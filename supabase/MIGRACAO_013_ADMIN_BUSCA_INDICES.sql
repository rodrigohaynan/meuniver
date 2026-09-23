-- Indexes for scalable case-insensitive partial-name/title searches.
create extension if not exists pg_trgm with schema extensions;
create index if not exists admin_profiles_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);
create index if not exists admin_profiles_email_trgm_idx on public.profiles using gin (email extensions.gin_trgm_ops);
create index if not exists admin_invitations_title_trgm_idx on public.invitations using gin (event_title extensions.gin_trgm_ops);
create index if not exists admin_invitations_host_trgm_idx on public.invitations using gin (host_name extensions.gin_trgm_ops);
