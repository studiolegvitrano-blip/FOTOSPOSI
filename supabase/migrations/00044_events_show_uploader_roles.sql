-- 00044: Toggle "mostra ruoli in galleria" + vincoli sui ruoli visualizzabili.
--
-- Gli sposi possono decidere se il feed mostra il ruolo del caricatore sotto la foto
-- (Testimone sposa/sposo, Padre, Madre). Gli altri ruoli raccolti in fase di
-- registrazione (Amico, Parente, Collega, Altro) NON vengono mostrati in galleria,
-- ma restano salvati su core_users.role_at_event per le liste "Partecipanti".

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS show_uploader_roles BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN events.show_uploader_roles IS
  'Se true, il feed galleria mostra il ruolo del caricatore sotto la foto (solo Testimone sposa/sposo, Padre, Madre). Se false, mostra solo il nome. Gli altri ruoli (Amico, Parente, Collega, Altro) non vengono mai mostrati in galleria.';
