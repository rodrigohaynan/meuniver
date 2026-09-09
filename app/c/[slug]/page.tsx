import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PublicInvitation } from "@/components/public-invitation";
import type { GiftItem, Invitation } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getPublishedInvitation = cache(
  async (slug: string): Promise<Invitation | null> => {
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
      .from("invitations")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    return (data as Invitation | null) ?? null;
  },
);

async function appBaseUrl() {
  /*
   * Para prévias sociais, prefira uma URL pública e estável.
   * No Netlify, URL normalmente aponta para o site de produção.
   */
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
  ];

  for (const value of candidates) {
    const clean = value?.trim();

    if (!clean) continue;

    try {
      return new URL(clean);
    } catch {
      // Tenta a próxima opção.
    }
  }

  /*
   * Fallback para o host real da requisição.
   */
  const requestHeaders = await headers();

  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    requestHeaders.get("host")?.trim();

  const forwardedProto =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (host) {
    const protocol =
      forwardedProto ||
      (host.includes("localhost") ? "http" : "https");

    try {
      return new URL(`${protocol}://${host}`);
    } catch {
      // Continua para localhost.
    }
  }

  return new URL("http://localhost:3000");
}

function metadataDescription(invitation: Invitation) {
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
    ? `Você está convidado para celebrar o aniversário de ${host}. Confirme sua presença pelo CONVNIVER.`
    : "Você está convidado para uma celebração especial. Confirme sua presença pelo CONVNIVER.";
}

function metadataTitle(invitation: Invitation) {
  const eventTitle = (invitation.event_title ?? "").trim();
  const host = (invitation.host_name ?? "").trim();

  if (eventTitle) return eventTitle;
  if (host) return `Aniversário de ${host}`;

  return "Convite de aniversário";
}

function absoluteUrl(value: string | null | undefined, baseUrl: URL) {
  const clean = value?.trim();

  if (!clean) return null;

  try {
    return new URL(clean).toString();
  } catch {
    try {
      return new URL(clean, baseUrl).toString();
    } catch {
      return null;
    }
  }
}

function getShareVersion(
  searchParams: Record<string, string | string[] | undefined>,
) {
  /*
   * Aceita o parâmetro usado pelo CONVNIVER (?share=...)
   * e mantém ?v=... por compatibilidade.
   *
   * IMPORTANTE:
   * não muda imagem, título, descrição ou layout.
   * Apenas faz a URL de compartilhamento realmente variar no og:url,
   * permitindo quebrar o cache social sem alterar o convite.
   */
  const raw = searchParams.share ?? searchParams.v;
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (!value) return null;

  const clean = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 50);

  return clean || null;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};

  const invitation = await getPublishedInvitation(slug);

  if (!invitation) {
    return {
      title: "Convite não encontrado — CONVNIVER",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = metadataTitle(invitation);
  const description = metadataDescription(invitation);
  const baseUrl = await appBaseUrl();

  const canonicalUrl = new URL(
    `/c/${encodeURIComponent(slug)}`,
    baseUrl,
  );

  /*
   * IMPORTANTE:
   * o parâmetro ?v= passa a fazer parte de og:url.
   * Assim Instagram/Facebook/WhatsApp recebem uma URL social nova
   * quando você precisa quebrar o cache da prévia.
   */
  const socialUrl = new URL(canonicalUrl);
  const shareVersion = getShareVersion(query);

  if (shareVersion) {
    /*
     * Usa "share" no og:url porque é o mesmo parâmetro
     * utilizado pelo link que já funciona no Instagram.
     */
    socialUrl.searchParams.set("share", shareVersion);
  }

  /*
   * CORREÇÃO PRINCIPAL:
   * usa a imagem pública do convite DIRETAMENTE no og:image.
   *
   * Não depende mais de /c/[slug]/og-image, ImageResponse,
   * outra consulta ao Supabase ou outra função serverless.
   * Isso deixa a prévia muito mais simples e confiável para crawlers.
   */
  const previewImage = absoluteUrl(invitation.hero_image_url, baseUrl);

  const host = (invitation.host_name ?? "").trim();
  const imageAlt = host
    ? `Convite de aniversário de ${host}`
    : title;

  return {
    metadataBase: baseUrl,

    title: `${title} — CONVNIVER`,
    description,

    alternates: {
      canonical: canonicalUrl.toString(),
    },

    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "CONVNIVER",
      title,
      description,

      /*
       * Não remover o ?v= daqui.
       * Ele é usado justamente para quebrar cache social.
       */
      url: socialUrl.toString(),

      images: previewImage
        ? [
            {
              url: previewImage,
              alt: imageAlt,
            },
          ]
        : undefined,
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: previewImage ? [previewImage] : undefined,
    },
  };
}

export default async function PublicInvitationPage({
  params,
}: PageProps) {
  const { slug } = await params;

  const invitation = await getPublishedInvitation(slug);

  if (!invitation) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();

  const { data: giftsData } = await supabase
    .from("gifts")
    .select("*")
    .eq("invitation_id", invitation.id)
    .order("sort_order");

  return (
    <PublicInvitation
      initialInvitation={invitation}
      initialGifts={(giftsData ?? []) as GiftItem[]}
    />
  );
}
