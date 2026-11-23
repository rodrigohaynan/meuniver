import type { Invitation } from "@/lib/types";

// Montagem do link e da mensagem de compartilhamento do convite.
// Sem dependências de servidor: usado nos botões do painel e do editor.

export type ShareableInvitation = Pick<
  Invitation,
  | "id"
  | "slug"
  | "event_title"
  | "host_name"
  | "event_date"
  | "event_time"
  | "location_name"
  | "invitation_text"
  | "hero_image_url"
  | "hero_image_zoom"
  | "hero_image_x"
  | "hero_image_y"
  | "rsvp_enabled"
  | "updated_at"
>;

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Domínio oficial do site; cai para a origem atual em desenvolvimento. */
export function shareOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && /^https:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://convidata.com.br";
}

/**
 * Link público do convite. O parâmetro `share` muda quando título, texto ou foto
 * mudam, forçando o WhatsApp a buscar a prévia (foto e título) atualizada.
 */
export function invitationShareUrl(invitation: ShareableInvitation) {
  const version = fingerprint(
    [
      invitation.event_title ?? "",
      invitation.invitation_text ?? "",
      invitation.hero_image_url ?? "",
      invitation.hero_image_zoom ?? 1,
      invitation.hero_image_x ?? 50,
      invitation.hero_image_y ?? 50,
      invitation.updated_at ?? "",
    ].join("|"),
  );
  const url = new URL(`/c/${encodeURIComponent(invitation.slug)}`, shareOrigin());
  url.searchParams.set("share", version);
  return url.toString();
}

function formatEventDate(date: string | null) {
  if (!date) return "";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  const text = parsed.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatEventTime(time: string | null | undefined) {
  const match = String(time ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = match[2];
  return minutes === "00" ? `${hours}h` : `${hours}h${minutes}`;
}

/** Mensagem padrão: o link vai por último para o WhatsApp montar a prévia com foto. */
export function defaultShareMessage(invitation: ShareableInvitation, url = invitationShareUrl(invitation)) {
  const title = invitation.event_title?.trim() || "nosso evento";
  const date = formatEventDate(invitation.event_date);
  const time = formatEventTime(invitation.event_time);
  const when = [date, time && (date ? `às ${time}` : time)].filter(Boolean).join(" ");
  const place = invitation.location_name?.trim();

  const lines = ["Você está convidado(a)! 🎉", "", `*${title}*`];
  if (when) lines.push(`📅 ${when}`);
  if (place) lines.push(`📍 ${place}`);
  lines.push(
    "",
    invitation.rsvp_enabled === false
      ? "Veja todos os detalhes no convite:"
      : "Veja o convite e confirme sua presença:",
    url,
  );
  return lines.join("\n");
}

export function whatsappShareHref(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
