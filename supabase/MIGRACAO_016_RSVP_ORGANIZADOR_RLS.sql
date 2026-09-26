-- CONVIDATA — Migração 016
-- Faz a inclusão manual de convidados obedecer diretamente ao RLS do banco.

drop policy if exists "rsvps owner insert" on public.rsvps;
create policy "rsvps owner insert"
on public.rsvps for insert
to authenticated
with check (
  jsonb_array_length(attendees) between 1 and 20
  and char_length(contact_name) between 2 and 100
  and exists (
    select 1
    from public.invitations i
    where i.id = rsvps.invitation_id
      and i.owner_id = auth.uid()
  )
);

alter function public.add_rsvp_owner(uuid,text,text,jsonb) security invoker;

revoke all on function public.add_rsvp_owner(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.add_rsvp_owner(uuid,text,text,jsonb) to authenticated;
