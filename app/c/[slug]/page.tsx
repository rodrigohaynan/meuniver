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

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    requestHeaders.get("host")?.trim();
  const forwardedProto =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (host) {
    const protocol =
      forwardedProto || (host.includes("localhost") ? "http" : "https");

    try {
      return new URL(`${protocol}://${host}`);
    } catch {
      // Continua para localhost.
    }
  }

  return new URL("http://localhost:3000");
}

function celebrationName(invitation: Invitation) {
  return invitation.age_unit === "months" ? "mêsversário" : "aniversário";
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
  const celebration = celebrationName(invitation);

  return host
    ? `Você está convidado para celebrar o ${celebration} de ${host}. Confirme sua presença pelo CONVNIVER.`
    : "Você está convidado para uma celebração especial. Confirme sua presença pelo CONVNIVER.";
}

function metadataTitle(invitation: Invitation) {
  const eventTitle = (invitation.event_title ?? "").trim();
  const host = (invitation.host_name ?? "").trim();
  const label = invitation.age_unit === "months" ? "Mêsversário" : "Aniversário";

  if (eventTitle) return eventTitle;
  if (host) return `${label} de ${host}`;

  return invitation.age_unit === "months"
    ? "Convite de mêsversário"
    : "Convite de aniversário";
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
  const raw = searchParams.share ?? searchParams.v;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;

  const clean = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 50);

  return clean || null;
}

function socialImageVersion(invitation: Invitation, shareVersion: string | null) {
  if (shareVersion) return shareVersion;

  const updated = (invitation.updated_at ?? "")
    .replace(/[^0-9]/g, "")
    .slice(0, 20);

  return updated || invitation.id.slice(0, 12);
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
      robots: { index: false, follow: false },
    };
  }

  const title = metadataTitle(invitation);
  const description = metadataDescription(invitation);
  const baseUrl = await appBaseUrl();
  const canonicalUrl = new URL(`/c/${encodeURIComponent(slug)}`, baseUrl);
  const socialUrl = new URL(canonicalUrl);
  const shareVersion = getShareVersion(query);

  if (shareVersion) {
    socialUrl.searchParams.set("share", shareVersion);
  }

  /*
   * Estratégia social do CONVNIVER:
   *
   * 1) imagem original em primeiro lugar: mantém o comportamento que funciona
   *    no Instagram;
   * 2) JPG social 1200x630 em segundo lugar: versão leve e compatível com
   *    WhatsApp.
   *
   * O convite do Théo mantém o JPG estático já validado. Todos os demais
   * convites, inclusive os novos, recebem automaticamente uma versão JPG pela
   * rota /social-preview/[slug].jpg.
   */
  const originalPreviewImage = absoluteUrl(invitation.hero_image_url, baseUrl);

  let whatsappPreviewImage: string | null = null;

  if (slug === "theo-rhaian") {
    whatsappPreviewImage = new URL(
      "/social/theo-rhaian-whatsapp.jpg",
      baseUrl,
    ).toString();
  } else if (originalPreviewImage) {
    const generatedPreview = new URL(
      `/social-preview/${encodeURIComponent(slug)}.jpg`,
      baseUrl,
    );
    generatedPreview.searchParams.set(
      "v",
      socialImageVersion(invitation, shareVersion),
    );
    whatsappPreviewImage = generatedPreview.toString();
  }

  const host = (invitation.host_name ?? "").trim();
  const celebration = celebrationName(invitation);
  const imageAlt = host ? `Convite de ${celebration} de ${host}` : title;

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
      url: socialUrl.toString(),
      images: [
        ...(originalPreviewImage
          ? [
              {
                url: originalPreviewImage,
                alt: imageAlt,
              },
            ]
          : []),
        ...(whatsappPreviewImage
          ? [
              {
                url: whatsappPreviewImage,
                width: 1200,
                height: 630,
                type: "image/jpeg",
                alt: imageAlt,
              },
            ]
          : []),
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: originalPreviewImage
        ? [originalPreviewImage]
        : whatsappPreviewImage
          ? [whatsappPreviewImage]
          : undefined,
    },
  };
}

export default async function PublicInvitationPage({ params }: PageProps) {
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
