import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createMercadoPagoPixPayment, getSellerAccessToken } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const numbers = value.split("").map(Number);
  const check = (factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i += 1) total += numbers[i] * (factor - i);
    const result = (total * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return check(10) === numbers[9] && check(11) === numbers[10];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const invitationId = String(body?.invitationId ?? "").trim();
    const guestName = String(body?.guestName ?? "").trim().replace(/\s+/g, " ");
    const guestEmail = String(body?.guestEmail ?? "").trim().toLowerCase();
    const guestWhatsapp = onlyDigits(body?.guestWhatsapp).slice(0, 13);
    const payerCpf = onlyDigits(body?.payerCpf);
    const amount = money(Number(body?.amount));

    if (!invitationId || guestName.length < 2) {
      return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(guestEmail)) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (!validCpf(payerCpf)) {
      return NextResponse.json({ error: "Informe um CPF válido para gerar o PIX." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 5 || amount > 10000) {
      return NextResponse.json({ error: "O presente em PIX deve ficar entre R$ 5,00 e R$ 10.000,00." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: invitation, error: invitationError } = await admin
      .from("invitations")
      .select("id, owner_id, event_title, host_name, status, pix_gift_enabled")
      .eq("id", invitationId)
      .eq("status", "published")
      .maybeSingle();

    if (invitationError) throw new Error(invitationError.message);
    if (!invitation || invitation.pix_gift_enabled !== true) {
      return NextResponse.json({ error: "Presentes em PIX não estão disponíveis neste convite." }, { status: 404 });
    }

    const accessToken = await getSellerAccessToken(invitation.owner_id);
    const giftId = randomUUID();
    const platformFee = money(amount * 0.05);

    const { error: createError } = await admin.from("cash_gifts").insert({
      id: giftId,
      invitation_id: invitation.id,
      owner_id: invitation.owner_id,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_whatsapp: guestWhatsapp,
      amount,
      platform_fee: platformFee,
      payment_status: "creating",
    });

    if (createError) throw new Error(createError.message);

    try {
      const payment = await createMercadoPagoPixPayment({
        accessToken,
        idempotencyKey: giftId,
        externalReference: giftId,
        amount,
        applicationFee: platformFee,
        description: `Presente CONVNIVER - ${invitation.host_name || invitation.event_title || "convite"}`,
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
        platformFee,
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
    console.error("[CONVNIVER] Erro ao criar presente PIX:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar o PIX." },
      { status: 500 },
    );
  }
}
