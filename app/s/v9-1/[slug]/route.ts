import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Invitation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOCIAL_BOT =
  /WhatsApp|facebookexternalhit|Facebot|Meta-ExternalAgent|Meta-ExternalFetcher|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Pinterestbot/i;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function titleFor(invitation: Invitation) {
  const eventTitle = (invitation.event_title ?? "").trim();
  const host = (invitation.host_name ?? "").trim();

  if (eventTitle) return eventTitle;
  if (host) return `Aniversário de ${host}`;
  return "Convite de aniversário";
}

function descriptionFor(invitation: Invitation) {
  const text = (invitation.invitation_text ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (text) {
    return text.length > 180
      ? `${text.slice(0, 177).trimEnd()}...`
      : text;
  }

  const host = (invitation.host_name ?? "").trim();

  return host
    ? `Você está convidado para celebrar o aniversário de ${host}.`
    : "Você está convidado para uma celebração especial.";
}

async function getInvitation(slug: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("invitations")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return (data as Invitation | null) ?? null;
}

function buildNetlifyOgImage(
  origin: string,
  heroImageUrl: string,
) {
  /*
   * Faz o WhatsApp receber um JPEG 1200x630 pelo PRÓPRIO domínio Netlify,
   * em vez do PNG grande diretamente do Supabase.
   *
   * Isso usa o Image CDN oficial do Netlify.
   */
  const image = new URL("/.netlify/images", origin);

  image.searchParams.set("url", heroImageUrl);
  image.searchParams.set("w", "1200");
  image.searchParams.set("h", "630");
  image.searchParams.set("fit", "cover");
  image.searchParams.set("position", "center");
  image.searchParams.set("fm", "jpg");
  image.searchParams.set("q", "72");

  return image.toString();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const invitation = await getInvitation(slug);

  if (!invitation) {
    return new NextResponse("Convite não encontrado.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const invitationUrl = new URL(
    `/c/${encodeURIComponent(slug)}`,
    origin,
  ).toString();

  /*
   * Quem é pessoa é enviado direto ao convite.
   * Crawlers sociais recebem HTML 200 com Open Graph.
   *
   * Importante: sem redirect para WhatsApp/Meta.
   */
  const userAgent = request.headers.get("user-agent") ?? "";

  if (userAgent && !SOCIAL_BOT.test(userAgent)) {
    return NextResponse.redirect(invitationUrl, 307);
  }

  const title = titleFor(invitation);
  const description = descriptionFor(invitation);
  const hero = invitation.hero_image_url?.trim();

  if (!hero) {
    return NextResponse.redirect(invitationUrl, 307);
  }

  const ogImage = buildNetlifyOgImage(origin, hero);

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safePageUrl = escapeHtml(requestUrl.toString());
  const safeInvitationUrl = escapeHtml(invitationUrl);
  const safeImage = escapeHtml(ogImage);

  /*
   * Open Graph "estilo portal de notícias":
   * tags literais no HEAD da primeira resposta,
   * imagem absoluta, HTTPS, JPEG, dimensões declaradas.
   */
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle} — CONVNIVER</title>
<meta name="description" content="${safeDescription}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="CONVNIVER">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safePageUrl}">

<meta property="og:image" content="${safeImage}">
<meta property="og:image:url" content="${safeImage}">
<meta property="og:image:secure_url" content="${safeImage}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${safeTitle}">

<link rel="image_src" href="${safeImage}">
<meta itemprop="image" content="${safeImage}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">

<link rel="canonical" href="${safeInvitationUrl}">
</head>
<body>
<a href="${safeInvitationUrl}">Abrir convite</a>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "index, follow",
    },
  });
}

/*
 * Alguns crawlers fazem HEAD antes do GET.
 * A rota anterior tinha apenas GET.
 */
export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const invitation = await getInvitation(slug);

  if (!invitation) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "index, follow",
    },
  });
}
