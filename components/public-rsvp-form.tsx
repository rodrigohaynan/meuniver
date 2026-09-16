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
  CheckCircle2,
  CircleDollarSign,
  Clipboard,
  Loader2,
  UsersRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTheme } from "@/lib/themes";
import type { Invitation, Rsvp } from "@/lib/types";

type Attendee = Rsvp["attendees"][number];

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

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function formatWhatsapp(value: string) {
  const clean = digits(value).slice(0, 11);
  if (!clean) return "";
  if (clean.length <= 2) return `(${clean}`;
  if (clean.length <= 7) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
}

function sanitizeName(value: string) {
  return value.replace(/[0-9]/g, "");
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
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

function emptyAttendee(): Attendee {
  return { name: "", category: "adult", age: null };
}

function validChildAge(value: unknown) {
  const age = Number(value);
  return Number.isInteger(age) && age >= 0 && age <= 17;
}

export function PublicRsvpForm({ invitation }: { invitation: Invitation }) {
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

  const [contactName, setContactName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [includeContact, setIncludeContact] = useState(true);
  const [contactCategory, setContactCategory] = useState<Attendee["category"]>("adult");
  const [contactAge, setContactAge] = useState<number | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([emptyAttendee()]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

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

  useEffect(() => {
    let active = true;
    async function checkPix() {
      if (!invitation.pix_gift_enabled) return;
      const { data, error } = await supabase.rpc("pix_gift_status_public", {
        p_invitation_id: invitation.id,
      });
      if (!active || error) return;
      setPixGiftAvailable(Boolean((data as { available?: boolean } | null)?.available));
    }
    void checkPix();
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
        if (data.status) setPixData((current) => current ? { ...current, status: data.status } : current);
        if (data.approved) setPixApproved(true);
      } catch {
        // Tenta novamente no próximo ciclo.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pixData?.giftId, pixApproved]);

  const manualAttendees = useMemo<Attendee[]>(
    () => attendees
      .filter((item) => item.name.trim().length >= 2)
      .map((item) => ({
        name: item.name.trim().replace(/\s+/g, " "),
        category: item.category,
        age: item.category === "child" ? item.age ?? null : null,
      })),
    [attendees],
  );

  const contactAlreadyListed = useMemo(() => {
    const normalized = normalizeName(contactName);
    return normalized.length >= 2 && manualAttendees.some((item) => normalizeName(item.name) === normalized);
  }, [contactName, manualAttendees]);

  const effectiveAttendees = useMemo<Attendee[]>(() => {
    const cleanContact = contactName.trim().replace(/\s+/g, " ");
    if (!includeContact || cleanContact.length < 2 || contactAlreadyListed) return manualAttendees;
    return [
      {
        name: cleanContact,
        category: contactCategory,
        age: contactCategory === "child" ? contactAge : null,
      },
      ...manualAttendees,
    ];
  }, [contactAge, contactAlreadyListed, contactCategory, contactName, includeContact, manualAttendees]);

  const summary = useMemo(() => ({
    total: effectiveAttendees.length,
    adults: effectiveAttendees.filter((item) => item.category === "adult").length,
    children: effectiveAttendees.filter((item) => item.category === "child").length,
  }), [effectiveAttendees]);

  const maxManual = includeContact && !contactAlreadyListed ? 11 : 12;

  function validateBeforeSubmit() {
    if (contactName.trim().length < 2) return "Informe o nome do responsável.";
    if (digits(whatsapp).length !== 11) return "Informe o WhatsApp no formato (XX) XXXXX-XXXX.";
    if (effectiveAttendees.length < 1) return "Informe pelo menos uma pessoa confirmada.";
    if (effectiveAttendees.length > 12) return "A confirmação pode ter no máximo 12 pessoas.";
    const childWithoutAge = effectiveAttendees.find((item) => item.category === "child" && !validChildAge(item.age));
    if (childWithoutAge) return `Informe a idade de ${childWithoutAge.name || "cada criança"}.`;
    return "";
  }

  async function performSubmit(allowDuplicate = false): Promise<"saved" | "cancelled" | "none"> {
    const { data, error } = await supabase.rpc("submit_rsvp_public", {
      p_invitation_id: invitation.id,
      p_contact_name: contactName.trim(),
      p_whatsapp: whatsapp.trim(),
      p_attendees: effectiveAttendees,
      p_allow_duplicate: allowDuplicate,
    });
    if (error) throw new Error(error.message);

    const result = data as {
      ok?: boolean;
      code?: string;
      error?: string;
      message?: string;
      addedCount?: number;
      duplicates?: DuplicateInfo[];
    } | null;

    if (result?.code === "duplicate-name" && result.duplicates?.length) {
      const lines = result.duplicates.map((item) => {
        if (item.matchType === "first-name") {
          if (item.rsvpId === "current") return `• ${item.submittedName}: possível repetição com ${item.existingName} nesta confirmação.`;
          return `• ${item.submittedName}: já existe ${item.existingName}, adicionado(a) por ${item.contactName}.`;
        }
        if (item.rsvpId === "current") return `• ${item.submittedName}: este nome aparece duas vezes nesta confirmação.`;
        return `• ${item.submittedName}: pessoa com nome igual já foi adicionada por ${item.contactName}.`;
      });
      const proceed = window.confirm(
        `ATENÇÃO — POSSÍVEL DUPLICIDADE\n\n${lines.join("\n")}\n\nSe forem pessoas diferentes, toque em OK para confirmar mesmo assim. Caso contrário, toque em Cancelar e corrija a lista.`,
      );
      if (!proceed) return "cancelled";
      return performSubmit(true);
    }

    if (!result?.ok) throw new Error(result?.error ?? "Não foi possível confirmar a presença.");
    if (result.code === "no-new-attendees") {
      setMessage(result.message || "Essas pessoas já estavam confirmadas por este responsável.");
      return "none";
    }
    setAddedCount(Number(result.addedCount ?? effectiveAttendees.length));
    return "saved";
  }

  async function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const validation = validateBeforeSubmit();
    if (validation) {
      setMessage(validation);
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const outcome = await performSubmit();
      if (outcome === "cancelled") {
        setMessage("Revise a lista antes de confirmar.");
        return;
      }
      if (outcome === "none") return;

      setContactName("");
      setWhatsapp("");
      setIncludeContact(true);
      setContactCategory("adult");
      setContactAge(null);
      setAttendees([emptyAttendee()]);
      setShowSuccess(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar a presença.");
    } finally {
      setSubmitting(false);
    }
  }

  function openDecline() {
    setDeclineName(contactName.trim());
    setDeclineWhatsapp(whatsapp.trim());
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
    setPixGuestName(declineName.trim() || contactName.trim());
    setPixGuestWhatsapp(declineWhatsapp.trim() || whatsapp.trim());
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

  return (
    <section style={style} className="bg-[var(--i-bg)] px-4 pb-12 text-[var(--i-text)] sm:px-6">
      <div className="mx-auto max-w-4xl pt-10">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--i-soft)] text-[var(--i-accent)]"><UsersRound className="size-5" /></span>
          <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Confirme sua presença</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--i-muted)]">{invitation.rsvp_note}</p>
        </div>

        <form onSubmit={submitRsvp} className="mt-6 rounded-[1.8rem] border border-[var(--i-border)] bg-[var(--i-panel)] p-5 shadow-[0_12px_38px_rgba(58,28,37,.045)] sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Field label="Quem está confirmando?">
                <input
                  value={contactName}
                  onChange={(event) => setContactName(sanitizeName(event.target.value))}
                  maxLength={100}
                  autoComplete="name"
                  className="h-11 w-full rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none focus:ring-2 focus:ring-[var(--i-soft)]"
                  required
                />
              </Field>
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--i-border)] bg-[var(--i-bg)] p-3">
                <input type="checkbox" checked={includeContact} onChange={(event) => setIncludeContact(event.target.checked)} className="mt-0.5 size-4 accent-[var(--i-accent)]" />
                <span>
                  <span className="block text-sm font-bold">O responsável também vai à festa</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[var(--i-muted)]">
                    Se este mesmo responsável já confirmou antes com o mesmo WhatsApp, ele não será duplicado; somente as novas pessoas serão acrescentadas.
                  </span>
                </span>
              </label>
            </div>

            <Field label="WhatsApp (obrigatório)">
              <input
                value={whatsapp}
                onChange={(event) => setWhatsapp(formatWhatsapp(event.target.value))}
                placeholder="(67) 99999-9999"
                inputMode="tel"
                autoComplete="tel-national"
                maxLength={15}
                pattern="\(\d{2}\) \d{5}-\d{4}"
                title="Informe no formato (XX) XXXXX-XXXX"
                className="h-11 w-full rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none focus:ring-2 focus:ring-[var(--i-soft)]"
                required
              />
            </Field>
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--i-border)] bg-[var(--i-soft)]/45 p-4">
            <p className="text-sm font-bold">{includeContact ? "O responsável será contado quando ainda não estiver confirmado." : "O responsável não será contado como convidado."}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--i-muted)]">{includeContact ? "Adicione abaixo somente as outras pessoas que irão junto." : "Adicione abaixo todas as pessoas que irão à festa."}</p>

            {includeContact && contactName.trim().length >= 2 && !contactAlreadyListed && (
              <div className="mt-3 rounded-xl bg-white px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--i-muted)]">Responsável</p>
                    <p className="mt-0.5 text-sm font-bold">{contactName.trim()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setContactCategory("adult"); setContactAge(null); }} className={`h-9 rounded-full border px-3 text-xs font-bold ${contactCategory === "adult" ? "border-[var(--i-accent)] bg-[var(--i-accent)] text-white" : "border-[var(--i-border)] bg-white"}`}>Adulto</button>
                    <button type="button" onClick={() => setContactCategory("child")} className={`h-9 rounded-full border px-3 text-xs font-bold ${contactCategory === "child" ? "border-[var(--i-accent)] bg-[var(--i-accent)] text-white" : "border-[var(--i-border)] bg-white"}`}>Criança</button>
                  </div>
                </div>
                {contactCategory === "child" && (
                  <label className="mt-3 block text-xs font-bold text-[var(--i-muted)]">Idade da criança (obrigatória)
                    <input type="number" min={0} max={17} value={contactAge ?? ""} onChange={(event) => setContactAge(event.target.value === "" ? null : Number(event.target.value))} className="mt-1 h-10 w-28 rounded-xl border border-[var(--i-border)] bg-white px-3 text-[var(--i-text)] outline-none" required />
                    <span className="ml-2 font-normal">0 = menor de 1 ano</span>
                  </label>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white px-3 py-1.5">{summary.total} pessoa(s)</span>
              <span className="rounded-full bg-white px-3 py-1.5">{summary.adults} adulto(s)</span>
              <span className="rounded-full bg-white px-3 py-1.5">{summary.children} criança(s)</span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {attendees.map((attendee, index) => (
              <div key={index} className="rounded-2xl bg-[var(--i-bg)] p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    value={attendee.name}
                    onChange={(event) => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: sanitizeName(event.target.value) } : item))}
                    placeholder={includeContact ? `Outra pessoa ${index + 1}` : `Pessoa ${index + 1}`}
                    maxLength={80}
                    autoComplete="name"
                    className="h-10 rounded-xl border border-[var(--i-border)] bg-white px-3 outline-none"
                  />
                  <button type="button" onClick={() => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, category: "adult", age: null } : item))} className={`h-10 rounded-xl px-3 text-sm font-bold ${attendee.category === "adult" ? "bg-[var(--i-accent)] text-white" : "border border-[var(--i-border)] bg-white"}`}>Adulto</button>
                  <button type="button" onClick={() => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, category: "child" } : item))} className={`h-10 rounded-xl px-3 text-sm font-bold ${attendee.category === "child" ? "bg-[var(--i-accent)] text-white" : "border border-[var(--i-border)] bg-white"}`}>Criança</button>
                </div>
                {attendee.category === "child" && (
                  <label className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--i-muted)]">Idade da criança
                    <input type="number" min={0} max={17} value={attendee.age ?? ""} onChange={(event) => setAttendees((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, age: event.target.value === "" ? null : Number(event.target.value) } : item))} className="h-9 w-24 rounded-xl border border-[var(--i-border)] bg-white px-3 text-[var(--i-text)] outline-none" required={attendee.name.trim().length >= 2} />
                    <span className="font-normal">obrigatória • 0 = menor de 1 ano</span>
                  </label>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => attendees.length < maxManual && setAttendees((items) => [...items, emptyAttendee()])} disabled={attendees.length >= maxManual} className="h-10 rounded-full border border-[var(--i-border)] bg-white px-4 text-sm font-bold disabled:opacity-50">+ Adicionar pessoa</button>
            {attendees.length > 1 && <button type="button" onClick={() => setAttendees((items) => items.slice(0, -1))} className="h-10 rounded-full px-4 text-sm font-bold text-red-700">Remover última</button>}
          </div>

          {message && <p className="mt-4 rounded-xl bg-[#fff6f1] px-4 py-3 text-sm font-bold text-[var(--i-text)]">{message}</p>}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button disabled={submitting} className="h-11 rounded-full bg-[var(--i-accent)] px-6 font-bold text-white disabled:opacity-60">{submitting ? "Verificando nomes…" : "Confirmar presença"}</button>
            <button type="button" onClick={openDecline} className="h-11 rounded-full border border-[var(--i-border)] bg-white px-6 font-bold text-[var(--i-muted)]">Não poderei comparecer</button>
          </div>
        </form>
      </div>

      {showSuccess && (
        <Modal onClose={() => setShowSuccess(false)}>
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-7" /></span>
            <h3 className="mt-4 font-display text-3xl font-bold">Presença confirmada!</h3>
            <p className="mt-2 text-sm leading-6 text-[#806e72]">{addedCount === 1 ? "1 pessoa foi adicionada à lista." : `${addedCount} pessoas foram adicionadas à lista.`} Se este responsável já tinha uma confirmação anterior, os nomes já existentes não foram duplicados.</p>
            <div className="mt-6 rounded-2xl bg-[#fff6f1] p-5 text-left">
              <p className="font-bold text-[#5d313e]">Gostou do CONVNIVER?</p>
              <p className="mt-1 text-sm leading-6 text-[#76666a]">Crie sua conta gratuitamente e deixe tudo pronto para criar e gerenciar seus próprios convites.</p>
              <a href="/entrar?modo=cadastro&origem=confirmacao" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#7d1f37] px-5 font-bold text-white">Criar minha conta</a>
            </div>
          </div>
        </Modal>
      )}

      {showDecline && (
        <Modal onClose={() => setShowDecline(false)}>
          {!declineDone ? (
            <form onSubmit={submitDecline}>
              <h3 className="font-display text-2xl font-bold">Não poderei comparecer</h3>
              <p className="mt-2 text-sm leading-6 text-[#806e72]">Avise o organizador para que ele possa se planejar.</p>
              <label className="mt-5 block text-sm font-bold">Seu nome<input value={declineName} onChange={(event) => setDeclineName(sanitizeName(event.target.value))} required minLength={2} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
              <label className="mt-4 block text-sm font-bold">WhatsApp<input value={declineWhatsapp} onChange={(event) => setDeclineWhatsapp(formatWhatsapp(event.target.value))} placeholder="(67) 99999-9999" inputMode="tel" maxLength={15} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" /></label>
              {declineMessage && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{declineMessage}</p>}
              <button disabled={declineBusy} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-60">{declineBusy && <Loader2 className="size-4 animate-spin" />} Enviar resposta</button>
            </form>
          ) : (
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#f4e7e0] text-[#7d1f37]"><CheckCircle2 className="size-7" /></span>
              <h3 className="mt-4 font-display text-2xl font-bold">Resposta enviada</h3>
              <p className="mt-2 text-sm leading-6 text-[#806e72]">O organizador foi informado de que você não poderá comparecer.</p>
              {pixGiftAvailable && <button type="button" onClick={openPixGift} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white"><CircleDollarSign className="size-4" /> Enviar presente em PIX</button>}
            </div>
          )}
        </Modal>
      )}

      {showPixGift && (
        <Modal onClose={() => setShowPixGift(false)} wide>
          {!pixData ? (
            <form onSubmit={createPixGift}>
              <h3 className="font-display text-2xl font-bold">Enviar presente em PIX</h3>
              <p className="mt-2 text-sm leading-6 text-[#806e72]">O pagamento é processado pelo Mercado Pago.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">Nome<input value={pixGuestName} onChange={(event) => setPixGuestName(sanitizeName(event.target.value))} required className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3" /></label>
                <label className="text-sm font-bold">E-mail<input type="email" value={pixGuestEmail} onChange={(event) => setPixGuestEmail(event.target.value)} required className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3" /></label>
                <label className="text-sm font-bold">WhatsApp<input value={pixGuestWhatsapp} onChange={(event) => setPixGuestWhatsapp(formatWhatsapp(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3" /></label>
                <label className="text-sm font-bold">CPF<input value={pixCpf} onChange={(event) => setPixCpf(formatCpf(event.target.value))} required inputMode="numeric" className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3" /></label>
                <label className="text-sm font-bold sm:col-span-2">Valor (R$)<input type="number" min={5} max={10000} step="0.01" value={pixAmount} onChange={(event) => setPixAmount(event.target.value)} required className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3" /></label>
              </div>
              {pixError && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{pixError}</p>}
              <button disabled={pixBusy} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-60">{pixBusy && <Loader2 className="size-4 animate-spin" />} Gerar PIX</button>
            </form>
          ) : (
            <div className="text-center">
              <CircleDollarSign className="mx-auto size-10 text-[#7d1f37]" />
              <h3 className="mt-3 font-display text-2xl font-bold">{pixApproved ? "Pagamento confirmado" : "PIX gerado"}</h3>
              <p className="mt-2 text-sm text-[#806e72]">Valor: {formatCurrency(pixData.amount)}</p>
              {pixData.qrCodeBase64 && <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto mt-5 size-56 rounded-xl border border-[#eaded8] bg-white p-2" />}
              {pixData.qrCode && <button type="button" onClick={() => void copyPixCode()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-[#d8c7bd] px-5 font-bold text-[#684f55]"><Clipboard className="size-4" /> {pixCopied ? "Copiado" : "Copiar código PIX"}</button>}
              {pixData.ticketUrl && <a href={pixData.ticketUrl} target="_blank" rel="noreferrer" className="mt-3 block text-sm font-bold text-[#7d1f37]">Abrir pagamento</a>}
              {pixError && <p className="mt-4 text-sm text-red-700">{pixError}</p>}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-bold">{label}<div className="mt-2">{children}</div></label>;
}

function Modal({ onClose, children, wide = false }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-black/55 p-4">
      <div className={`relative w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[1.8rem] bg-white p-6 text-[#351820] shadow-2xl sm:p-7`}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-[#f7efeb] text-[#806e72]" aria-label="Fechar"><X className="size-4" /></button>
        {children}
      </div>
    </div>
  );
}
