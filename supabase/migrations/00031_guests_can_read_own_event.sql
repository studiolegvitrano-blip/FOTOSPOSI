-- Un invitato (core_users.role = 'invitato', con event_id impostato dal flusso di registrazione
-- da QR — vedi apps/web/src/app/api/auth/setup/route.ts) doveva poter leggere l'evento a cui è
-- stato invitato per usare la pagina di upload (getEventById/getEventTier/getEventWindow), ma la
-- RLS su `events` permetteva la SELECT solo al creatore (created_by = auth.uid()). Senza questa
-- policy, un ospite tornato correttamente sulla pagina giusta dopo il login vedeva comunque un
-- caricamento infinito (query dell'evento sempre vuota per via della RLS).
CREATE POLICY "Guests can read their invited event" ON events
  FOR SELECT USING (
    id IN (SELECT event_id FROM core_users WHERE id = auth.uid() AND event_id IS NOT NULL)
  );
