import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function authenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ connected: false, error: "unauthorized" }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("marketplace_seller_accounts")
    .select("mercado_pago_user_id, expires_at, updated_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ connected: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    connected: Boolean(data),
    mercadoPagoUserId: data?.mercado_pago_user_id ?? null,
    expiresAt: data?.expires_at ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

export async function DELETE() {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("marketplace_seller_accounts")
    .delete()
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
