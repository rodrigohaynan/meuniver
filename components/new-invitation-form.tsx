"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TEMPLATES } from "@/lib/themes";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 45);
}

export function NewInvitationForm() {
  const router = useRouter();
  const [templateKey, setTemplateKey] = useState(TEMPLATES[0].key);
  const [hostName, setHostName] = useState("");
  const [age, setAge] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createInvitation() {
    if (hostName.trim().length < 2 || busy) return;
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sua sessão expirou.");

      const template = TEMPLATES.find((item) => item.key === templateKey) ?? TEMPLATES[0];
      const suffix = Math.random().toString(36).slice(2, 6);
      const slug = `${slugify(hostName) || "aniversario"}-${suffix}`;

      const { data, error: insertError } = await supabase
        .from("invitations")
        .insert({
          owner_id: user.id,
          slug,
          status: "draft",
          event_title: `Aniversário de ${hostName.trim()}`,
          host_name: hostName.trim(),
          age: Math.max(1, Math.min(120, Math.round(age || 1))),
          event_date: null,
          event_time: "",
          location_name: "",
          address: "",
          maps_url: "",
          invitation_text: "Vamos celebrar juntos! Sua presença vai deixar esse dia ainda mais especial.",
          rsvp_note: "Confirme todas as pessoas que irão com você e informe se são adultos ou crianças.",
          theme_key: template.theme,
          layout_key: template.layout,
          gift_enabled: true,
          rsvp_enabled: true,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      router.push(`/painel/convites/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o convite.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => (
          <button key={template.key} type="button" onClick={() => setTemplateKey(template.key)} className={`rounded-[1.5rem] border p-4 text-left transition ${templateKey === template.key ? "border-[#8e4056] bg-[#fff8f5] ring-2 ring-[#8e4056]/10" : "border-[#dfd0c6] bg-white hover:border-[#b98d99]"}`}>
            <span className="text-3xl">{template.emoji}</span>
            <p className="mt-3 font-display text-xl font-bold text-[#3c2028]">{template.label}</p>
            <p className="mt-1 text-sm text-[#806e72]">{template.layout === "kids" ? "Layout infantil" : template.layout === "elegant" ? "Layout elegante" : "Layout moderno"}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 rounded-[1.7rem] border border-[#dfd0c6] bg-white p-5 sm:grid-cols-[1fr_160px] sm:p-6">
        <label>
          <span className="text-sm font-bold text-[#594147]">Nome do aniversariante</span>
          <input value={hostName} onChange={(event) => setHostName(event.target.value)} maxLength={80} placeholder="Ex.: Liene, Sofia, Miguel..." className="mt-2 h-12 w-full rounded-xl border border-[#d8c7bd] px-4 outline-none focus:border-[#9e6172] focus:ring-2 focus:ring-[#9e6172]/10" />
        </label>
        <label>
          <span className="text-sm font-bold text-[#594147]">Idade</span>
          <input type="number" min={1} max={120} value={age} onChange={(event) => setAge(Number(event.target.value))} className="mt-2 h-12 w-full rounded-xl border border-[#d8c7bd] px-4 outline-none focus:border-[#9e6172]" />
        </label>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button type="button" onClick={() => void createInvitation()} disabled={busy || hostName.trim().length < 2} className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-[#7d1f37] px-6 font-bold text-white disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        Criar e começar a editar
      </button>
    </div>
  );
}
