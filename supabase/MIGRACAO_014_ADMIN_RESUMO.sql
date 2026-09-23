-- Fixed-size aggregate response: the administrative home never downloads entire tables.
create or replace function public.admin_home_stats()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'invitations', (select count(*) from public.invitations),
    'published', (select count(*) from public.invitations where status = 'published'),
    'pending_billing', (select count(*) from public.invitations where billing_status = 'pending'),
    'rsvp_submissions', (select count(*) from public.rsvps),
    'guest_count', (select coalesce(sum(jsonb_array_length(attendees)),0) from public.rsvps),
    'declines', (select count(*) from public.rsvp_declines),
    'reservations', (select count(*) from public.gift_reservations),
    'pending_reminders', (select count(*) from public.whatsapp_reminders where status = 'pending'),
    'reminder_rows', (select count(*) from public.whatsapp_reminders),
    'approved_cash', (select coalesce(sum(amount),0) from public.cash_gifts where payment_status = 'approved'),
    'approved_fees', (select coalesce(sum(platform_fee),0) from public.cash_gifts where payment_status = 'approved')
  );
$$;
revoke all on function public.admin_home_stats() from public, anon, authenticated;
grant execute on function public.admin_home_stats() to service_role;
create index if not exists admin_cash_gifts_approved_idx on public.cash_gifts (payment_status) where payment_status = 'approved';
