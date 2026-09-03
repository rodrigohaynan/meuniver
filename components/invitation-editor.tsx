"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Check, ExternalLink, Gift, ImagePlus, Loader2, Palette, Save, Settings2, Trash2, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTheme, LAYOUTS, THEMES } from "@/lib/themes";
import type { GiftItem, GiftReservation, Invitation, Rsvp } from "@/lib/types";

type Tab = "content" | "appearance" | "photo" | "gifts" | "responses";

export function InvitationEditor({
  initialInvitation,
  initialGifts,
  initialRsvps,
  initialReservations,
}: {
  initialInvitation: Invitation;
  initialGifts: GiftItem[];
  initialRsvps: Rsvp[];
  initialReservations: GiftReservation[];
}) {
  const [invitation, setInvitation] = useState(initialInvitation);
  const [gifts, setGifts] = useState(initialGifts);
  const [rsvps] = useState(initialRsvps);
  const [reservations] = useState(initialReservations);
  const [tab, setTab] = useState<Tab>("content");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newGift, setNewGift] = useState({ name: "", description: "", price_hint: "", suggestion_url: "" });
  const [giftBusy, setGiftBusy] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const theme = getTheme(invitation.theme_key);

  async function saveInvitation() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("invitations")
      .update({
        status: invitation.status,
        event_title: invitation.event_title.trim(),
        host_name: invitation.host_name.trim(),
        age: Math.max(1, Math.min(120, Math.round(invitation.age || 1))),
        event_date: invitation.event_date || null,
        event_time: invitation.event_time,
        location_name: invitation.location_name.trim(),
        address: invitation.address.trim(),
        maps_url: invitation.maps_url.trim(),
        invitation_text: invitation.invitation_text.trim(),
        rsvp_note: invitation.rsvp_note.trim(),
        theme_key: invitation.theme_key,
        layout_key: invitation.layout_key,
        hero_image_url: invitation.hero_image_url,
        gift_enabled: invitation.gift_enabled,
        rsvp_enabled: invitation.rsvp_enabled,
      })
      .eq("id", invitation.id);

    setSaving(false);
    setMessage(error ? error.message : "Alterações salvas.");
  }

  async function uploadHero(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setMessage("Use uma imagem JPG, PNG ou WEBP com até 8 MB.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setMessage("Sessão expirada.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${invitation.id}/hero-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("invite-media").upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) {
      setSaving(false);
      setMessage(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from("invite-media").getPublicUrl(path);
    const next = { ...invitation, hero_image_url: data.publicUrl };
    setInvitation(next);
    const { error } = await supabase.from("invitations").update({ hero_image_url: data.publicUrl }).eq("id", invitation.id);
    setSaving(false);
    setMessage(error ? error.message : "Foto principal atualizada.");
  }

  async function addGift() {
    if (newGift.name.trim().length < 2 || giftBusy) return;
    setGiftBusy(true);
    const { data, error } = await supabase.from("gifts").insert({
      invitation_id: invitation.id,
      name: newGift.name.trim(),
      description: newGift.description.trim(),
      price_hint: newGift.price_hint.trim(),
      suggestion_url: newGift.suggestion_url.trim() || null,
      sort_order: gifts.length + 1,
    }).select("*").single();
    if (!error && data) {
      setGifts((current) => [...current, data as GiftItem]);
      setNewGift({ name: "", description: "", price_hint: "", suggestion_url: "" });
      setMessage("Presente adicionado.");
    } else if (error) {
      setMessage(error.message);
    }
    setGiftBusy(false);
  }

  async function saveGift(gift: GiftItem) {
    const { error } = await supabase.from("gifts").update({
      name: gift.name.trim(),
      description: gift.description.trim(),
      price_hint: gift.price_hint.trim(),
      suggestion_url: gift.suggestion_url?.trim() || null,
      sort_order: gift.sort_order,
      manual_image_url: gift.manual_image_url,
    }).eq("id", gift.id);
    setMessage(error ? error.message : `Presente "${gift.name}" salvo.`);
  }

  async function uploadGiftImage(gift: GiftItem, file: File | undefined) {
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${invitation.id}/gift-${gift.id}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("invite-media").upload(path, file, { contentType: file.type });
    if (error) {
      setMessage(error.message);
      return;
    }
    const { data } = supabase.storage.from("invite-media").getPublicUrl(path);
    const next = { ...gift, manual_image_url: data.publicUrl };
    setGifts((items) => items.map((item) => item.id === gift.id ? next : item));
    await supabase.from("gifts").update({ manual_image_url: data.publicUrl }).eq("id", gift.id);
    setMessage("Foto manual do presente atualizada.");
  }

  async function deleteGift(gift: GiftItem) {
    if (!window.confirm(`Excluir "${gift.name}"?`)) return;
    const { error } = await supabase.from("gifts").delete().eq("id", gift.id);
    if (!error) setGifts((items) => items.filter((item) => item.id !== gift.id));
    setMessage(error ? error.message : "Presente excluído.");
  }

  async function releaseGift(gift: GiftItem) {
    const { data, error } = await supabase.rpc("release_gift_owner", { p_gift_id: gift.id });
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      setMessage(error?.message ?? result?.error ?? "Não foi possível liberar.");
      return;
    }
    setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, reserved: false } : item));
    setMessage("Reserva liberada.");
  }

  const adults = rsvps.reduce((sum, rsvp) => sum + rsvp.attendees.filter((item) => item.category === "adult").length, 0);
  const children = rsvps.reduce((sum, rsvp) => sum + rsvp.attendees.filter((item) => item.category === "child").length, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="min-w-0">
        <div className="flex flex-wrap gap-2">
          {[
            ["content", Settings2, "Conteúdo"],
            ["appearance", Palette, "Aparência"],
            ["photo", ImagePlus, "Foto principal"],
            ["gifts", Gift, "Presentes"],
            ["responses", UsersRound, "Respostas"],
          ].map(([key, Icon, label]) => {
            const TabIcon = Icon as typeof Settings2;
            return (
              <button key={String(key)} type="button" onClick={() => setTab(key as Tab)} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold ${tab === key ? "bg-[#7d1f37] text-white" : "border border-[#ded0c8] bg-white text-[#684f55]"}`}>
                <TabIcon className="size-4" /> {String(label)}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-[1.8rem] border border-[#e1d3cb] bg-white p-5 sm:p-6">
          {tab === "content" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título do convite"><Input value={invitation.event_title} onChange={(value) => setInvitation({ ...invitation, event_title: value })} /></Field>
              <Field label="Aniversariante"><Input value={invitation.host_name} onChange={(value) => setInvitation({ ...invitation, host_name: value })} /></Field>
              <Field label="Idade"><Input type="number" value={String(invitation.age)} onChange={(value) => setInvitation({ ...invitation, age: Number(value) })} /></Field>
              <Field label="Data"><Input type="date" value={invitation.event_date ?? ""} onChange={(value) => setInvitation({ ...invitation, event_date: value })} /></Field>
              <Field label="Horário"><Input type="time" value={invitation.event_time} onChange={(value) => setInvitation({ ...invitation, event_time: value })} /></Field>
              <Field label="Local"><Input value={invitation.location_name} onChange={(value) => setInvitation({ ...invitation, location_name: value })} /></Field>
              <div className="sm:col-span-2"><Field label="Endereço"><Input value={invitation.address} onChange={(value) => setInvitation({ ...invitation, address: value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Link do mapa"><Input value={invitation.maps_url} onChange={(value) => setInvitation({ ...invitation, maps_url: value })} placeholder="https://maps.google.com/..." /></Field></div>
              <div className="sm:col-span-2"><Field label="Texto do convite"><TextArea value={invitation.invitation_text} onChange={(value) => setInvitation({ ...invitation, invitation_text: value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Observação da confirmação"><TextArea value={invitation.rsvp_note} onChange={(value) => setInvitation({ ...invitation, rsvp_note: value })} /></Field></div>
              <Toggle label="Confirmação de presença ativa" checked={invitation.rsvp_enabled} onChange={(checked) => setInvitation({ ...invitation, rsvp_enabled: checked })} />
              <Toggle label="Lista de presentes ativa" checked={invitation.gift_enabled} onChange={(checked) => setInvitation({ ...invitation, gift_enabled: checked })} />
            </div>
          )}

          {tab === "appearance" && (
            <div>
              <h2 className="font-display text-2xl font-bold">Combinações de cores</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {THEMES.map((item) => (
                  <button key={item.key} type="button" onClick={() => setInvitation({ ...invitation, theme_key: item.key })} className={`rounded-2xl border p-4 text-left ${invitation.theme_key === item.key ? "border-[#7d1f37] ring-2 ring-[#7d1f37]/10" : "border-[#dfd0c6]"}`}>
                    <div className="flex gap-2">
                      {[item.colors.background, item.colors.accent, item.colors.accentSoft, item.colors.text].map((color) => <span key={color} className="size-8 rounded-full border border-black/5" style={{ background: color }} />)}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div><p className="font-bold">{item.label}</p><p className="mt-1 text-xs text-[#806e72]">{item.description}</p></div>
                      {invitation.theme_key === item.key && <Check className="size-5 text-[#7d1f37]" />}
                    </div>
                  </button>
                ))}
              </div>

              <h2 className="mt-8 font-display text-2xl font-bold">Layout</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {LAYOUTS.map((layout) => (
                  <button key={layout.key} type="button" onClick={() => setInvitation({ ...invitation, layout_key: layout.key })} className={`rounded-2xl border p-4 text-left ${invitation.layout_key === layout.key ? "border-[#7d1f37] bg-[#fff8f5]" : "border-[#dfd0c6]"}`}>
                    <p className="font-bold">{layout.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#806e72]">{layout.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "photo" && (
            <div>
              <h2 className="font-display text-2xl font-bold">Foto principal do convite</h2>
              <p className="mt-2 text-sm leading-6 text-[#806e72]">A foto aparece no topo do convite. Use uma imagem vertical ou horizontal de boa qualidade.</p>
              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-dashed border-[#cdb8ab] bg-[#faf5f1]">
                {invitation.hero_image_url ? (
                  <img src={invitation.hero_image_url} alt="Foto principal" className="max-h-96 w-full object-contain" />
                ) : (
                  <div className="grid min-h-64 place-items-center text-center text-[#907d82]"><div><ImagePlus className="mx-auto size-10" /><p className="mt-3 font-bold">Nenhuma foto enviada</p></div></div>
                )}
              </div>
              <label className="mt-4 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white">
                <ImagePlus className="size-4" /> Escolher foto
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadHero(event.target.files?.[0])} />
              </label>
            </div>
          )}

          {tab === "gifts" && (
            <div>
              <h2 className="font-display text-2xl font-bold">Lista de presentes</h2>
              <p className="mt-2 text-sm text-[#806e72]">Foto manual tem prioridade. Sem foto manual, o link de sugestão tenta fornecer a imagem do anúncio.</p>

              <div className="mt-5 grid gap-3 rounded-2xl bg-[#faf6f3] p-4 sm:grid-cols-2">
                <Field label="Nome"><Input value={newGift.name} onChange={(value) => setNewGift({ ...newGift, name: value })} placeholder="Ex.: Mochila média" /></Field>
                <Field label="Observação"><Input value={newGift.price_hint} onChange={(value) => setNewGift({ ...newGift, price_hint: value })} placeholder="Cor, tamanho..." /></Field>
                <div className="sm:col-span-2"><Field label="Descrição"><Input value={newGift.description} onChange={(value) => setNewGift({ ...newGift, description: value })} /></Field></div>
                <div className="sm:col-span-2"><Field label="Link de sugestão"><Input value={newGift.suggestion_url} onChange={(value) => setNewGift({ ...newGift, suggestion_url: value })} placeholder="https://..." /></Field></div>
                <button type="button" onClick={() => void addGift()} disabled={giftBusy || newGift.name.trim().length < 2} className="h-10 rounded-full bg-[#7d1f37] px-4 text-sm font-bold text-white disabled:opacity-50">{giftBusy ? "Adicionando…" : "Adicionar presente"}</button>
              </div>

              <div className="mt-5 space-y-4">
                {gifts.map((gift) => (
                  <div key={gift.id} className="rounded-2xl border border-[#e1d3cb] p-4">
                    <div className="grid gap-4 md:grid-cols-[140px_1fr]">
                      <div className="overflow-hidden rounded-xl bg-[#f6eee9]">
                        {gift.manual_image_url ? (
                          <img src={gift.manual_image_url} alt={gift.name} className="h-36 w-full object-contain" />
                        ) : gift.suggestion_url ? (
                          <img src={`/api/product-image/${gift.id}?url=${encodeURIComponent(gift.suggestion_url)}`} alt={gift.name} className="h-36 w-full object-contain" />
                        ) : (
                          <div className="grid h-36 place-items-center text-3xl">🎁</div>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Nome"><Input value={gift.name} onChange={(value) => setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, name: value } : item))} /></Field>
                        <Field label="Observação"><Input value={gift.price_hint} onChange={(value) => setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, price_hint: value } : item))} /></Field>
                        <div className="sm:col-span-2"><Field label="Descrição"><Input value={gift.description} onChange={(value) => setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, description: value } : item))} /></Field></div>
                        <div className="sm:col-span-2"><Field label="Link de sugestão"><Input value={gift.suggestion_url ?? ""} onChange={(value) => setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, suggestion_url: value || null } : item))} /></Field></div>
                        <div className="sm:col-span-2 flex flex-wrap gap-2">
                          <button type="button" onClick={() => void saveGift(gift)} className="h-9 rounded-full bg-[#7d1f37] px-4 text-xs font-bold text-white">Salvar</button>
                          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-[#d8c7bd] px-4 text-xs font-bold"><ImagePlus className="size-3.5" /> Foto manual<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadGiftImage(gift, event.target.files?.[0])} /></label>
                          {gift.reserved && <button type="button" onClick={() => void releaseGift(gift)} className="h-9 rounded-full border border-[#d8c7bd] px-4 text-xs font-bold text-[#6b553e]">Liberar reserva</button>}
                          <button type="button" onClick={() => void deleteGift(gift)} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-bold text-red-700"><Trash2 className="size-3.5" /> Excluir</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {gifts.length === 0 && <p className="rounded-2xl border border-dashed border-[#d8c7bd] p-8 text-center text-sm text-[#806e72]">Nenhum presente cadastrado.</p>}
              </div>
            </div>
          )}

          {tab === "responses" && (
            <div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Confirmações" value={rsvps.length} />
                <Stat label="Adultos" value={adults} />
                <Stat label="Crianças" value={children} />
              </div>
              <h2 className="mt-7 font-display text-2xl font-bold">Presenças</h2>
              <div className="mt-3 space-y-3">
                {rsvps.map((rsvp) => (
                  <article key={rsvp.id} className="rounded-2xl border border-[#e1d3cb] p-4">
                    <p className="font-bold">{rsvp.contact_name}</p>
                    <p className="mt-1 text-xs text-[#806e72]">{rsvp.whatsapp || "Sem contato"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rsvp.attendees.map((attendee, index) => <span key={`${rsvp.id}-${index}`} className="rounded-full bg-[#f5ece7] px-3 py-1 text-xs font-bold text-[#684f55]">{attendee.name} • {attendee.category === "child" ? "Criança" : "Adulto"}</span>)}
                    </div>
                  </article>
                ))}
                {rsvps.length === 0 && <p className="text-sm text-[#806e72]">Ainda não há confirmações.</p>}
              </div>
              <h2 className="mt-7 font-display text-2xl font-bold">Reservas de presentes</h2>
              <div className="mt-3 space-y-2">
                {reservations.map((reservation) => {
                  const giftName = gifts.find((gift) => gift.id === reservation.gift_id)?.name ?? "Presente";
                  return <div key={reservation.id} className="rounded-xl bg-[#faf6f3] px-4 py-3 text-sm"><strong>{giftName}</strong> — {reservation.guest_name}{reservation.guest_contact ? ` • ${reservation.guest_contact}` : ""}</div>;
                })}
                {reservations.length === 0 && <p className="text-sm text-[#806e72]">Nenhuma reserva até agora.</p>}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#eee3dc] pt-5">
            <button type="button" onClick={() => void saveInvitation()} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar alterações
            </button>
            <button type="button" onClick={() => setInvitation({ ...invitation, status: invitation.status === "published" ? "draft" : "published" })} className="h-11 rounded-full border border-[#d8c7bd] px-5 text-sm font-bold text-[#684f55]">
              {invitation.status === "published" ? "Voltar para rascunho" : "Marcar para publicar"}
            </button>
            {message && <span className="text-sm font-bold text-[#7c686d]">{message}</span>}
          </div>
        </div>
      </section>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="rounded-[1.8rem] border border-[#dfd0c6] bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-2">
            <div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#9a7438]">Prévia</p><p className="mt-1 text-sm font-bold">{invitation.status === "published" ? "Publicado" : "Rascunho"}</p></div>
            {invitation.status === "published" && <a href={`/c/${invitation.slug}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-bold text-[#7d1f37]">Abrir <ExternalLink className="size-3.5" /></a>}
          </div>
          <MiniPreview invitation={invitation} />
        </div>
      </aside>
    </div>
  );
}

function MiniPreview({ invitation }: { invitation: Invitation }) {
  const theme = getTheme(invitation.theme_key);
  const style = {
    "--p-bg": theme.colors.background,
    "--p-panel": theme.colors.panel,
    "--p-text": theme.colors.text,
    "--p-muted": theme.colors.muted,
    "--p-accent": theme.colors.accent,
    "--p-soft": theme.colors.accentSoft,
    "--p-border": theme.colors.border,
  } as CSSProperties;

  return (
    <div style={style} className="overflow-hidden rounded-[1.4rem] border border-[var(--p-border)] bg-[var(--p-bg)]">
      {invitation.hero_image_url ? <img src={invitation.hero_image_url} alt="" className="h-52 w-full object-cover" /> : <div className="grid h-44 place-items-center bg-[var(--p-soft)] text-5xl">{invitation.layout_key === "kids" ? "🎈" : "🎂"}</div>}
      <div className={`p-6 text-center ${invitation.layout_key === "modern" ? "text-left" : ""}`}>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--p-accent)]">Você está convidado</p>
        <h3 className="mt-3 font-display text-3xl font-bold text-[var(--p-text)]">{invitation.event_title || "Seu aniversário"}</h3>
        <p className="mt-2 text-sm text-[var(--p-muted)]">{invitation.age} anos {invitation.event_date ? `• ${new Date(`${invitation.event_date}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}</p>
        <p className="mt-5 text-sm leading-6 text-[var(--p-muted)]">{invitation.invitation_text}</p>
        <span className="mt-5 inline-flex rounded-full bg-[var(--p-accent)] px-4 py-2 text-xs font-bold text-white">Confirmar presença</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-[#594147]">{label}<div className="mt-2">{children}</div></label>;
}

function Input({ value, onChange, type = "text", placeholder = "" }: { value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-[#d8c7bd] bg-white px-3 text-sm outline-none focus:border-[#9e6172] focus:ring-2 focus:ring-[#9e6172]/10" />;
}

function TextArea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="w-full rounded-xl border border-[#d8c7bd] bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-[#9e6172]" />;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e1d3cb] px-4 py-3 text-sm font-bold"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-[#7d1f37]" /></label>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-[#faf6f3] p-4"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#987f85]">{label}</p><p className="mt-2 font-display text-3xl font-bold">{value}</p></div>;
}
