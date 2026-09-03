import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 3_000_000;
const MAX_IMAGE_BYTES = 7_000_000;
const PAGE_TIMEOUT_MS = 12_000;
const IMAGE_TIMEOUT_MS = 15_000;

type CapturedImage = { bytes: ArrayBuffer; contentType: string };
type ImageCandidateSource =
  | "product-json"
  | "marketplace-cdn"
  | "itemprop"
  | "image-src"
  | "hero-img"
  | "og"
  | "twitter"
  | "generic-json";

type ImageCandidate = { url: URL; source: ImageCandidateSource; score: number };

function blockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
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
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00;
}

function blockedIp(address: string) {
  const version = isIP(address);
  return version === 4 ? blockedIpv4(address) : version === 6 ? blockedIpv6(address) : true;
}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("O link precisa usar http ou https.");
  if (url.username || url.password) throw new Error("O link informado não é permitido.");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("O link precisa apontar para um site público.");
  }

  if (isIP(hostname)) {
    if (blockedIp(hostname)) throw new Error("O link precisa apontar para um site público.");
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some(({ address }) => blockedIp(address))) {
    throw new Error("O link precisa apontar para um site público.");
  }
}

async function fetchPublic(initialUrl: URL, init: RequestInit, timeoutMs: number) {
  let current = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublic(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(current, { ...init, cache: "no-store", redirect: "manual", signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("O site demorou demais para responder.");
      throw new Error("Não foi possível acessar o link informado.");
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) throw new Error("O anúncio redirecionou para um endereço inválido.");
      current = new URL(location, current);
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error("O anúncio fez redirecionamentos demais.");
}

async function readLimited(response: Response, maxBytes: number) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("O conteúdo encontrado é grande demais.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new Error("O conteúdo encontrado é grande demais.");
  return buffer;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/");
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim());
}

function recordTypeIsProduct(record: Record<string, unknown>) {
  const value = record["@type"];
  if (typeof value === "string") return value.toLowerCase() === "product";
  if (Array.isArray(value)) return value.some((item) => typeof item === "string" && item.toLowerCase() === "product");
  return false;
}

function imageStrings(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imageStrings);
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const direct = record.url ?? record.contentUrl;
  return typeof direct === "string" ? [direct] : [];
}

function collectJsonLdImages(value: unknown, productOnly: boolean, output: string[]) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdImages(item, productOnly, output));
    return;
  }
  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const isProduct = recordTypeIsProduct(record);
  if ((!productOnly || isProduct) && record.image) output.push(...imageStrings(record.image));

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") collectJsonLdImages(nested, productOnly, output);
  }
}

function marketplaceProductScore(url: URL) {
  const host = url.hostname.toLowerCase();
  const path = decodeURIComponent(url.pathname).toLowerCase();

  if (host.endsWith("mlstatic.com")) {
    if (/d_(?:nq|q)_np/i.test(url.pathname) || /d_[a-z]{1,4}_np/i.test(url.pathname)) return 120;
    if (path.includes("frontend-assets") || path.includes("navigation") || path.includes("logo")) return -140;
    return 20;
  }

  if (host.endsWith("susercontent.com") || host.includes("shopee")) {
    if (path.includes("/file/") || host.endsWith("img.susercontent.com")) return 110;
    if (/logo|favicon|sprite|icon/.test(path)) return -120;
    return 15;
  }

  return 0;
}

function genericAssetPenalty(url: URL) {
  const value = `${url.hostname}${url.pathname}`.toLowerCase();
  return /favicon|sprite|placeholder|default[_-]?image|brand[_-]?logo|site[_-]?logo|social[_-]?share|handshake|navigation|header[_-]?logo/.test(value)
    ? -140
    : 0;
}

function sourceBaseScore(source: ImageCandidateSource) {
  switch (source) {
    case "product-json": return 150;
    case "marketplace-cdn": return 135;
    case "itemprop": return 115;
    case "hero-img": return 100;
    case "image-src": return 90;
    case "og": return 75;
    case "twitter": return 65;
    case "generic-json": return 55;
  }
}

