-- Convidata: novos tipos de evento sem modificar convites existentes.
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS event_subtitle text;

-- Registros anteriores preservam a categoria conforme sua unidade de idade.
UPDATE public.invitations SET event_type = CASE
  WHEN age_unit = 'months' THEN 'monthiversary' ELSE 'birthday'
END WHERE event_type IS NULL;

ALTER TABLE public.invitations
  ALTER COLUMN event_type SET DEFAULT 'birthday',
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN age DROP NOT NULL,
  ALTER COLUMN age_unit DROP NOT NULL;

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_event_type_check,
  DROP CONSTRAINT IF EXISTS invitations_event_age_consistency_check;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_event_type_check CHECK (
    event_type IN (
      'birthday','monthiversary','wedding','engagement','wedding-anniversary',
      'baby-shower','gender-reveal','diaper-shower','baptism','barbecue',
      'meeting','gathering','party','graduation','housewarming',
      'inauguration','corporate','other'
    )
  ),
  ADD CONSTRAINT invitations_event_age_consistency_check CHECK (
    (
      event_type = 'birthday' AND age_unit = 'years' AND age BETWEEN 1 AND 120
    ) OR (
      event_type = 'monthiversary' AND age_unit = 'months' AND age BETWEEN 1 AND 12
    ) OR (
      event_type NOT IN ('birthday','monthiversary')
      AND age IS NULL AND age_unit IS NULL
    )
  );

COMMENT ON COLUMN public.invitations.event_type IS 'Tipo de evento da Convidata; convites antigos preservados como birthday/monthiversary.';
COMMENT ON COLUMN public.invitations.event_subtitle IS 'Subtítulo opcional da ocasião.';
