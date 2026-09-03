import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";
const SOCIAL_PREVIEW_USER_AGENTS = [
  "WhatsApp/2.23.20.0",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Facebot",
] as const;
const MAX_REDIRECTS = 5;
const PAGE_TIMEOUT_MS = 10_000;
const IMAGE_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 3_000_000;
const MAX_IMAGE_BYTES = 7_000_000;

type CapturedProductImage = {
  blob: Blob;
  sourceUrl: string;
};

function blockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function blockedIpv6(address: string) {
  const value = address.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice(7);
    if (isIP(mapped) === 4) return blockedIpv4(mapped);
  }

  const firstGroup = value.split(":")[0];
  const first = Number.parseInt(firstGroup || "0", 16);
  if (!Number.isFinite(first)) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xff00) === 0xff00) return true;
  return false;
}

function blockedIp(address: string) {
  const version = isIP(address);
  if (version === 4) return blockedIpv4(address);
  if (version === 6) return blockedIpv6(address);
  return true;
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("O link precisa usar http ou https.");
  }
  if (url.username || url.password) {
    throw new Error("O link informado não é permitido.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("O link precisa apontar para um site público.");
  }

  if (isIP(hostname)) {
    if (blockedIp(hostname)) throw new Error("O link precisa apontar para um site público.");
    return;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Não foi possível localizar o site desse link.");
  }
  if (!addresses.length || addresses.some((entry) => blockedIp(entry.address))) {
    throw new Error("O link precisa apontar para um site público.");
  }
}

async function fetchPublic(
  initialUrl: URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicUrl(currentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        ...init,
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("O site demorou demais para responder.");
      }
      throw new Error("Não foi possível acessar o link informado.");
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) throw new Error("O anúncio redirecionou para um endereço inválido.");
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error("O anúncio fez redirecionamentos demais.");
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new Error("O conteúdo encontrado é grande demais para importar.");

  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("O conteúdo encontrado é grande demais para importar.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function htmlDecode(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function tagAttribute(tag: string, name: string) {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = tag.match(pattern);
  return htmlDecode((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim());
}

function firstImageFromJsonLd(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstImageFromJsonLd(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const direct = record.image;
  if (typeof direct === "string") return direct;
  if (Array.isArray(direct)) {
    for (const item of direct) {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const candidate = (item as Record<string, unknown>).url ?? (item as Record<string, unknown>).contentUrl;
        if (typeof candidate === "string") return candidate;
      }
    }
  }
  if (direct && typeof direct === "object") {
    const candidate = (direct as Record<string, unknown>).url ?? (direct as Record<string, unknown>).contentUrl;
    if (typeof candidate === "string") return candidate;
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      const found = firstImageFromJsonLd(nested);
      if (found) return found;
    }
  }
  return null;
}


function marketplaceImageScore(url: URL) {
  const host = url.hostname.toLowerCase();
  const path = decodeURIComponent(url.pathname).toLowerCase();
  let score = 0;

  if (host.endsWith("mlstatic.com")) score += 30;
  if (/\/d_nq_np/i.test(url.pathname)) score += 90;
  else if (/\/d_nq_/i.test(url.pathname)) score += 60;
  if (/_2x_/i.test(url.pathname)) score += 20;

  if (
    path.includes("frontend-assets") ||
    path.includes("logo") ||
    path.includes("icon") ||
    path.includes("placeholder") ||
    path.includes("handshake") ||
    path.includes("social")
  ) {
    score -= 200;
  }

  return score;
}

