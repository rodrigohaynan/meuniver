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
    .replace(/&gt;/gi, ">");
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim());
}

function jsonLdImage(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = jsonLdImage(item);
      if (result) return result;
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
        const entry = item as Record<string, unknown>;
        const candidate = entry.url ?? entry.contentUrl;
        if (typeof candidate === "string") return candidate;
      }
    }
  }
  if (direct && typeof direct === "object") {
    const entry = direct as Record<string, unknown>;
    const candidate = entry.url ?? entry.contentUrl;
    if (typeof candidate === "string") return candidate;
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      const result = jsonLdImage(nested);
      if (result) return result;
    }
  }
  return null;
}

function extractImageUrl(html: string, pageUrl: URL) {
  const candidates: string[] = [];
  const priorities = ["og:image:secure_url", "og:image:url", "og:image", "twitter:image:src", "twitter:image"];
  const meta = new Map<string, string>();

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attribute(tag, "property") || attribute(tag, "name") || attribute(tag, "itemprop")).toLowerCase();
    const content = attribute(tag, "content");
    if (key && content && !meta.has(key)) meta.set(key, content);
  }
  for (const key of priorities) {
    const value = meta.get(key);
    if (value) candidates.push(value);
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, "rel").toLowerCase();
    const href = attribute(tag, "href");
    if (rel.split(/\s+/).includes("image_src") && href) candidates.push(href);
  }

  for (const script of html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    const text = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const candidate = jsonLdImage(JSON.parse(text));
      if (candidate) candidates.push(candidate);
    } catch {
      // Open Graph ainda poderá fornecer a imagem.
    }
  }

  for (const candidate of candidates) {
    try {
      const url = new URL(decodeHtml(candidate), pageUrl);
      if (url.protocol === "http:" || url.protocol === "https:") return url;
    } catch {
      // Tenta o próximo candidato.
    }
  }
  throw new Error("O anúncio não informou uma imagem principal.");
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
  return downloadImage(imageUrl, productUrl.toString());
}

export async function captureProductImage(rawUrl: string): Promise<CapturedImage> {
  let normalized: string;
  try {
    normalized = new URL(rawUrl).toString();
  } catch {
    throw new Error("O link de sugestão é inválido.");
  }
  try {
    return await direct(normalized);
  } catch (directError) {
    try {
      return await viaMicrolink(normalized);
    } catch {
      throw directError instanceof Error ? directError : new Error("Não foi possível capturar a imagem do anúncio.");
    }
  }
}