function createCandidate(raw: string, source: ImageCandidateSource, pageUrl: URL): ImageCandidate | null {
  try {
    const url = new URL(decodeHtml(raw), pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return {
      url,
      source,
      score: sourceBaseScore(source) + marketplaceProductScore(url) + genericAssetPenalty(url),
    };
  } catch {
    return null;
  }
}

function addKnownMarketplaceCandidates(html: string, pageUrl: URL, candidates: ImageCandidate[]) {
  const normalized = decodeHtml(html);

  const absoluteImagePattern = /https?:\/\/[^\s"'<>\\]+/gi;
  for (const rawMatch of normalized.match(absoluteImagePattern) ?? []) {
    if (!/(?:mlstatic\.com|susercontent\.com)/i.test(rawMatch)) continue;
    const clean = rawMatch.replace(/[),}\]]+$/, "");
    const candidate = createCandidate(clean, "marketplace-cdn", pageUrl);
    if (candidate) candidates.push(candidate);
  }

  if (pageUrl.hostname.toLowerCase().includes("shopee")) {
    const imageIdPattern = /["'](?:image|image_id)["']\s*:\s*["']([a-z0-9_-]{20,})(?:@[^"']*)?["']/gi;
    let match: RegExpExecArray | null;
    while ((match = imageIdPattern.exec(normalized))) {
      const id = match[1];
      const candidate = createCandidate(`https://down-br.img.susercontent.com/file/${id}`, "marketplace-cdn", pageUrl);
      if (candidate) candidates.push(candidate);
    }
  }
}

function extractImageUrl(html: string, pageUrl: URL) {
  const candidates: ImageCandidate[] = [];
  const meta = new Map<string, string>();

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attribute(tag, "property") || attribute(tag, "name") || attribute(tag, "itemprop")).toLowerCase();
    const content = attribute(tag, "content");
    if (key && content && !meta.has(key)) meta.set(key, content);
  }

  for (const script of html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    const text = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const parsed = JSON.parse(text);
      const productImages: string[] = [];
      collectJsonLdImages(parsed, true, productImages);
      productImages.forEach((image) => {
        const candidate = createCandidate(image, "product-json", pageUrl);
        if (candidate) candidates.push(candidate);
      });

      if (productImages.length === 0) {
        const genericImages: string[] = [];
        collectJsonLdImages(parsed, false, genericImages);
        genericImages.forEach((image) => {
          const candidate = createCandidate(image, "generic-json", pageUrl);
          if (candidate) candidates.push(candidate);
        });
      }
    } catch {
      // Continua com as outras fontes da página.
    }
  }

  const itempropImage = meta.get("image");
  if (itempropImage) {
    const candidate = createCandidate(itempropImage, "itemprop", pageUrl);
    if (candidate) candidates.push(candidate);
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, "rel").toLowerCase();
    const href = attribute(tag, "href");
    if (rel.split(/\s+/).includes("image_src") && href) {
      const candidate = createCandidate(href, "image-src", pageUrl);
      if (candidate) candidates.push(candidate);
    }
  }

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attribute(tag, "src") || attribute(tag, "data-src") || attribute(tag, "data-original");
    if (!src) continue;
    const fetchPriority = attribute(tag, "fetchpriority").toLowerCase();
    const candidate = createCandidate(src, "hero-img", pageUrl);
    if (candidate) {
      if (fetchPriority === "high") candidate.score += 20;
      candidates.push(candidate);
    }
  }

  addKnownMarketplaceCandidates(html, pageUrl, candidates);

  for (const key of ["og:image:secure_url", "og:image:url", "og:image"]) {
    const value = meta.get(key);
    if (!value) continue;
    const candidate = createCandidate(value, "og", pageUrl);
    if (candidate) candidates.push(candidate);
  }

  for (const key of ["twitter:image:src", "twitter:image"]) {
    const value = meta.get(key);
    if (!value) continue;
    const candidate = createCandidate(value, "twitter", pageUrl);
    if (candidate) candidates.push(candidate);
  }

  const unique = new Map<string, ImageCandidate>();
  for (const candidate of candidates) {
    const key = candidate.url.toString();
    const previous = unique.get(key);
    if (!previous || candidate.score > previous.score) unique.set(key, candidate);
  }

  const ranked = [...unique.values()].sort((a, b) => b.score - a.score);
  const best = ranked.find((candidate) => candidate.score > 0);
  if (best) return best.url;

  throw new Error("O anúncio não informou uma imagem principal de produto que pudesse ser capturada.");
}

