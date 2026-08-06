-- Tipo dieta dell'invitato principale (host) — affiancato alle intolleranze per aiutare
-- i catering a preparare il menu senza dover incrociare manualmente le intolleranze.
-- Default 'onnivoro' per retrocompatibilità con record esistenti (backfill sotto).
ALTER TABLE public.rsvp_responses
  ADD COLUMN IF NOT EXISTS diet_type TEXT NOT NULL DEFAULT 'onnivoro'
  CHECK (diet_type IN ('onnivoro', 'vegetariano', 'vegano', 'pescatariano', 'altro'));

COMMENT ON COLUMN public.rsvp_responses.diet_type IS
  'Tipo dieta del capofamiglia/host: onnivoro (default) | vegetariano | vegano | pescatariano | altro. Distinto da host_intolerances[] che indica allergie specifiche.';

-- Indice per filtrare velocemente le conferme per tipo dieta (utile per export catering).
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_diet_type ON public.rsvp_responses (event_id, diet_type);

NOTIFY pgrst, 'reload schema';
