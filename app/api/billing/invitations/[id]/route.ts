import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createBillingPix,
  isReusablePending,
  latestBillingPayment,
  publicBillingPayment,
  syncBillingPayment,
} from "@/lib/billing";
import { isValidCpf, onlyDigits } from "@/lib/cpf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

async function ownedInvitation(id: string) {
  if (!UUID.test(id)) return { error: NextResponse.json({ error: "Convite inválido." }, { status: 400 }) };

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 }) };

  const admin = createAdminSupabaseClient();
  const { data: invitation, error } = await admin
    .from("invitations")
    .select("id, owner_id, event_title, host_name, billing_status, billing_amount")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invitation || invitation.owner_id !== user.id) {
    return { error: NextResponse.json({ error: "Convite não encontrado." }, { status: 404 }) };
  }
  return { user, invitation };
}

/** Situação da cobrança da publicação (consultada a cada poucos segundos pela tela). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await ownedInvitation(id);
    if ("error" in result) return result.error;

    let payment = await latestBillingPayment(id);
    if (payment && payment.payment_status === "pending") {
      try {
        payment = await syncBillingPayment(payment);
      } catch (error) {
        console.error("[Convidata] Falha ao consultar pagamento da publicação:", error);
      }
    }

    const { data: fresh } = await createAdminSupabaseClient()
      .from("invitations")
      .select("billing_status, billing_amount")
      .eq("id", id)
      .maybeSingle();

    return NextResponse.json({
      billingStatus: fresh?.billing_status ?? result.invitation.billing_status,
      amount: Number(fresh?.billing_amount ?? result.invitation.billing_amount ?? 0),
      payment: payment ? publicBillingPayment(payment) : null,
    });
  } catch (error) {
    console.error("[Convidata] Erro ao consultar cobrança:", error);
    return NextResponse.json({ error: "Não foi possível consultar o pagamento." }, { status: 500 });
  }
}

/** Gera (ou reaproveita) o PIX para liberar a publicação do convite. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await ownedInvitation(id);
    if ("error" in result) return result.error;
    const { user, invitation } = result;

    const amount = Number(invitation.billing_amount ?? 0);
    if (invitation.billing_status !== "pending" || amount <= 0) {
      return NextResponse.json({ ok: true, billingStatus: invitation.billing_status, payment: null });
    }

    const body = await request.json().catch(() => ({}));
    const payerCpf = onlyDigits(body?.payerCpf);
    if (!isValidCpf(payerCpf)) {
      return NextResponse.json({ error: "Informe um CPF válido para gerar o PIX." }, { status: 400 });
    }

    const current = await latestBillingPayment(id);
    if (isReusablePending(current, amount) && current) {
      return NextResponse.json({ ok: true, billingStatus: "pending", payment: publicBillingPayment(current) });
    }

    const fullName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim();
    const payment = await createBillingPix({
      invitationId: invitation.id,
      ownerId: user.id,
      amount,
      description: `Publicação de convite Convidata - ${invitation.event_title || invitation.host_name || "convite"}`,
      payerEmail: user.email ?? "",
      payerName: fullName.split(" ")[0] || (user.email ?? "Organizador").split("@")[0],
      payerCpf,
    });

    return NextResponse.json({
      ok: true,
      billingStatus: payment.payment_status === "approved" ? "paid" : "pending",
      payment: publicBillingPayment(payment),
    });
  } catch (error) {
    console.error("[Convidata] Erro ao gerar PIX da publicação:", error);
    const message = error instanceof Error && error.message.startsWith("Pagamento da publicação indisponível")
      ? error.message
      : "Não foi possível gerar o PIX agora. Tente novamente em instantes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
