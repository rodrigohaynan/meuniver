"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { CalendarDays, ExternalLink, Gift, MapPin, Search, Sparkles, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTheme } from "@/lib/themes";
import type { GiftItem, Invitation, Rsvp } from "@/lib/types";

function shopeeSearch(name: string) {
  return `https://shopee.com.br/search?keyword=${encodeURIComponent(name)}`;
}

function mercadoLivreSearch(name: string) {
  return `https://lista.mercadolivre.com.br/${encodeURIComponent(name)}`;
}

function formatAge(age: number) {
  const value = Math.max(1, Math.round(Number(age) || 1));
  return `${value} ${value === 1 ? "ano" : "anos"}`;
}

export function PublicInvitation({ initialInvitation, initialGifts }: { initialInvitation: Invitation; initialGifts: GiftItem[] }) {
  const invitation = {
    ...initialInvitation,
    hero_image_zoom: initialInvitation.hero_image_zoom ?? 1,
    hero_image_x: initialInvitation.hero_image_x ?? 50,
    hero_image_y: initialInvitation.hero_image_y ?? 50,
  };
  const [gifts, setGifts] = useState(initialGifts.map((gift) => ({ ...gift, suggestion_image_url: gift.suggestion_image_url ?? null })));
  const [reservationGift, setReservationGift] = useState<GiftItem | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestContact, setGuestContact] = useState("");
  const [rsvpContact, setRsvpContact] = useState("");
  const [rsvpWhatsapp, setRsvpWhatsapp] = useState("");
  const [attendees, setAttendees] = useState<Rsvp["attendees"]>([{ name: "", category: "adult" }]);
  const [message, setMessage] = useState("");

  const supabase = useMemo(() => createClient(), []);
  const theme = getTheme(invitation.theme_key);

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
    const cleanAttendees = attendees
      .filter((item) => item.name.trim().length >= 2)
      .map((item) => ({ name: item.name.trim(), category: item.category }));
    if (rsvpContact.trim().length < 2 || cleanAttendees.length === 0) {
      setMessage("Informe o responsável e pelo menos uma pessoa confirmada.");
      return;
    }
    const { error } = await supabase.from("rsvps").insert({
      invitation_id: invitation.id,
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

  const dateText = invitation.event_date
    ? new Date(`${invitation.event_date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const visibleGifts = gifts.filter((gift) => !gift.reserved);

  return (
    <main style={style} className="min-h-screen overflow-hidden bg-[var(--i-bg)] text-[var(--i-text)]">
      <div className="pointer-events-none absolute left-[-8rem] top-16 size-72 rounded-full bg-[var(--i-soft)] opacity-55 blur-3xl" />
      <div className="pointer-events-none absolute right-[-7rem] top-[36rem] size-80 rounded-full bg-[var(--i-soft)] opacity-45 blur-3xl" />

      <section className="relative mx-auto max-w-5xl px-4 pb-14 pt-5 sm:px-6 sm:pt-8">
        <div className={`overflow-hidden rounded-[2.1rem] border border-[var(--i-border)] bg-[var(--i-panel)] shadow-[0_18px_55px_rgba(58,28,37,.07)] ${invitation.layout_key === "kids" ? "ring-4 ring-[var(--i-soft)]" : ""}`}>
          <div className="relative aspect-[4/3] overflow-hidden bg-[var(--i-soft)] sm:aspect-[16/9]">
            {invitation.hero_image_url ? (
              <img
                src={invitation.hero_image_url}
                alt={`Foto de ${invitation.host_name}`}
                className="h-full w-full object-cover"
                style={heroImageStyle(invitation)}
              />
            ) : (
              <div className="grid h-full place-items-center text-7xl">{invitation.layout_key === "kids" ? "🎈" : "🎂"}</div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />
            <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[var(--i-accent)] shadow-sm backdrop-blur">{formatAge(invitation.age)}</span>
          </div>

          <div className={`px-6 py-8 sm:px-10 sm:py-11 ${invitation.layout_key === "modern" ? "text-left" : "text-center"}`}>
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[var(--i-accent)] ${invitation.layout_key === "modern" ? "justify-start" : "justify-center"}`}>
              <Sparkles className="size-3.5" /> Você está convidado
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-6xl">{invitation.event_title}</h1>
            {invitation.host_name && invitation.event_title.toLowerCase().indexOf(invitation.host_name.toLowerCase()) === -1 && (
              <p className="mt-2 font-display text-2xl font-semibold text-[var(--i-accent)]">{invitation.host_name}</p>
            )}
            <p className={`mt-6 text-base leading-8 text-[var(--i-muted)] sm:text-lg ${invitation.layout_key === "modern" ? "max-w-3xl" : "mx-auto max-w-3xl"}`}>{invitation.invitation_text}</p>

            {(dateText || invitation.location_name || invitation.address) && (
              <div className={`mt-8 grid gap-3 sm:grid-cols-2 ${invitation.layout_key === "modern" ? "max-w-3xl" : "mx-auto max-w-3xl"}`}>
                {dateText && (
                  <div className="flex items-start gap-3 rounded-2xl bg-[var(--i-soft)]/70 px-4 py-4 text-left">
                    <CalendarDays className="mt-0.5 size-5 shrink-0 text-[var(--i-accent)]" />
                    <div><p className="text-sm font-bold capitalize">{dateText}</p>{invitation.event_time && <p className="mt-1 text-sm text-[var(--i-muted)]">às {invitation.event_time}</p>}</div>
                  </div>
                )}
                {(invitation.location_name || invitation.address) && (
                  <div className="flex items-start gap-3 rounded-2xl bg-[var(--i-soft)]/70 px-4 py-4 text-left">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-[var(--i-accent)]" />
                    <div><p className="text-sm font-bold">{invitation.location_name || "Local da festa"}</p><p className="mt-1 text-sm leading-5 text-[var(--i-muted)]">{invitation.address}</p>{invitation.maps_url && <a href={invitation.maps_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--i-accent)]">Abrir no mapa <ExternalLink className="size-3.5" /></a>}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {invitation.rsvp_enabled && (
          <section className="mx-auto mt-10 max-w-4xl">
            <div className="text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--i-soft)] text-[var(--i-accent)]"><UsersRound className="size-5" /></span>
              <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Confirme sua presença</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--i-muted)]">{invitation.rsvp_note}</p>
            </div>

            <form onSubmit={submitRsvp} className="mt-6 rounded-[1.8rem] border border-[var(--i-border)] bg-[var(--i-panel)] p-5 shadow-[0_12px_38px_rgba(58,28,37,.045)] sm:p-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Quem está confirmando?"><input value={rsvpContact} onChange={(event) => setRsvpContact(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none focus:ring-2 focus:ring-[var(--i-soft)]" required /></Field>
                <Field label="WhatsApp (opcional)"><input value={rsvpWhatsapp} onChange={(event) => setRsvpWhatsapp(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none focus:ring-2 focus:ring-[var(--i-soft)]" /></Field>
              </div>
              <div className="mt-4 space-y-3">
                {attendees.map((attendee, index) => (
                  <div key={index} className="grid gap-2 rounded-2xl bg-[var(--i-bg)] p-3 sm:grid-cols-[1fr_auto_auto]">
                    <input value={attendee.name} onChange={(event) => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder={`Pessoa ${index + 1}`} className="h-10 rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none" />
                    <button type="button" onClick={() => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, category: "adult" } : item))} className={`h-10 rounded-xl px-3 text-sm font-bold ${attendee.category === "adult" ? "bg-[var(--i-accent)] text-white" : "border border-[var(--i-border)] bg-white"}`}>Adulto</button>
                    <button type="button" onClick={() => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, category: "child" } : item))} className={`h-10 rounded-xl px-3 text-sm font-bold ${attendee.category === "child" ? "bg-[var(--i-accent)] text-white" : "border border-[var(--i-border)] bg-white"}`}>Criança</button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => attendees.length < 12 && setAttendees((items) => [...items, { name: "", category: "adult" }])} className="h-10 rounded-full border border-[var(--i-border)] bg-white px-4 text-sm font-bold">+ Adicionar pessoa</button>
                {attendees.length > 1 && <button type="button" onClick={() => setAttendees((items) => items.slice(0, -1))} className="h-10 rounded-full px-4 text-sm font-bold text-red-700">Remover última</button>}
              </div>
              <button className="mt-5 h-11 rounded-full bg-[var(--i-accent)] px-6 font-bold text-white">Confirmar presença</button>
            </form>
          </section>
        )}

        {invitation.gift_enabled && (
          <section className="mt-12">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--i-accent)]">Se quiser presentear</p>
              <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Sugestões de presentes</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--i-muted)]">A presença é o mais importante. A lista abaixo é apenas uma ajuda para quem quiser escolher algo especial.</p>
            </div>

            {visibleGifts.length ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleGifts.map((gift, index) => (
                  <article key={gift.id} className="group flex min-h-64 flex-col overflow-hidden rounded-[1.6rem] border border-[var(--i-border)] bg-[var(--i-panel)] shadow-[0_10px_35px_rgba(58,28,37,.045)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(58,28,37,.08)]">
                    <GiftProductImage gift={gift} index={index} />
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-display text-xl font-bold">{gift.name}</h3>
                      <p className="mt-2 flex-1 text-sm leading-6 text-[var(--i-muted)]">{gift.description}</p>
                      {gift.suggestion_url ? (
                        <a href={gift.suggestion_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-bold text-[var(--i-accent)]">Ver sugestão <ExternalLink className="size-3.5" /></a>
                      ) : (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a href={shopeeSearch(gift.name)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--i-border)] px-3 text-xs font-bold"><Search className="size-3" /> Shopee</a>
                          <a href={mercadoLivreSearch(gift.name)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--i-border)] px-3 text-xs font-bold"><Search className="size-3" /> Mercado Livre</a>
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
            ) : (
              <div className="mx-auto mt-7 max-w-xl rounded-[1.8rem] border border-[var(--i-border)] bg-[var(--i-panel)] px-6 py-10 text-center"><Gift className="mx-auto size-9 text-[var(--i-accent)]" /><p className="mt-3 font-display text-2xl font-bold">Todos os presentes foram escolhidos</p><p className="mt-2 text-sm text-[var(--i-muted)]">Sua presença continua sendo o presente mais importante.</p></div>
            )}
          </section>
        )}

        {message && <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-[var(--i-border)] bg-[var(--i-panel)] px-5 py-4 text-center text-sm font-bold">{message}</div>}
      </section>

      {reservationGift && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4">
          <form onSubmit={reserveGift} className="mx-auto mt-16 w-full max-w-md rounded-[1.7rem] bg-white p-6 text-[#351820] shadow-2xl">
            <h3 className="font-display text-2xl font-bold">Vou dar: {reservationGift.name}</h3>
            <p className="mt-2 text-sm leading-6 text-[#806e72]">Seu nome fica visível somente para o responsável pelo convite.</p>
            <label className="mt-5 block text-sm font-bold">Seu nome<input value={guestName} onChange={(event) => setGuestName(event.target.value)} required minLength={2} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
            <label className="mt-4 block text-sm font-bold">WhatsApp ou contato (opcional)<input value={guestContact} onChange={(event) => setGuestContact(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
            <div className="mt-5 flex gap-2"><button className="h-10 rounded-full bg-[#7d1f37] px-5 text-sm font-bold text-white">Confirmar escolha</button><button type="button" onClick={() => setReservationGift(null)} className="h-10 rounded-full border border-[#d8c7bd] px-4 text-sm font-bold">Cancelar</button></div>
          </form>
        </div>
      )}
    </main>
  );
}

function GiftProductImage({ gift, index }: { gift: GiftItem; index: number }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [gift.manual_image_url, gift.suggestion_image_url]);

  const storedSuggestion = gift.suggestion_image_url?.includes("/storage/v1/object/public/invite-media/")
    ? gift.suggestion_image_url
    : null;
  const src = gift.manual_image_url || storedSuggestion;

  if (!src || failed) {
    return <div className="relative grid aspect-[4/3] place-items-center bg-[var(--i-soft)]"><Gift className="size-10 text-[var(--i-accent)]" /><span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--i-muted)]">{String(index + 1).padStart(2, "0")}</span></div>;
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--i-soft)]">
      <img
        key={src}
        src={src}
        alt={`Imagem sugerida de ${gift.name}`}
        className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
        onError={() => setFailed(true)}
      />
      <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--i-muted)] shadow-sm">{String(index + 1).padStart(2, "0")}</span>
    </div>
  );
}

function heroImageStyle(invitation: Pick<Invitation, "hero_image_zoom" | "hero_image_x" | "hero_image_y">): CSSProperties {
  return {
    objectPosition: `${clamp(invitation.hero_image_x ?? 50, 0, 100)}% ${clamp(invitation.hero_image_y ?? 50, 0, 100)}%`,
    transform: `scale(${clamp(invitation.hero_image_zoom ?? 1, 1, 2.5)})`,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold">{label}<div className="mt-2">{children}</div></label>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