function embeddedMercadoLivreImages(html: string) {
  const normalized = html
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");

  const matches =
    normalized.match(
      /https?:\/\/[a-z0-9.-]*mlstatic\.com\/D_NQ_[^"'\\\s<>]+?\.(?:webp|jpe?g|png|avif)/gi,
    ) ?? [];

  return [...new Set(matches)];
}

function extractCanonicalPageUrl(html: string, pageUrl: URL) {
  const candidates: string[] = [];

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = tagAttribute(tag, "rel")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const href = tagAttribute(tag, "href");
    if (rel.includes("canonical") && href) candidates.push(href);
  }

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (tagAttribute(tag, "property") || tagAttribute(tag, "name")).toLowerCase();
    const content = tagAttribute(tag, "content");
    if (key === "og:url" && content) candidates.push(content);
  }

  for (const candidate of candidates) {
    try {
      const resolved = new URL(htmlDecode(candidate), pageUrl);
      const host = resolved.hostname.toLowerCase();
      if (
        (host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br")) &&
        resolved.protocol === "https:"
      ) {
        resolved.hash = "";
        return resolved;
      }
    } catch {
      // Continua procurando outra URL canônica.
    }
  }

  return null;
}


function looksInstitutionalImage(url: URL) {
  const value = decodeURIComponent(`${url.hostname}${url.pathname}${url.search}`).toLowerCase();
  return (
    value.includes("frontend-assets") ||
    value.includes("logo") ||
    value.includes("icon") ||
    value.includes("placeholder") ||
    value.includes("handshake") ||
    value.includes("social") ||
    value.includes("default") ||
    value.includes("brand")
  );
}

function isLikelyOpenGraphProductImage(url: URL, pageUrl: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (looksInstitutionalImage(url)) return false;

  const pageHost = pageUrl.hostname.toLowerCase();
  const imageHost = url.hostname.toLowerCase();
  const isMercadoLivre =
    pageHost === "mercadolivre.com.br" ||
    pageHost.endsWith(".mercadolivre.com.br") ||
    pageHost === "meli.la" ||
    pageHost.endsWith(".meli.la");

  if (isMercadoLivre) {
    return imageHost.endsWith("mlstatic.com") && /\/D_NQ_/i.test(url.pathname);
  }

  return true;
}

function extractOpenGraphProductImage(html: string, pageUrl: URL) {
  const values = new Map<string, string>();

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (tagAttribute(tag, "property") || tagAttribute(tag, "name")).toLowerCase();
    const content = tagAttribute(tag, "content");
    if (key && content && !values.has(key)) values.set(key, content);
  }

  for (const key of [
    "og:image:secure_url",
    "og:image:url",
    "og:image",
    "twitter:image:src",
    "twitter:image",
  ]) {
    const candidate = values.get(key);
    if (!candidate) continue;
    try {
      const resolved = new URL(htmlDecode(candidate), pageUrl);
      if (isLikelyOpenGraphProductImage(resolved, pageUrl)) return resolved;
    } catch {
      // Continua procurando a próxima imagem social.
    }
  }

  return null;
}

async function downloadProductImage(
  imageUrl: URL,
  referer: string,
  userAgent = USER_AGENT,
): Promise<CapturedProductImage> {
  const image = await fetchPublic(
    imageUrl,
    {
      method: "GET",
      headers: {
        "user-agent": userAgent,
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        referer,
      },
    },
    IMAGE_TIMEOUT_MS,
  );

  if (!image.response.ok) {
    await image.response.body?.cancel().catch(() => undefined);
    throw new Error(`A imagem principal do anúncio respondeu com erro (${image.response.status}).`);
  }

  const imageBytes = await readLimited(image.response, MAX_IMAGE_BYTES);
  const contentType = detectedImageType(imageBytes, image.response.headers.get("content-type") ?? "");
  if (!contentType) throw new Error("O arquivo encontrado no anúncio não é uma imagem válida.");

  const imageBuffer = new ArrayBuffer(imageBytes.byteLength);
  new Uint8Array(imageBuffer).set(imageBytes);

  return {
    blob: new Blob([imageBuffer], { type: contentType }),
    sourceUrl: image.finalUrl.toString(),
  };
}

