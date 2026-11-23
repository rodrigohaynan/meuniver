import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createMercadoPagoPixPayment, getMercadoPagoPayment } from "@/lib/mercadopago";
import { roundMoney } from "@/lib/pix-fees";

// Cobrança da publicação do convite: o organizador paga um PIX direto para a
// conta Mercado Pago da própria Convidata (sem marketplace/OAuth).

export type BillingPaymentRecord = {
  id: string;
  invitation_id: string;
  owner_id: string;
  amount: number;
  payment_id: string | null;
  payment_status: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
};

const BILLING_COLUMNS =
  "id, invitation_id, owner_id, amount, payment_id, payment_status, qr_code, qr_code_base64, ticket_url, expires_at, paid_at, created_at";

const FINAL_STATUSES = ["approved", "rejected", "cancelled", "refunded", "charged_back", "failed"];
const PIX_VALIDITY_MINUTES = 30;

export function platformAccessToken() {
  const token = process.env.MERCADO_PAGO_PLATFORM_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Pagamento da publicação indisponível no momento. A Convidata ainda não configurou o recebimento por PIX.",
    );
  }
  return token;
}

function webhookUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return undefined;
  try {
    const url = new URL("/api/billing/webhook", appUrl);
    // O Mercado Pago só aceita notificações em HTTPS público.
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function publicBillingPayment(record: BillingPaymentRecord) {
  return {
    id: record.id,
    status: record.payment_status,
    approved: record.payment_status === "approved",
    amount: Number(record.amount),
    qrCode: record.qr_code,
    qrCodeBase64: record.qr_code_base64,
    ticketUrl: record.ticket_url,
    expiresAt: record.expires_at,
  };
}

export async function latestBillingPayment(invitationId: string) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("invitation_billing_payments")
    .select(BILLING_COLUMNS)
    .eq("invitation_id", invitationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BillingPaymentRecord | null) ?? null;
}

/** Reaproveita um PIX pendente ainda válido, para não gerar cobranças duplicadas. */
export function isReusablePending(record: BillingPaymentRecord | null, amount: number) {
  if (!record || record.payment_status !== "pending" || !record.qr_code) return false;
  if (Number(record.amount) !== Number(amount)) return false;
  if (!record.expires_at) return false;
  return new Date(record.expires_at).getTime() - Date.now() > 2 * 60 * 1000;
}

export async function createBillingPix({
  invitationId,
  ownerId,
  amount,
  description,
  payerEmail,
  payerName,
  payerCpf,
}: {
  invitationId: string;
  ownerId: string;
  amount: number;
  description: string;
  payerEmail: string;
  payerName: string;
  payerCpf: string;
}) {
  const accessToken = platformAccessToken();
  const admin = createAdminSupabaseClient();
  const value = roundMoney(amount);
  const expiresAt = new Date(Date.now() + PIX_VALIDITY_MINUTES * 60 * 1000);

  const { data: created, error: createError } = await admin
    .from("invitation_billing_payments")
    .insert({
      invitation_id: invitationId,
      owner_id: ownerId,
      amount: value,
      payment_status: "creating",
      expires_at: expiresAt.toISOString(),
    })
    .select(BILLING_COLUMNS)
    .single();
  if (createError || !created) throw new Error(createError?.message || "Não foi possível registrar a cobrança.");

  const record = created as BillingPaymentRecord;

  try {
    const payment = await createMercadoPagoPixPayment({
      accessToken,
      idempotencyKey: record.id,
      externalReference: `billing:${record.id}`,
      amount: value,
      description,
      payerEmail,
      payerName,
      payerCpf,
      notificationUrl: webhookUrl(),
      expiresAt,
    });

    const transactionData = payment?.point_of_interaction?.transaction_data ?? {};
    const { data: updated, error: updateError } = await admin
      .from("invitation_billing_payments")
      .update({
        payment_id: String(payment.id),
        // "approved" só é gravado depois de liberar o convite (applyApprovedPayment).
        payment_status: payment.status === "approved" ? "pending" : String(payment.status ?? "pending"),
        qr_code: transactionData.qr_code ?? null,
        qr_code_base64: transactionData.qr_code_base64 ?? null,
        ticket_url: transactionData.ticket_url ?? null,
      })
      .eq("id", record.id)
      .select(BILLING_COLUMNS)
      .single();
    if (updateError || !updated) throw new Error(updateError?.message || "Não foi possível salvar o PIX.");

    const saved = updated as BillingPaymentRecord;
    if (payment.status === "approved") return await applyApprovedPayment(saved, payment);
    return saved;
  } catch (error) {
    await admin.from("invitation_billing_payments").update({ payment_status: "failed" }).eq("id", record.id);
    throw error;
  }
}

type MercadoPagoPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  date_approved?: string | null;
};

async function applyApprovedPayment(record: BillingPaymentRecord, payment: MercadoPagoPayment) {
  const admin = createAdminSupabaseClient();
  const paidAmount = Number(payment.transaction_amount ?? 0);

  // Só libera se o pagamento for exatamente desta cobrança e do valor esperado.
  if (payment.external_reference !== `billing:${record.id}` || paidAmount + 0.001 < Number(record.amount)) {
    throw new Error("Pagamento não confere com a cobrança do convite.");
  }

  const paidAt = payment.date_approved || new Date().toISOString();

  // Primeiro libera o convite (service role: o gatilho de proteção financeira
  // permite). Se falhar, o registro continua pendente e a próxima consulta tenta de novo.
  const { error: invitationError } = await admin
    .from("invitations")
    .update({
      billing_status: "paid",
      billing_paid_at: paidAt,
      billing_note: `Pago via PIX (Mercado Pago ${payment.id})`,
    })
    .eq("id", record.invitation_id)
    .eq("billing_status", "pending");
  if (invitationError) throw new Error(invitationError.message);

  const { data: updated, error } = await admin
    .from("invitation_billing_payments")
    .update({ payment_status: "approved", paid_at: paidAt })
    .eq("id", record.id)
    .select(BILLING_COLUMNS)
    .single();
  if (error || !updated) throw new Error(error?.message || "Não foi possível registrar o pagamento.");

  return updated as BillingPaymentRecord;
}

/** Consulta o Mercado Pago e aplica o resultado (usado no polling e no webhook). */
export async function syncBillingPayment(record: BillingPaymentRecord) {
  if (!record.payment_id || FINAL_STATUSES.includes(record.payment_status)) return record;

  const payment = (await getMercadoPagoPayment(platformAccessToken(), record.payment_id)) as MercadoPagoPayment;
  const status = String(payment?.status ?? record.payment_status);

  if (status === "approved") return applyApprovedPayment(record, payment);
  if (status === record.payment_status) return record;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("invitation_billing_payments")
    .update({ payment_status: status })
    .eq("id", record.id)
    .select(BILLING_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message || "Não foi possível atualizar o pagamento.");
  return data as BillingPaymentRecord;
}

export async function billingPaymentByMercadoPagoId(paymentId: string) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("invitation_billing_payments")
    .select(BILLING_COLUMNS)
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BillingPaymentRecord | null) ?? null;
}
