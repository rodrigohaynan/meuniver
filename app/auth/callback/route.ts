import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Aceita apenas caminhos internos ("/painel", "/redefinir-senha"...).
// Bloqueia "//dominio.com", "/\\dominio.com", URLs absolutas e variações (open redirect).
function safeNextPath(value: string | null, origin: string) {
  if (!value || !value.startsWith("/")) return "/painel";
  try {
    // O parser de URL remove tabs/quebras de linha ("/\t/evil.com" vira
    // "//evil.com"), então a checagem definitiva é pela origem resolvida.
    const resolved = new URL(value, origin);
    if (resolved.origin !== origin) return "/painel";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/painel";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), url.origin);

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/entrar?erro=oauth", url.origin));
}
