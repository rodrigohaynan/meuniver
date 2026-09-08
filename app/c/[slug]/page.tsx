import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
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

function appBaseUrl() {
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

function absoluteUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return new URL(value, appBaseUrl()).toString();
  }
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
  const invitationUrl = new URL(`/c/${encodeURIComponent(slug)}`, appBaseUrl()).toString();

  // A foto principal cadastrada pelo organizador vira a OG Image do convite.
  // Se não houver foto, usa a arte institucional do CONVNIVER.
  const previewImage = invitation.hero_image_url?.trim()
    ? absoluteUrl(invitation.hero_image_url.trim())
    : new URL("/brand/convniver-login-hero.png", appBaseUrl()).toString();

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
