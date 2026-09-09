"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clipboard,
  ExternalLink,
  Gift,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTheme } from "@/lib/themes";
import type { GiftItem, Invitation, Rsvp } from "@/lib/types";

function shopeeSearch(name: string) {
  return `https://shopee.com.br/search?keyword=${encodeURIComponent(name)}`;
}

function mercadoLivreSearch(name: string) {
  return `https://lista.mercadolivre.com.br/${encodeURIComponent(name)}`;
}

function suggestionImageFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function suggestionImageProxyUrl(giftId: string, suggestionUrl: string) {
  const fingerprint = suggestionImageFingerprint(suggestionUrl);
  const cacheKey = `${giftId}-${fingerprint}`;
  return `/api/product-image/${encodeURIComponent(cacheKey)}?url=${encodeURIComponent(suggestionUrl)}`;
}

function isStoredSuggestionImage(value: string | null) {
  return Boolean(value?.includes("/storage/v1/object/public/invite-media/"));
}

function formatAge(age: number, ageUnit: Invitation["age_unit"] = "years") {
  const value = Math.max(1, Math.round(Number(age) || 1));
  if (ageUnit === "months") return `${value} ${value === 1 ? "mês" : "meses"}`;
  return `${value} ${value === 1 ? "ano" : "anos"}`;
}

function normalizePersonName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const clean = digits(value).slice(0, 11);
  return clean
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

type DuplicateInfo = {
  submittedName: string;
  existingName: string;
  contactName: string;
  rsvpId: string;
  matchType?: "exact" | "first-name";
};

type PixGiftData = {
  giftId: string;
  paymentId: string;
  status: string;
  amount: number;
  platformFee: number;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
};