function detectImageType(bytes: ArrayBuffer, header: string) {
  const view = new Uint8Array(bytes);
  const normalized = header.split(";")[0].trim().toLowerCase();
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
  if (allowed.has(normalized)) return normalized;
  if (view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "image/jpeg";
  if (view.length >= 8 && view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) return "image/png";
  if (view.length >= 12 && new TextDecoder().decode(view.slice(0, 4)) === "RIFF" && new TextDecoder().decode(view.slice(8, 12)) === "WEBP") return "image/webp";
  if (view.length >= 6 && new TextDecoder().decode(view.slice(0, 6)).startsWith("GIF8")) return "image/gif";
  if (view.length >= 12 && new TextDecoder().decode(view.slice(4, 8)) === "ftyp" && ["avif", "avis"].includes(new TextDecoder().decode(view.slice(8, 12)))) return "image/avif";
  return "";
}

async function downloadImage(imageUrl: URL, referer: string): Promise<CapturedImage> {
  const image = await fetchPublic(
    imageUrl,
    { headers: { "user-agent": USER_AGENT, accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", referer } },
    IMAGE_TIMEOUT_MS,
  );
  if (!image.response.ok) {
    await image.response.body?.cancel().catch(() => undefined);
    throw new Error("A imagem principal do anúncio não pôde ser baixada.");
  }
  const bytes = await readLimited(image.response, MAX_IMAGE_BYTES);
  const contentType = detectImageType(bytes, image.response.headers.get("content-type") ?? "");
  if (!contentType) throw new Error("O arquivo encontrado não é uma imagem válida.");
  return { bytes, contentType };
}



type MercadoLivreItemPayload = {
  id?: string;
  thumbnail?: string;
  secure_thumbnail?: string;
  pictures?: Array<{ url?: string; secure_url?: string }>;
};

function isMercadoLivreHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br") || host === "mercadolibre.com" || host.endsWith(".mercadolibre.com");
}

function mercadoLivreIds(rawUrl: string) {
  const itemIds = new Set<string>();
  const productIds = new Set<string>();

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { itemIds: [] as string[], productIds: [] as string[] };
  }

  const addItem = (value: string | null | undefined) => {
    const match = value?.toUpperCase().match(/\b(MLB\d{6,})\b/);
    if (match) itemIds.add(match[1]);
  };

  addItem(url.searchParams.get("wid"));

  for (const key of ["pdp_filters", "filters"]) {
    const value = url.searchParams.get(key);
    if (value) {
      const decoded = decodeURIComponent(value);
      const match = decoded.toUpperCase().match(/(?:ITEM_ID\s*[:=]\s*)?(MLB\d{6,})/);
      if (match) itemIds.add(match[1]);
    }
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  addItem(hashParams.get("wid"));
  for (const key of ["pdp_filters", "filters"]) {
    const value = hashParams.get(key);
    if (value) {
      const decoded = decodeURIComponent(value);
      const match = decoded.toUpperCase().match(/(?:ITEM_ID\s*[:=]\s*)?(MLB\d{6,})/);
      if (match) itemIds.add(match[1]);
    }
  }

  const productPath = url.pathname.match(/\/p\/(MLB\d{6,})\b/i);
  if (productPath) productIds.add(productPath[1].toUpperCase());

  // Como último recurso, procura IDs MLB no fragmento/consulta, mas evita
  // tratar o ID de catálogo /p/ como item quando ele for o único encontrado.
  const decodedUrl = decodeURIComponent(rawUrl);
  for (const match of decodedUrl.toUpperCase().matchAll(/\bMLB\d{6,}\b/g)) {
    const id = match[0];
    if (!productIds.has(id)) itemIds.add(id);
  }

  return { itemIds: [...itemIds], productIds: [...productIds] };
}

function mercadoLivreApiHeaders() {
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: "application/json",
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
  };
  const token = process.env.MERCADOLIBRE_ACCESS_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function mercadoLivreItemImage(itemId: string): Promise<CapturedImage | null> {
  const apiUrl = new URL(`https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}`);
  apiUrl.searchParams.set("attributes", "id,title,pictures,thumbnail,secure_thumbnail");

  const result = await fetchPublic(apiUrl, { headers: mercadoLivreApiHeaders() }, PAGE_TIMEOUT_MS);
  if (result.response.status !== 200 && result.response.status !== 206) {
    await result.response.body?.cancel().catch(() => undefined);
    return null;
  }

  let payload: MercadoLivreItemPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(await readLimited(result.response, 2_000_000))) as MercadoLivreItemPayload;
  } catch {
    return null;
  }

  const addresses = [
    ...(payload.pictures ?? []).flatMap((picture) => [picture.secure_url, picture.url]),
    payload.secure_thumbnail,
    payload.thumbnail,
  ].filter((value): value is string => Boolean(value));

  for (const address of addresses) {
    try {
      const imageUrl = new URL(address);
      if (!imageUrl.hostname.toLowerCase().endsWith("mlstatic.com")) continue;
      return await downloadImage(imageUrl, `https://www.mercadolivre.com.br/`);
    } catch {
      // Tenta a próxima foto do próprio item.
    }
  }
  return null;
}

