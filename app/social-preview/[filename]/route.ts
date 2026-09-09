import sharp from "sharp";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;

function slugFromFilename(filename: string) {
  return decodeURIComponent(filename).replace(/\.jpe?g$/i, "").trim();
}

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const slug = slugFromFilename(filename);

  if (!slug) return errorResponse("Convite inválido.", 400);

  const supabase = await createServerSupabaseClient();
  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("hero_image_url, updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !invitation?.hero_image_url) {
    return errorResponse("Imagem do convite não encontrada.", 404);
  }

  try {
    const sourceResponse = await fetch(invitation.hero_image_url, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
    });

    if (!sourceResponse.ok) {
      return errorResponse("Não foi possível carregar a imagem do convite.", 502);
    }

    const input = Buffer.from(await sourceResponse.arrayBuffer());

    // Fundo preenchido e suavizado para manter a proporção social sem cortar
    // informações importantes de artes verticais.
    const background = await sharp(input)
      .rotate()
      .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
      .blur(24)
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    // A arte completa fica visível no centro. Em imagens horizontais ela ocupa
    // praticamente todo o quadro; em artes verticais o fundo suavizado preenche
    // as laterais, evitando cortes de nomes, rostos e textos.
    const foreground = await sharp(input)
      .rotate()
      .resize(WIDTH, HEIGHT, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();

    const jpeg = await sharp(background)
      .composite([{ input: foreground, gravity: "centre" }])
      .jpeg({
        quality: 82,
        progressive: true,
        mozjpeg: true,
        chromaSubsampling: "4:2:0",
      })
      .toBuffer();

    return new Response(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(jpeg.byteLength),
        "Content-Disposition": `inline; filename="${slug}-whatsapp.jpg"`,
        // A URL recebe ?v=<updated_at> no metadata. Quando o convite muda,
        // o endereço da imagem muda e os crawlers recebem a nova versão.
        "Cache-Control": "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=604800",
      },
    });
  } catch (cause) {
    console.error("Erro ao gerar social preview", { slug, cause });
    return errorResponse("Não foi possível gerar a miniatura do convite.", 500);
  }
}