export function PublicInvitation({
  initialInvitation,
  initialGifts,
}: {
  initialInvitation: Invitation;
  initialGifts: GiftItem[];
}) {
  const invitation = {
    ...initialInvitation,
    hero_image_zoom: initialInvitation.hero_image_zoom ?? 1,
    hero_image_x: initialInvitation.hero_image_x ?? 50,
    hero_image_y: initialInvitation.hero_image_y ?? 50,
    pix_gift_enabled: initialInvitation.pix_gift_enabled ?? true,
    age_unit: initialInvitation.age_unit ?? "years",
  };

  const [gifts, setGifts] = useState(
    initialGifts.map((gift) => ({
      ...gift,
      suggestion_image_url: gift.suggestion_image_url ?? null,
    })),
  );
  const [reservationGift, setReservationGift] = useState<GiftItem | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestContact, setGuestContact] = useState("");

  const [rsvpContact, setRsvpContact] = useState("");
  const [rsvpWhatsapp, setRsvpWhatsapp] = useState("");
  const [attendees, setAttendees] = useState<Rsvp["attendees"]>([
    { name: "", category: "adult" },
  ]);
  const [includeContactAsAttendee, setIncludeContactAsAttendee] = useState(true);
  const [rsvpContactCategory, setRsvpContactCategory] = useState<
    Rsvp["attendees"][number]["category"]
  >("adult");
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  const [showRsvpSuccess, setShowRsvpSuccess] = useState(false);
  const [message, setMessage] = useState("");

  const [showDecline, setShowDecline] = useState(false);
  const [declineName, setDeclineName] = useState("");
  const [declineWhatsapp, setDeclineWhatsapp] = useState("");
  const [declineBusy, setDeclineBusy] = useState(false);
  const [declineDone, setDeclineDone] = useState(false);
  const [declineMessage, setDeclineMessage] = useState("");

  const [pixGiftAvailable, setPixGiftAvailable] = useState(false);
  const [showPixGift, setShowPixGift] = useState(false);
  const [pixGuestName, setPixGuestName] = useState("");
  const [pixGuestEmail, setPixGuestEmail] = useState("");
  const [pixGuestWhatsapp, setPixGuestWhatsapp] = useState("");
  const [pixCpf, setPixCpf] = useState("");
  const [pixAmount, setPixAmount] = useState("50");
  const [pixBusy, setPixBusy] = useState(false);
  const [pixError, setPixError] = useState("");
  const [pixData, setPixData] = useState<PixGiftData | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixApproved, setPixApproved] = useState(false);

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

  useEffect(() => {
    let active = true;

    async function checkPixAvailability() {
      if (!invitation.pix_gift_enabled) return;
      const { data, error } = await supabase.rpc("pix_gift_status_public", {
        p_invitation_id: invitation.id,
      });
      if (!active || error) return;
      const result = data as { available?: boolean } | null;
      setPixGiftAvailable(Boolean(result?.available));
    }

    void checkPixAvailability();
    return () => { active = false; };
  }, [invitation.id, invitation.pix_gift_enabled, supabase]);

  useEffect(() => {
    if (!pixData?.giftId || pixApproved) return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/pix-gifts/${encodeURIComponent(pixData.giftId)}/status`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;

        if (data.status) {
          setPixData((current) => current ? { ...current, status: data.status } : current);
        }
        if (data.approved) setPixApproved(true);
      } catch {
        // A consulta automática tenta novamente no próximo ciclo.
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [pixData?.giftId, pixApproved]);

  const cleanAttendees = useMemo(
    () =>
      attendees
        .filter((item) => item.name.trim().length >= 2)
        .map((item) => ({
          name: item.name.trim().replace(/\s+/g, " "),
          category: item.category,
        })),
    [attendees],
  );

  const contactAlreadyListed = useMemo(() => {
    const normalizedContact = normalizePersonName(rsvpContact);
    if (normalizedContact.length < 2) return false;
    return cleanAttendees.some(
      (item) => normalizePersonName(item.name) === normalizedContact,
    );
  }, [cleanAttendees, rsvpContact]);

  const effectiveAttendees = useMemo<Rsvp["attendees"]>(() => {
    const contact = rsvpContact.trim().replace(/\s+/g, " ");
    if (!includeContactAsAttendee || contact.length < 2 || contactAlreadyListed) {
      return cleanAttendees;
    }
    return [{ name: contact, category: rsvpContactCategory }, ...cleanAttendees];
  }, [
    cleanAttendees,
    contactAlreadyListed,
    includeContactAsAttendee,
    rsvpContact,
    rsvpContactCategory,
  ]);

  const attendeeSummary = useMemo(
    () => ({
      total: effectiveAttendees.length,
      adults: effectiveAttendees.filter((item) => item.category === "adult").length,
      children: effectiveAttendees.filter((item) => item.category === "child").length,
    }),
    [effectiveAttendees],
  );

  const maxManualAttendees = includeContactAsAttendee && !contactAlreadyListed ? 11 : 12;

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

    setGifts((items) =>
      items.map((item) => item.id === reservationGift.id ? { ...item, reserved: true } : item),
    );
    setReservationGift(null);
    setGuestName("");
    setGuestContact("");
    setMessage("Presente reservado. Obrigado! 🎁");
  }

  async function performRsvpSubmit(
    allowDuplicate = false,
  ): Promise<"saved" | "cancelled"> {
    const { data, error } = await supabase.rpc("submit_rsvp_public", {
      p_invitation_id: invitation.id,
      p_contact_name: rsvpContact.trim(),
      p_whatsapp: rsvpWhatsapp.trim(),
      p_attendees: effectiveAttendees,
      p_allow_duplicate: allowDuplicate,
    });

    if (error) throw new Error(error.message);

    const result = data as {
      ok?: boolean;
      error?: string;
      code?: string;
      duplicates?: DuplicateInfo[];
    } | null;

    if (result?.code === "duplicate-name" && result.duplicates?.length) {
      const lines = result.duplicates.map((item) => {
        if (item.matchType === "first-name") {
          if (item.rsvpId === "current") {
            return `• ${item.submittedName}: possível duplicidade com ${item.existingName} nesta mesma confirmação (mesmo primeiro nome).`;
          }
          return `• ${item.submittedName}: possível duplicidade. Já existe ${item.existingName}, adicionado(a) por ${item.contactName}.`;
        }
        if (item.rsvpId === "current") {
          return `• ${item.submittedName}: o nome aparece duas vezes nesta mesma confirmação.`;
        }
        return `• ${item.submittedName}: pessoa com nome igual já foi adicionada por ${item.contactName}.`;
      });

      const proceed = window.confirm(
        `ATENÇÃO — POSSÍVEL DUPLICIDADE\n\n${lines.join("\n")}\n\nSe forem pessoas diferentes, toque em OK para confirmar mesmo assim. Caso contrário, toque em Cancelar e corrija a lista.`,
      );
      if (!proceed) return "cancelled";
      return performRsvpSubmit(true);
    }

    if (!result?.ok) throw new Error(result?.error ?? "Não foi possível confirmar a presença.");
    return "saved";
  }

  async function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rsvpSubmitting) return;

    if (rsvpContact.trim().length < 2 || effectiveAttendees.length === 0) {
      setMessage("Informe o responsável e pelo menos uma pessoa confirmada.");
      return;
    }
    if (effectiveAttendees.length > 12) {
      setMessage("A confirmação pode ter no máximo 12 pessoas.");
      return;
    }

    setRsvpSubmitting(true);
    setMessage("");

    try {
      const outcome = await performRsvpSubmit();
      if (outcome === "cancelled") {
        setMessage("Revise a lista antes de confirmar.");
        return;
      }

      setRsvpContact("");
      setRsvpWhatsapp("");
      setAttendees([{ name: "", category: "adult" }]);
      setIncludeContactAsAttendee(true);
      setRsvpContactCategory("adult");
      setShowRsvpSuccess(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar a presença.");
    } finally {
      setRsvpSubmitting(false);
    }
  }

  function openDeclineModal() {
    setDeclineName(rsvpContact.trim());
    setDeclineWhatsapp(rsvpWhatsapp.trim());
    setDeclineDone(false);
    setDeclineMessage("");
    setShowDecline(true);
  }

  async function submitDecline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (declineBusy || declineName.trim().length < 2) return;

    setDeclineBusy(true);
    setDeclineMessage("");
    try {
      const { data, error } = await supabase.rpc("decline_rsvp_public", {
        p_invitation_id: invitation.id,
        p_contact_name: declineName.trim(),
        p_whatsapp: declineWhatsapp.trim(),
      });
      const result = data as { ok?: boolean; error?: string } | null;
      if (error || !result?.ok) throw new Error(error?.message || result?.error || "Não foi possível enviar sua resposta.");
      setDeclineDone(true);
    } catch (error) {
      setDeclineMessage(error instanceof Error ? error.message : "Não foi possível enviar sua resposta.");
    } finally {
      setDeclineBusy(false);
    }
  }

  function openPixGift() {
    setPixGuestName(declineName.trim() || rsvpContact.trim());
    setPixGuestWhatsapp(declineWhatsapp.trim() || rsvpWhatsapp.trim());
    setPixError("");
    setPixData(null);
    setPixApproved(false);
    setShowDecline(false);
    setShowPixGift(true);
  }

  async function createPixGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pixBusy) return;

    setPixBusy(true);
    setPixError("");
    try {
      const response = await fetch("/api/pix-gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitationId: invitation.id,
          guestName: pixGuestName.trim(),
          guestEmail: pixGuestEmail.trim(),
          guestWhatsapp: pixGuestWhatsapp.trim(),
          payerCpf: digits(pixCpf),
          amount: Number(pixAmount),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data?.error || "Não foi possível gerar o PIX.");
      setPixData(data as PixGiftData);
      if (data.status === "approved") setPixApproved(true);
    } catch (error) {
      setPixError(error instanceof Error ? error.message : "Não foi possível gerar o PIX.");
    } finally {
      setPixBusy(false);
    }
  }

  async function copyPixCode() {
    if (!pixData?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setPixCopied(true);
      window.setTimeout(() => setPixCopied(false), 1800);
    } catch {
      setPixError("Não foi possível copiar automaticamente. Se preferir, use o QR Code.");
    }
  }

  const dateText = invitation.event_date
    ? new Date(`${invitation.event_date}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
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
            <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[var(--i-accent)] shadow-sm backdrop-blur">{formatAge(invitation.age, invitation.age_unit)}</span>
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
                    <div>
                      <p className="text-sm font-bold capitalize">{dateText}</p>
                      {invitation.event_time && <p className="mt-1 text-sm text-[var(--i-muted)]">às {invitation.event_time}</p>}
                    </div>
                  </div>
                )}
                {(invitation.location_name || invitation.address) && (
                  <div className="flex items-start gap-3 rounded-2xl bg-[var(--i-soft)]/70 px-4 py-4 text-left">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-[var(--i-accent)]" />
                    <div>
                      <p className="text-sm font-bold">{invitation.location_name || "Local da festa"}</p>
                      <p className="mt-1 text-sm leading-5 text-[var(--i-muted)]">{invitation.address}</p>
                      {invitation.maps_url && (
                        <a href={invitation.maps_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--i-accent)]">
                          Abrir no mapa <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
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
                <div>
                  <Field label="Quem está confirmando?">
                    <input value={rsvpContact} onChange={(event) => setRsvpContact(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none focus:ring-2 focus:ring-[var(--i-soft)]" required />
                  </Field>
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--i-border)] bg-[var(--i-bg)] p-3">
                    <input type="checkbox" checked={includeContactAsAttendee} onChange={(event) => setIncludeContactAsAttendee(event.target.checked)} className="mt-0.5 size-4 accent-[var(--i-accent)]" />
                    <span>
                      <span className="block text-sm font-bold">O responsável também vai à festa</span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--i-muted)]">
                        {contactAlreadyListed
                          ? "Este nome já está na lista abaixo e não será duplicado."
                          : includeContactAsAttendee
                            ? "Será incluído automaticamente. Escolha abaixo se é adulto ou criança."
                            : "Marque esta opção para incluí-lo automaticamente."}
                      </span>
                    </span>
                  </label>
                </div>

                <Field label="WhatsApp (opcional)">
                  <input value={rsvpWhatsapp} onChange={(event) => setRsvpWhatsapp(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none focus:ring-2 focus:ring-[var(--i-soft)]" />
                </Field>
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--i-border)] bg-[var(--i-soft)]/45 p-4">
                <p className="text-sm font-bold">
                  {includeContactAsAttendee ? "O responsável será contado automaticamente." : "O responsável não será contado como convidado."}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--i-muted)]">
                  {includeContactAsAttendee ? "Adicione abaixo somente as outras pessoas que irão junto." : "Adicione abaixo todas as pessoas que irão à festa."}
                </p>

                {includeContactAsAttendee && rsvpContact.trim().length >= 2 && !contactAlreadyListed && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--i-muted)]">Responsável incluído automaticamente</p>
                      <p className="mt-0.5 text-sm font-bold">{rsvpContact.trim()}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setRsvpContactCategory("adult")} className={`h-9 rounded-full border px-3 text-xs font-bold ${rsvpContactCategory === "adult" ? "border-[var(--i-accent)] bg-[var(--i-accent)] text-white" : "border-[var(--i-border)] bg-white"}`}>Adulto</button>
                      <button type="button" onClick={() => setRsvpContactCategory("child")} className={`h-9 rounded-full border px-3 text-xs font-bold ${rsvpContactCategory === "child" ? "border-[var(--i-accent)] bg-[var(--i-accent)] text-white" : "border-[var(--i-border)] bg-white"}`}>Criança</button>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-white px-3 py-1.5">{attendeeSummary.total} pessoa(s)</span>
                  <span className="rounded-full bg-white px-3 py-1.5">{attendeeSummary.adults} adulto(s)</span>
                  <span className="rounded-full bg-white px-3 py-1.5">{attendeeSummary.children} criança(s)</span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {attendees.map((attendee, index) => (
                  <div key={index} className="grid gap-2 rounded-2xl bg-[var(--i-bg)] p-3 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      value={attendee.name}
                      onChange={(event) => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                      placeholder={includeContactAsAttendee ? `Outra pessoa ${index + 1}` : `Pessoa ${index + 1}`}
                      className="h-10 rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none"
                    />
                    <button type="button" onClick={() => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, category: "adult" } : item))} className={`h-10 rounded-xl px-3 text-sm font-bold ${attendee.category === "adult" ? "bg-[var(--i-accent)] text-white" : "border border-[var(--i-border)] bg-white"}`}>Adulto</button>
                    <button type="button" onClick={() => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, category: "child" } : item))} className={`h-10 rounded-xl px-3 text-sm font-bold ${attendee.category === "child" ? "bg-[var(--i-accent)] text-white" : "border border-[var(--i-border)] bg-white"}`}>Criança</button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => attendees.length < maxManualAttendees && setAttendees((items) => [...items, { name: "", category: "adult" }])} disabled={attendees.length >= maxManualAttendees} className="h-10 rounded-full border border-[var(--i-border)] bg-white px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">+ Adicionar pessoa</button>
                {attendees.length > 1 && <button type="button" onClick={() => setAttendees((items) => items.slice(0, -1))} className="h-10 rounded-full px-4 text-sm font-bold text-red-700">Remover última</button>}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button disabled={rsvpSubmitting} className="h-11 rounded-full bg-[var(--i-accent)] px-6 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  {rsvpSubmitting ? "Verificando nomes…" : "Confirmar presença"}
                </button>
                <button type="button" onClick={openDeclineModal} className="h-11 rounded-full border border-[var(--i-border)] bg-white px-6 font-bold text-[var(--i-muted)]">
                  Não poderei comparecer
                </button>
              </div>
            </form>

            <div className="mt-4 rounded-2xl border border-[var(--i-border)] bg-[var(--i-panel)] px-5 py-4 text-center text-sm leading-6 text-[var(--i-muted)]">
              Não poderá ir? Avise o organizador. {pixGiftAvailable && "Se quiser, você também poderá enviar um presente em PIX."}
            </div>
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
              <div className="mx-auto mt-7 max-w-xl rounded-[1.8rem] border border-[var(--i-border)] bg-[var(--i-panel)] px-6 py-10 text-center">
                <Gift className="mx-auto size-9 text-[var(--i-accent)]" />
                <p className="mt-3 font-display text-2xl font-bold">Todos os presentes foram escolhidos</p>
                <p className="mt-2 text-sm text-[var(--i-muted)]">Sua presença continua sendo o presente mais importante.</p>
              </div>
            )}
          </section>
        )}

        {message && <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-[var(--i-border)] bg-[var(--i-panel)] px-5 py-4 text-center text-sm font-bold">{message}</div>}
      </section>

      {showRsvpSuccess && (
        <Modal onClose={() => setShowRsvpSuccess(false)}>
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-7" /></span>
            <h3 className="mt-4 font-display text-3xl font-bold">Presença confirmada!</h3>
            <p className="mt-2 text-sm leading-6 text-[#806e72]">Sua confirmação foi enviada ao organizador. Esperamos você na comemoração.</p>
            <div className="mt-6 rounded-2xl bg-[#fff6f1] p-5 text-left">
              <p className="font-bold text-[#5d313e]">Gostou do CONVNIVER?</p>
              <p className="mt-1 text-sm leading-6 text-[#76666a]">Crie sua conta gratuitamente agora e deixe tudo pronto para, em breve, criar e gerenciar seus próprios convites.</p>
              <a href="/entrar?modo=cadastro&origem=confirmacao" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#7d1f37] px-5 font-bold text-white">Criar minha conta</a>
            </div>
            <button type="button" onClick={() => setShowRsvpSuccess(false)} className="mt-4 text-sm font-bold text-[#806e72]">Continuar no convite</button>
          </div>
        </Modal>
      )}

      {showDecline && (
        <Modal onClose={() => setShowDecline(false)}>
          {!declineDone ? (
            <form onSubmit={submitDecline}>
              <h3 className="font-display text-2xl font-bold">Não poderei comparecer</h3>
              <p className="mt-2 text-sm leading-6 text-[#806e72]">Avise o organizador para que ele possa se planejar.</p>
              <label className="mt-5 block text-sm font-bold">Seu nome<input value={declineName} onChange={(event) => setDeclineName(event.target.value)} required minLength={2} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
              <label className="mt-4 block text-sm font-bold">WhatsApp (opcional)<input value={declineWhatsapp} onChange={(event) => setDeclineWhatsapp(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
              {declineMessage && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{declineMessage}</p>}
              <button disabled={declineBusy} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-60">{declineBusy && <Loader2 className="size-4 animate-spin" />} Enviar resposta</button>
            </form>
          ) : (
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#f4e7e0] text-[#7d1f37]"><CheckCircle2 className="size-7" /></span>
              <h3 className="mt-4 font-display text-2xl font-bold">Resposta enviada</h3>
              <p className="mt-2 text-sm leading-6 text-[#806e72]">O organizador foi informado de que você não poderá comparecer.</p>
              {pixGiftAvailable && (
                <div className="mt-5 rounded-2xl bg-[#fff6f1] p-5">
                  <CircleDollarSign className="mx-auto size-8 text-[#7d1f37]" />
                  <p className="mt-3 font-bold">Quer deixar um presente mesmo à distância?</p>
                  <p className="mt-1 text-sm leading-6 text-[#806e72]">Você pode escolher um valor e pagar por PIX com segurança.</p>
                  <button type="button" onClick={openPixGift} className="mt-4 h-11 w-full rounded-full bg-[#7d1f37] px-5 font-bold text-white">Enviar presente em PIX</button>
                </div>
              )}
              <button type="button" onClick={() => setShowDecline(false)} className="mt-4 text-sm font-bold text-[#806e72]">Fechar</button>
            </div>
          )}
        </Modal>
      )}

      {showPixGift && (
        <Modal onClose={() => setShowPixGift(false)} wide>
          {!pixData ? (
            <form onSubmit={createPixGift}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f4e7e0] text-[#7d1f37]"><CircleDollarSign className="size-5" /></span>
                <div>
                  <h3 className="font-display text-2xl font-bold">Presente em PIX</h3>
                  <p className="mt-1 text-sm leading-6 text-[#806e72]">Escolha um valor. O pagamento será processado pelo Mercado Pago.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold sm:col-span-2">Seu nome<input value={pixGuestName} onChange={(event) => setPixGuestName(event.target.value)} required minLength={2} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
                <label className="block text-sm font-bold">E-mail<input type="email" value={pixGuestEmail} onChange={(event) => setPixGuestEmail(event.target.value)} required className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
                <label className="block text-sm font-bold">CPF<input value={pixCpf} onChange={(event) => setPixCpf(formatCpf(event.target.value))} required inputMode="numeric" className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" placeholder="000.000.000-00" /></label>
                <label className="block text-sm font-bold">WhatsApp (opcional)<input value={pixGuestWhatsapp} onChange={(event) => setPixGuestWhatsapp(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
                <label className="block text-sm font-bold">Valor do presente<input type="number" min="5" max="10000" step="0.01" value={pixAmount} onChange={(event) => setPixAmount(event.target.value)} required className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
              </div>

              <p className="mt-4 rounded-xl bg-[#faf6f3] px-4 py-3 text-xs leading-5 text-[#76666a]">O CONVNIVER cobra 5% do valor do presente como taxa da plataforma. As tarifas do Mercado Pago são aplicadas conforme a conta do organizador.</p>
              {pixError && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{pixError}</p>}
              <button disabled={pixBusy} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-60">{pixBusy && <Loader2 className="size-4 animate-spin" />} Gerar PIX</button>
            </form>
          ) : pixApproved ? (
            <div className="text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-8" /></span>
              <h3 className="mt-4 font-display text-3xl font-bold">Presente recebido!</h3>
              <p className="mt-2 text-sm leading-6 text-[#806e72]">Pagamento confirmado. O valor será dividido automaticamente entre o organizador e o CONVNIVER pelo Mercado Pago.</p>
              <button type="button" onClick={() => setShowPixGift(false)} className="mt-5 h-11 rounded-full bg-[#7d1f37] px-6 font-bold text-white">Concluir</button>
            </div>
          ) : (
            <div className="text-center">
              <h3 className="font-display text-2xl font-bold">Pague o PIX</h3>
              <p className="mt-2 text-sm leading-6 text-[#806e72]">Presente de <strong>{formatCurrency(pixData.amount)}</strong>. A confirmação será atualizada automaticamente.</p>

              {pixData.qrCodeBase64 && <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto mt-5 size-64 max-w-full rounded-2xl border border-[#eaded7] bg-white p-3" />}
              {pixData.qrCode && (
                <button type="button" onClick={() => void copyPixCode()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white"><Clipboard className="size-4" /> {pixCopied ? "Código copiado" : "Copiar PIX copia e cola"}</button>
              )}
              {pixData.ticketUrl && <a href={pixData.ticketUrl} target="_blank" rel="noreferrer" className="mx-auto mt-3 block w-fit text-sm font-bold text-[#7d1f37]">Abrir pagamento <ExternalLink className="ml-1 inline size-3.5" /></a>}
              <div className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-[#806e72]"><Loader2 className="size-4 animate-spin" /> Aguardando confirmação…</div>
              {pixError && <p className="mt-3 text-sm text-red-700">{pixError}</p>}
            </div>
          )}
        </Modal>
      )}

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

function Modal({
  onClose,
  children,
  wide = false,
}: {
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/50 p-4">
      <div className={`relative mx-auto mt-10 w-full ${wide ? "max-w-xl" : "max-w-md"} rounded-[1.8rem] bg-white p-6 text-[#351820] shadow-2xl sm:p-7`}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-[#f7efeb] text-[#806e72]" aria-label="Fechar"><X className="size-4" /></button>
        {children}
      </div>
    </div>
  );
}

function GiftProductImage({ gift, index }: { gift: GiftItem; index: number }) {
  const [failed, setFailed] = useState(false);
  const storedSuggestionImage = isStoredSuggestionImage(gift.suggestion_image_url) ? gift.suggestion_image_url : null;
  const proxyImage = gift.suggestion_url ? suggestionImageProxyUrl(gift.id, gift.suggestion_url) : null;
  const src = gift.manual_image_url || storedSuggestionImage || proxyImage;

  useEffect(() => { setFailed(false); }, [gift.id, gift.manual_image_url, gift.suggestion_image_url, gift.suggestion_url, src]);

  if (!src || failed) {
    return <div className="relative grid aspect-[4/3] place-items-center bg-[var(--i-soft)]"><Gift className="size-10 text-[var(--i-accent)]" /><span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--i-muted)]">{String(index + 1).padStart(2, "0")}</span></div>;
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--i-soft)]">
      <img key={gift.manual_image_url ?? storedSuggestionImage ?? gift.suggestion_url ?? gift.id} src={src} alt={`Imagem sugerida de ${gift.name}`} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" onError={() => setFailed(true)} />
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-bold">{label}<div className="mt-2">{children}</div></label>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
