-- CONVNIVER — Migração 005
-- Miniatura social persistente para WhatsApp e outros crawlers.

alter table public.invitations
add column if not exists share_image_url text;

create extension if not exists pg_net;

create or replace function public.queue_social_preview_generation()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  if new.status = 'published'
     and new.hero_image_url is not null
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.hero_image_url is distinct from new.hero_image_url
     ) then
    perform net.http_post(
      url := 'https://uaakzwjscxxlabnxosdm.supabase.co/functions/v1/generate-social-preview',
      body := jsonb_build_object('invitationId', new.id),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  end if;

  return new;
end;
$$;

drop trigger if exists invitations_generate_social_preview on public.invitations;
create trigger invitations_generate_social_preview
after insert or update of status, hero_image_url on public.invitations
for each row
execute function public.queue_social_preview_generation();

comment on column public.invitations.share_image_url is
'URL pública do JPEG 1200x630 otimizado para previews sociais, especialmente WhatsApp.';
