-- Meu Convite — migração 002
-- Execute uma vez no SQL Editor do Supabase se você já executou o schema inicial.

alter table public.invitations
  add column if not exists hero_image_zoom numeric not null default 1,
  add column if not exists hero_image_x integer not null default 50,
  add column if not exists hero_image_y integer not null default 50;

alter table public.gifts
  add column if not exists suggestion_image_url text;

-- Normaliza valores já existentes.
update public.invitations
set hero_image_zoom = greatest(1, least(2.5, coalesce(hero_image_zoom, 1))),
    hero_image_x = greatest(0, least(100, coalesce(hero_image_x, 50))),
    hero_image_y = greatest(0, least(100, coalesce(hero_image_y, 50)));
