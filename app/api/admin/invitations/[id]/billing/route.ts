import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["free", "pending", "paid", "exempt", "refunded"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const status = String(body.status ?? "");
    const amount = Number(body.amount ?? 0);
    const note = String(body.note ?? "").trim().slice(0, 500);

    if (!ALLOWED.has(status)) return NextResponse.json({ error: "Status financeiro inválido." }, { status: 400 });
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });

    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("invitations").update({
      billing_status: status,
      billing_amount: amount,
      billing_note: note,
      billing_paid_at: status === "paid" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) throw new Error(error.message);

    await admin.from("admin_audit_log").insert({
      admin_user_id: adminUser.id,
      action: "invitation.billing.update",
      entity_type: "invitation",
      entity_id: id,
      details: { status, amount, note },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao alterar cobrança." }, { status: 500 });
  }
}
