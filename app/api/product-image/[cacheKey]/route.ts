import { captureProductImage } from "@/lib/product-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateProductUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Link de sugestão inválido.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("O link precisa usar http ou https.");
  }
  if (url.username || url.password) throw new Error("O link informado não é permitido.");
  return url.toString();
}

export async function GET(request: Request, { params }: { params: Promise<{ cacheKey: string }> }) {
  const { cacheKey } = await params;
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(cacheKey)) {
    return new Response("Chave inválida.", { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url")?.trim() ?? "";
  if (!rawUrl) return new Response("Link não informado.", { status: 400, headers: { "Cache-Control": "no-store" } });

  try {
    const productUrl = validateProductUrl(rawUrl);
    const image = await captureProductImage(productUrl);
    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "no-store, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Netlify-CDN-Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível obter a imagem do anúncio.";
    return new Response(message, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
