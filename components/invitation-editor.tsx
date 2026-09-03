"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Check,
  ExternalLink,
  Gift,
  ImagePlus,
  Loader2,
  Minus,
  MoveHorizontal,
  MoveVertical,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  UsersRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTheme, LAYOUTS, THEMES } from "@/lib/themes";
import type { GiftItem, GiftReservation, Invitation, Rsvp } from "@/lib/types";

type Tab = "content" | "appearance" | "photo" | "gifts" | "responses";

const PHOTO_ZOOM_MIN = 1;
const PHOTO_ZOOM_MAX = 2.5;

function formatAge(age: number) {
  const value = Math.max(1, Math.round(Number(age) || 1));
  return `${value} ${value === 1 ? "ano" : "anos"}`;
}

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
  const [invitation, setInvitation] = useState({
    ...initialInvitation,
    hero_image_zoom: initialInvitation.hero_image_zoom ?? 1,
    hero_image_x: initialInvitation.hero_image_x ?? 50,
    hero_image_y: initialInvitation.hero_image_y ?? 50,
  });
  const [gifts, setGifts] = useState(initialGifts.map((gift) => ({ ...gift, suggestion_image_url: gift.suggestion_image_url ?? null })));
  const [rsvps] = useState(initialRsvps);
  const [reservations] = useState(initialReservations);
  const [tab, setTab] = useState<Tab>("content");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newGift, setNewGift] = useState({ name: "", description: "", price_hint: "", suggestion_url: "" });
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftImageBusy, setGiftImageBusy] = useState<string | null>(null);

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
        hero_image_zoom: invitation.hero_image_zoom,
        hero_image_x: invitation.hero_image_x,
        hero_image_y: invitation.hero_image_y,
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

    const extension = safeExtension(file.type, file.name);
    const path = `${user.id}/${invitation.id}/hero-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("invite-media").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (uploadError) {
      setSaving(false);
      setMessage(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from("invite-media").getPublicUrl(path);
    const next = {
      ...invitation,
      hero_image_url: data.publicUrl,
      hero_image_zoom: 1,
      hero_image_x: 50,
      hero_image_y: 50,
    };
    setInvitation(next);
    const { error } = await supabase
      .from("invitations")
      .update({
        hero_image_url: data.publicUrl,
        hero_image_zoom: 1,
        hero_image_x: 50,
        hero_image_y: 50,
      })
      .eq("id", invitation.id);
    setSaving(false);
    setMessage(error ? error.message : "Foto principal atualizada. Ajuste o enquadramento e salve.");
  }

  async function captureAndStoreSuggestionImage(giftId: string, suggestionUrl: string) {
    const cleanUrl = suggestionUrl.trim();
    if (!cleanUrl) return null;

    const response = await fetch(
      `/api/product-image/${encodeURIComponent(giftId)}?url=${encodeURIComponent(cleanUrl)}&t=${Date.now()}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).trim();
      throw new Error(detail || "Não foi possível localizar a imagem principal desse anúncio.");
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
    if (!contentType.startsWith("image/")) {
      throw new Error("O anúncio respondeu sem uma imagem válida.");
    }

    const blob = await response.blob();
    if (!blob.size) throw new Error("A imagem capturada veio vazia.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada. Entre novamente para importar a imagem.");

    const extension = safeExtension(contentType, `produto.${contentType.split("/")[1] || "jpg"}`);
    const path = `${user.id}/${invitation.id}/gift-${giftId}-suggestion-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("invite-media").upload(path, blob, {
      upsert: false,
      contentType,
    });
    if (uploadError) throw new Error(`Imagem encontrada, mas não foi possível armazená-la: ${uploadError.message}`);

    const { data } = supabase.storage.from("invite-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function addGift() {
    if (newGift.name.trim().length < 2 || giftBusy) return;
    setGiftBusy(true);
    setMessage("");
    const suggestionUrl = newGift.suggestion_url.trim() || null;
    const { data, error } = await supabase.from("gifts").insert({
      invitation_id: invitation.id,
      name: newGift.name.trim(),
      description: newGift.description.trim(),
      price_hint: newGift.price_hint.trim(),
      suggestion_url: suggestionUrl,
      suggestion_image_url: null,
      sort_order: gifts.length + 1,
    }).select("*").single();

    if (error || !data) {
      setMessage(error?.message ?? "Não foi possível adicionar o presente.");
      setGiftBusy(false);
      return;
    }

    let gift = data as GiftItem;
    let finalMessage = "Presente adicionado.";
    if (suggestionUrl) {
      try {
        const imageUrl = await captureAndStoreSuggestionImage(gift.id, suggestionUrl);
        if (imageUrl) {
          await supabase.from("gifts").update({ suggestion_image_url: imageUrl }).eq("id", gift.id);
          gift = { ...gift, suggestion_image_url: imageUrl };
          finalMessage = "Presente adicionado com imagem do anúncio.";
        }
      } catch (captureError) {
        finalMessage = captureError instanceof Error
          ? `Presente salvo, mas ${captureError.message.toLowerCase()}`
          : "Presente salvo sem imagem automática.";
      }
    }

    setGifts((current) => [...current, gift]);
    setNewGift({ name: "", description: "", price_hint: "", suggestion_url: "" });
    setMessage(finalMessage);
    setGiftBusy(false);
  }

  async function saveGift(gift: GiftItem) {
    if (giftImageBusy) return;
    setGiftImageBusy(gift.id);
    setMessage("");

    const suggestionUrl = gift.suggestion_url?.trim() || null;
    let suggestionImageUrl = suggestionUrl ? gift.suggestion_image_url : null;

    const { error: baseError } = await supabase.from("gifts").update({
      name: gift.name.trim(),
      description: gift.description.trim(),
      price_hint: gift.price_hint.trim(),
      suggestion_url: suggestionUrl,
      suggestion_image_url: suggestionImageUrl,
      sort_order: gift.sort_order,
      manual_image_url: gift.manual_image_url,
    }).eq("id", gift.id);

    if (baseError) {
      setGiftImageBusy(null);
      setMessage(baseError.message);
      return;
    }

    if (suggestionUrl && !gift.manual_image_url) {
      try {
        const capturedImageUrl = await captureAndStoreSuggestionImage(gift.id, suggestionUrl);
        if (capturedImageUrl) {
          suggestionImageUrl = capturedImageUrl;
          const { error } = await supabase.from("gifts").update({ suggestion_image_url: capturedImageUrl }).eq("id", gift.id);
          if (error) throw new Error(error.message);
          setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, suggestion_image_url: capturedImageUrl } : item));
          setMessage(`Presente "${gift.name}" salvo com a imagem atualizada do anúncio.`);
        }
      } catch (captureError) {
        const detail = captureError instanceof Error ? captureError.message : "Não foi possível capturar a imagem automática.";
        setMessage(suggestionImageUrl
          ? `Presente salvo. Não foi possível atualizar a imagem do anúncio; a imagem anterior foi mantida. ${detail}`
          : `Presente salvo. ${detail}`);
      }
    } else {
      setMessage(`Presente "${gift.name}" salvo.`);
    }
    setGiftImageBusy(null);
  }

  async function recaptureGiftImage(gift: GiftItem) {
    if (!gift.suggestion_url?.trim() || giftImageBusy) return;
    setGiftImageBusy(gift.id);
    setMessage("");
    try {
      const imageUrl = await captureAndStoreSuggestionImage(gift.id, gift.suggestion_url);
      if (!imageUrl) throw new Error("Imagem não encontrada.");
      const { error } = await supabase.from("gifts").update({ suggestion_image_url: imageUrl }).eq("id", gift.id);
      if (error) throw new Error(error.message);
      setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, suggestion_image_url: imageUrl } : item));
      setMessage("Imagem do anúncio atualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a imagem do anúncio.");
    } finally {
      setGiftImageBusy(null);
    }
  }

  async function uploadGiftImage(gift: GiftItem, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setMessage("Use JPG, PNG ou WEBP com até 8 MB.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const extension = safeExtension(file.type, file.name);
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

  async function removeGiftManualImage(gift: GiftItem) {
    const { error } = await supabase.from("gifts").update({ manual_image_url: null }).eq("id", gift.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, manual_image_url: null } : item));
    setMessage("Foto manual removida. A imagem do link terá prioridade agora.");
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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-[#e4d8d0] bg-[#fffdfa] shadow-[0_14px_45px_rgba(83,48,58,.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee4de] px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#9a7438]">Prévia do convite</p>
            <p className="mt-1 text-sm font-semibold text-[#765f65]">Edite abaixo e acompanhe o resultado sem um painel pesado.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${invitation.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-[#f5ece7] text-[#765f65]"}`}>{invitation.status === "published" ? "Publicado" : "Rascunho"}</span>
            {invitation.status === "published" && <a href={`/c/${invitation.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#7d1f37]">Abrir convite <ExternalLink className="size-3.5" /></a>}
          </div>
        </div>
        <div className="mx-auto max-w-4xl p-3 sm:p-5"><MiniPreview invitation={invitation} /></div>
      </section>

      <section>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            ["content", Settings2, "Informações"],
            ["appearance", Palette, "Cores e layout"],
            ["photo", ImagePlus, "Foto principal"],
            ["gifts", Gift, "Presentes"],
            ["responses", UsersRound, "Respostas"],
          ].map(([key, Icon, label]) => {
            const TabIcon = Icon as typeof Settings2;
            return (
              <button key={String(key)} type="button" onClick={() => setTab(key as Tab)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${tab === key ? "bg-[#7d1f37] text-white" : "border border-[#ded0c8] bg-white text-[#684f55] hover:bg-[#fff9f5]"}`}>
                <TabIcon className="size-4" /> {String(label)}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-[1.8rem] border border-[#e4d8d0] bg-[#fffdfa] p-5 shadow-[0_12px_40px_rgba(83,48,58,.045)] sm:p-7">
          {tab === "content" && (
            <div>
              <SectionTitle title="Informações do aniversário" description="Tudo que o convidado precisa saber, sem excesso de blocos na página pública." />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
            </div>
          )}

          {tab === "appearance" && (
            <div>
              <SectionTitle title="Estilo do convite" description="Escolha uma combinação pronta e um formato. O conteúdo continua o mesmo." />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {THEMES.map((item) => (
                  <button key={item.key} type="button" onClick={() => setInvitation({ ...invitation, theme_key: item.key })} className={`rounded-2xl border p-4 text-left transition ${invitation.theme_key === item.key ? "border-[#7d1f37] bg-[#fff8f5] ring-2 ring-[#7d1f37]/10" : "border-[#dfd0c6] bg-white hover:border-[#c9b2a6]"}`}>
                    <div className="flex gap-2">{[item.colors.background, item.colors.accent, item.colors.accentSoft, item.colors.text].map((color) => <span key={color} className="size-8 rounded-full border border-black/5" style={{ background: color }} />)}</div>
                    <div className="mt-3 flex items-center justify-between gap-3"><div><p className="font-bold">{item.label}</p><p className="mt-1 text-xs text-[#806e72]">{item.description}</p></div>{invitation.theme_key === item.key && <Check className="size-5 text-[#7d1f37]" />}</div>
                  </button>
                ))}
              </div>

              <h3 className="mt-8 font-display text-xl font-bold">Formato</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {LAYOUTS.map((layout) => (
                  <button key={layout.key} type="button" onClick={() => setInvitation({ ...invitation, layout_key: layout.key })} className={`rounded-2xl border p-4 text-left transition ${invitation.layout_key === layout.key ? "border-[#7d1f37] bg-[#fff8f5]" : "border-[#dfd0c6] bg-white"}`}>
                    <p className="font-bold">{layout.label}</p><p className="mt-1 text-xs leading-5 text-[#806e72]">{layout.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "photo" && (
            <div>
              <SectionTitle title="Foto principal" description="Ajuste a foto dentro da janela do convite. O enquadramento abaixo será o mesmo da página publicada." />
              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
                <div>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.6rem] border border-[#dbc9be] bg-[#f5ece7] sm:aspect-[16/9]">
                    {invitation.hero_image_url ? (
                      <img
                        src={invitation.hero_image_url}
                        alt="Foto principal"
                        className="h-full w-full object-cover transition-transform duration-150"
                        style={heroImageStyle(invitation)}
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-center text-[#907d82]"><div><ImagePlus className="mx-auto size-10" /><p className="mt-3 font-bold">Nenhuma foto enviada</p></div></div>
                    )}
                  </div>
                  <div className="mt-3 rounded-2xl bg-[#faf5f1] px-4 py-3 text-xs leading-5 text-[#76666a]">
                    <strong className="text-[#4e343a]">Dimensão ideal:</strong> 1600 × 1200 px (proporção 4:3) ou maior. Mínimo recomendado: 1200 × 900 px. JPG ou WEBP costuma dar o melhor resultado. Mantenha rostos e textos importantes próximos ao centro para funcionar bem no celular e no computador.
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white"><ImagePlus className="size-4" /> {invitation.hero_image_url ? "Trocar foto" : "Escolher foto"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadHero(event.target.files?.[0])} /></label>
                    {invitation.hero_image_url && <button type="button" onClick={() => setInvitation({ ...invitation, hero_image_zoom: 1, hero_image_x: 50, hero_image_y: 50 })} className="inline-flex h-11 items-center gap-2 rounded-full border border-[#d8c7bd] bg-white px-4 text-sm font-bold text-[#684f55]"><RotateCcw className="size-4" /> Centralizar</button>}
                  </div>

                  <RangeControl icon={<Plus className="size-4" />} label="Zoom" value={invitation.hero_image_zoom} min={PHOTO_ZOOM_MIN} max={PHOTO_ZOOM_MAX} step={0.05} valueLabel={`${Math.round(invitation.hero_image_zoom * 100)}%`} disabled={!invitation.hero_image_url} onChange={(value) => setInvitation({ ...invitation, hero_image_zoom: value })} />
                  <RangeControl icon={<MoveHorizontal className="size-4" />} label="Posição horizontal" value={invitation.hero_image_x} min={0} max={100} step={1} valueLabel={`${Math.round(invitation.hero_image_x)}%`} disabled={!invitation.hero_image_url} onChange={(value) => setInvitation({ ...invitation, hero_image_x: value })} />
                  <RangeControl icon={<MoveVertical className="size-4" />} label="Posição vertical" value={invitation.hero_image_y} min={0} max={100} step={1} valueLabel={`${Math.round(invitation.hero_image_y)}%`} disabled={!invitation.hero_image_url} onChange={(value) => setInvitation({ ...invitation, hero_image_y: value })} />
                  <div className="flex gap-2">
                    <button type="button" disabled={!invitation.hero_image_url || invitation.hero_image_zoom <= PHOTO_ZOOM_MIN} onClick={() => setInvitation({ ...invitation, hero_image_zoom: Math.max(PHOTO_ZOOM_MIN, Number((invitation.hero_image_zoom - .1).toFixed(2))) })} className="inline-flex size-10 items-center justify-center rounded-full border border-[#d8c7bd] bg-white disabled:opacity-40" aria-label="Diminuir zoom"><Minus className="size-4" /></button>
                    <button type="button" disabled={!invitation.hero_image_url || invitation.hero_image_zoom >= PHOTO_ZOOM_MAX} onClick={() => setInvitation({ ...invitation, hero_image_zoom: Math.min(PHOTO_ZOOM_MAX, Number((invitation.hero_image_zoom + .1).toFixed(2))) })} className="inline-flex size-10 items-center justify-center rounded-full border border-[#d8c7bd] bg-white disabled:opacity-40" aria-label="Aumentar zoom"><Plus className="size-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "gifts" && (
            <div>
              <SectionTitle title="Lista de presentes" description="Foto manual tem prioridade. Sem foto manual, o sistema salva uma cópia da imagem do link para evitar anúncios quebrados." />
              <div className="mt-5 grid gap-3 rounded-2xl bg-[#faf6f3] p-4 sm:grid-cols-2">
                <Field label="Nome"><Input value={newGift.name} onChange={(value) => setNewGift({ ...newGift, name: value })} placeholder="Ex.: Mochila média" /></Field>
                <Field label="Observação"><Input value={newGift.price_hint} onChange={(value) => setNewGift({ ...newGift, price_hint: value })} placeholder="Cor, tamanho..." /></Field>
                <div className="sm:col-span-2"><Field label="Descrição"><Input value={newGift.description} onChange={(value) => setNewGift({ ...newGift, description: value })} /></Field></div>
                <div className="sm:col-span-2"><Field label="Link de sugestão"><Input value={newGift.suggestion_url} onChange={(value) => setNewGift({ ...newGift, suggestion_url: value })} placeholder="https://..." /></Field></div>
                <button type="button" onClick={() => void addGift()} disabled={giftBusy || newGift.name.trim().length < 2} className="h-10 rounded-full bg-[#7d1f37] px-4 text-sm font-bold text-white disabled:opacity-50">{giftBusy ? "Adicionando…" : "Adicionar presente"}</button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {gifts.map((gift) => (
                  <div key={gift.id} className="overflow-hidden rounded-[1.5rem] border border-[#e1d3cb] bg-white">
                    <div className="grid gap-4 p-4 sm:grid-cols-[150px_1fr]">
                      <GiftImagePreview gift={gift} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Nome"><Input value={gift.name} onChange={(value) => setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, name: value } : item))} /></Field>
                        <Field label="Observação"><Input value={gift.price_hint} onChange={(value) => setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, price_hint: value } : item))} /></Field>
                        <div className="sm:col-span-2"><Field label="Descrição"><Input value={gift.description} onChange={(value) => setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, description: value } : item))} /></Field></div>
                        <div className="sm:col-span-2"><Field label="Link de sugestão"><Input value={gift.suggestion_url ?? ""} onChange={(value) => setGifts((items) => items.map((item) => item.id === gift.id ? { ...item, suggestion_url: value || null, suggestion_image_url: null } : item))} /></Field></div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-[#eee4de] px-4 py-3">
                      <button type="button" onClick={() => void saveGift(gift)} disabled={giftImageBusy === gift.id} className="h-9 rounded-full bg-[#7d1f37] px-4 text-xs font-bold text-white disabled:opacity-50">{giftImageBusy === gift.id ? "Salvando…" : "Salvar"}</button>
                      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-[#d8c7bd] px-4 text-xs font-bold"><ImagePlus className="size-3.5" /> Foto manual<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadGiftImage(gift, event.target.files?.[0])} /></label>
                      {gift.manual_image_url && <button type="button" onClick={() => void removeGiftManualImage(gift)} className="h-9 rounded-full px-3 text-xs font-bold text-red-700">Remover foto manual</button>}
                      {gift.suggestion_url && <button type="button" onClick={() => void recaptureGiftImage(gift)} disabled={giftImageBusy === gift.id} className="h-9 rounded-full border border-[#d8c7bd] px-4 text-xs font-bold text-[#6b553e]">Recapturar imagem do link</button>}
                      {gift.reserved && <button type="button" onClick={() => void releaseGift(gift)} className="h-9 rounded-full border border-[#d8c7bd] px-4 text-xs font-bold text-[#6b553e]">Liberar reserva</button>}
                      <button type="button" onClick={() => void deleteGift(gift)} className="ml-auto inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-bold text-red-700"><Trash2 className="size-3.5" /> Excluir</button>
                    </div>
                  </div>
                ))}
                {gifts.length === 0 && <p className="rounded-2xl border border-dashed border-[#d8c7bd] p-8 text-center text-sm text-[#806e72] lg:col-span-2">Nenhum presente cadastrado.</p>}
              </div>
            </div>
          )}

          {tab === "responses" && (
            <div>
              <SectionTitle title="Confirmações e reservas" description="Acompanhe quem confirmou presença e quais presentes já foram escolhidos." />
              <div className="mt-5 grid gap-3 sm:grid-cols-3"><Stat label="Confirmações" value={rsvps.length} /><Stat label="Adultos" value={adults} /><Stat label="Crianças" value={children} /></div>
              <h3 className="mt-7 font-display text-xl font-bold">Presenças</h3>
              <div className="mt-3 space-y-3">
                {rsvps.map((rsvp) => <article key={rsvp.id} className="rounded-2xl border border-[#e1d3cb] bg-white p-4"><p className="font-bold">{rsvp.contact_name}</p><p className="mt-1 text-xs text-[#806e72]">{rsvp.whatsapp || "Sem contato"}</p><div className="mt-3 flex flex-wrap gap-2">{rsvp.attendees.map((attendee, index) => <span key={`${rsvp.id}-${index}`} className="rounded-full bg-[#f5ece7] px-3 py-1 text-xs font-bold text-[#684f55]">{attendee.name} • {attendee.category === "child" ? "Criança" : "Adulto"}</span>)}</div></article>)}
                {rsvps.length === 0 && <p className="text-sm text-[#806e72]">Ainda não há confirmações.</p>}
              </div>
              <h3 className="mt-7 font-display text-xl font-bold">Reservas de presentes</h3>
              <div className="mt-3 space-y-2">{reservations.map((reservation) => { const giftName = gifts.find((gift) => gift.id === reservation.gift_id)?.name ?? "Presente"; return <div key={reservation.id} className="rounded-xl bg-[#faf6f3] px-4 py-3 text-sm"><strong>{giftName}</strong> — {reservation.guest_name}{reservation.guest_contact ? ` • ${reservation.guest_contact}` : ""}</div>; })}{reservations.length === 0 && <p className="text-sm text-[#806e72]">Nenhuma reserva até agora.</p>}</div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-[#eee3dc] pt-5">
            <button type="button" onClick={() => void saveInvitation()} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar alterações</button>
            <button type="button" onClick={() => setInvitation({ ...invitation, status: invitation.status === "published" ? "draft" : "published" })} className="h-11 rounded-full border border-[#d8c7bd] bg-white px-5 text-sm font-bold text-[#684f55]">{invitation.status === "published" ? "Voltar para rascunho" : "Marcar para publicar"}</button>
            {message && <span className="text-sm font-bold text-[#7c686d]">{message}</span>}
          </div>
        </div>
      </section>
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
    <div style={style} className="overflow-hidden rounded-[1.7rem] border border-[var(--p-border)] bg-[var(--p-panel)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--p-soft)] sm:aspect-[16/8]">
        {invitation.hero_image_url ? <img src={invitation.hero_image_url} alt="" className="h-full w-full object-cover" style={heroImageStyle(invitation)} /> : <div className="grid h-full place-items-center text-5xl">{invitation.layout_key === "kids" ? "🎈" : "🎂"}</div>}
      </div>
      <div className={`px-6 py-7 sm:px-10 ${invitation.layout_key === "modern" ? "text-left" : "text-center"}`}>
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[var(--p-accent)]">Você está convidado</p>
        <h3 className="mt-2 font-display text-3xl font-bold text-[var(--p-text)] sm:text-4xl">{invitation.event_title || "Seu aniversário"}</h3>
        <p className="mt-2 text-sm font-semibold text-[var(--p-muted)]">{formatAge(invitation.age)} {invitation.event_date ? `• ${new Date(`${invitation.event_date}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}</p>
        <p className={`mt-4 text-sm leading-6 text-[var(--p-muted)] ${invitation.layout_key === "modern" ? "max-w-2xl" : "mx-auto max-w-2xl"}`}>{invitation.invitation_text}</p>
      </div>
    </div>
  );
}

function GiftImagePreview({ gift }: { gift: GiftItem }) {
  const [storedFailed, setStoredFailed] = useState(false);
  const [proxyFailed, setProxyFailed] = useState(false);

  useEffect(() => {
    setStoredFailed(false);
    setProxyFailed(false);
  }, [gift.manual_image_url, gift.suggestion_image_url, gift.suggestion_url]);

  const storedSuggestion = gift.suggestion_image_url?.includes("/storage/v1/object/public/invite-media/")
    ? gift.suggestion_image_url
    : null;
  const stored = gift.manual_image_url || storedSuggestion;
  const proxy = gift.suggestion_url ? `/api/product-image/${encodeURIComponent(gift.id)}?url=${encodeURIComponent(gift.suggestion_url)}&t=preview` : null;
  const src = stored && !storedFailed ? stored : proxy && !proxyFailed ? proxy : null;

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#f6eee9]">
      {src ? (
        <img
          key={src}
          src={src}
          alt={gift.name}
          referrerPolicy="no-referrer"
          className="h-40 w-full object-contain"
          onError={() => stored && !storedFailed ? setStoredFailed(true) : setProxyFailed(true)}
        />
      ) : <div className="grid h-40 place-items-center text-3xl">🎁</div>}
      <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#765f65]">{gift.manual_image_url ? "Foto manual" : src ? "Imagem do link" : "Sem imagem"}</span>
    </div>
  );
}

function heroImageStyle(invitation: Pick<Invitation, "hero_image_zoom" | "hero_image_x" | "hero_image_y">): CSSProperties {
  return {
    objectPosition: `${clamp(invitation.hero_image_x ?? 50, 0, 100)}% ${clamp(invitation.hero_image_y ?? 50, 0, 100)}%`,
    transform: `scale(${clamp(invitation.hero_image_zoom ?? 1, PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX)})`,
  };
}

function RangeControl({ icon, label, value, min, max, step, valueLabel, disabled, onChange }: { icon: React.ReactNode; label: string; value: number; min: number; max: number; step: number; valueLabel: string; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <label className={`block ${disabled ? "opacity-45" : ""}`}>
      <span className="flex items-center justify-between gap-3 text-sm font-bold text-[#594147]"><span className="inline-flex items-center gap-2">{icon}{label}</span><span className="text-xs text-[#907d82]">{valueLabel}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-[#7d1f37]" />
    </label>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="font-display text-2xl font-bold text-[#351820]">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[#806e72]">{description}</p></div>;
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
  return <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e1d3cb] bg-white px-4 py-3 text-sm font-bold"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-[#7d1f37]" /></label>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-[#faf6f3] p-4"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#987f85]">{label}</p><p className="mt-2 font-display text-3xl font-bold">{value}</p></div>;
}

function safeExtension(contentType: string, filename: string) {
  const byType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
  if (byType[contentType]) return byType[contentType];
  const raw = filename.split(".").pop()?.toLowerCase();
  return raw && /^[a-z0-9]{2,5}$/.test(raw) ? raw : "jpg";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
