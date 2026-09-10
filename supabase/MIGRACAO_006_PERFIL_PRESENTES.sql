-- CONVNIVER - Perfil de tamanhos e preferências para presentes
-- Permite armazenar uma lista flexível de informações do aniversariante,
-- como calçado, roupas, fralda, aro/diâmetro do dedo, cores e observações.

alter table public.invitations
  add column if not exists gift_profile jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invitations_gift_profile_is_array'
  ) then
    alter table public.invitations
      add constraint invitations_gift_profile_is_array
      check (jsonb_typeof(gift_profile) = 'array');
  end if;
end $$;
