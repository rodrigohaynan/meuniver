import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "A nova senha precisa ter pelo menos 6 caracteres." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Este link de recuperação expirou ou não é mais válido. Solicite um novo link." },
        { status: 401 },
      );
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: /fetch failed|failed to fetch/i.test(error.message)
            ? "O serviço de acesso está temporariamente indisponível. Tente novamente em alguns instantes."
            : (error.message || "Não foi possível alterar a senha."),
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
