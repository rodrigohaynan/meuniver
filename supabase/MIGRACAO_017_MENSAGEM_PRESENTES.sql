-- CONVIDATA — Migração 017
-- Mensagem personalizável exibida abaixo de "Sugestões de presentes".

alter table public.invitations
  add column if not exists gift_intro_text text not null default 'A presença é o mais importante. Sugestões genéricas podem ser escolhidas por mais de uma pessoa; presentes específicos ficam indisponíveis depois da primeira escolha.';

alter table public.invitations
  drop constraint if exists invitations_gift_intro_text_length_check;

alter table public.invitations
  add constraint invitations_gift_intro_text_length_check
  check (char_length(gift_intro_text) between 1 and 600);

update public.invitations
set gift_intro_text = 'A presença é o mais importante. Sugestões genéricas podem ser escolhidas por mais de uma pessoa; presentes específicos ficam indisponíveis depois da primeira escolha.'
where nullif(trim(gift_intro_text), '') is null;
