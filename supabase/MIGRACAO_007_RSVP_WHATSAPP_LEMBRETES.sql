-- RSVP: padronização de nomes e WhatsApp + base para futuros lembretes.

create or replace function public.format_person_name_ptbr(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_clean text := trim(regexp_replace(coalesce(p_value, ''), '[[:space:]]+', ' ', 'g'));
  v_part text;
  v_result text := '';
  v_index integer := 0;
begin
  if v_clean = '' then return ''; end if;

  foreach v_part in array regexp_split_to_array(lower(v_clean), '[[:space:]]+')
  loop
    v_index := v_index + 1;
    if not (v_index > 1 and v_part in ('de', 'da', 'do', 'das', 'dos', 'e')) then
      v_part := initcap(v_part);
    end if;
    v_result := v_result || case when v_result = '' then '' else ' ' end || v_part;
  end loop;

  return v_result;
end;
$$;

create or replace function public.format_whatsapp_br(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
begin
  if length(v_digits) = 13 and left(v_digits, 2) = '55' then
    v_digits := substr(v_digits, 3);
  end if;
  if length(v_digits) <> 11 then return trim(coalesce(p_value, '')); end if;
  return '(' || substr(v_digits, 1, 2) || ') ' || substr(v_digits, 3, 5) || '-' || substr(v_digits, 8, 4);
end;
$$;

create or replace function public.whatsapp_e164_br(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
begin
  if length(v_digits) = 13 and left(v_digits, 2) = '55' then return '+' || v_digits; end if;
  if length(v_digits) = 11 then return '+55' || v_digits; end if;
  return '';
end;
$$;

alter table public.rsvps
  add column if not exists whatsapp_e164 text not null default '',
  add column if not exists whatsapp_reminders_enabled boolean not null default true,
  add column if not exists last_whatsapp_reminder_at timestamptz,
  add column if not exists whatsapp_reminder_count integer not null default 0;

alter table public.rsvps drop constraint if exists rsvps_whatsapp_reminder_count_check;
alter table public.rsvps add constraint rsvps_whatsapp_reminder_count_check check (whatsapp_reminder_count >= 0);

create or replace function public.normalize_rsvp_record()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_name text;
  v_digits text;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.contact_name, '') ~ '[0-9]' then
      raise exception 'Use apenas letras no nome de quem está confirmando.';
    end if;

    for v_item in select value from jsonb_array_elements(coalesce(new.attendees, '[]'::jsonb))
    loop
      v_name := coalesce(v_item->>'name', '');
      if v_name ~ '[0-9]' then
        raise exception 'Use apenas letras nos nomes dos convidados.';
      end if;
    end loop;

    v_digits := regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g');
    if length(v_digits) = 13 and left(v_digits, 2) = '55' then v_digits := substr(v_digits, 3); end if;
    if length(v_digits) <> 11 then
      raise exception 'Informe o WhatsApp no formato (XX) XXXXX-XXXX.';
    end if;
  end if;

  new.contact_name := public.format_person_name_ptbr(new.contact_name);
  new.whatsapp := public.format_whatsapp_br(new.whatsapp);
  new.whatsapp_e164 := public.whatsapp_e164_br(new.whatsapp);

  if jsonb_typeof(new.attendees) = 'array' then
    select coalesce(
      jsonb_agg(jsonb_set(item, '{name}', to_jsonb(public.format_person_name_ptbr(item->>'name')), true) order by ord),
      '[]'::jsonb
    ) into new.attendees
    from jsonb_array_elements(new.attendees) with ordinality as attendee(item, ord);
  end if;

  return new;
end;
$$;

drop trigger if exists rsvps_normalize_before_write on public.rsvps;
create trigger rsvps_normalize_before_write
before insert or update on public.rsvps
for each row execute function public.normalize_rsvp_record();

update public.rsvps
set
  contact_name = public.format_person_name_ptbr(contact_name),
  whatsapp = public.format_whatsapp_br(whatsapp),
  whatsapp_e164 = public.whatsapp_e164_br(whatsapp),
  attendees = (
    select coalesce(
      jsonb_agg(jsonb_set(item, '{name}', to_jsonb(public.format_person_name_ptbr(item->>'name')), true) order by ord),
      '[]'::jsonb
    )
    from jsonb_array_elements(rsvps.attendees) with ordinality as attendee(item, ord)
  );

create table if not exists public.whatsapp_reminders (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  rsvp_id uuid not null references public.rsvps(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  template_key text not null default 'event_reminder',
  message_preview text not null default '',
  provider_message_id text,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_reminders_due_idx on public.whatsapp_reminders(status, scheduled_for);
create index if not exists whatsapp_reminders_invitation_idx on public.whatsapp_reminders(invitation_id);
create index if not exists whatsapp_reminders_rsvp_idx on public.whatsapp_reminders(rsvp_id);

alter table public.whatsapp_reminders enable row level security;