function extractProductImage(html: string, pageUrl: URL) {
  const metaCandidates = new Map<string, string>();
  const rawCandidates: string[] = [];

  // Mercado Livre frequentemente coloca a foto real no JSON/hidratação da
  // página enquanto o og:image pode ser apenas uma imagem institucional.
  // Por isso as imagens D_NQ_ da CDN têm prioridade máxima.
  rawCandidates.push(...embeddedMercadoLivreImages(html));

  for (const script of html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    const jsonText = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const found = firstImageFromJsonLd(JSON.parse(jsonText));
      if (found) rawCandidates.push(found);
    } catch {
      // Alguns sites entregam JSON-LD parcialmente inválido.
    }
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = tagAttribute(tag, "rel").toLowerCase();
    const href = tagAttribute(tag, "href");
    if ((rel === "image_src" || rel.split(/\s+/).includes("image_src")) && href) {
      rawCandidates.push(href);
    }
  }

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (
      tagAttribute(tag, "property") ||
      tagAttribute(tag, "name") ||
      tagAttribute(tag, "itemprop")
    ).toLowerCase();
    const content = tagAttribute(tag, "content");
    if (key && content && !metaCandidates.has(key)) metaCandidates.set(key, content);
  }

  for (const key of [
    "og:image:secure_url",
    "og:image:url",
    "og:image",
    "twitter:image:src",
    "twitter:image",
  ]) {
    const value = metaCandidates.get(key);
    if (value) rawCandidates.push(value);
  }

  const resolvedCandidates: Array<{ url: URL; score: number; order: number }> = [];
  const seen = new Set<string>();

  rawCandidates.forEach((candidate, order) => {
    try {
      const resolved = new URL(htmlDecode(candidate), pageUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;
      const key = resolved.toString();
      if (seen.has(key)) return;
      seen.add(key);
      resolvedCandidates.push({
        url: resolved,
        score: marketplaceImageScore(resolved),
        order,
      });
    } catch {
      // Ignora candidatos inválidos.
    }
  });

  if (!resolvedCandidates.length) {
    throw new Error("O anúncio não informou uma imagem principal que pudesse ser capturada.");
  }

  resolvedCandidates.sort((a, b) => b.score - a.score || a.order - b.order);
  return resolvedCandidates[0].url;
}

function detectedImageType(bytes: Uint8Array, headerType: string) {
  const normalizedHeader = headerType.split(";")[0].trim().toLowerCase();
  const allowedHeaderTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
  if (allowedHeaderTypes.has(normalizedHeader)) return normalizedHeader;

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  if (bytes.length >= 6 && String.fromCharCode(...bytes.slice(0, 6)).startsWith("GIF8")) return "image/gif";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" &&
    ["avif", "avis"].includes(String.fromCharCode(...bytes.slice(8, 12)))
  ) return "image/avif";
  return "";
}



function mercadoLivreItemId(url: URL) {
  const sources = [
    url.searchParams.get("wid") ?? "",
    url.searchParams.get("item_id") ?? "",
    url.searchParams.get("pdp_filters") ?? "",
    decodeURIComponent(url.hash.slice(1)),
    url.pathname,
  ];

  for (const source of sources) {
    const match = source.match(/\bMLB[-:]?(\d{8,})\b/i);
    if (match) return `MLB-${match[1]}`;
  }
  return "";
}

function mercadoLivreSlug(url: URL) {
  const firstSegment = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!firstSegment || /^(?:MLB[-]?\d+|p|up)$/i.test(firstSegment)) return "";
  return firstSegment
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

function mercadoLivreCanonicalCandidate(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (!(hostname === "mercadolivre.com.br" || hostname.endsWith(".mercadolivre.com.br"))) return null;
  if (hostname === "produto.mercadolivre.com.br") return null;

  const itemId = mercadoLivreItemId(url);
  if (!itemId) return null;

  const slug = mercadoLivreSlug(url);
  const path = slug ? `${itemId}-${slug}-_JM` : `${itemId}-_JM`;
  return new URL(`https://produto.mercadolivre.com.br/${path}`);
}

