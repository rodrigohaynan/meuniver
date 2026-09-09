import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMercadoPagoPayment, getSellerAccessToken } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const { data: gift, error } = await admin
    .from("cash_gifts")
    .select("id, owner_id, payment_id, payment_status, qr_code, qr_code_base64, ticket_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!gift) return NextResponse.json({ error: "Presente não encontrado." }, { status: 404 });

  if (!gift.payment_id || ["approved", "rejected", "cancelled", "refunded", "failed"].includes(gift.payment_status)) {
    return NextResponse.json({
      status: gift.payment_status,
      approved: gift.payment_status === "approved",
      qrCode: gift.qr_code,
      qrCodeBase64: gift.qr_code_base64,
      ticketUrl: gift.ticket_url,
    });
  }

  try {
    const accessToken = await getSellerAccessToken(gift.owner_id);
    const payment = await getMercadoPagoPayment(accessToken, gift.payment_id);
    const status = String(payment?.status ?? gift.payment_status);

    if (status !== gift.payment_status) {
      await admin.from("cash_gifts").update({ payment_status: status }).eq("id", gift.id);
    }

    return NextResponse.json({
      status,
      approved: status === "approved",
      qrCode: gift.qr_code,
      qrCodeBase64: gift.qr_code_base64,
      ticketUrl: gift.ticket_url,
    });
  } catch (error) {
    return NextResponse.json({
      status: gift.payment_status,
      approved: gift.payment_status === "approved",
      warning: error instanceof Error ? error.message : "Não foi possível atualizar o status.",
      qrCode: gift.qr_code,
      qrCodeBase64: gift.qr_code_base64,
      ticketUrl: gift.ticket_url,
    });
  }
}
