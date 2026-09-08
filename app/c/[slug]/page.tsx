import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PublicInvitation } from "@/components/public-invitation";
import type { GiftItem, Invitation } from "@/lib/types";

export const dynamic = "force-dynamic";

const getPublishedInvitation = cache(async (slug: string): Promise<Invitation | null> => {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("invitations")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return (data as Invitation | null) ?? null;
});

async function appBaseUrl() {
  // Para previews sociais, use primeiro o host REAL da requisição.
  // Isso evita og:image apontando para localhost, domínio antigo ou URL de deploy
  // quando NEXT_PUBLIC_APP_URL estiver ausente/desatualizada no Netlify.
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    requestHeaders.get("host")?.trim();
  const forwardedProto =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (host) {
    const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
    try {
      return new URL(`${protocol}://${host}`);
    } catch {
      // Continua para as variáveis de ambiente.
    }
  }

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
      // Tenta a próxima variável disponível.
    }
  }

  return new URL("http://localhost:3000");
}

function previewVersion(invitation: Invitation) {
  const source = [
    invitation.hero_image_url ?? "",
    invitation.event_title,
    invitation.host_name,
    invitation.hero_image_zoom,
    invitation.hero_image_x,
    invitation.hero_image_y,
  ].join("|");

  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function metadataDescription(invitation: Invitation) {
  const text = invitation.invitation_text.trim().replace(/\s+/g, " ");

  if (text) {
    return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
  }

  const host = invitation.host_name.trim();
  return host
    ? `Você está convidado para celebrar o aniversário de ${host}. Confirme sua presença pelo CONVNIVER.`
    : "Você está convidado para uma celebração especial. Confirme sua presença pelo CONVNIVER.";
}

function metadataTitle(invitation: Invitation) {
  const eventTitle = invitation.event_title.trim();
  const host = invitation.host_name.trim();

  if (eventTitle) return eventTitle;
  if (host) return `Aniversário de ${host}`;
  return "Convite de aniversário";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
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
  const invitationUrl = new URL(`/c/${encodeURIComponent(slug)}`, baseUrl).toString();

  // JPEG otimizado e servido no mesmo domínio do convite.
  // A versão muda quando a foto/título/enquadramento muda para reduzir problemas
  // de cache do WhatsApp.
  const previewImageUrl = new URL(
    `/c/${encodeURIComponent(slug)}/og-image.jpg`,
    baseUrl,
  );
  previewImageUrl.searchParams.set("v", previewVersion(invitation));
  const previewImage = previewImageUrl.toString();

  const imageAlt = invitation.host_name.trim()
    ? `Convite de aniversário de ${invitation.host_name.trim()}`
    : title;

  return {
    title: `${title} — CONVNIVER`,
    description,
    alternates: {
      canonical: invitationUrl,
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "CONVNIVER",
      title,
      description,
      url: invitationUrl,
      images: [
        {
          url: previewImage,
          width: 1200,
          height: 630,
          type: "image/jpeg",
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [previewImage],
    },
  };
}

export default async function PublicInvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const invitation = await getPublishedInvitation(slug);

  if (!invitation) notFound();

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
