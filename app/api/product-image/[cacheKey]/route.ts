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
  return url;
}

function validateImageUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("A imagem encontrada possui um endereço inválido.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("A imagem encontrada possui um endereço inválido.");
  }
  if (url.username || url.password) throw new Error("A imagem encontrada não é permitida.");

  // Evita mixed content em URLs antigas de CDN que ainda venham com http.
  if (url.protocol === "http:") url.protocol = "https:";
  return url.toString();
}

async function resolveImageWithMicrolink(rawUrl: string) {
  const productUrl = validateProductUrl(rawUrl);
  const metadataUrl = new URL("https://api.microlink.io/");
  metadataUrl.searchParams.set("url", productUrl.toString());
  metadataUrl.searchParams.set("filter", "image.url");
  metadataUrl.searchParams.set("cache", "false");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(metadataUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; MeuConvite/1.0)",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A leitura do anúncio demorou demais.");
    }
    throw new Error("Não foi possível consultar os metadados do anúncio.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`O serviço de imagem respondeu com erro (${response.status}).`);
  }

  const payload = (await response.json()) as {
    status?: string;
    data?: { image?: string | { url?: string } };
  };
  const image = payload.data?.image;
  const imageUrl = typeof image === "string" ? image : image?.url;
  if (!imageUrl) throw new Error("O anúncio não disponibilizou uma imagem principal.");
  return validateImageUrl(imageUrl);
}

export async function GET(request: Request, { params }: { params: Promise<{ cacheKey: string }> }) {
  const { cacheKey } = await params;
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(cacheKey)) {
    return new Response("Chave inválida.", { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url")?.trim() ?? "";
  const wantsJson = requestUrl.searchParams.get("format") === "json";
  if (!rawUrl) return new Response("Link não informado.", { status: 400, headers: { "Cache-Control": "no-store" } });

  try {
    const imageUrl = await resolveImageWithMicrolink(rawUrl);
    if (wantsJson) {
      return Response.json(
        { imageUrl },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    return Response.redirect(imageUrl, 307);
  } catch (metadataError) {
    if (wantsJson) {
      const message = metadataError instanceof Error ? metadataError.message : "Imagem indisponível.";
      return Response.json({ error: message }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    // Fallback legado para outros sites que funcionam bem com extração direta.
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
    } catch (fallbackError) {
      const first = metadataError instanceof Error ? metadataError.message : "Falha ao consultar metadados.";
      const second = fallbackError instanceof Error ? fallbackError.message : "Falha na captura direta.";
      return new Response(`${first} ${second}`, {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  }
}
