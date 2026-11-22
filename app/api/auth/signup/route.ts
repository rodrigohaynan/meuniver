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
  const password = typeof payload?.password === "string" ? payload.password : "";
  const fullName = typeof payload?.fullName === "string" ? payload.fullName.trim().replace(/\s+/g, " ") : "";
  const sex = typeof payload?.sex === "string" ? payload.sex : "";
  const birthDate = typeof payload?.birthDate === "string" ? payload.birthDate : "";
  const state = typeof payload?.state === "string" ? payload.state : "";
  const city = typeof payload?.city === "string" ? payload.city : "";
  const whatsapp = typeof payload?.whatsapp === "string" ? payload.whatsapp.replace(/\D/g, "") : "";

  if (!email || password.length < 6 || fullName.length < 3 || !sex || !birthDate || !state || !city || whatsapp.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Revise os dados obrigatórios do cadastro." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const origin = requestOrigin(request);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          sex,
          birth_date: birthDate,
          state,
          city,
          whatsapp,
        },
        emailRedirectTo: `${origin}/auth/callback?next=/painel`,
      },
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: /fetch failed|failed to fetch/i.test(error.message)
            ? "O serviço de acesso está temporariamente indisponível. Tente novamente em alguns instantes."
            : (error.message || "Não foi possível criar a conta."),
        },
        { status: /fetch failed|failed to fetch/i.test(error.message) ? 503 : 400 },
      );
    }

    return NextResponse.json(
      { ok: true, hasSession: Boolean(data.session) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Não foi possível conectar ao serviço de cadastro. Tente novamente." },
      { status: 503 },
    );
  }
}
