-- 00061: Capsula del Tempo — video messaggi con watermark, delivery a data futura,
-- pagamenti proporzionali (feature 18/09/2026).
-- La tabella time_capsule_messages esiste già (testo/foto via Supabase Storage + Drive);
-- qui si estendono le colonne per il flusso video R2 + pagamenti + delivery channel.

ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS r2_key text;
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS original_r2_key text;
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS watermark_phrase text;
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS delivery_channel text DEFAULT 'app'
  CHECK (delivery_channel IN ('email', 'whatsapp', 'app'));
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS recipient_whatsapp text;
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS recipient_guest_id uuid
  REFERENCES public.event_guests(id);
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS status text DEFAULT 'scheduled'
  CHECK (status IN ('awaiting_payment', 'processing', 'scheduled', 'delivered', 'failed'));
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS video_job_id text;
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS payment_required boolean DEFAULT false;
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS price_cents integer;
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS order_id uuid
  REFERENCES public.orders(id);
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS access_token uuid DEFAULT gen_random_uuid();
ALTER TABLE public.time_capsule_messages ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- RLS: SELECT estesa a mittente e destinatario guest loggato (prima: solo owner evento).
DROP POLICY IF EXISTS tcm_select_event_owner ON public.time_capsule_messages;
CREATE POLICY tcm_select_participant ON public.time_capsule_messages
  FOR SELECT TO authenticated
  USING (
    sender_user_id = auth.uid()
    OR event_id IN (SELECT e.id FROM public.events e WHERE e.created_by = auth.uid())
    OR recipient_guest_id IN (SELECT g.id FROM public.event_guests g WHERE g.user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
