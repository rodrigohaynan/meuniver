import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GiftProfileEditor } from "@/components/gift-profile-editor";
import { GiftReservationModeEditor } from "@/components/gift-reservation-mode-editor";
import { InvitationEditor } from "@/components/invitation-editor";
import { RsvpDeclinesPanel, type RsvpDecline } from "@/components/rsvp-declines-panel";
import type { GiftItem, GiftReservation, Invitation, Rsvp } from "@/lib/types";

export default async function InvitationEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/entrar");

  // Autorizar ANTES de carregar presentes, reservas e dados de convidados.
  // Um convite publicado é público para visualização, não para edição.
  const { data: invitationData, error: invitationError } = await supabase
    .from("invitations")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (invitationError || !invitationData || invitationData.owner_id !== user.id) notFound();

  const [
    { data: giftsData, error: giftsError },
    { data: rsvpsData, error: rsvpsError },
    { data: declinesData, error: declinesError },
  ] = await Promise.all([
    supabase.from("gifts").select("*").eq("invitation_id", invitationData.id).order("sort_order"),
    supabase.from("rsvps").select("*").eq("invitation_id", invitationData.id).order("created_at", { ascending: true }),
    supabase.from("rsvp_declines").select("*").eq("invitation_id", invitationData.id).order("created_at", { ascending: false }),
  ]);

  if (giftsError || rsvpsError || declinesError) {
    throw new Error("Não foi possível carregar os dados deste convite.");
  }

  const gifts = (giftsData ?? []) as GiftItem[];
  const giftIds = gifts.map((gift) => gift.id);
  let reservations: GiftReservation[] = [];
  if (giftIds.length) {
    const { data } = await supabase.from("gift_reservations").select("*").in("gift_id", giftIds).order("reserved_at", { ascending: false });
    reservations = (data ?? []) as GiftReservation[];
  }

  const invitation = invitationData as Invitation;
  const declines = (declinesData ?? []) as RsvpDecline[];

  return (
    <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-bold text-[#765f65]"><ArrowLeft className="size-4" /> Meus convites</Link>
          <h1 className="mt-3 font-display text-3xl font-bold text-[#351820]">{invitation.event_title}</h1>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#806e72] shadow-sm">/c/{invitation.slug}</span>
      </div>

      <GiftProfileEditor
        invitationId={invitation.id}
        hostName={invitation.host_name}
        initialProfile={invitation.gift_profile ?? []}
      />

      <GiftReservationModeEditor
        initialGifts={gifts}
        reservations={reservations}
      />

      <RsvpDeclinesPanel invitationId={invitation.id} initialDeclines={declines} />

      <InvitationEditor
        initialInvitation={invitation}
        initialGifts={gifts}
        initialRsvps={(rsvpsData ?? []) as Rsvp[]}
        initialReservations={reservations}
      />
    </div>
  );
}
