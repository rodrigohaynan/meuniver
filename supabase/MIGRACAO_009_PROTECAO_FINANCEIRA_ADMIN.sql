-- CONVNIVER — Migração 009
-- Impede que usuários comuns alterem diretamente a situação financeira dos convites.

create or replace function public.protect_invitation_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not exists (
       select 1 from public.site_admins a where a.user_id = auth.uid()
     ) then
    if new.billing_status is distinct from old.billing_status
       or new.billing_amount is distinct from old.billing_amount
       or new.billing_paid_at is distinct from old.billing_paid_at
       or new.billing_note is distinct from old.billing_note then
      raise exception 'Os dados financeiros deste convite só podem ser alterados pela administração.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists invitations_protect_billing_fields on public.invitations;
create trigger invitations_protect_billing_fields
before update on public.invitations
for each row execute function public.protect_invitation_billing_fields();