function collectMercadoLivreImageUrls(value: unknown, output: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && /mlstatic\.com/i.test(value)) output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectMercadoLivreImageUrls(entry, output));
    return;
  }
  if (typeof value !== "object") return;
  for (const nested of Object.values(value as Record<string, unknown>)) {
    collectMercadoLivreImageUrls(nested, output);
  }
}

async function mercadoLivreProductImage(productId: string): Promise<CapturedImage | null> {
  const apiUrl = new URL(`https://api.mercadolibre.com/products/${encodeURIComponent(productId)}`);
  const result = await fetchPublic(apiUrl, { headers: mercadoLivreApiHeaders() }, PAGE_TIMEOUT_MS);
  if (!result.response.ok) {
    await result.response.body?.cancel().catch(() => undefined);
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(await readLimited(result.response, 3_000_000)));
  } catch {
    return null;
  }

  const addresses: string[] = [];
  collectMercadoLivreImageUrls(payload, addresses);
  for (const address of [...new Set(addresses)]) {
    try {
      return await downloadImage(new URL(address), "https://www.mercadolivre.com.br/");
    } catch {
      // Tenta a próxima foto encontrada no catálogo.
    }
  }
  return null;
}

async function viaMercadoLivreApi(rawUrl: string): Promise<CapturedImage | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isMercadoLivreHost(parsed.hostname)) return null;

  const { itemIds, productIds } = mercadoLivreIds(rawUrl);
  for (const itemId of itemIds) {
    const image = await mercadoLivreItemImage(itemId).catch(() => null);
    if (image) return image;
  }
  for (const productId of productIds) {
    const image = await mercadoLivreProductImage(productId).catch(() => null);
    if (image) return image;
  }
  return null;
}

