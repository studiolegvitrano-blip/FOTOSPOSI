-- Aggiunge colonne nome/cognome separati per i due partner dell'evento.
-- Richiesto dall'utente 27/07/2026: il watermark deve usare SOLO i nomi (più pulito
-- della stringa libera `couple_name`), e serve supportare matrimonio stesso-sesso
-- (es. "Marco & Luca" o "Anna & Anna") dove non è appropriato parlare di "sposo/sposa".
--
-- Schema:
--   groom1_first_name + groom1_last_name = persona 1 (chi si sposa per primo nel DB)
--   groom2_first_name + groom2_last_name = persona 2
--   partner1_role + partner2_role = 'groom' (sposo) o 'bride' (sposa) — il default
--     è entrambi 'groom' (neutro) e gli sposi possono specificare i ruoli.
--
-- Tutte le colonne sono NULLABLE: gli eventi già creati continueranno a funzionare
-- usando `couple_name` come fallback finché gli sposi non aggiornano le impostazioni.
-- Il watermark, la creazione evento e il settings form useranno i campi nuovi SE
-- valorizzati, altrimenti `couple_name` come fallback legacy.
--
-- Backfill conservativo: per gli eventi esistenti proviamo a splittare `couple_name`
-- su '&', ' e ', ' E ' e simili; se il parsing non è chiaro lasciamo NULL.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS groom1_first_name TEXT,
  ADD COLUMN IF NOT EXISTS groom1_last_name TEXT,
  ADD COLUMN IF NOT EXISTS groom1_role TEXT NOT NULL DEFAULT 'groom'
    CHECK (groom1_role IN ('groom', 'bride')),
  ADD COLUMN IF NOT EXISTS groom2_first_name TEXT,
  ADD COLUMN IF NOT EXISTS groom2_last_name TEXT,
  ADD COLUMN IF NOT EXISTS groom2_role TEXT NOT NULL DEFAULT 'groom'
    CHECK (groom2_role IN ('groom', 'bride'));

-- Backfill best-effort: split su '&' (es. "Marco & Luca") o ' e ' (es. "Marco e Luca")
-- NB: questo è un best-effort — molti eventi avranno nomi concatenati ("Agostino Sabrina")
-- che NON possiamo splittare automaticamente. Quei casi resteranno NULL e l'utente
-- compilerà i campi dal settings.
DO $$
DECLARE
  rec RECORD;
  parts TEXT[];
  p1 TEXT; p2 TEXT;
  n1 TEXT; sn1 TEXT;
  n2 TEXT; sn2 TEXT;
BEGIN
  FOR rec IN SELECT id, couple_name FROM events WHERE couple_name IS NOT NULL LOOP
    p1 := NULL; p2 := NULL;
    -- Strategia 1: split su ' & ' (con spazi)
    IF rec.couple_name LIKE '% & %' THEN
      SELECT split_part(rec.couple_name, ' & ', 1) INTO p1;
      SELECT split_part(rec.couple_name, ' & ', 2) INTO p2;
    ELSIF rec.couple_name LIKE '% e %' OR rec.couple_name LIKE '% E %' THEN
      SELECT split_part(rec.couple_name, ' e ', 1) INTO p1;
      SELECT split_part(rec.couple_name, ' e ', 2) INTO p2;
    END IF;
    IF p1 IS NOT NULL AND p2 IS NOT NULL THEN
      -- Split nome+cognome: l'ultima parola è il cognome, il resto è il nome.
      -- Es. "Marco Rossi" → first="Marco", last="Rossi"
      n1 := split_part(trim(p1), ' ', 1);
      sn1 := NULLIF(trim(substring(trim(p1) FROM position(' ' IN trim(p1)) + 1)), '');
      n2 := split_part(trim(p2), ' ', 1);
      sn2 := NULLIF(trim(substring(trim(p2) FROM position(' ' IN trim(p2)) + 1)), '');
      UPDATE events SET
        groom1_first_name = n1,
        groom1_last_name = sn1,
        groom2_first_name = n2,
        groom2_last_name = sn2
      WHERE id = rec.id;
    END IF;
  END LOOP;
END
$$;
