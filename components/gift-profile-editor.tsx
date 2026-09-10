"use client";

import { useMemo, useState } from "react";
import { Gift, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { GiftProfileItem } from "@/lib/types";

const SUGGESTED_LABELS = [
  "Calçado",
  "Camiseta / blusa",
  "Calça / short",
  "Vestido",
  "Fralda",
  "Anel / diâmetro do dedo",
  "Roupas",
  "Cores preferidas",
  "Temas / hobbies / interesses",
  "Outras observações",
];

function cleanProfile(items: GiftProfileItem[]) {
  return items
    .map((item) => ({
      label: item.label.trim().replace(/\s+/g, " ").slice(0, 60),
      value: item.value.trim().replace(/\s+/g, " ").slice(0, 220),
    }))
    .filter((item) => item.label.length >= 2 && item.value.length >= 1)
    .slice(0, 20);
}

export function GiftProfileEditor({
  invitationId,
  hostName,
  initialProfile,
}: {
  invitationId: string;
  hostName: string;
  initialProfile: GiftProfileItem[];
}) {
  const [items, setItems] = useState<GiftProfileItem[]>(
    Array.isArray(initialProfile) ? initialProfile : [],
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => createClient(), []);

  function updateItem(index: number, patch: Partial<GiftProfileItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function addItem() {
    if (items.length >= 20) return;
    setItems((current) => [...current, { label: "", value: "" }]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage("");

    const profile = cleanProfile(items);
    const { error } = await supabase
      .from("invitations")
      .update({ gift_profile: profile })
      .eq("id", invitationId);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setItems(profile);
    setMessage("Informações para presentes salvas.");
  }

  return (
    <details className="mb-6 overflow-hidden rounded-[1.8rem] border border-[#e4d8d0] bg-[#fffdfa] shadow-[0_12px_40px_rgba(83,48,58,.045)]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 sm:px-7">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5ece7] text-[#7d1f37]">
          <Gift className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-xl font-bold text-[#351820]">Tamanhos e preferências para presentes</span>
          <span className="mt-0.5 block text-sm text-[#806e72]">Ajude os convidados a acertar no presente de {hostName || "quem está comemorando"}.</span>
        </span>
      </summary>

      <div className="border-t border-[#eee4de] px-5 py-5 sm:px-7">
        <p className="text-sm leading-6 text-[#806e72]">
          Cadastre somente informações úteis. Você pode usar os exemplos abaixo ou criar qualquer outro campo, como numeração de roupa, tamanho de capacete, pulseira, preferências, restrições ou medidas.
        </p>

        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <div key={`${index}-${item.label}`} className="grid gap-2 rounded-2xl border border-[#e7dcd5] bg-white p-3 sm:grid-cols-[minmax(150px,.7fr)_minmax(220px,1.3fr)_auto] sm:items-center">
              <input
                value={item.label}
                onChange={(event) => updateItem(index, { label: event.target.value })}
                maxLength={60}
                placeholder="Informação"
                list="gift-profile-labels"
                className="h-10 rounded-xl border border-[#d8c7bd] px-3 text-sm outline-none focus:border-[#9e6172]"
              />
              <input
                value={item.value}
                onChange={(event) => updateItem(index, { value: event.target.value })}
                maxLength={220}
                placeholder="Ex.: 20/21, tamanho M, aro 18..."
                className="h-10 rounded-xl border border-[#d8c7bd] px-3 text-sm outline-none focus:border-[#9e6172]"
              />
              <button type="button" onClick={() => removeItem(index)} className="inline-flex size-10 items-center justify-center rounded-full text-red-700 hover:bg-red-50" aria-label="Remover informação">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}

          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#d8c7bd] px-5 py-7 text-center text-sm text-[#806e72]">
              Nenhuma informação cadastrada ainda.
            </div>
          )}
        </div>

        <datalist id="gift-profile-labels">
          {SUGGESTED_LABELS.map((label) => <option key={label} value={label} />)}
        </datalist>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={addItem} disabled={items.length >= 20} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#d8c7bd] bg-white px-4 text-sm font-bold text-[#684f55] disabled:opacity-50">
            <Plus className="size-4" /> Adicionar informação
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#7d1f37] px-5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar informações
          </button>
          {message && <span className={`text-sm font-bold ${message.includes("salvas") ? "text-emerald-700" : "text-red-700"}`}>{message}</span>}
        </div>
      </div>
    </details>
  );
}