async function direct(rawUrl: string): Promise<CapturedImage> {
  const productUrl = new URL(rawUrl);
  const page = await fetchPublic(
    productUrl,
    { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9,en;q=0.7" } },
    PAGE_TIMEOUT_MS,
  );
  if (!page.response.ok) {
    await page.response.body?.cancel().catch(() => undefined);
    throw new Error(`O anúncio respondeu com erro (${page.response.status}).`);
  }
  const pageType = page.response.headers.get("content-type")?.toLowerCase() ?? "";
  if (pageType && !pageType.includes("text/html") && !pageType.includes("application/xhtml+xml")) {
    await page.response.body?.cancel().catch(() => undefined);
    throw new Error("O link não parece apontar para uma página de produto.");
  }
  const html = new TextDecoder().decode(await readLimited(page.response, MAX_HTML_BYTES));
  const imageUrl = extractImageUrl(html, page.finalUrl);
  return downloadImage(imageUrl, page.finalUrl.toString());
}


async function viaJinaReader(rawUrl: string): Promise<CapturedImage> {
  const productUrl = new URL(rawUrl);
  await assertPublic(productUrl);

  const readerUrl = new URL(`https://r.jina.ai/${productUrl.toString()}`);
  const reader = await fetchPublic(
    readerUrl,
    {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8",
        "x-engine": "browser",
        "x-no-cache": "true",
      },
    },
    28_000,
  );

  if (!reader.response.ok) {
    await reader.response.body?.cancel().catch(() => undefined);
    throw new Error(`A leitura renderizada do anúncio respondeu com erro (${reader.response.status}).`);
  }

  const markdown = new TextDecoder().decode(await readLimited(reader.response, 4_000_000));
  const candidates: ImageCandidate[] = [];

  const markdownImagePattern = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = markdownImagePattern.exec(markdown))) {
    const candidate = createCandidate(match[1], "marketplace-cdn", productUrl);
    if (candidate) candidates.push(candidate);
  }

  const absoluteImagePattern = /https?:\/\/[^\s)\]}'"<>]+/gi;
  for (const raw of markdown.match(absoluteImagePattern) ?? []) {
    if (!/(?:mlstatic\.com|susercontent\.com)/i.test(raw)) continue;
    const candidate = createCandidate(raw.replace(/[.,;:]+$/, ""), "marketplace-cdn", productUrl);
    if (candidate) candidates.push(candidate);
  }

  const unique = new Map<string, ImageCandidate>();
  for (const candidate of candidates) {
    const key = candidate.url.toString();
    const previous = unique.get(key);
    if (!previous || candidate.score > previous.score) unique.set(key, candidate);
  }

  const ranked = [...unique.values()]
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const candidate of ranked.slice(0, 12)) {
    try {
      return await downloadImage(candidate.url, productUrl.toString());
    } catch {
      // Tenta a próxima imagem encontrada na página renderizada.
    }
  }

  throw new Error("A página renderizada não revelou uma foto válida do produto.");
}

async function viaMicrolink(rawUrl: string): Promise<CapturedImage> {
  const productUrl = new URL(rawUrl);
  await assertPublic(productUrl);
  const metadataUrl = new URL("https://api.microlink.io/");
  metadataUrl.searchParams.set("url", productUrl.toString());
  metadataUrl.searchParams.set("filter", "image.url");
  metadataUrl.searchParams.set("cache", "false");

  const metadata = await fetchPublic(metadataUrl, { headers: { "user-agent": USER_AGENT, accept: "application/json" } }, 18_000);
  if (!metadata.response.ok) {
    await metadata.response.body?.cancel().catch(() => undefined);
    throw new Error("O serviço alternativo não conseguiu ler o anúncio.");
  }
  const payload = JSON.parse(new TextDecoder().decode(await readLimited(metadata.response, 1_000_000))) as {
    data?: { image?: string | { url?: string } };
  };
  const value = payload.data?.image;
  const address = typeof value === "string" ? value : value?.url;
  if (!address) throw new Error("O anúncio não disponibilizou uma imagem principal.");
  const imageUrl = new URL(address, productUrl);

  // Evita gravar logos institucionais retornados por páginas bloqueadas de marketplaces.
  if (marketplaceProductScore(imageUrl) + genericAssetPenalty(imageUrl) < 0) {
    throw new Error("O anúncio retornou apenas uma imagem institucional, não a foto do produto.");
  }

  return downloadImage(imageUrl, productUrl.toString());
}

export async function captureProductImage(rawUrl: string): Promise<CapturedImage> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("O link de sugestão é inválido.");
  }
  const normalized = parsed.toString();
  const mercadoLivre = isMercadoLivreHost(parsed.hostname);

  const mercadoLivreImage = await viaMercadoLivreApi(normalized).catch(() => null);
  if (mercadoLivreImage) return mercadoLivreImage;

  let directError: unknown;
  try {
    return await direct(normalized);
  } catch (error) {
    directError = error;
  }

  try {
    return await viaJinaReader(normalized);
  } catch (readerError) {
    // No Mercado Livre não aceitamos o Microlink como imagem final, porque em
    // páginas bloqueadas ele pode devolver a arte institucional do marketplace.
    if (mercadoLivre) {
      const directMessage = directError instanceof Error ? directError.message : "captura direta indisponível";
      const readerMessage = readerError instanceof Error ? readerError.message : "leitura renderizada indisponível";
      throw new Error(`Não foi possível obter a foto real do produto. ${directMessage} ${readerMessage}`);
    }
  }

  try {
    return await viaMicrolink(normalized);
  } catch {
    throw directError instanceof Error ? directError : new Error("Não foi possível capturar a imagem do anúncio.");
  }
}
