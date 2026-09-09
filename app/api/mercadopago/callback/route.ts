import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { exchangeAuthorizationCode } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

function paymentSettingsUrl(request: NextRequest, params?: Record<string, string>) {
  const url = new URL("/painel/pagamentos", request.url);
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  const returnedState = request.nextUrl.searchParams.get("state")?.trim();
  const expectedState = request.cookies.get("convniver_mp_state")?.value;
  const verifier = request.cookies.get("convniver_mp_verifier")?.value;

  if (!code || !returnedState || !expectedState || returnedState !== expectedState || !verifier) {
    return NextResponse.redirect(paymentSettingsUrl(request, { erro: "oauth" }));
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/entrar", request.url));

  try {
    const token = await exchangeAuthorizationCode(code, verifier);
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("marketplace_seller_accounts")
      .upsert({
        owner_id: user.id,
        mercado_pago_user_id: String(token.user_id ?? ""),
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        token_type: token.token_type ?? null,
        scope: token.scope ?? null,
        expires_at: expiresAt,
      }, { onConflict: "owner_id" });

    if (error) throw new Error(error.message);

    const response = NextResponse.redirect(paymentSettingsUrl(request, { conectado: "1" }));
    response.cookies.delete("convniver_mp_state");
    response.cookies.delete("convniver_mp_verifier");
    return response;
  } catch (error) {
    console.error("[CONVNIVER] Erro OAuth Mercado Pago:", error);
    return NextResponse.redirect(paymentSettingsUrl(request, { erro: "conexao" }));
  }
}
