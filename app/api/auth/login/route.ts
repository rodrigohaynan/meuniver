import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Informe e-mail e senha." }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: /fetch failed|failed to fetch/i.test(error.message)
            ? "O serviço de acesso está temporariamente indisponível. Tente novamente em alguns instantes."
            : "E-mail ou senha incorretos.",
        },
        { status: /fetch failed|failed to fetch/i.test(error.message) ? 503 : 400 },
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Não foi possível conectar ao serviço de acesso. Tente novamente." },
      { status: 503 },
    );
  }
}
