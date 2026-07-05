-- Flag scelto dagli sposi in fase di creazione evento ("Consenti agli invitati di scattare
-- foto e video") — di default true (comportamento invariato per eventi già esistenti).
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_guest_media BOOLEAN NOT NULL DEFAULT true;
