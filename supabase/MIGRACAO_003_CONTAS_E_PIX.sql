-- CONVNIVER — Migração 003
-- Cadastro ampliado + recusas de presença + presentes em PIX via marketplace Mercado Pago.
-- Execute uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

-- =========================================================
-- 1) PERFIL DO USUÁRIO
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  sex text not null default '' check (sex in ('', 'female', 'male', 'other', 'prefer_not_to_say')),
  birth_date date,
  state text not null default '',
  city text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    sex,
    birth_date,
    state,
    city,
    whatsapp,
    email
  ) values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
    case
      when coalesce(new.raw_user_meta_data ->> 'sex', '') in ('female','male','other','prefer_not_to_say')
        then new.raw_user_meta_data ->> 'sex'
      else ''
    end,
    case
      when coalesce(new.raw_user_meta_data ->> 'birth_date', '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
        then (new.raw_user_meta_data ->> 'birth_date')::date
      else null
    end,
    upper(left(trim(coalesce(new.raw_user_meta_data ->> 'state', '')), 2)),
    trim(coalesce(new.raw_user_meta_data ->> 'city', '')),
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'whatsapp', ''), '[^0-9]', '', 'g'),
    coalesce(new.email, '')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    sex = excluded.sex,
    birth_date = excluded.birth_date,
    state = excluded.state,
    city = excluded.city,
    whatsapp = excluded.whatsapp,
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Cria perfil básico para contas antigas que ainda não o tenham.
insert into public.profiles (id, full_name, email)
select
  u.id,
  trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')),
  coalesce(u.email, '')
from auth.users u
on conflict (id) do nothing;

-- =========================================================
-- 2) PRESENTES EM PIX NO CONVITE
-- =========================================================
alter table public.invitations
add column if not exists pix_gift_enabled boolean not null default true;

-- Conta Mercado Pago conectada pelo ORGANIZADOR via OAuth.
-- Nunca expor access_token / refresh_token ao navegador.
create table if not exists public.marketplace_seller_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  mercado_pago_user_id text not null,
  access_token text not null,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_seller_accounts enable row level security;
-- Sem políticas para clientes: acesso somente pelo backend com service role.

create table if not exists public.cash_gifts (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  guest_whatsapp text not null default '',
  amount numeric(12,2) not null check (amount >= 5 and amount <= 10000),
  platform_fee numeric(12,2) not null check (platform_fee >= 0),
  payment_id text,
  payment_status text not null default 'creating',
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cash_gifts_invitation_idx on public.cash_gifts(invitation_id);
create index if not exists cash_gifts_owner_idx on public.cash_gifts(owner_id);
create index if not exists cash_gifts_payment_idx on public.cash_gifts(payment_id);

alter table public.cash_gifts enable row level security;

drop policy if exists "cash gifts owner read" on public.cash_gifts;
create policy "cash gifts owner read"
on public.cash_gifts for select
to authenticated
using (owner_id = auth.uid());

-- =========================================================
-- 3) CONVIDADO QUE NÃO PODERÁ COMPARECER
-- =========================================================
create table if not exists public.rsvp_declines (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  contact_name text not null,
  whatsapp text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists rsvp_declines_invitation_idx on public.rsvp_declines(invitation_id);
alter table public.rsvp_declines enable row level security;

drop policy if exists "rsvp declines owner read" on public.rsvp_declines;
create policy "rsvp declines owner read"
on public.rsvp_declines for select
to authenticated
using (
  exists (
    select 1
    from public.invitations i
    where i.id = rsvp_declines.invitation_id
      and i.owner_id = auth.uid()
  )
);

drop policy if exists "rsvp declines owner delete" on public.rsvp_declines;
create policy "rsvp declines owner delete"
on public.rsvp_declines for delete
to authenticated
using (
  exists (
    select 1
    from public.invitations i
    where i.id = rsvp_declines.invitation_id
      and i.owner_id = auth.uid()
  )
);

create or replace function public.decline_rsvp_public(
  p_invitation_id uuid,
  p_contact_name text,
  p_whatsapp text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(trim(coalesce(p_contact_name, ''))) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Informe seu nome.');
  end if;

  if not exists (
    select 1 from public.invitations i
    where i.id = p_invitation_id
      and i.status = 'published'
      and i.rsvp_enabled = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'Este convite não aceita respostas no momento.');
  end if;

  insert into public.rsvp_declines (invitation_id, contact_name, whatsapp)
  values (
    p_invitation_id,
    left(trim(p_contact_name), 120),
    left(trim(coalesce(p_whatsapp, '')), 40)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.decline_rsvp_public(uuid, text, text) to anon, authenticated;

-- Retorna apenas se o recurso PIX está disponível para este convite.
-- Nenhum token ou dado financeiro do organizador é exposto.
create or replace function public.pix_gift_status_public(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_enabled boolean;
begin
  select i.owner_id, i.pix_gift_enabled
  into v_owner_id, v_enabled
  from public.invitations i
  where i.id = p_invitation_id
    and i.status = 'published';

  if v_owner_id is null then
    return jsonb_build_object('available', false);
  end if;

  return jsonb_build_object(
    'available',
    v_enabled = true
    and exists (
      select 1
      from public.marketplace_seller_accounts a
      where a.owner_id = v_owner_id
        and char_length(a.access_token) > 10
    ),
    'platform_fee_percent', 5
  );
end;
$$;

grant execute on function public.pix_gift_status_public(uuid) to anon, authenticated;

-- =========================================================
-- 4) updated_at
-- =========================================================
create or replace function public.touch_generic_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_generic_updated_at();

drop trigger if exists marketplace_accounts_touch_updated_at on public.marketplace_seller_accounts;
create trigger marketplace_accounts_touch_updated_at
before update on public.marketplace_seller_accounts
for each row execute function public.touch_generic_updated_at();

drop trigger if exists cash_gifts_touch_updated_at on public.cash_gifts;
create trigger cash_gifts_touch_updated_at
before update on public.cash_gifts
for each row execute function public.touch_generic_updated_at();
