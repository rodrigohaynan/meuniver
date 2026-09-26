-- CONVIDATA — Migração 015
-- Permite que o proprietário do convite adicione confirmações/convidados manualmente
-- sem abrir permissão de inserção em convites de terceiros.

create or replace function public.normalize_rsvp_record()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_name text;
  v_digits text;
  v_is_owner boolean := false;
begin
  if tg_op = 'INSERT' then
    if not public.is_valid_rsvp_person_name(new.contact_name) then
      raise exception 'Digite somente o nome de uma pessoa, usando apenas letras e espaços. Ex.: Maria da Silva. Não use números, vírgulas, símbolos ou quantidades como 3 adultos.';
    end if;

    for v_item in select value from jsonb_array_elements(coalesce(new.attendees, '[]'::jsonb))
    loop
      v_name := coalesce(v_item->>'name', '');
      if not public.is_valid_rsvp_person_name(v_name) then
        raise exception 'Digite um nome por campo, usando apenas letras e espaços. Para outra pessoa, use Adicionar pessoa. Não use números, vírgulas, símbolos ou quantidades.';
      end if;
    end loop;

    select exists (
      select 1
      from public.invitations i
      where i.id = new.invitation_id
        and i.owner_id = auth.uid()
    ) into v_is_owner;

    v_digits := regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g');
    if length(v_digits) = 13 and left(v_digits, 2) = '55' then
      v_digits := substr(v_digits, 3);
    end if;

    -- Convidados que confirmam pelo convite continuam obrigados a informar WhatsApp.
    -- O organizador pode fazer um lançamento manual sem telefone; telefone parcial/inválido não é aceito.
    if length(v_digits) <> 11 and not (v_is_owner and length(v_digits) = 0) then
      raise exception 'Informe o WhatsApp no formato (XX) XXXXX-XXXX ou deixe em branco no lançamento manual do organizador.';
    end if;
  end if;

  new.contact_name := public.format_person_name_ptbr(new.contact_name);
  new.whatsapp := public.format_whatsapp_br(new.whatsapp);
  new.whatsapp_e164 := public.whatsapp_e164_br(new.whatsapp);

  if jsonb_typeof(new.attendees) = 'array' then
    select coalesce(
      jsonb_agg(
        jsonb_set(
          item,
          '{name}',
          to_jsonb(public.format_person_name_ptbr(item->>'name')),
          true
        )
        order by ord
      ),
      '[]'::jsonb
    )
    into new.attendees
    from jsonb_array_elements(new.attendees) with ordinality as attendee(item, ord);
  end if;

  return new;
end;
$$;

