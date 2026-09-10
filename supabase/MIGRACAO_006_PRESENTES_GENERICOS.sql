-- CONVNIVER — presentes genéricos x presentes específicos
-- Genérico (multiple): pode ser escolhido por várias pessoas e permanece disponível.
-- Específico (single): apenas uma escolha; depois fica indisponível.

alter table public.gifts
  add column if not exists reservation_mode text not null default 'single';

alter table public.gifts
  drop constraint if exists gifts_reservation_mode_check;

alter table public.gifts
  add constraint gifts_reservation_mode_check
  check (reservation_mode in ('single','multiple'));

alter table public.gift_reservations
  drop constraint if exists gift_reservations_gift_id_key;

create index if not exists gift_reservations_gift_id_idx
  on public.gift_reservations(gift_id);

create or replace function public.reserve_gift_public(
  p_gift_id uuid,
  p_guest_name text,
  p_guest_contact text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift public.gifts%rowtype;
  v_invite public.invitations%rowtype;
  v_count integer;
begin
  if char_length(trim(p_guest_name)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Informe seu nome.');
  end if;

  select * into v_gift
  from public.gifts
  where id = p_gift_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Presente não encontrado.');
  end if;

  select * into v_invite
  from public.invitations
  where id = v_gift.invitation_id;

  if not found or v_invite.status <> 'published' or v_invite.gift_enabled = false then
    return jsonb_build_object('ok', false, 'error', 'Lista indisponível.');
  end if;

  select count(*)::integer into v_count
  from public.gift_reservations
  where gift_id = p_gift_id;

  if v_gift.reservation_mode = 'single' and (v_gift.reserved or v_count > 0) then
    update public.gifts set reserved = true where id = p_gift_id;
    return jsonb_build_object('ok', false, 'error', 'Este presente já foi escolhido.');
  end if;

  insert into public.gift_reservations(gift_id, guest_name, guest_contact)
  values (
    p_gift_id,
    left(trim(p_guest_name), 120),
    left(trim(coalesce(p_guest_contact, '')), 120)
  );

  if v_gift.reservation_mode = 'single' then
    update public.gifts set reserved = true where id = p_gift_id;
  else
    update public.gifts set reserved = false where id = p_gift_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'reservation_mode', v_gift.reservation_mode,
    'reservation_count', v_count + 1
  );
end;
$$;

grant execute on function public.reserve_gift_public(uuid, text, text) to anon, authenticated;

create or replace function public.set_gift_reservation_mode_owner(
  p_gift_id uuid,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_count integer;
begin
  if p_mode not in ('single','multiple') then
    return jsonb_build_object('ok', false, 'error', 'Modo inválido.');
  end if;

  select i.owner_id into v_owner
  from public.gifts g
  join public.invitations i on i.id = g.invitation_id
  where g.id = p_gift_id;

  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Não autorizado.');
  end if;

  select count(*)::integer into v_count
  from public.gift_reservations
  where gift_id = p_gift_id;

  update public.gifts
  set reservation_mode = p_mode,
      reserved = case
        when p_mode = 'multiple' then false
        else v_count > 0
      end
  where id = p_gift_id;

  return jsonb_build_object(
    'ok', true,
    'reservation_mode', p_mode,
    'reservation_count', v_count,
    'reserved', case when p_mode = 'multiple' then false else v_count > 0 end
  );
end;
$$;

grant execute on function public.set_gift_reservation_mode_owner(uuid, text) to authenticated;
