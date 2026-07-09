-- Font scelto dagli sposi per il testo impresso su foto/video.
-- Valori: 'classico' (Playfair Display), 'elegante' (Dancing Script), 'moderno' (Noto Sans).
ALTER TABLE events ADD COLUMN IF NOT EXISTS watermark_font text NOT NULL DEFAULT 'classico';
