-- CONVNIVER — Migração 008
-- Painel administrativo do proprietário do site.

create extension if not exists pgcrypto;

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;
drop policy if exists "site admins read own" on public.site_admins;
create policy "site admins read own" on public.site_admins
for select to authenticated using (user_id = auth.uid());

create table if not exists public.site_settings (
  id boolean primary key default true check (id = true),
  invitation_charging_enabled boolean not null default false,
  invitation_price numeric(12,2) not null default 0 check (invitation_price >= 0),
  free_invites_per_user integer not null default 0 check (free_invites_per_user >= 0),
  pix_platform_fee_percent numeric(5,2) not null default 5 check (pix_platform_fee_percent >= 0 and pix_platform_fee_percent <= 100),
  reminder_feature_enabled boolean not null default false,
  currency text not null default 'BRL',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.site_settings(id) values (true) on conflict (id) do nothing;
alter table public.site_settings enable row level security;
drop policy if exists "site settings authenticated read" on public.site_settings;
create policy "site settings authenticated read" on public.site_settings
for select to authenticated using (true);

alter table public.invitations
  add column if not exists billing_status text not null default 'free',
  add column if not exists billing_amount numeric(12,2) not null default 0,
  add column if not exists billing_paid_at timestamptz,
  add column if not exists billing_note text not null default '';

alter table public.invitations drop constraint if exists invitations_billing_status_check;
alter table public.invitations add constraint invitations_billing_status_check
check (billing_status in ('free','pending','paid','exempt','refunded'));
alter table public.invitations drop constraint if exists invitations_billing_amount_check;
alter table public.invitations add constraint invitations_billing_amount_check check (billing_amount >= 0);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
alter table public.admin_audit_log enable row level security;

create or replace function public.prepare_invitation_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := false;
  v_price numeric(12,2) := 0;
  v_free_limit integer := 0;
  v_existing integer := 0;
begin
  select invitation_charging_enabled, invitation_price, free_invites_per_user
    into v_enabled, v_price, v_free_limit
  from public.site_settings where id = true;

  if coalesce(v_enabled,false) and coalesce(v_price,0) > 0 then
    if coalesce(v_free_limit,0) > 0 then
      select count(*)::integer into v_existing
      from public.invitations where owner_id = new.owner_id;
    end if;

    if coalesce(v_free_limit,0) > 0 and v_existing < v_free_limit then
      new.billing_status := 'free';
      new.billing_amount := 0;
    else
      new.billing_status := 'pending';
      new.billing_amount := v_price;
    end if;
  else
    new.billing_status := 'free';
    new.billing_amount := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists invitations_prepare_billing on public.invitations;
create trigger invitations_prepare_billing
before insert on public.invitations
for each row execute function public.prepare_invitation_billing();

create or replace function public.enforce_invitation_billing_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := false;
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    select invitation_charging_enabled into v_enabled
    from public.site_settings where id = true;

    if coalesce(v_enabled,false) and new.billing_status = 'pending' then
      raise exception 'Este convite aguarda pagamento ou isenção antes de ser publicado.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists invitations_enforce_billing_publish on public.invitations;
create trigger invitations_enforce_billing_publish
before update of status on public.invitations
for each row execute function public.enforce_invitation_billing_on_publish();
