-- CONVNIVER — Migração 010
-- Evita números, símbolos e descrições genéricas no lugar do nome dos convidados.

create or replace function public.is_valid_rsvp_person_name(p_value text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_clean text := trim(regexp_replace(coalesce(p_value, ''), '[[:space:]]+', ' ', 'g'));
  v_normalized text;
begin
  if char_length(v_clean) < 2 or char_length(v_clean) > 100 then
    return false;
  end if;

  v_normalized := public.normalize_attendee_name(v_clean);

  -- Depois da normalização dos acentos, nomes do RSVP aceitam somente letras e espaços.
  if v_normalized !~ '^[a-z]+( [a-z]+)*$' then
    return false;
  end if;

  -- Impede descrições/quantidades usadas no lugar do nome da pessoa.
  if v_normalized in (
    'adulto', 'adulta', 'adultos', 'adultas',
    'crianca', 'criancas',
    'menino', 'menina', 'meninos', 'meninas'
  ) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.normalize_rsvp_record()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_name text;
  v_digits text;
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

    v_digits := regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g');
    if length(v_digits) = 13 and left(v_digits, 2) = '55' then
      v_digits := substr(v_digits, 3);
    end if;

    if length(v_digits) <> 11 then
      raise exception 'Informe o WhatsApp no formato (XX) XXXXX-XXXX.';
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
