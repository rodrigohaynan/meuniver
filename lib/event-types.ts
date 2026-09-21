export const EVENT_TYPES = [
  { key: "birthday", label: "Aniversário", emoji: "🎂", group: "Pessoais", usesAge: true, hostLabel: "Nome do aniversariante", placeholder: "Ex.: Théo, Sofia, Miguel..." },
  { key: "monthiversary", label: "Mêsversário", emoji: "🍼", group: "Pessoais", usesAge: true, hostLabel: "Nome do bebê", placeholder: "Ex.: Théo, Sofia..." },
  { key: "wedding", label: "Casamento", emoji: "💍", group: "Casais", usesAge: false, hostLabel: "Nome dos noivos", placeholder: "Ex.: Ana e Pedro" },
  { key: "engagement", label: "Noivado", emoji: "🥂", group: "Casais", usesAge: false, hostLabel: "Nome dos noivos", placeholder: "Ex.: Ana e Pedro" },
  { key: "wedding-anniversary", label: "Bodas", emoji: "🤍", group: "Casais", usesAge: false, hostLabel: "Nome do casal", placeholder: "Ex.: Ana e Pedro" },
  { key: "baby-shower", label: "Chá de bebê", emoji: "👶", group: "Família", usesAge: false, hostLabel: "Nome do bebê ou da família", placeholder: "Ex.: Bebê Sofia" },
  { key: "gender-reveal", label: "Chá revelação", emoji: "🎈", group: "Família", usesAge: false, hostLabel: "Nome da família ou dos futuros pais", placeholder: "Ex.: Ana e Pedro" },
  { key: "diaper-shower", label: "Chá de fraldas", emoji: "🧷", group: "Família", usesAge: false, hostLabel: "Nome do bebê ou da família", placeholder: "Ex.: Bebê Sofia" },
  { key: "baptism", label: "Batizado", emoji: "🕊️", group: "Família", usesAge: false, hostLabel: "Nome do homenageado", placeholder: "Ex.: Sofia" },
  { key: "barbecue", label: "Churrasco", emoji: "🍖", group: "Encontros", usesAge: false, hostLabel: "Nome do anfitrião ou do grupo", placeholder: "Ex.: Família Silva" },
  { key: "meeting", label: "Reunião", emoji: "🗓️", group: "Encontros", usesAge: false, hostLabel: "Nome do grupo ou anfitrião", placeholder: "Ex.: Equipe comercial" },
  { key: "gathering", label: "Confraternização", emoji: "🤝", group: "Encontros", usesAge: false, hostLabel: "Nome do grupo ou anfitrião", placeholder: "Ex.: Amigos de longa data" },
  { key: "party", label: "Festa", emoji: "🎉", group: "Encontros", usesAge: false, hostLabel: "Nome ou tema da festa", placeholder: "Ex.: Festa da turma" },
  { key: "graduation", label: "Formatura", emoji: "🎓", group: "Outras ocasiões", usesAge: false, hostLabel: "Nome do formando ou da turma", placeholder: "Ex.: Turma de Direito" },
  { key: "housewarming", label: "Chá de casa nova", emoji: "🏠", group: "Outras ocasiões", usesAge: false, hostLabel: "Nome dos anfitriões", placeholder: "Ex.: Ana e Pedro" },
  { key: "inauguration", label: "Inauguração", emoji: "🎀", group: "Outras ocasiões", usesAge: false, hostLabel: "Nome do local ou da empresa", placeholder: "Ex.: Minha Loja" },
  { key: "corporate", label: "Evento corporativo", emoji: "🏢", group: "Outras ocasiões", usesAge: false, hostLabel: "Nome da empresa ou do evento", placeholder: "Ex.: Encontro anual da equipe" },
  { key: "other", label: "Outro evento", emoji: "✨", group: "Outras ocasiões", usesAge: false, hostLabel: "Nome do evento ou anfitrião", placeholder: "Ex.: Nosso encontro especial" },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]["key"];

export function isEventType(value: string): value is EventType {
  return EVENT_TYPES.some((type) => type.key === value);
}

export function eventTypeFor(invitation: { event_type?: string | null; age_unit?: string | null }): EventType {
  if (invitation.event_type && isEventType(invitation.event_type)) return invitation.event_type;
  return invitation.age_unit === "months" ? "monthiversary" : "birthday";
}

export function eventTypeMeta(value: EventType) {
  return EVENT_TYPES.find((type) => type.key === value) ?? EVENT_TYPES[0];
}

export function eventUsesAge(value: EventType) {
  return eventTypeMeta(value).usesAge;
}

export function defaultEventTitle(value: EventType, name: string): string {
  const title = eventTypeMeta(value).label;
  const clean = name.trim();
  if (!clean) return title;
  if (value === "other" || value === "corporate") return clean;
  if (value === "meeting" || value === "party" || value === "gathering" || value === "inauguration") return `${title} — ${clean}`;
  return `${title} de ${clean}`;
}

export function defaultInvitationText(value: EventType) {
  if (value === "monthiversary") return "Vamos celebrar mais um mês de vida! Sua presença vai deixar esse momento ainda mais especial.";
  if (value === "birthday") return "Vamos celebrar juntos! Sua presença vai deixar esse dia ainda mais especial.";
  if (value === "meeting" || value === "corporate") return "Sua participação é muito importante. Esperamos você neste encontro!";
  return "Será um prazer celebrar este momento com você. Sua presença vai tornar esta ocasião ainda mais especial.";
}

export function eventDisplayLabel(value: EventType) {
  return eventTypeMeta(value).label.toLocaleLowerCase("pt-BR");
}
