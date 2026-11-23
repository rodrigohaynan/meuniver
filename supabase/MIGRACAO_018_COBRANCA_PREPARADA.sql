-- Convidata — Migração 018
-- Prepara a cobrança futura, mantendo tudo GRATUITO por enquanto:
--   • presentes em PIX: taxa da plataforma (futuro: 2%) SOMADA ao valor pago pelo convidado;
--   • publicação do convite (futuro: R$ 4,99) paga pelo organizador via PIX direto para a Convidata.
-- Para ligar no futuro, basta ajustar em /admin/financeiro:
--   taxa dos presentes = 2  •  cobrar por novos convites = ativo (preço já em R$ 4,99).

-- 1) Configurações -----------------------------------------------------------
alter table public.site_settings
  add column if not exists pix_fee_paid_by text not null default 'guest';

alter table public.site_settings drop constraint if exists site_settings_pix_fee_paid_by_check;
alter table public.site_settings add constraint site_settings_pix_fee_paid_by_check
  check (pix_fee_paid_by in ('guest', 'organizer'));

alter table public.site_settings alter column pix_platform_fee_percent set default 0;

update public.site_settings
set pix_platform_fee_percent = 0,
    pix_fee_paid_by = 'guest',
    invitation_charging_enabled = false,
    invitation_price = 4.99,
    updated_at = now()
where id = true;

-- 2) Presentes em PIX: registra quanto o convidado pagou e quem arcou com a taxa ---
alter table public.cash_gifts
  add column if not exists charged_amount numeric(12,2),
  add column if not exists fee_paid_by text not null default 'organizer';

update public.cash_gifts set charged_amount = amount where charged_amount is null;

alter table public.cash_gifts drop constraint if exists cash_gifts_fee_paid_by_check;
alter table public.cash_gifts add constraint cash_gifts_fee_paid_by_check
  check (fee_paid_by in ('guest', 'organizer'));
alter table public.cash_gifts drop constraint if exists cash_gifts_charged_amount_check;
alter table public.cash_gifts add constraint cash_gifts_charged_amount_check
  check (charged_amount is null or charged_amount >= amount);

-- 3) Pagamentos de publicação (organizador → Convidata) ------------------------
create table if not exists public.invitation_billing_payments (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_id text,
  payment_status text not null default 'creating',
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invitation_billing_payments_invitation_idx
  on public.invitation_billing_payments(invitation_id, created_at desc);
create index if not exists invitation_billing_payments_owner_idx
  on public.invitation_billing_payments(owner_id);
create unique index if not exists invitation_billing_payments_payment_idx
  on public.invitation_billing_payments(payment_id) where payment_id is not null;

alter table public.invitation_billing_payments enable row level security;

-- O organizador só consulta os próprios pagamentos; gravações apenas pelo servidor (service role).
drop policy if exists "billing payments owner read" on public.invitation_billing_payments;
create policy "billing payments owner read"
on public.invitation_billing_payments for select
to authenticated
using (owner_id = auth.uid());

drop trigger if exists invitation_billing_payments_touch_updated_at on public.invitation_billing_payments;
create trigger invitation_billing_payments_touch_updated_at
before update on public.invitation_billing_payments
for each row execute function public.touch_generic_updated_at();
