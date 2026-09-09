import sharp from "sharp";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Invitation } from "@/lib/types";

type SharpPipeline = ReturnType<typeof sharp>;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const SAFE_TARGET_BYTES = 180 * 1024;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function invitationTitle(invitation: Invitation | null) {
  if (!invitation) return "Você está convidado";

  return (
    invitation.event_title.trim() ||
    (invitation.host_name.trim()
      ? `Aniversário de ${invitation.host_name.trim()}`
      : "Você está convidado")
  );
}

function wrapTitle(value: string, maxChars = 31) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 3);
}

async function fetchImage(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "image/jpeg,image/png,image/webp,image/*;q=0.8",
      "user-agent": "CONVNIVER-OG/1.0",
    },
  });

  if (!response.ok) return null;

  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || "";

  if (!contentType.startsWith("image/")) return null;

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_SOURCE_BYTES) return null;

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) return null;

  return bytes;
}

async function cropHero(source: Buffer, invitation: Invitation) {
  const metadata = await sharp(source, { failOn: "none" }).metadata();

  const rawWidth = metadata.width || WIDTH;
  const rawHeight = metadata.height || HEIGHT;
  const orientation = metadata.orientation || 1;
  const rotated = orientation >= 5 && orientation <= 8;
  const sourceWidth = rotated ? rawHeight : rawWidth;
  const sourceHeight = rotated ? rawWidth : rawHeight;

  const zoom = clamp(Number(invitation.hero_image_zoom) || 1, 1, 2.5);
  const focalX = clamp(Number(invitation.hero_image_x) || 50, 0, 100) / 100;
  const focalY = clamp(Number(invitation.hero_image_y) || 50, 0, 100) / 100;

  const coverScale = Math.max(WIDTH / sourceWidth, HEIGHT / sourceHeight) * zoom;
  const resizedWidth = Math.max(WIDTH, Math.ceil(sourceWidth * coverScale));
  const resizedHeight = Math.max(HEIGHT, Math.ceil(sourceHeight * coverScale));

  const focalPixelX = focalX * resizedWidth;
  const focalPixelY = focalY * resizedHeight;
  const left = clamp(Math.round(focalPixelX - WIDTH / 2), 0, resizedWidth - WIDTH);
  const top = clamp(Math.round(focalPixelY - HEIGHT / 2), 0, resizedHeight - HEIGHT);

  return sharp(source, { failOn: "none" })
    .rotate()
    .resize(resizedWidth, resizedHeight, { fit: "fill" })
    .extract({ left, top, width: WIDTH, height: HEIGHT });
}

function fallbackCanvas(title: string) {
  const lines = wrapTitle(title);
  const startY = lines.length === 1 ? 365 : lines.length === 2 ? 330 : 295;
  const titleSvg = lines
    .map(
      (line, index) =>
        `<text x="64" y="${startY + index * 68}" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`,
    )
    .join("");

  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f7eee9"/>
          <stop offset="0.52" stop-color="#c68e8e"/>
          <stop offset="1" stop-color="#7d1f37"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <rect x="0" y="0" width="1200" height="630" fill="#351820" opacity="0.14"/>
      <text x="64" y="232" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="5" fill="#f1c775">CONVNIVER</text>
      ${titleSvg}
    </svg>`;

  return sharp(Buffer.from(svg));
}

async function toWhatsAppJpeg(image: SharpPipeline) {
  // Primeira tentativa rápida. Se necessário, reduz a qualidade até ficar
  // confortavelmente abaixo do tamanho que costuma falhar no WhatsApp.
  for (const quality of [62, 52, 44, 36]) {
    const output = await image
      .clone()
      .jpeg({
        quality,
        progressive: true,
        chromaSubsampling: "4:2:0",
      })
      .toBuffer();

    if (output.length <= SAFE_TARGET_BYTES || quality === 36) {
      return output;
    }
  }

  throw new Error("Não foi possível gerar a imagem social.");
}

async function buildJpeg(slug: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("invitations")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const invitation = (data as Invitation | null) ?? null;
  const title = invitationTitle(invitation);

  let pipeline: SharpPipeline;

  if (invitation?.hero_image_url?.trim()) {
    try {
      const source = await fetchImage(invitation.hero_image_url.trim());
      pipeline = source
        ? await cropHero(source, invitation)
        : fallbackCanvas(title);
    } catch {
      pipeline = fallbackCanvas(title);
    }
  } else {
    pipeline = fallbackCanvas(title);
  }

  return toWhatsAppJpeg(pipeline);
}

const commonHeaders = {
  "Content-Type": "image/jpeg",
  "Cache-Control":
    "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  "Netlify-CDN-Cache-Control":
    "public, durable, max-age=3600, stale-while-revalidate=86400",
  "Content-Disposition": 'inline; filename="convniver-preview.jpg"',
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const jpeg = await buildJpeg(slug);

  return new Response(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Length": String(jpeg.length),
    },
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: commonHeaders,
  });
}
