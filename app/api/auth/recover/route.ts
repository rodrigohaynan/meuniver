import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  return host ? `${proto}://${host}` : url.origin;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";

  if (!email) {
    return NextResponse.json({ ok: false, error: "Informe seu e-mail." }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const origin = requestOrigin(request);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Não foi possível enviar o link de recuperação." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Se esse e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Verifique também a pasta de spam.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Não foi possível conectar ao serviço de recuperação. Tente novamente." },
      { status: 503 },
    );
  }
}
