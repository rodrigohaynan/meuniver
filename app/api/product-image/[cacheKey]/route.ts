import { captureProductImage } from "@/lib/product-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ cacheKey: string }> }) {
  const { cacheKey } = await params;
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(cacheKey)) {
    return new Response("Chave inválida.", { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const rawUrl = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!rawUrl) return new Response("Link não informado.", { status: 400, headers: { "Cache-Control": "no-store" } });

  try {
    const image = await captureProductImage(rawUrl);
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
    const message = error instanceof Error ? error.message : "Imagem indisponível.";
    return new Response(message, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
