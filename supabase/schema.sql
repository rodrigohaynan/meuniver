-- Meu Convite — schema inicial
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','published')),
  event_title text not null default 'Meu aniversário',
  host_name text not null default '',
  age integer not null default 1 check (age between 1 and 120),
  event_date date,
  event_time text not null default '',
  location_name text not null default '',
  address text not null default '',
  maps_url text not null default '',
  invitation_text text not null default '',
  rsvp_note text not null default '',
  theme_key text not null default 'wine-rose',
  layout_key text not null default 'elegant' check (layout_key in ('elegant','modern','kids')),
  hero_image_url text,
  gift_enabled boolean not null default true,
  rsvp_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  name text not null,
  description text not null default '',
  price_hint text not null default '',
  suggestion_url text,
  manual_image_url text,
  sort_order integer not null default 1,
  reserved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  contact_name text not null,
  whatsapp text not null default '',
  attendees jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.gift_reservations (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null unique references public.gifts(id) on delete cascade,
  guest_name text not null,
  guest_contact text not null default '',
  reserved_at timestamptz not null default now()
);

create index if not exists invitations_owner_idx on public.invitations(owner_id);
create index if not exists gifts_invitation_idx on public.gifts(invitation_id);
create index if not exists rsvps_invitation_idx on public.rsvps(invitation_id);

alter table public.invitations enable row level security;
alter table public.gifts enable row level security;
alter table public.rsvps enable row level security;
alter table public.gift_reservations enable row level security;

create policy "invitations owner or public"
on public.invitations for select
using (owner_id = auth.uid() or status = 'published');

create policy "invitations owner insert"
on public.invitations for insert
to authenticated
with check (owner_id = auth.uid());

create policy "invitations owner update"
on public.invitations for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "invitations owner delete"
on public.invitations for delete
to authenticated
using (owner_id = auth.uid());

create policy "gifts public for published invitation"
on public.gifts for select
using (
  exists (
    select 1 from public.invitations i
    where i.id = gifts.invitation_id
      and (i.status = 'published' or i.owner_id = auth.uid())
  )
);

create policy "gifts owner insert"
on public.gifts for insert
to authenticated
with check (
  exists (select 1 from public.invitations i where i.id = gifts.invitation_id and i.owner_id = auth.uid())
);

create policy "gifts owner update"
on public.gifts for update
to authenticated
using (
  exists (select 1 from public.invitations i where i.id = gifts.invitation_id and i.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.invitations i where i.id = gifts.invitation_id and i.owner_id = auth.uid())
);

create policy "gifts owner delete"
on public.gifts for delete
to authenticated
using (
  exists (select 1 from public.invitations i where i.id = gifts.invitation_id and i.owner_id = auth.uid())
);

create policy "rsvps owner read"
on public.rsvps for select
to authenticated
using (
  exists (select 1 from public.invitations i where i.id = rsvps.invitation_id and i.owner_id = auth.uid())
);

create policy "rsvps public insert"
on public.rsvps for insert
to anon, authenticated
with check (
  jsonb_array_length(attendees) between 1 and 20
  and char_length(contact_name) between 2 and 100
  and exists (
    select 1 from public.invitations i
    where i.id = rsvps.invitation_id and i.status = 'published' and i.rsvp_enabled = true
  )
);

create policy "rsvps owner delete"
on public.rsvps for delete
to authenticated
using (
  exists (select 1 from public.invitations i where i.id = rsvps.invitation_id and i.owner_id = auth.uid())
);

create policy "gift reservations owner read"
on public.gift_reservations for select
to authenticated
using (
  exists (
    select 1
    from public.gifts g
    join public.invitations i on i.id = g.invitation_id
    where g.id = gift_reservations.gift_id and i.owner_id = auth.uid()
  )
);

create policy "gift reservations owner delete"
on public.gift_reservations for delete
to authenticated
using (
  exists (
    select 1
    from public.gifts g
    join public.invitations i on i.id = g.invitation_id
    where g.id = gift_reservations.gift_id and i.owner_id = auth.uid()
  )
);

create or replace function public.reserve_gift_public(
  p_gift_id uuid,
  p_guest_name text,
  p_guest_contact text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift public.gifts%rowtype;
  v_invite public.invitations%rowtype;
begin
  if char_length(trim(p_guest_name)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Informe seu nome.');
  end if;

  select * into v_gift from public.gifts where id = p_gift_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Presente não encontrado.');
  end if;

  select * into v_invite from public.invitations where id = v_gift.invitation_id;
  if not found or v_invite.status <> 'published' or v_invite.gift_enabled = false then
    return jsonb_build_object('ok', false, 'error', 'Lista indisponível.');
  end if;

  if v_gift.reserved then
    return jsonb_build_object('ok', false, 'error', 'Este presente já foi escolhido.');
  end if;

  update public.gifts set reserved = true where id = p_gift_id;
  insert into public.gift_reservations(gift_id, guest_name, guest_contact)
  values (p_gift_id, trim(p_guest_name), left(trim(coalesce(p_guest_contact, '')), 120));

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    update public.gifts set reserved = true where id = p_gift_id;
    return jsonb_build_object('ok', false, 'error', 'Este presente já foi escolhido.');
end;
$$;

grant execute on function public.reserve_gift_public(uuid, text, text) to anon, authenticated;

create or replace function public.release_gift_owner(p_gift_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select i.owner_id into v_owner
  from public.gifts g
  join public.invitations i on i.id = g.invitation_id
  where g.id = p_gift_id;

  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Não autorizado.');
  end if;

  delete from public.gift_reservations where gift_id = p_gift_id;
  update public.gifts set reserved = false where id = p_gift_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.release_gift_owner(uuid) to authenticated;

-- Atualiza updated_at automaticamente.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invitations_touch_updated_at on public.invitations;
create trigger invitations_touch_updated_at
before update on public.invitations
for each row execute function public.touch_updated_at();

-- Bucket público para fotos dos convites.
insert into storage.buckets (id, name, public)
values ('invite-media', 'invite-media', true)
on conflict (id) do update set public = true;

create policy "invite media authenticated insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'invite-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "invite media owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'invite-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'invite-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "invite media owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'invite-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
