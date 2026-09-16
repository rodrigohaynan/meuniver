import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const email = clean(body.email, 220).toLowerCase();
    const password = String(body.password ?? "");
    const fullName = clean(body.fullName, 160);
    const whatsapp = clean(body.whatsapp, 40);
    const state = clean(body.state, 2).toUpperCase();
    const city = clean(body.city, 120);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "A senha inicial precisa ter pelo menos 8 caracteres." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, whatsapp, state, city },
    });
    if (error || !data.user) throw new Error(error?.message ?? "Não foi possível criar o usuário.");

    await admin.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      email,
      whatsapp,
      state,
      city,
      updated_at: new Date().toISOString(),
    });

    await admin.from("admin_audit_log").insert({
      admin_user_id: adminUser.id,
      action: "user.create",
      entity_type: "user",
      entity_id: data.user.id,
      details: { email },
    });

    return NextResponse.json({ ok: true, id: data.user.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao criar usuário." }, { status: 500 });
  }
}
