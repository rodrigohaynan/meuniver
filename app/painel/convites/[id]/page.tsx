import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InvitationEditor } from "@/components/invitation-editor";
import type { GiftItem, GiftReservation, Invitation, Rsvp } from "@/lib/types";

export default async function InvitationEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: invitationData }, { data: giftsData }, { data: rsvpsData }] = await Promise.all([
    supabase.from("invitations").select("*").eq("id", id).single(),
    supabase.from("gifts").select("*").eq("invitation_id", id).order("sort_order"),
    supabase.from("rsvps").select("*").eq("invitation_id", id).order("created_at", { ascending: false }),
  ]);

  if (!invitationData) notFound();

  const gifts = (giftsData ?? []) as GiftItem[];
  const giftIds = gifts.map((gift) => gift.id);
  let reservations: GiftReservation[] = [];
  if (giftIds.length) {
    const { data } = await supabase.from("gift_reservations").select("*").in("gift_id", giftIds).order("reserved_at", { ascending: false });
    reservations = (data ?? []) as GiftReservation[];
  }

  const invitation = invitationData as Invitation;

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 sm:py-9">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-bold text-[#765f65]"><ArrowLeft className="size-4" /> Meus convites</Link>
          <h1 className="mt-3 font-display text-3xl font-bold text-[#351820]">{invitation.event_title}</h1>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#806e72] shadow-sm">/c/{invitation.slug}</span>
      </div>

      <InvitationEditor
        initialInvitation={invitation}
        initialGifts={gifts}
        initialRsvps={(rsvpsData ?? []) as Rsvp[]}
        initialReservations={reservations}
      />
    </div>
  );
}
