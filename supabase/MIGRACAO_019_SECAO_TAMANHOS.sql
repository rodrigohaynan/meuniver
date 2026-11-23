-- Convidata — Migração 019
-- Permite ao organizador ocultar a seção "Tamanhos e preferências" do convite
-- sem apagar as informações, e personalizar o título exibido.

alter table public.invitations
  add column if not exists gift_profile_enabled boolean not null default true,
  add column if not exists gift_profile_title text;

alter table public.invitations drop constraint if exists invitations_gift_profile_title_length;
alter table public.invitations add constraint invitations_gift_profile_title_length
  check (gift_profile_title is null or char_length(gift_profile_title) <= 90);