create or replace function public.add_rsvp_owner(
  p_invitation_id uuid,
  p_contact_name text,
  p_whatsapp text,
  p_attendees jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_contact text := trim(regexp_replace(coalesce(p_contact_name, ''), '[[:space:]]+', ' ', 'g'));
  v_phone text := trim(coalesce(p_whatsapp, ''));
  v_phone_key text;
  v_contact_key text;
  v_existing_id uuid;
  v_existing_attendees jsonb := '[]'::jsonb;
  v_filtered jsonb := '[]'::jsonb;
  v_seen jsonb := '{}'::jsonb;
  v_item jsonb;
  v_name text;
  v_name_key text;
  v_category text;
  v_age_text text;
  v_age integer;
  v_added integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Sessão expirada.');
  end if;

  if not exists (
    select 1
    from public.invitations i
    where i.id = p_invitation_id
      and i.owner_id = v_user_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Você não tem permissão para adicionar convidados neste convite.');
  end if;

  if not public.is_valid_rsvp_person_name(v_contact) then
    return jsonb_build_object('ok', false, 'error', 'Informe um nome válido para o responsável ou para o primeiro convidado.');
  end if;

  if v_phone <> '' and public.whatsapp_e164_br(v_phone) = '' then
    return jsonb_build_object('ok', false, 'error', 'Informe um WhatsApp válido ou deixe o campo em branco.');
  end if;

  if jsonb_typeof(p_attendees) <> 'array'
     or jsonb_array_length(p_attendees) < 1
     or jsonb_array_length(p_attendees) > 20 then
    return jsonb_build_object('ok', false, 'error', 'Adicione de 1 a 20 pessoas por lançamento.');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_invitation_id::text));

  v_contact_key := public.normalize_attendee_name(v_contact);
  v_phone_key := public.whatsapp_e164_br(v_phone);

  select r.id, r.attendees
    into v_existing_id, v_existing_attendees
  from public.rsvps r
  where r.invitation_id = p_invitation_id
    and public.normalize_attendee_name(r.contact_name) = v_contact_key
    and coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_phone_key
  order by r.created_at asc, r.id asc
  limit 1;

  if v_existing_id is not null then
    select coalesce(
      jsonb_object_agg(public.normalize_attendee_name(a.value->>'name'), true),
      '{}'::jsonb
    )
    into v_seen
    from jsonb_array_elements(v_existing_attendees) as a(value);
  end if;

  for v_item in select value from jsonb_array_elements(p_attendees)
  loop
    v_name := trim(regexp_replace(coalesce(v_item->>'name', ''), '[[:space:]]+', ' ', 'g'));
    v_category := coalesce(v_item->>'category', '');
    v_age_text := trim(coalesce(v_item->>'age', ''));
    v_age := null;

    if not public.is_valid_rsvp_person_name(v_name)
       or v_category not in ('adult', 'child') then
      return jsonb_build_object('ok', false, 'error', 'Revise os nomes e marque cada pessoa como adulto ou criança.');
    end if;

    if v_category = 'child' then
      if v_age_text !~ '^[0-9]{1,2}$' then
        return jsonb_build_object('ok', false, 'error', 'Informe a idade de cada criança.');
      end if;
      v_age := v_age_text::integer;
      if v_age < 0 or v_age > 17 then
        return jsonb_build_object('ok', false, 'error', 'A idade da criança deve ficar entre 0 e 17 anos.');
      end if;
    end if;

    v_name_key := public.normalize_attendee_name(v_name);
    if not (v_seen ? v_name_key) then
      if v_category = 'child' then
        v_filtered := v_filtered || jsonb_build_array(
          jsonb_build_object('name', v_name, 'category', 'child', 'age', v_age)
        );
      else
        v_filtered := v_filtered || jsonb_build_array(
          jsonb_build_object('name', v_name, 'category', 'adult')
        );
      end if;
      v_seen := v_seen || jsonb_build_object(v_name_key, true);
      v_added := v_added + 1;
    end if;
  end loop;

  if v_added = 0 then
    return jsonb_build_object(
      'ok', true,
      'code', 'no-new-attendees',
      'rsvpId', coalesce(v_existing_id::text, ''),
      'addedCount', 0,
      'message', 'As pessoas informadas já constam neste grupo.'
    );
  end if;

  if v_existing_id is not null then
    update public.rsvps
    set
      contact_name = v_contact,
      whatsapp = v_phone,
      whatsapp_reminders_enabled = (v_phone_key <> ''),
      attendees = v_existing_attendees || v_filtered
    where id = v_existing_id;

    return jsonb_build_object(
      'ok', true,
      'rsvpId', v_existing_id::text,
      'addedCount', v_added
    );
  end if;

  insert into public.rsvps (
    invitation_id,
    contact_name,
    whatsapp,
    whatsapp_reminders_enabled,
    attendees
  )
  values (
    p_invitation_id,
    v_contact,
    v_phone,
    (v_phone_key <> ''),
    v_filtered
  )
  returning id into v_existing_id;

  return jsonb_build_object(
    'ok', true,
    'rsvpId', v_existing_id::text,
    'addedCount', v_added
  );
end;
$$;

revoke all on function public.add_rsvp_owner(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.add_rsvp_owner(uuid,text,text,jsonb) to authenticated;
