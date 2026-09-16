-- CONVNIVER — Migração 011
-- Agrupa confirmações do mesmo responsável (mesmo nome + WhatsApp)
-- em um único registro e anexa novos convidados à confirmação original.

DO $$
BEGIN
  IF to_regprocedure('public.submit_rsvp_public_base(uuid,text,text,jsonb,boolean)') IS NULL
     AND to_regprocedure('public.submit_rsvp_public(uuid,text,text,jsonb,boolean)') IS NOT NULL THEN
    ALTER FUNCTION public.submit_rsvp_public(uuid,text,text,jsonb,boolean)
      RENAME TO submit_rsvp_public_base;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.submit_rsvp_public(
  p_invitation_id uuid,
  p_contact_name text,
  p_whatsapp text,
  p_attendees jsonb,
  p_allow_duplicate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_contact_key text;
  v_phone_key text;
  v_keep_id uuid;
  v_merged_attendees jsonb;
BEGIN
  v_result := public.submit_rsvp_public_base(
    p_invitation_id,
    p_contact_name,
    p_whatsapp,
    p_attendees,
    p_allow_duplicate
  );

  IF coalesce((v_result->>'ok')::boolean, false) IS NOT TRUE
     OR coalesce((v_result->>'addedCount')::integer, 0) <= 0 THEN
    RETURN v_result;
  END IF;

  v_contact_key := public.normalize_attendee_name(p_contact_name);
  v_phone_key := public.whatsapp_e164_br(p_whatsapp);

  IF v_contact_key = '' OR v_phone_key = '' THEN
    RETURN v_result;
  END IF;

  SELECT r.id
    INTO v_keep_id
  FROM public.rsvps r
  WHERE r.invitation_id = p_invitation_id
    AND public.normalize_attendee_name(r.contact_name) = v_contact_key
    AND coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_phone_key
  ORDER BY r.created_at ASC, r.id ASC
  LIMIT 1;

  IF v_keep_id IS NULL THEN
    RETURN v_result;
  END IF;

  SELECT coalesce(
    jsonb_agg(x.item ORDER BY x.first_created_at, x.first_ordinality),
    '[]'::jsonb
  )
  INTO v_merged_attendees
  FROM (
    SELECT DISTINCT ON (public.normalize_attendee_name(a.value->>'name'))
      a.value AS item,
      r.created_at AS first_created_at,
      a.ord AS first_ordinality
    FROM public.rsvps r
    CROSS JOIN LATERAL jsonb_array_elements(r.attendees) WITH ORDINALITY AS a(value, ord)
    WHERE r.invitation_id = p_invitation_id
      AND public.normalize_attendee_name(r.contact_name) = v_contact_key
      AND coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_phone_key
    ORDER BY
      public.normalize_attendee_name(a.value->>'name'),
      r.created_at ASC,
      a.ord ASC
  ) AS x;

  UPDATE public.rsvps
  SET
    contact_name = public.format_person_name_ptbr(p_contact_name),
    whatsapp = public.format_whatsapp_br(p_whatsapp),
    whatsapp_e164 = v_phone_key,
    attendees = v_merged_attendees
  WHERE id = v_keep_id;

  DELETE FROM public.rsvps r
  WHERE r.invitation_id = p_invitation_id
    AND r.id <> v_keep_id
    AND public.normalize_attendee_name(r.contact_name) = v_contact_key
    AND coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_phone_key;

  RETURN jsonb_set(v_result, '{rsvpId}', to_jsonb(v_keep_id::text), true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_rsvp_public(uuid,text,text,jsonb,boolean) TO anon, authenticated;

-- Consolida registros antigos que pertencem ao mesmo responsável.
DO $$
DECLARE
  v_group record;
  v_keep_id uuid;
  v_merged_attendees jsonb;
BEGIN
  FOR v_group IN
    SELECT
      r.invitation_id,
      public.normalize_attendee_name(r.contact_name) AS contact_key,
      coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) AS phone_key
    FROM public.rsvps r
    WHERE coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) <> ''
    GROUP BY
      r.invitation_id,
      public.normalize_attendee_name(r.contact_name),
      coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp))
    HAVING count(*) > 1
  LOOP
    SELECT r.id
      INTO v_keep_id
    FROM public.rsvps r
    WHERE r.invitation_id = v_group.invitation_id
      AND public.normalize_attendee_name(r.contact_name) = v_group.contact_key
      AND coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_group.phone_key
    ORDER BY r.created_at ASC, r.id ASC
    LIMIT 1;

    SELECT coalesce(
      jsonb_agg(x.item ORDER BY x.first_created_at, x.first_ordinality),
      '[]'::jsonb
    )
    INTO v_merged_attendees
    FROM (
      SELECT DISTINCT ON (public.normalize_attendee_name(a.value->>'name'))
        a.value AS item,
        r.created_at AS first_created_at,
        a.ord AS first_ordinality
      FROM public.rsvps r
      CROSS JOIN LATERAL jsonb_array_elements(r.attendees) WITH ORDINALITY AS a(value, ord)
      WHERE r.invitation_id = v_group.invitation_id
        AND public.normalize_attendee_name(r.contact_name) = v_group.contact_key
        AND coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_group.phone_key
      ORDER BY
        public.normalize_attendee_name(a.value->>'name'),
        r.created_at ASC,
        a.ord ASC
    ) AS x;

    UPDATE public.rsvps
    SET attendees = v_merged_attendees
    WHERE id = v_keep_id;

    DELETE FROM public.rsvps r
    WHERE r.invitation_id = v_group.invitation_id
      AND r.id <> v_keep_id
      AND public.normalize_attendee_name(r.contact_name) = v_group.contact_key
      AND coalesce(nullif(r.whatsapp_e164, ''), public.whatsapp_e164_br(r.whatsapp)) = v_group.phone_key;
  END LOOP;
END
$$;
