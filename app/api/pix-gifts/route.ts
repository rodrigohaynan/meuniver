import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createMercadoPagoPixPayment, getSellerAccessToken } from "@/lib/mercadopago";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import {
  PIX_GIFT_MAX,
  PIX_GIFT_MIN,
  computePixGiftCharge,
  normalizePixFeeConfig,
  roundMoney,
} from "@/lib/pix-fees";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadPixFeeConfig() {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("site_settings")
    .select("pix_platform_fee_percent, pix_fee_paid_by")
    .eq("id", true)
    .maybeSingle();
  return normalizePixFeeConfig(data?.pix_platform_fee_percent ?? 0, data?.pix_fee_paid_by ?? "guest");
}

/** Configuração pública da taxa, para o convidado ver o total antes de gerar o PIX. */
export async function GET() {
  try {
    const config = await loadPixFeeConfig();
    return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ percent: 0, paidBy: "guest" }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const invitationId = String(body?.invitationId ?? "").trim();
    const guestName = String(body?.guestName ?? "").trim().replace(/\s+/g, " ");
    const guestEmail = String(body?.guestEmail ?? "").trim().toLowerCase();
    const guestWhatsapp = onlyDigits(body?.guestWhatsapp).slice(0, 13);
    const payerCpf = onlyDigits(body?.payerCpf);
    const amount = roundMoney(Number(body?.amount));

    if (!invitationId || guestName.length < 2) {
      return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(guestEmail)) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (!isValidCpf(payerCpf)) {
      return NextResponse.json({ error: "Informe um CPF válido para gerar o PIX." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < PIX_GIFT_MIN || amount > PIX_GIFT_MAX) {
      return NextResponse.json({ error: "O presente em PIX deve ficar entre R$ 5,00 e R$ 10.000,00." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const [{ data: invitation, error: invitationError }, feeConfig] = await Promise.all([
      admin
        .from("invitations")
        .select("id, owner_id, event_title, host_name, status, pix_gift_enabled")
        .eq("id", invitationId)
        .eq("status", "published")
        .maybeSingle(),
      loadPixFeeConfig(),
    ]);

    if (invitationError) throw new Error(invitationError.message);
    if (!invitation || invitation.pix_gift_enabled !== true) {
      return NextResponse.json({ error: "Presentes em PIX não estão disponíveis neste convite." }, { status: 404 });
    }

    const accessToken = await getSellerAccessToken(invitation.owner_id);
    const giftId = randomUUID();
    // Taxa da Convidata: somada ao valor pago pelo convidado (padrão) ou descontada do organizador.
    const charge = computePixGiftCharge(amount, feeConfig);
    const platformFee = charge.fee;

    const { error: createError } = await admin.from("cash_gifts").insert({
      id: giftId,
      invitation_id: invitation.id,
      owner_id: invitation.owner_id,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_whatsapp: guestWhatsapp,
      amount,
      charged_amount: charge.total,
      fee_paid_by: charge.paidBy,
      platform_fee: platformFee,
      payment_status: "creating",
    });

    if (createError) throw new Error(createError.message);

    try {
      const payment = await createMercadoPagoPixPayment({
        accessToken,
        idempotencyKey: giftId,
        externalReference: giftId,
        amount: charge.total,
        applicationFee: platformFee,
        description: `Presente Convidata - ${invitation.host_name || invitation.event_title || "convite"}`,
        payerEmail: guestEmail,
        payerName: guestName.split(" ")[0] || guestName,
        payerCpf,
      });

      const transactionData = payment?.point_of_interaction?.transaction_data ?? {};
      const paymentId = String(payment.id);
      const paymentStatus = String(payment.status ?? "pending");
      const qrCode = transactionData.qr_code ?? null;
      const qrCodeBase64 = transactionData.qr_code_base64 ?? null;
      const ticketUrl = transactionData.ticket_url ?? null;

      const { error: updateError } = await admin
        .from("cash_gifts")
        .update({
          payment_id: paymentId,
          payment_status: paymentStatus,
          qr_code: qrCode,
          qr_code_base64: qrCodeBase64,
          ticket_url: ticketUrl,
        })
        .eq("id", giftId);

      if (updateError) throw new Error(updateError.message);

      return NextResponse.json({
        ok: true,
        giftId,
        paymentId,
        status: paymentStatus,
        amount,
        total: charge.total,
        platformFee,
        platformFeePercent: charge.percent,
        feePaidBy: charge.paidBy,
        qrCode,
        qrCodeBase64,
        ticketUrl,
      });
    } catch (error) {
      await admin
        .from("cash_gifts")
        .update({ payment_status: "failed" })
        .eq("id", giftId);
      throw error;
    }
  } catch (error) {
    console.error("[Convidata] Erro ao criar presente PIX:", error);
    // Mensagens internas (banco, Mercado Pago) ficam só no log do servidor.
    const message = error instanceof Error && error.message.startsWith("O organizador ainda não conectou")
      ? "Este convite ainda não está recebendo presentes em PIX."
      : "Não foi possível gerar o PIX agora. Tente novamente em instantes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
