import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildMercadoPagoAuthorizationUrl, createPkcePair } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }

  const state = randomUUID();
  const { verifier, challenge } = createPkcePair();
  const authorizationUrl = buildMercadoPagoAuthorizationUrl(state, challenge);
  const response = NextResponse.redirect(authorizationUrl);

  response.cookies.set("convniver_mp_state", state, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  response.cookies.set("convniver_mp_verifier", verifier, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
