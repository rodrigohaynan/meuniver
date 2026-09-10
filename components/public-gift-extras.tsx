"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Gift, Ruler, Sparkles } from "lucide-react";
import { getTheme } from "@/lib/themes";
import type { GiftItem, GiftProfileItem } from "@/lib/types";

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
  const profile = (Array.isArray(giftProfile) ? giftProfile : []).filter(
    (item) => item?.label?.trim() && item?.value?.trim(),
  );
  const reservedGifts = giftEnabled ? gifts.filter((gift) => gift.reserved) : [];

  return (
    <>
      {reservedGifts.length > 0 && (
        <ReservedGiftsInline gifts={reservedGifts} themeKey={themeKey} />
      )}

      {profile.length > 0 && (
        <section
          style={{ background: theme.colors.background, color: theme.colors.text }}
          className="pb-16"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
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
          </div>
        </section>
      )}
    </>
  );
}

function ReservedGiftsInline({ gifts, themeKey }: { gifts: GiftItem[]; themeKey: string }) {
  const theme = getTheme(themeKey);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const headings = Array.from(document.querySelectorAll("h2"));
    const heading = headings.find(
      (item) => item.textContent?.trim() === "Sugestões de presentes",
    );
    const section = heading?.closest("section");
    if (!section) return;

    const container = document.createElement("div");
    container.dataset.reservedGiftsInline = "true";
    container.className = "mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

    const emptyTitle = Array.from(section.querySelectorAll("p")).find(
      (item) => item.textContent?.trim() === "Todos os presentes foram escolhidos",
    );
    const emptyState = emptyTitle?.parentElement as HTMLElement | undefined;
    const previousDisplay = emptyState?.style.display ?? "";
    if (emptyState) emptyState.style.display = "none";

    section.appendChild(container);
    setTarget(container);

    return () => {
      setTarget(null);
      container.remove();
      if (emptyState) emptyState.style.display = previousDisplay;
    };
  }, []);

  if (!target) return null;

  return createPortal(
    <>
      {gifts.map((gift) => {
        const image = gift.manual_image_url || gift.suggestion_image_url;
        return (
          <article
            key={gift.id}
            style={{ background: theme.colors.panel, borderColor: theme.colors.border }}
            className="overflow-hidden rounded-[1.6rem] border opacity-80 shadow-[0_10px_35px_rgba(58,28,37,.035)]"
          >
            <div style={{ background: theme.colors.accentSoft }} className="relative aspect-[4/3] overflow-hidden">
              {image ? (
                <img src={image} alt={`Imagem de ${gift.name}`} className="h-full w-full object-contain grayscale-[15%]" />
              ) : (
                <div className="grid h-full place-items-center">
                  <Gift style={{ color: theme.colors.accent }} className="size-10" />
                </div>
              )}
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                <CheckCircle2 className="size-3.5" /> Já escolhido
              </span>
            </div>
            <div className="p-5">
              <h3 className="font-display text-xl font-bold">{gift.name}</h3>
              {gift.description && (
                <p style={{ color: theme.colors.muted }} className="mt-2 text-sm leading-6">
                  {gift.description}
                </p>
              )}
              {gift.price_hint && (
                <div style={{ borderColor: theme.colors.border }} className="mt-4 border-t pt-3 text-xs font-bold">
                  <Sparkles style={{ color: theme.colors.accent }} className="mr-1 inline size-3.5" /> {gift.price_hint}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </>,
    target,
  );
}
