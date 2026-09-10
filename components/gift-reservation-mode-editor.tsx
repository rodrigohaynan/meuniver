"use client";

import { useMemo, useState } from "react";
import { Boxes, Check, Gift, Loader2, PackageCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { GiftItem, GiftReservation, GiftReservationMode } from "@/lib/types";

export function GiftReservationModeEditor({
  initialGifts,
  reservations,
}: {
  initialGifts: GiftItem[];
  reservations: GiftReservation[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [gifts, setGifts] = useState(
    initialGifts.map((gift) => ({
      ...gift,
      reservation_mode: gift.reservation_mode ?? "single",
    })),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const reservation of reservations) {
      map.set(reservation.gift_id, (map.get(reservation.gift_id) ?? 0) + 1);
    }
    return map;
  }, [reservations]);

  async function changeMode(gift: GiftItem, mode: GiftReservationMode) {
    if (busyId || gift.reservation_mode === mode) return;
    setBusyId(gift.id);
    setMessage("");

    const { data, error } = await supabase.rpc("set_gift_reservation_mode_owner", {
      p_gift_id: gift.id,
      p_mode: mode,
    });
    const result = data as {
      ok?: boolean;
      error?: string;
      reserved?: boolean;
    } | null;

    if (error || !result?.ok) {
      setMessage(error?.message ?? result?.error ?? "Não foi possível alterar o tipo da sugestão.");
      setBusyId(null);
      return;
    }

    setGifts((current) =>
      current.map((item) =>
        item.id === gift.id
          ? {
              ...item,
              reservation_mode: mode,
              reserved: Boolean(result.reserved),
            }
          : item,
      ),
    );
    setMessage(
      mode === "multiple"
        ? `“${gift.name}” agora pode ser escolhido por várias pessoas.`
        : `“${gift.name}” agora é um presente de escolha única.`,
    );
    setBusyId(null);
    router.refresh();
  }

  if (!gifts.length) return null;

  return (
    <details className="mb-6 overflow-hidden rounded-[1.8rem] border border-[#e4d8d0] bg-[#fffdfa] shadow-[0_12px_40px_rgba(83,48,58,.045)]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 sm:px-7">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5ece7] text-[#7d1f37]">
          <Gift className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-xl font-bold text-[#351820]">Tipo de cada sugestão de presente</span>
          <span className="mt-0.5 block text-sm text-[#806e72]">Defina se o item é genérico e pode ser escolhido várias vezes ou se é um presente específico.</span>
        </span>
      </summary>

      <div className="border-t border-[#eee4de] px-5 py-5 sm:px-7">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#e7dcd5] bg-white p-4">
            <div className="flex items-start gap-3">
              <Boxes className="mt-0.5 size-5 shrink-0 text-[#7d1f37]" />
              <div>
                <p className="font-bold text-[#3c2028]">Sugestão genérica</p>
                <p className="mt-1 text-sm leading-5 text-[#806e72]">Ex.: roupas infantis, brinquedos, calçados. Várias pessoas podem escolher a mesma categoria.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#e7dcd5] bg-white p-4">
            <div className="flex items-start gap-3">
              <PackageCheck className="mt-0.5 size-5 shrink-0 text-[#7d1f37]" />
              <div>
                <p className="font-bold text-[#3c2028]">Presente específico</p>
                <p className="mt-1 text-sm leading-5 text-[#806e72]">Ex.: bicicleta X, brinquedo modelo Y. Depois da primeira escolha, fica marcado como escolhido.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {gifts.map((gift) => {
            const mode = gift.reservation_mode ?? "single";
            const count = counts.get(gift.id) ?? 0;
            const busy = busyId === gift.id;

            return (
              <div key={gift.id} className="rounded-2xl border border-[#e7dcd5] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[#3c2028]">{gift.name}</p>
                    <p className="mt-1 text-xs text-[#806e72]">
                      {count === 0 ? "Nenhuma escolha registrada" : `${count} ${count === 1 ? "escolha registrada" : "escolhas registradas"}`}
                    </p>
                  </div>

                  <div className="grid min-w-[260px] grid-cols-2 rounded-xl bg-[#f7f0ec] p-1">
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void changeMode(gift, "multiple")}
                      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${mode === "multiple" ? "bg-white text-[#7d1f37] shadow-sm" : "text-[#806e72]"}`}
                    >
                      {busy && mode !== "multiple" ? <Loader2 className="size-3.5 animate-spin" /> : mode === "multiple" ? <Check className="size-3.5" /> : null}
                      Genérico
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void changeMode(gift, "single")}
                      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${mode === "single" ? "bg-white text-[#7d1f37] shadow-sm" : "text-[#806e72]"}`}
                    >
                      {busy && mode !== "single" ? <Loader2 className="size-3.5 animate-spin" /> : mode === "single" ? <Check className="size-3.5" /> : null}
                      Único
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {message && <p className="mt-4 rounded-xl bg-[#f7f0ec] px-4 py-3 text-sm font-bold text-[#684f55]">{message}</p>}
      </div>
    </details>
  );
}
