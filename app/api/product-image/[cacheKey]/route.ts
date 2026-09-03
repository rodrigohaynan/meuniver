import { captureProductImageFromUrl } from "@/lib/product-image";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ cacheKey: string }>;
};

function normalizeProductUrl(value: string) {
  const input = value.trim().slice(0, 1000);
  if (!input) return "";
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

export async function GET(request: Request, context: RouteContext) {
  // Igual ao convite da Liene: cada presente/link recebe um caminho distinto,
  // evitando que cache de navegador/CDN misture imagens de presentes diferentes.
  await context.params;

  const rawUrl = new URL(request.url).searchParams.get("url") ?? "";
  const productUrl = normalizeProductUrl(rawUrl);
  if (!productUrl) {
    return new Response("Link não informado.", {
      status: 400,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  try {
    const captured = await captureProductImageFromUrl(productUrl);
    return new Response(await captured.blob.arrayBuffer(), {
      headers: {
        "Content-Type": captured.blob.type || "image/jpeg",
        "Cache-Control": "no-store, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Netlify-CDN-Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Imagem do anúncio indisponível.", {
      status: 404,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Netlify-CDN-Cache-Control": "no-store",
      },
    });
  }
}
