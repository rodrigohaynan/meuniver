import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PublicInvitation } from "@/components/public-invitation";
import type { GiftItem, Invitation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PublicInvitationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: invitationData } = await supabase
    .from("invitations")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!invitationData) notFound();
  const invitation = invitationData as Invitation;

  const { data: giftsData } = await supabase
    .from("gifts")
    .select("*")
    .eq("invitation_id", invitation.id)
    .order("sort_order");

  return <PublicInvitation initialInvitation={invitation} initialGifts={(giftsData ?? []) as GiftItem[]} />;
}
