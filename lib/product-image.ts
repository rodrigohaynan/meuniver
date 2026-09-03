import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36";
const MAX_BYTES = 7_000_000;

function blockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function blockedIpv6(address: string) {
  const value = address.toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb");
}

async function assertPublic(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("URL inválida.");
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("URL não permitida.");

  if (isIP(host) === 4 && blockedIpv4(host)) throw new Error("URL não permitida.");
  if (isIP(host) === 6 && blockedIpv6(host)) throw new Error("URL não permitida.");

  if (!isIP(host)) {
    const addresses = await lookup(host, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isIP(address) === 4 ? blockedIpv4(address) : blockedIpv6(address))) {
      throw new Error("URL não permitida.");
    }
  }
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
}

function extractMeta(html: string, pageUrl: URL) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const priorities = ["og:image:secure_url", "og:image:url", "og:image", "twitter:image:src", "twitter:image"];

  for (const key of priorities) {
    for (const tag of tags) {
      const prop = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (prop !== key) continue;
      const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
      if (content) return new URL(decodeHtml(content), pageUrl);
    }
  }
  throw new Error("Imagem principal não encontrada.");
}

async function readBytes(response: Response) {
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new Error("Imagem muito grande.");
  return buffer;
}

async function direct(rawUrl: string) {
  const url = new URL(rawUrl);
  await assertPublic(url);

  const page = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
  });
  if (!page.ok) throw new Error(`Página respondeu ${page.status}.`);
  const html = (await page.text()).slice(0, 3_000_000);
  const imageUrl = extractMeta(html, new URL(page.url));
  await assertPublic(imageUrl);

  const image = await fetch(imageUrl, {
    cache: "no-store",
    headers: { "user-agent": USER_AGENT, accept: "image/*", referer: page.url },
  });
  if (!image.ok) throw new Error("Imagem indisponível.");
  return { bytes: await readBytes(image), contentType: image.headers.get("content-type") || "image/jpeg" };
}

async function viaMicrolink(rawUrl: string) {
  const original = new URL(rawUrl);
  await assertPublic(original);

  const metaUrl = new URL("https://api.microlink.io/");
  metaUrl.searchParams.set("url", original.toString());
  metaUrl.searchParams.set("filter", "image.url");

  const meta = await fetch(metaUrl, { cache: "no-store", headers: { accept: "application/json", "user-agent": USER_AGENT } });
  if (!meta.ok) throw new Error("Fallback indisponível.");
  const payload = await meta.json() as { data?: { image?: string | { url?: string } } };
  const imageValue = payload.data?.image;
  const imageAddress = typeof imageValue === "string" ? imageValue : imageValue?.url;
  if (!imageAddress) throw new Error("Imagem não encontrada.");
  const imageUrl = new URL(imageAddress, original);
  await assertPublic(imageUrl);

  const image = await fetch(imageUrl, { cache: "no-store", headers: { accept: "image/*", "user-agent": USER_AGENT } });
  if (!image.ok) throw new Error("Imagem indisponível.");
  return { bytes: await readBytes(image), contentType: image.headers.get("content-type") || "image/jpeg" };
}

export async function captureProductImage(rawUrl: string) {
  try {
    return await direct(rawUrl);
  } catch (firstError) {
    try {
      return await viaMicrolink(rawUrl);
    } catch {
      throw firstError;
    }
  }
}
