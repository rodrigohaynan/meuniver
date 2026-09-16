import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const email = clean(body.email, 220).toLowerCase();
    const password = String(body.password ?? "");
    const fullName = clean(body.fullName, 160);
    const whatsapp = clean(body.whatsapp, 40);
    const state = clean(body.state, 2).toUpperCase();
    const city = clean(body.city, 120);

    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    if (password && password.length < 8) return NextResponse.json({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, { status: 400 });

    const admin = createAdminSupabaseClient();
    const authUpdate: { email: string; password?: string; user_metadata: Record<string, string> } = {
      email,
      user_metadata: { full_name: fullName, whatsapp, state, city },
    };
    if (password) authUpdate.password = password;

    const { error } = await admin.auth.admin.updateUserById(id, authUpdate);
    if (error) throw new Error(error.message);

    const { error: profileError } = await admin.from("profiles").upsert({
      id,
      full_name: fullName,
      email,
      whatsapp,
      state,
      city,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw new Error(profileError.message);

    await admin.from("admin_audit_log").insert({
      admin_user_id: adminUser.id,
      action: "user.update",
      entity_type: "user",
      entity_id: id,
      details: { email, password_changed: Boolean(password) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao atualizar usuário." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  if (id === adminUser.id) {
    return NextResponse.json({ error: "A conta administrativa atual não pode ser excluída por esta tela." }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { data: userData } = await admin.auth.admin.getUserById(id);
    const email = userData.user?.email ?? "";

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);

    await admin.from("admin_audit_log").insert({
      admin_user_id: adminUser.id,
      action: "user.delete",
      entity_type: "user",
      entity_id: id,
      details: { email },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao excluir usuário." }, { status: 500 });
  }
}
