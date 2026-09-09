-- CONVNIVER — Migração 004
-- Suporte a aniversários em anos e mêsversários de 1 a 12 meses.

alter table public.invitations
add column if not exists age_unit text not null default 'years';

alter table public.invitations
drop constraint if exists invitations_age_unit_check;

alter table public.invitations
add constraint invitations_age_unit_check
check (age_unit in ('years', 'months'));

alter table public.invitations
drop constraint if exists invitations_month_age_check;

alter table public.invitations
add constraint invitations_month_age_check
check (age_unit = 'years' or age between 1 and 12);

comment on column public.invitations.age_unit is
'Unidade da idade da comemoração: years para aniversário e months para mêsversário.';
