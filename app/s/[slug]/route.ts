import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Invitation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanDescription(invitation: Invitation) {
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

function cleanTitle(invitation: Invitation) {
  const eventTitle = (invitation.event_title ?? "").trim();
  const host = (invitation.host_name ?? "").trim();

  if (eventTitle) return eventTitle;
  if (host) return `Aniversário de ${host}`;

  return "Convite de aniversário";
}

function absoluteImage(
  value: string | null | undefined,
  origin: string,
) {
  const clean = value?.trim();

  if (!clean) return null;

  try {
    return new URL(clean).toString();
  } catch {
    try {
      return new URL(clean, origin).toString();
    } catch {
      return null;
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("invitations")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const invitation = (data as Invitation | null) ?? null;

  if (!invitation) {
    return new NextResponse(
      "<!doctype html><html><head><title>Convite não encontrado</title></head><body>Convite não encontrado.</body></html>",
      {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const invitationUrl = new URL(
    `/c/${encodeURIComponent(slug)}`,
    origin,
  ).toString();

  /*
   * O og:url usa EXATAMENTE a URL compartilhada (/s/...).
   * Assim qualquer ?v=novo cria uma URL social realmente nova.
   */
  const socialUrl = requestUrl.toString();

  const title = cleanTitle(invitation);
  const description = cleanDescription(invitation);
  const image = absoluteImage(invitation.hero_image_url, origin);

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeSocialUrl = escapeHtml(socialUrl);
  const safeInvitationUrl = escapeHtml(invitationUrl);
  const safeImage = image ? escapeHtml(image) : null;

  /*
   * IMPORTANTE:
   * Esta rota NÃO usa generateMetadata.
   * Ela devolve HTML cru, já com Open Graph dentro do <head>,
   * exatamente no primeiro HTML recebido pelo WhatsApp.
   *
   * O WhatsApp não executa JavaScript, então fica nesta página e lê as tags.
   * Um navegador comum executa o script e vai para o convite real.
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
<meta property="og:url" content="${safeSocialUrl}">
${safeImage ? `<meta property="og:image" content="${safeImage}">
<meta property="og:image:secure_url" content="${safeImage}">
<meta property="og:image:alt" content="${safeTitle}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
${safeImage ? `<meta name="twitter:image" content="${safeImage}">` : ""}
<link rel="canonical" href="${safeInvitationUrl}">
</head>
<body>
<p><a href="${safeInvitationUrl}">Abrir convite</a></p>
<script>
  window.location.replace(${JSON.stringify(invitationUrl).replace("<", "\\u003c")});
</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",

      /*
       * Cache curto para não prender uma miniatura por muito tempo no Netlify.
       * O cache do próprio WhatsApp ainda pode existir; para testar, mude ?v=.
       */
      "Cache-Control":
        "public, max-age=0, s-maxage=60, stale-while-revalidate=60",

      "X-Robots-Tag": "index, follow",
    },
  });
}