function looksLikeDirectImageUrl(url: URL) {
  return /\.(?:jpe?g|png|webp|gif|avif)(?:$|[?#])/i.test(url.toString());
}

async function captureDirectImageUrl(imageUrl: URL): Promise<CapturedProductImage> {
  const image = await fetchPublic(
    imageUrl,
    {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    },
    IMAGE_TIMEOUT_MS,
  );

  if (!image.response.ok) {
    await image.response.body?.cancel().catch(() => undefined);
    throw new Error(`A imagem respondeu com erro (${image.response.status}).`);
  }

  const imageBytes = await readLimited(image.response, MAX_IMAGE_BYTES);
  const contentType = detectedImageType(imageBytes, image.response.headers.get("content-type") ?? "");
  if (!contentType) throw new Error("O endereço informado não retornou uma imagem válida.");

  const imageBuffer = new ArrayBuffer(imageBytes.byteLength);
  new Uint8Array(imageBuffer).set(imageBytes);

  return {
    blob: new Blob([imageBuffer], { type: contentType }),
    sourceUrl: image.finalUrl.toString(),
  };
}


async function captureOpenGraphAsSocialCrawler(rawUrl: string): Promise<CapturedProductImage> {
  let productUrl: URL;
  try {
    productUrl = new URL(rawUrl);
  } catch {
    throw new Error("O link de sugestão é inválido.");
  }

  if (looksLikeDirectImageUrl(productUrl)) {
    return captureDirectImageUrl(productUrl);
  }

  let lastError: Error | null = null;

  for (const userAgent of SOCIAL_PREVIEW_USER_AGENTS) {
    let page: { response: Response; finalUrl: URL } | null = null;

    try {
      page = await fetchPublic(
        productUrl,
        {
          method: "GET",
          headers: {
            "user-agent": userAgent,
            accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
          },
        },
        PAGE_TIMEOUT_MS,
      );

      if (!page.response.ok) {
        const status = page.response.status;
        await page.response.body?.cancel().catch(() => undefined);
        lastError = new Error(`O preview social respondeu com erro (${status}).`);
        continue;
      }

      const pageType = page.response.headers.get("content-type")?.toLowerCase() ?? "";

      if (pageType.startsWith("image/")) {
        const imageBytes = await readLimited(page.response, MAX_IMAGE_BYTES);
        const contentType = detectedImageType(imageBytes, pageType);
        if (!contentType) {
          lastError = new Error("O preview social não retornou uma imagem válida.");
          continue;
        }

        const imageBuffer = new ArrayBuffer(imageBytes.byteLength);
        new Uint8Array(imageBuffer).set(imageBytes);

        return {
          blob: new Blob([imageBuffer], { type: contentType }),
          sourceUrl: page.finalUrl.toString(),
        };
      }

      if (
        pageType &&
        !pageType.includes("text/html") &&
        !pageType.includes("application/xhtml+xml")
      ) {
        await page.response.body?.cancel().catch(() => undefined);
        lastError = new Error("O preview social não retornou HTML de produto.");
        continue;
      }

      const htmlBytes = await readLimited(page.response, MAX_HTML_BYTES);
      const html = new TextDecoder("utf-8").decode(htmlBytes);

      // Aqui usamos somente as tags sociais que o WhatsApp/Meta consomem.
      // No Mercado Livre a imagem precisa continuar parecendo uma foto real
      // de produto (mlstatic/D_NQ_), para não voltar ao ícone institucional.
      const openGraphImage = extractOpenGraphProductImage(html, page.finalUrl);
      if (!openGraphImage) {
        lastError = new Error("O crawler social não recebeu uma OG Image válida do produto.");
        continue;
      }

      try {
        return await downloadProductImage(
          openGraphImage,
          page.finalUrl.toString(),
          userAgent,
        );
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("A OG Image do preview social não pôde ser baixada.");
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Não foi possível consultar o preview social do anúncio.");
    }
  }

  throw lastError ?? new Error("O anúncio não disponibilizou uma OG Image para preview social.");
}

async function captureProductImageDirect(rawUrl: string): Promise<CapturedProductImage> {
  let productUrl: URL;
  try {
    productUrl = new URL(rawUrl);
  } catch {
    throw new Error("O link de sugestão é inválido.");
  }

  if (looksLikeDirectImageUrl(productUrl)) {
    return captureDirectImageUrl(productUrl);
  }

  const page = await fetchPublic(
    productUrl,
    {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
      },
    },
    PAGE_TIMEOUT_MS,
  );

  if (!page.response.ok) {
    await page.response.body?.cancel().catch(() => undefined);
    throw new Error(`O anúncio respondeu com erro (${page.response.status}).`);
  }
  const pageType = page.response.headers.get("content-type")?.toLowerCase() ?? "";
  if (pageType.startsWith("image/")) {
    const imageBytes = await readLimited(page.response, MAX_IMAGE_BYTES);
    const contentType = detectedImageType(imageBytes, pageType);
    if (!contentType) throw new Error("O endereço informado não retornou uma imagem válida.");

    const imageBuffer = new ArrayBuffer(imageBytes.byteLength);
    new Uint8Array(imageBuffer).set(imageBytes);
    return {
      blob: new Blob([imageBuffer], { type: contentType }),
      sourceUrl: page.finalUrl.toString(),
    };
  }
  if (pageType && !pageType.includes("text/html") && !pageType.includes("application/xhtml+xml")) {
    await page.response.body?.cancel().catch(() => undefined);
    throw new Error("O link não parece apontar para uma página de produto.");
  }

  const htmlBytes = await readLimited(page.response, MAX_HTML_BYTES);
  let html = new TextDecoder("utf-8").decode(htmlBytes);
  let imagePageUrl = page.finalUrl;

  const currentHost = page.finalUrl.hostname.toLowerCase();
  const isMercadoLivre =
    currentHost === "mercadolivre.com.br" ||
    currentHost.endsWith(".mercadolivre.com.br");

  if (isMercadoLivre) {
    const canonicalPage = extractCanonicalPageUrl(html, page.finalUrl);
    if (canonicalPage) {
      const currentComparable = new URL(page.finalUrl);
      currentComparable.hash = "";
      const canonicalComparable = new URL(canonicalPage);
      canonicalComparable.hash = "";

      if (canonicalComparable.toString() !== currentComparable.toString()) {
        try {
          const canonicalResponse = await fetchPublic(
            canonicalComparable,
            {
              method: "GET",
              headers: {
                "user-agent": USER_AGENT,
                accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
                "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
              },
            },
            PAGE_TIMEOUT_MS,
          );

          if (canonicalResponse.response.ok) {
            const canonicalType =
              canonicalResponse.response.headers.get("content-type")?.toLowerCase() ?? "";
            if (
              !canonicalType ||
              canonicalType.includes("text/html") ||
              canonicalType.includes("application/xhtml+xml")
            ) {
              html = new TextDecoder("utf-8").decode(
                await readLimited(canonicalResponse.response, MAX_HTML_BYTES),
              );
              imagePageUrl = canonicalResponse.finalUrl;
            } else {
              await canonicalResponse.response.body?.cancel().catch(() => undefined);
            }
          } else {
            await canonicalResponse.response.body?.cancel().catch(() => undefined);
          }
        } catch {
          // Se a URL canônica não puder ser lida, usa o HTML original.
        }
      }
    }
  }

  // Primeira opção: OG Image/Twitter Image, desde que pareça realmente uma
  // foto de produto. No Mercado Livre, imagens institucionais são rejeitadas
  // e somente assets D_NQ_ da CDN mlstatic são aceitos nessa etapa.
  const openGraphImage = extractOpenGraphProductImage(html, imagePageUrl);
  if (openGraphImage) {
    try {
      return await downloadProductImage(openGraphImage, imagePageUrl.toString());
    } catch {
      // Se a OG Image existir mas estiver bloqueada/indisponível, continua
      // para as imagens reais embutidas/JSON-LD abaixo.
    }
  }

  const fallbackImage = extractProductImage(html, imagePageUrl);
  return downloadProductImage(fallbackImage, imagePageUrl.toString());
}

async function captureProductImageViaMicrolink(rawUrl: string): Promise<CapturedProductImage> {
  let productUrl: URL;
  try {
    productUrl = new URL(rawUrl);
  } catch {
    throw new Error("O link de sugestão é inválido.");
  }

  await assertPublicUrl(productUrl);

  const metadataUrl = new URL("https://api.microlink.io/");
  metadataUrl.searchParams.set("url", productUrl.toString());
  metadataUrl.searchParams.set("filter", "image.url");

  const metadata = await fetchPublic(
    metadataUrl,
    {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
    },
    18_000,
  );

  if (!metadata.response.ok) {
    await metadata.response.body?.cancel().catch(() => undefined);
    throw new Error("O serviço alternativo não conseguiu ler o anúncio.");
  }

  const metadataBytes = await readLimited(metadata.response, 1_000_000);
  let imageAddress = "";
  try {
    const payload = JSON.parse(new TextDecoder("utf-8").decode(metadataBytes)) as {
      status?: string;
      data?: { image?: { url?: string } | string };
    };
    const image = payload.data?.image;
    imageAddress = typeof image === "string" ? image : image?.url ?? "";
  } catch {
    throw new Error("A resposta do serviço alternativo não pôde ser interpretada.");
  }

  if (!imageAddress) {
    throw new Error("O anúncio não disponibilizou uma imagem principal.");
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(imageAddress, productUrl);
  } catch {
    throw new Error("A imagem encontrada no anúncio possui um endereço inválido.");
  }

  if (!isLikelyOpenGraphProductImage(imageUrl, productUrl)) {
    throw new Error("O serviço alternativo retornou uma imagem institucional, não a foto do produto.");
  }

  const image = await fetchPublic(
    imageUrl,
    {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        referer: productUrl.toString(),
      },
    },
    IMAGE_TIMEOUT_MS,
  );

  if (!image.response.ok) {
    await image.response.body?.cancel().catch(() => undefined);
    throw new Error("A imagem encontrada no anúncio não pôde ser baixada.");
  }

  const imageBytes = await readLimited(image.response, MAX_IMAGE_BYTES);
  const contentType = detectedImageType(imageBytes, image.response.headers.get("content-type") ?? "");
  if (!contentType) throw new Error("O arquivo encontrado no anúncio não é uma imagem válida.");

  const imageBuffer = new ArrayBuffer(imageBytes.byteLength);
  new Uint8Array(imageBuffer).set(imageBytes);

  return {
    blob: new Blob([imageBuffer], { type: contentType }),
    sourceUrl: image.finalUrl.toString(),
  };
}

export async function captureProductImageFromUrl(rawUrl: string): Promise<CapturedProductImage> {
  let originalUrl: URL | null = null;
  try {
    originalUrl = new URL(rawUrl);
  } catch {
    // As funções abaixo devolverão a mensagem padronizada.
  }

  // Primeira tentativa: reproduz o tipo de requisição que gera a miniatura
  // quando o link é compartilhado no WhatsApp/Meta.
  let socialError: Error | null = null;
  try {
    return await captureOpenGraphAsSocialCrawler(rawUrl);
  } catch (error) {
    socialError = error instanceof Error ? error : null;
  }

  // Segunda tentativa: fluxo normal do capturador já usado no projeto.
  try {
    return await captureProductImageDirect(rawUrl);
  } catch (directError) {
    const canonicalCandidate = originalUrl ? mercadoLivreCanonicalCandidate(originalUrl) : null;

    if (canonicalCandidate) {
      try {
        return await captureProductImageDirect(canonicalCandidate.toString());
      } catch {
        // Continua para o fallback de metadados.
      }
    }

    try {
      return await captureProductImageViaMicrolink(rawUrl);
    } catch {
      if (socialError) throw socialError;
      throw directError instanceof Error
        ? directError
        : new Error("Não foi possível capturar automaticamente a imagem do anúncio.");
    }
  }
}

