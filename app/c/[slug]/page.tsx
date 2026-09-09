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

function absoluteUrl(
  value: string | null | undefined,
  baseUrl: URL,
) {
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

function firstParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

function safeParam(value: string | undefined) {
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
   * Aceita o parâmetro já usado nos seus testes:
   * ?share=v6-1, ?share=wa-v7-1 etc.
   * Também aceita ?v= por compatibilidade.
   */
  const share = safeParam(firstParam(query.share));
  const version = safeParam(firstParam(query.v));

  const socialUrl = new URL(canonicalUrl);

  if (share) {
    socialUrl.searchParams.set("share", share);
  } else if (version) {
    socialUrl.searchParams.set("v", version);
  }

  /*
   * TESTE CONTROLADO DO WHATSAPP PARA O THÉO:
   * usa JPEG 1200x630 com ~127 KB hospedado no MESMO domínio.
   * Evita PNG de vários MB e evita depender de storage externo.
   */
  const theoWhatsappImage =
    slug === "theo-rhaian"
      ? new URL(
          "/social/theo-rhaian-whatsapp.jpg",
          baseUrl,
        ).toString()
      : null;

  const heroImage = absoluteUrl(
    invitation.hero_image_url,
    baseUrl,
  );

  const previewImage = theoWhatsappImage ?? heroImage;

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
      url: socialUrl.toString(),

      images: previewImage
        ? [
            {
              url: previewImage,
              width: 1200,
              height: 630,
              type: "image/jpeg",
              alt: imageAlt,
            },
          ]
        : undefined,
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: previewImage
        ? [previewImage]
        : undefined,
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
