"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ExternalLink, Gift, Loader2, Ruler, Search, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTheme } from "@/lib/themes";
import type { GiftItem, GiftProfileItem } from "@/lib/types";

function shopeeSearch(name: string) {
  return `https://shopee.com.br/search?keyword=${encodeURIComponent(name)}`;
}

function mercadoLivreSearch(name: string) {
  return `https://lista.mercadolivre.com.br/${encodeURIComponent(name)}`;
}

export function PublicGiftExtras({
  hostName,
  themeKey,
  giftEnabled,
  giftProfile,
  gifts,
}: {
  hostName: string;
  themeKey: string;
  giftEnabled: boolean;
  giftProfile: GiftProfileItem[];
  gifts: GiftItem[];
}) {
  const theme = getTheme(themeKey);
  const supabase = useMemo(() => createClient(), []);
  const profile = (Array.isArray(giftProfile) ? giftProfile : []).filter(
    (item) => item?.label?.trim() && item?.value?.trim(),
  );
  const [items, setItems] = useState(
    gifts.map((gift) => ({
      ...gift,
      reservation_mode: gift.reservation_mode ?? "single",
    })),
  );
  const [reservationGift, setReservationGift] = useState<GiftItem | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestContact, setGuestContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reserveGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reservationGift || busy) return;
    setBusy(true);
    setMessage("");

    const { data, error } = await supabase.rpc("reserve_gift_public", {
      p_gift_id: reservationGift.id,
      p_guest_name: guestName.trim(),
      p_guest_contact: guestContact.trim(),
    });
    const result = data as {
      ok?: boolean;
      error?: string;
      reservation_mode?: "single" | "multiple";
    } | null;

    if (error || !result?.ok) {
      setMessage(error?.message ?? result?.error ?? "Não foi possível registrar sua escolha.");
      setBusy(false);
      return;
    }

    const mode = result.reservation_mode ?? reservationGift.reservation_mode ?? "single";
    if (mode === "single") {
      setItems((current) =>
        current.map((item) =>
          item.id === reservationGift.id ? { ...item, reserved: true } : item,
        ),
      );
      setMessage("Presente escolhido. Obrigado!");
    } else {
      setMessage("Escolha registrada. Esta sugestão continua disponível para outros convidados.");
    }

    setReservationGift(null);
    setGuestName("");
    setGuestContact("");
    setBusy(false);
  }

  if (!profile.length && (!giftEnabled || !items.length)) return null;

  return (
    <section
      style={{ background: theme.colors.background, color: theme.colors.text }}
      className="pb-16"
    >
      <div className="mx-auto max-w-5xl space-y-9 px-4 sm:px-6">
        {profile.length > 0 && (
          <div
            style={{ background: theme.colors.panel, borderColor: theme.colors.border }}
            className="rounded-[1.8rem] border p-5 shadow-[0_12px_38px_rgba(58,28,37,.045)] sm:p-7"
          >
            <div className="flex items-start gap-3">
              <span
                style={{ background: theme.colors.accentSoft, color: theme.colors.accent }}
                className="grid size-11 shrink-0 place-items-center rounded-full"
              >
                <Ruler className="size-5" />
              </span>
              <div>
                <p
                  style={{ color: theme.colors.accent }}
                  className="text-xs font-bold uppercase tracking-[.16em]"
                >
                  Para ajudar no presente
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
                  Tamanhos e preferências de {hostName || "quem está comemorando"}
                </h2>
                <p style={{ color: theme.colors.muted }} className="mt-2 text-sm leading-6">
                  Estas informações foram deixadas pelo organizador para ajudar você a escolher algo no tamanho e estilo certos.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profile.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  style={{ background: theme.colors.accentSoft, borderColor: theme.colors.border }}
                  className="rounded-2xl border px-4 py-3"
                >
                  <p style={{ color: theme.colors.muted }} className="text-[11px] font-bold uppercase tracking-[.12em]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-bold leading-5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {giftEnabled && items.length > 0 && (
          <div>
            <div className="text-center">
              <p style={{ color: theme.colors.accent }} className="text-xs font-bold uppercase tracking-[.18em]">
                Se quiser presentear
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Sugestões de presentes</h2>
              <p style={{ color: theme.colors.muted }} className="mx-auto mt-2 max-w-2xl text-sm leading-6">
                A presença é o mais importante. Sugestões genéricas podem ser escolhidas por mais de uma pessoa; presentes específicos ficam indisponíveis depois da primeira escolha.
              </p>
            </div>

            {message && (
              <div
                style={{ background: theme.colors.panel, borderColor: theme.colors.border }}
                className="mx-auto mt-5 max-w-2xl rounded-2xl border px-5 py-3 text-center text-sm font-bold"
              >
                {message}
              </div>
            )}

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((gift) => {
                const mode = gift.reservation_mode ?? "single";
                const unavailable = mode === "single" && gift.reserved;
                const image = gift.manual_image_url || gift.suggestion_image_url;

                return (
                  <article
                    key={gift.id}
                    style={{ background: theme.colors.panel, borderColor: theme.colors.border }}
                    className={`group flex min-h-64 flex-col overflow-hidden rounded-[1.6rem] border shadow-[0_10px_35px_rgba(58,28,37,.045)] transition ${unavailable ? "opacity-80" : "hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(58,28,37,.08)]"}`}
                  >
                    <div style={{ background: theme.colors.accentSoft }} className="relative aspect-[4/3] overflow-hidden">
                      {image ? (
                        <img src={image} alt={`Imagem de ${gift.name}`} className={`h-full w-full object-contain ${unavailable ? "grayscale-[15%]" : ""}`} />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <Gift style={{ color: theme.colors.accent }} className="size-10" />
                        </div>
                      )}

                      {unavailable ? (
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                          <CheckCircle2 className="size-3.5" /> Já escolhido
                        </span>
                      ) : mode === "multiple" ? (
                        <span
                          style={{ color: theme.colors.accent }}
                          className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold shadow-sm"
                        >
                          Sugestão aberta
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-display text-xl font-bold">{gift.name}</h3>
                      {gift.description && (
                        <p style={{ color: theme.colors.muted }} className="mt-2 flex-1 text-sm leading-6">
                          {gift.description}
                        </p>
                      )}

                      {gift.suggestion_url ? (
                        <a href={gift.suggestion_url} target="_blank" rel="noreferrer" style={{ color: theme.colors.accent }} className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-bold">
                          Ver sugestão <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a href={shopeeSearch(gift.name)} target="_blank" rel="noreferrer" style={{ borderColor: theme.colors.border }} className="inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-bold">
                            <Search className="size-3" /> Shopee
                          </a>
                          <a href={mercadoLivreSearch(gift.name)} target="_blank" rel="noreferrer" style={{ borderColor: theme.colors.border }} className="inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-bold">
                            <Search className="size-3" /> Mercado Livre
                          </a>
                        </div>
                      )}

                      <div style={{ borderColor: theme.colors.border }} className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
                        <span style={{ color: theme.colors.muted }} className="text-xs font-bold">
                          {gift.price_hint}
                        </span>
                        {unavailable ? (
                          <span className="inline-flex h-9 items-center gap-1 rounded-full bg-emerald-50 px-4 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="size-3.5" /> Escolhido
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setMessage(""); setReservationGift(gift); }}
                            style={{ background: theme.colors.accent }}
                            className="h-9 rounded-full px-4 text-xs font-bold text-white"
                          >
                            Escolher
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {reservationGift && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/50 p-4">
          <form onSubmit={reserveGift} className="relative mx-auto mt-16 w-full max-w-md rounded-[1.7rem] bg-white p-6 text-[#351820] shadow-2xl">
            <button type="button" onClick={() => setReservationGift(null)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-[#f7efeb] text-[#806e72]" aria-label="Fechar">
              <X className="size-4" />
            </button>
            <h3 className="pr-10 font-display text-2xl font-bold">Vou dar: {reservationGift.name}</h3>
            <p className="mt-2 text-sm leading-6 text-[#806e72]">
              {reservationGift.reservation_mode === "multiple"
                ? "Esta é uma sugestão genérica. Sua escolha será registrada para o organizador, mas ela continuará disponível para outros convidados."
                : "Seu nome fica visível somente para o responsável pelo convite e este presente ficará indisponível para novas escolhas."}
            </p>
            <label className="mt-5 block text-sm font-bold">
              Seu nome
              <input value={guestName} onChange={(event) => setGuestName(event.target.value)} required minLength={2} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" />
            </label>
            <label className="mt-4 block text-sm font-bold">
              WhatsApp ou contato (opcional)
              <input value={guestContact} onChange={(event) => setGuestContact(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" />
            </label>
            {message && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
            <div className="mt-5 flex gap-2">
              <button disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#7d1f37] px-5 text-sm font-bold text-white disabled:opacity-60">
                {busy && <Loader2 className="size-4 animate-spin" />} Confirmar escolha
              </button>
              <button type="button" onClick={() => setReservationGift(null)} className="h-10 rounded-full border border-[#d8c7bd] px-4 text-sm font-bold">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
