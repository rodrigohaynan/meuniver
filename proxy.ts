import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * /c/* = convite público real
     * /s/* = página pública ultraleve usada pelos crawlers de compartilhamento
     *
     * Nenhuma das duas deve passar pela renovação de sessão do Supabase.
     */
    "/((?!_next/static|_next/image|favicon.ico|c(?:/|$)|s(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
