import { NextResponse } from "next/server";
import { billingPaymentByMercadoPagoId, syncBillingPayment } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Notificações do Mercado Pago sobre os PIX de publicação.
// O conteúdo recebido nunca é confiado: o status é sempre consultado de novo na
// API do Mercado Pago com o token da Convidata antes de liberar qualquer convite.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));

  const type = String(body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
  const paymentId = String(body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "").trim();

  if (type !== "payment" || !/^\d{1,30}$/.test(paymentId)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const record = await billingPaymentByMercadoPagoId(paymentId);
    if (record) await syncBillingPayment(record);
  } catch (error) {
    console.error("[Convidata] Erro ao processar notificação de pagamento:", error);
    // 500 faz o Mercado Pago tentar novamente mais tarde.
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
