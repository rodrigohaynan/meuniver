-- CONVNIVER — Migração 009
-- 1) Quando o mesmo responsável (mesmo nome + WhatsApp) envia nova confirmação,
--    pessoas já confirmadas por ele são ignoradas e somente novos convidados são inseridos.
-- 2) Toda criança nova precisa ter idade informada (0 a 17 anos).

create or replace function public.submit_rsvp_public(
  p_invitation_id uuid,
  p_contact_name text,
  p_whatsapp text,
  p_attendees jsonb,
  p_allow_duplicate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invitations%rowtype;
  v_attendee jsonb;
  v_name text;
  v_category text;
  v_age integer;
  v_age_text text;
  v_key text;
  v_first text;
  v_existing_count integer := 0;
  v_use_first_name_warning boolean := false;
  v_duplicates jsonb := '[]'::jsonb;
  v_seen_exact jsonb := '{}'::jsonb;
  v_seen_first jsonb := '{}'::jsonb;
  v_existing_same_names jsonb := '{}'::jsonb;
  v_filtered_attendees jsonb := '[]'::jsonb;
  v_contact_key text;
  v_phone_e164 text;
  v_existing_rsvp_id uuid;
  v_existing_name text;
  v_existing_contact text;
  v_repeated_name text;
  v_new_id uuid;
begin
  if p_invitation_id is null then
    return jsonb_build_object('ok', false, 'error', 'Convite inválido.');
  end if;

  if char_length(trim(coalesce(p_contact_name, ''))) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Informe o nome de quem está fazendo a confirmação.');
  end if;

  v_phone_e164 := public.whatsapp_e164_br(p_whatsapp);
  if v_phone_e164 = '' then
    return jsonb_build_object('ok', false, 'error', 'Informe o WhatsApp no formato (XX) XXXXX-XXXX.');
  end if;

  if jsonb_typeof(p_attendees) <> 'array'
     or jsonb_array_length(p_attendees) < 1
     or jsonb_array_length(p_attendees) > 12 then
    return jsonb_build_object('ok', false, 'error', 'Revise a lista de pessoas confirmadas.');
  end if;

  select * into v_invite
  from public.invitations
  where id = p_invitation_id;

  if not found or v_invite.status <> 'published' or v_invite.rsvp_enabled = false then
    return jsonb_build_object('ok', false, 'error', 'A confirmação de presença não está disponível.');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_invitation_id::text));

  v_contact_key := public.normalize_attendee_name(p_contact_name);

  select coalesce(
    jsonb_object_agg(public.normalize_attendee_name(a.value->>'name'), true),
    '{}'::jsonb
  )
  into v_existing_same_names
  from public.rsvps r
  cross join lateral jsonb_array_elements(r.attendees) as a(value)
  where r.invitation_id = p_invitation_id
    and public.normalize_attendee_name(r.contact_name) = v_contact_key
    and coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_phone_e164;

  for v_attendee in select value from jsonb_array_elements(p_attendees)
  loop
    v_name := trim(regexp_replace(coalesce(v_attendee->>'name', ''), '[[:space:]]+', ' ', 'g'));
    v_category := coalesce(v_attendee->>'category', '');
    v_age_text := trim(coalesce(v_attendee->>'age', ''));
    v_age := null;

    if char_length(v_name) < 2
       or char_length(v_name) > 80
       or v_category not in ('adult', 'child') then
      return jsonb_build_object(
        'ok', false,
        'error', 'Revise os nomes e marque cada pessoa como adulto ou criança.'
      );
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

    v_key := public.normalize_attendee_name(v_name);

    if v_existing_same_names ? v_key then
      continue;
    end if;

    if v_category = 'child' then
      v_filtered_attendees := v_filtered_attendees || jsonb_build_array(
        jsonb_build_object('name', v_name, 'category', 'child', 'age', v_age)
      );
    else
      v_filtered_attendees := v_filtered_attendees || jsonb_build_array(
        jsonb_build_object('name', v_name, 'category', 'adult')
      );
    end if;
  end loop;

  if jsonb_array_length(v_filtered_attendees) = 0 then
    return jsonb_build_object(
      'ok', true,
      'code', 'no-new-attendees',
      'addedCount', 0,
      'message', 'As pessoas informadas já estavam confirmadas por este responsável.'
    );
  end if;

  select coalesce(sum(jsonb_array_length(r.attendees)), 0)::integer
    into v_existing_count
  from public.rsvps r
  where r.invitation_id = p_invitation_id;

  v_use_first_name_warning := v_existing_count < 100;

  if p_allow_duplicate is not true then
    for v_attendee in select value from jsonb_array_elements(v_filtered_attendees)
    loop
      v_name := trim(regexp_replace(coalesce(v_attendee->>'name', ''), '[[:space:]]+', ' ', 'g'));
      v_key := public.normalize_attendee_name(v_name);
      v_first := split_part(v_key, ' ', 1);

      v_existing_rsvp_id := null;
      v_existing_name := null;
      v_existing_contact := null;

      select r.id, a.value->>'name', r.contact_name
        into v_existing_rsvp_id, v_existing_name, v_existing_contact
      from public.rsvps r
      cross join lateral jsonb_array_elements(r.attendees) as a(value)
      where r.invitation_id = p_invitation_id
        and public.normalize_attendee_name(a.value->>'name') = v_key
        and not (
          public.normalize_attendee_name(r.contact_name) = v_contact_key
          and coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_phone_e164
        )
      order by r.created_at asc
      limit 1;

      if v_existing_rsvp_id is not null then
        v_duplicates := v_duplicates || jsonb_build_array(
          jsonb_build_object(
            'submittedName', v_name,
            'existingName', v_existing_name,
            'contactName', v_existing_contact,
            'rsvpId', v_existing_rsvp_id::text,
            'matchType', 'exact'
          )
        );
        continue;
      end if;

      if v_seen_exact ? v_key then
        v_repeated_name := v_seen_exact->>v_key;
        v_duplicates := v_duplicates || jsonb_build_array(
          jsonb_build_object(
            'submittedName', v_name,
            'existingName', v_repeated_name,
            'contactName', 'esta mesma confirmação',
            'rsvpId', 'current',
            'matchType', 'exact'
          )
        );
        continue;
      end if;

      if v_use_first_name_warning and v_first <> '' then
        v_existing_rsvp_id := null;
        v_existing_name := null;
        v_existing_contact := null;

        select r.id, a.value->>'name', r.contact_name
          into v_existing_rsvp_id, v_existing_name, v_existing_contact
        from public.rsvps r
        cross join lateral jsonb_array_elements(r.attendees) as a(value)
        where r.invitation_id = p_invitation_id
          and split_part(public.normalize_attendee_name(a.value->>'name'), ' ', 1) = v_first
          and not (
            public.normalize_attendee_name(r.contact_name) = v_contact_key
            and coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_phone_e164
          )
        order by r.created_at asc
        limit 1;

        if v_existing_rsvp_id is not null then
          v_duplicates := v_duplicates || jsonb_build_array(
            jsonb_build_object(
              'submittedName', v_name,
              'existingName', v_existing_name,
              'contactName', v_existing_contact,
              'rsvpId', v_existing_rsvp_id::text,
              'matchType', 'first-name'
            )
          );

          v_seen_exact := v_seen_exact || jsonb_build_object(v_key, v_name);
          if not (v_seen_first ? v_first) then
            v_seen_first := v_seen_first || jsonb_build_object(v_first, v_name);
          end if;
          continue;
        end if;

        if v_seen_first ? v_first then
          v_repeated_name := v_seen_first->>v_first;
          v_duplicates := v_duplicates || jsonb_build_array(
            jsonb_build_object(
              'submittedName', v_name,
              'existingName', v_repeated_name,
              'contactName', 'esta mesma confirmação',
              'rsvpId', 'current',
              'matchType', 'first-name'
            )
          );
        end if;
      end if;

      v_seen_exact := v_seen_exact || jsonb_build_object(v_key, v_name);
      if v_first <> '' and not (v_seen_first ? v_first) then
        v_seen_first := v_seen_first || jsonb_build_object(v_first, v_name);
      end if;
    end loop;

    if jsonb_array_length(v_duplicates) > 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'duplicate-name',
        'error', 'Já existe pessoa com nome igual ou semelhante na lista de presença.',
        'duplicates', v_duplicates
      );
    end if;
  end if;

  insert into public.rsvps(invitation_id, contact_name, whatsapp, attendees)
  values (
    p_invitation_id,
    left(trim(p_contact_name), 100),
    left(trim(coalesce(p_whatsapp, '')), 30),
    v_filtered_attendees
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'rsvpId', v_new_id::text,
    'addedCount', jsonb_array_length(v_filtered_attendees)
  );
end;
$$;
