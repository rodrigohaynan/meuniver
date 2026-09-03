"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { ExternalLink, Gift, MapPin, Search, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTheme } from "@/lib/themes";
import type { GiftItem, Invitation, Rsvp } from "@/lib/types";

function shopeeSearch(name: string) {
  return `https://shopee.com.br/search?keyword=${encodeURIComponent(name)}`;
}

function mercadoLivreSearch(name: string) {
  return `https://lista.mercadolivre.com.br/${encodeURIComponent(name)}`;
}

export function PublicInvitation({ initialInvitation, initialGifts }: { initialInvitation: Invitation; initialGifts: GiftItem[] }) {
  const [gifts, setGifts] = useState(initialGifts);
  const [reservationGift, setReservationGift] = useState<GiftItem | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestContact, setGuestContact] = useState("");
  const [rsvpContact, setRsvpContact] = useState("");
  const [rsvpWhatsapp, setRsvpWhatsapp] = useState("");
  const [attendees, setAttendees] = useState<Rsvp["attendees"]>([{ name: "", category: "adult" }]);
  const [message, setMessage] = useState("");

  const supabase = useMemo(() => createClient(), []);
  const theme = getTheme(initialInvitation.theme_key);

  const style = {
    "--i-bg": theme.colors.background,
    "--i-panel": theme.colors.panel,
    "--i-text": theme.colors.text,
    "--i-muted": theme.colors.muted,
    "--i-accent": theme.colors.accent,
    "--i-soft": theme.colors.accentSoft,
    "--i-border": theme.colors.border,
  } as CSSProperties;

  async function reserveGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reservationGift) return;
    setMessage("");
    const { data, error } = await supabase.rpc("reserve_gift_public", {
      p_gift_id: reservationGift.id,
      p_guest_name: guestName.trim(),
      p_guest_contact: guestContact.trim(),
    });
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      setMessage(error?.message ?? result?.error ?? "Esse presente não está mais disponível.");
      return;
    }
    setGifts((items) => items.map((item) => item.id === reservationGift.id ? { ...item, reserved: true } : item));
    setReservationGift(null);
    setGuestName("");
    setGuestContact("");
    setMessage("Presente reservado. Obrigado! 🎁");
  }

  async function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanAttendees = attendees.filter((item) => item.name.trim().length >= 2).map((item) => ({ name: item.name.trim(), category: item.category }));
    if (rsvpContact.trim().length < 2 || cleanAttendees.length === 0) {
      setMessage("Informe o responsável e pelo menos uma pessoa confirmada.");
      return;
    }
    const { error } = await supabase.from("rsvps").insert({
      invitation_id: initialInvitation.id,
      contact_name: rsvpContact.trim(),
      whatsapp: rsvpWhatsapp.trim(),
      attendees: cleanAttendees,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setRsvpContact("");
    setRsvpWhatsapp("");
    setAttendees([{ name: "", category: "adult" }]);
    setMessage("Presença confirmada. Nos vemos na festa! 🎉");
  }

  return (
    <main style={style} className="min-h-screen bg-[var(--i-bg)] text-[var(--i-text)]">
      <section className={`mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 ${initialInvitation.layout_key === "modern" ? "max-w-6xl" : ""}`}>
        <div className={`overflow-hidden border border-[var(--i-border)] bg-[var(--i-panel)] shadow-[0_20px_60px_rgba(40,20,30,.08)] ${initialInvitation.layout_key === "kids" ? "rounded-[2.5rem]" : "rounded-[2rem]"}`}>
          {initialInvitation.hero_image_url ? (
            <img src={initialInvitation.hero_image_url} alt={`Foto de ${initialInvitation.host_name}`} className={`w-full object-cover ${initialInvitation.layout_key === "modern" ? "max-h-[520px]" : "max-h-[620px]"}`} />
          ) : (
            <div className="grid min-h-72 place-items-center bg-[var(--i-soft)] text-7xl">{initialInvitation.layout_key === "kids" ? "🎈" : "🎂"}</div>
          )}

          <div className={`p-6 sm:p-10 ${initialInvitation.layout_key === "modern" ? "text-left" : "text-center"}`}>
            <p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--i-accent)]">Você está convidado</p>
            <h1 className="mt-4 font-display text-4xl font-bold sm:text-6xl">{initialInvitation.event_title}</h1>
            <p className="mt-3 text-base font-bold text-[var(--i-muted)]">{initialInvitation.age} anos</p>

            <div className={`mt-7 flex flex-wrap gap-3 ${initialInvitation.layout_key === "modern" ? "justify-start" : "justify-center"}`}>
              {initialInvitation.event_date && <span className="rounded-full bg-[var(--i-soft)] px-4 py-2 text-sm font-bold">{new Date(`${initialInvitation.event_date}T12:00:00`).toLocaleDateString("pt-BR")}{initialInvitation.event_time ? ` • ${initialInvitation.event_time}` : ""}</span>}
              {initialInvitation.location_name && <span className="rounded-full bg-[var(--i-soft)] px-4 py-2 text-sm font-bold">{initialInvitation.location_name}</span>}
            </div>

            <p className={`mt-7 text-base leading-8 text-[var(--i-muted)] ${initialInvitation.layout_key === "modern" ? "max-w-2xl" : "mx-auto max-w-2xl"}`}>{initialInvitation.invitation_text}</p>

            {(initialInvitation.address || initialInvitation.maps_url) && (
              <div className={`mt-7 rounded-2xl border border-[var(--i-border)] bg-[var(--i-bg)] p-4 ${initialInvitation.layout_key === "modern" ? "max-w-2xl" : "mx-auto max-w-2xl"}`}>
                <div className={`flex gap-3 ${initialInvitation.layout_key === "modern" ? "" : "justify-center"}`}>
                  <MapPin className="mt-0.5 size-5 shrink-0 text-[var(--i-accent)]" />
                  <div className={initialInvitation.layout_key === "modern" ? "text-left" : "text-left"}>
                    <p className="font-bold">{initialInvitation.location_name}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--i-muted)]">{initialInvitation.address}</p>
                    {initialInvitation.maps_url && <a href={initialInvitation.maps_url} target="_blank" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[var(--i-accent)]">Abrir no mapa <ExternalLink className="size-3.5" /></a>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {initialInvitation.rsvp_enabled && (
          <section className="mt-6 rounded-[2rem] border border-[var(--i-border)] bg-[var(--i-panel)] p-6 sm:p-8">
            <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--i-soft)] text-[var(--i-accent)]"><UsersRound className="size-5" /></span><div><h2 className="font-display text-3xl font-bold">Confirme sua presença</h2><p className="mt-1 text-sm leading-6 text-[var(--i-muted)]">{initialInvitation.rsvp_note}</p></div></div>
            <form onSubmit={submitRsvp} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Quem está confirmando?"><input value={rsvpContact} onChange={(event) => setRsvpContact(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none" required /></Field>
                <Field label="WhatsApp (opcional)"><input value={rsvpWhatsapp} onChange={(event) => setRsvpWhatsapp(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none" /></Field>
              </div>
              <div className="space-y-3">
                {attendees.map((attendee, index) => (
                  <div key={index} className="grid gap-2 rounded-2xl bg-[var(--i-bg)] p-3 sm:grid-cols-[1fr_auto_auto]">
                    <input value={attendee.name} onChange={(event) => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder={`Pessoa ${index + 1}`} className="h-10 rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none" />
                    <button type="button" onClick={() => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, category: "adult" as const } : item))} className={`h-10 rounded-xl px-3 text-sm font-bold ${attendee.category === "adult" ? "bg-[var(--i-accent)] text-white" : "border border-[var(--i-border)] bg-white"}`}>Adulto</button>
                    <button type="button" onClick={() => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, category: "child" as const } : item))} className={`h-10 rounded-xl px-3 text-sm font-bold ${attendee.category === "child" ? "bg-[var(--i-accent)] text-white" : "border border-[var(--i-border)] bg-white"}`}>Criança</button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => attendees.length < 12 && setAttendees((items) => [...items, { name: "", category: "adult" }])} className="h-10 rounded-full border border-[var(--i-border)] px-4 text-sm font-bold">+ Adicionar pessoa</button>
                {attendees.length > 1 && <button type="button" onClick={() => setAttendees((items) => items.slice(0, -1))} className="h-10 rounded-full px-4 text-sm font-bold text-red-700">Remover última</button>}
              </div>
              <button className="h-11 rounded-full bg-[var(--i-accent)] px-6 font-bold text-white">Confirmar presença</button>
            </form>
          </section>
        )}

        {initialInvitation.gift_enabled && (
          <section className="mt-6">
            <div className="mb-5">
              <p className="text-sm font-bold uppercase tracking-[.16em] text-[var(--i-accent)]">Se quiser presentear</p>
              <h2 className="mt-2 font-display text-3xl font-bold">Sugestões de presentes</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--i-muted)]">A presença é o mais importante. A lista é apenas uma ajuda para quem quiser escolher algo especial.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gifts.filter((gift) => !gift.reserved).map((gift) => (
                <article key={gift.id} className="flex min-h-64 flex-col overflow-hidden rounded-[1.6rem] border border-[var(--i-border)] bg-[var(--i-panel)]">
                  {gift.manual_image_url ? (
                    <img src={gift.manual_image_url} alt={gift.name} className="aspect-[4/3] w-full object-contain bg-[var(--i-soft)]" />
                  ) : gift.suggestion_url ? (
                    <img src={`/api/product-image/${gift.id}?url=${encodeURIComponent(gift.suggestion_url)}`} alt={gift.name} className="aspect-[4/3] w-full object-contain bg-[var(--i-soft)]" />
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center bg-[var(--i-soft)]"><Gift className="size-10 text-[var(--i-accent)]" /></div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-xl font-bold">{gift.name}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-[var(--i-muted)]">{gift.description}</p>
                    {gift.suggestion_url ? (
                      <a href={gift.suggestion_url} target="_blank" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--i-accent)]">Ver sugestão <ExternalLink className="size-3.5" /></a>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a href={shopeeSearch(gift.name)} target="_blank" className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--i-border)] px-3 text-xs font-bold"><Search className="size-3" /> Shopee</a>
                        <a href={mercadoLivreSearch(gift.name)} target="_blank" className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--i-border)] px-3 text-xs font-bold"><Search className="size-3" /> Mercado Livre</a>
                      </div>
                    )}
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--i-border)] pt-4">
                      <span className="text-xs font-bold text-[var(--i-muted)]">{gift.price_hint}</span>
                      <button type="button" onClick={() => setReservationGift(gift)} className="h-9 rounded-full bg-[var(--i-accent)] px-4 text-xs font-bold text-white">Escolher</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {message && <div className="mt-6 rounded-2xl border border-[var(--i-border)] bg-[var(--i-panel)] px-5 py-4 text-center text-sm font-bold">{message}</div>}
      </section>

      {reservationGift && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4">
          <form onSubmit={reserveGift} className="mx-auto mt-16 w-full max-w-md rounded-[1.7rem] bg-white p-6 text-[#351820] shadow-2xl">
            <h3 className="font-display text-2xl font-bold">Vou dar: {reservationGift.name}</h3>
            <p className="mt-2 text-sm leading-6 text-[#806e72]">Seu nome fica visível somente para o responsável pelo convite.</p>
            <label className="mt-5 block text-sm font-bold">Seu nome<input value={guestName} onChange={(event) => setGuestName(event.target.value)} required minLength={2} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
            <label className="mt-4 block text-sm font-bold">WhatsApp ou contato (opcional)<input value={guestContact} onChange={(event) => setGuestContact(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
            <div className="mt-5 flex gap-2">
              <button className="h-10 rounded-full bg-[#7d1f37] px-5 text-sm font-bold text-white">Confirmar escolha</button>
              <button type="button" onClick={() => setReservationGift(null)} className="h-10 rounded-full border border-[#d8c7bd] px-4 text-sm font-bold">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold">{label}<div className="mt-2">{children}</div></label>;
}
