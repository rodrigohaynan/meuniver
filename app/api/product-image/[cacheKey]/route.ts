import { captureProductImageFromUrl } from "@/lib/product-image";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ cacheKey: string }>;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeProductUrl(value: string | null | undefined) {
  const input = (value ?? "").trim().slice(0, 1000);
  if (!input) return "";
  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return "";
  }
}

function textResponse(message: string, status: number) {
  return new Response(message, { status, headers: NO_STORE_HEADERS });
}

/**
 * A rota só busca imagens de links que pertencem a um presente real:
 * - convidados: o link precisa ser o mesmo salvo no presente de um convite publicado;
 * - organizador: pode pré-visualizar um link ainda não salvo nos próprios presentes.
 * Isso impede o uso da rota como proxy aberto para qualquer URL da internet.
 */
async function isAllowedProductUrl(giftId: string, productUrl: string) {
  const supabase = await createServerSupabaseClient();

  // O RLS só devolve presentes de convites publicados ou do próprio organizador.
  const { data: gift } = await supabase
    .from("gifts")
    .select("invitation_id, suggestion_url")
    .eq("id", giftId)
    .maybeSingle();

  if (!gift) return false;
  if (normalizeProductUrl(gift.suggestion_url) === productUrl) return true;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: invitation } = await supabase
    .from("invitations")
    .select("owner_id")
    .eq("id", gift.invitation_id)
    .maybeSingle();

  return invitation?.owner_id === user.id;
}

export async function GET(request: Request, context: RouteContext) {
  // Cada presente/link recebe um caminho distinto (`<giftId>-<hash do link>`),
  // evitando que cache de navegador/CDN misture imagens de presentes diferentes.
  const { cacheKey } = await context.params;
  const giftId = decodeURIComponent(cacheKey).slice(0, 36);
  if (!UUID.test(giftId)) return textResponse("Presente inválido.", 400);

  const productUrl = normalizeProductUrl(new URL(request.url).searchParams.get("url"));
  if (!productUrl) return textResponse("Link não informado.", 400);

  try {
    if (!(await isAllowedProductUrl(giftId, productUrl))) {
      return textResponse("Imagem do anúncio indisponível.", 404);
    }

    const captured = await captureProductImageFromUrl(productUrl);
    return new Response(await captured.blob.arrayBuffer(), {
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": captured.blob.type || "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return textResponse("Imagem do anúncio indisponível.", 404);
  }
}
