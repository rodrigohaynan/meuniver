import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // /c/* é público. Não deve passar pela renovação de sessão do Supabase,
    // porque crawlers do WhatsApp/Facebook/Instagram não precisam de login e
    // podem desistir da prévia se houver uma chamada extra de autenticação.
    "/((?!_next/static|_next/image|favicon.ico|c(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
