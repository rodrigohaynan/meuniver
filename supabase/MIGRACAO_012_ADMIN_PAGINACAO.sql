-- Consultation-only aggregate for the owner dashboard.
-- Executable exclusively through the server-side service_role client.
create or replace function public.admin_invitation_counts(p_owner_ids uuid[])
returns table(owner_id uuid, invitations_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select i.owner_id, count(*)::bigint
  from public.invitations i
  where i.owner_id = any(p_owner_ids)
  group by i.owner_id;
$$;
revoke all on function public.admin_invitation_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_invitation_counts(uuid[]) to service_role;

create index if not exists admin_profiles_created_idx
  on public.profiles (created_at desc, id desc);
create index if not exists admin_invitations_owner_created_idx
  on public.invitations (owner_id, created_at desc, id desc);
create index if not exists admin_invitations_status_created_idx
  on public.invitations (status, created_at desc, id desc);
create index if not exists admin_invitations_created_idx
  on public.invitations (created_at desc, id desc);
