-- Migration 00042: core_users.role_at_event
--
-- Aggiunge una colonna per memorizzare il ruolo dell'invitato RELATIVO al matrimonio
-- (distinto da `role` che è il ruolo nella piattaforma: sposo/invitato/manager/admin).
-- Lo sposo che crea l'evento NON ha role_at_event (NULL); gli invitati via QR compilano
-- il form post-OAuth con: Testimone / Parente / Amico / Altro (campo manuale).
-- Il valore è testuale libero per supportare "Altro" personalizzato (es. "Collega di lavoro").
--
-- Usato da:
--   - /api/auth/setup quando eventId è presente (invitato via QR)
--   - Galleria evento per mostrare "Mario Rossi — Testimone" sotto ogni foto caricata
--   - Wedding Wrapped per personalizzare il riepilogo
ALTER TABLE core_users
  ADD COLUMN IF NOT EXISTS role_at_event TEXT;

COMMENT ON COLUMN core_users.role_at_event IS
  'Ruolo dell''utente RELATIVO al matrimonio a cui è invitato (Testimone/Parente/Amico/Altro manuale). NULL per sposi/amministratori. Distinto da `role` che è il ruolo nella piattaforma.';
