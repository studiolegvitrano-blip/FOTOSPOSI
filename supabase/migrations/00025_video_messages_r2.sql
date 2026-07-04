-- Aggiungi campi a video_messages per supporto R2 + nome ospite
ALTER TABLE video_messages ADD COLUMN IF NOT EXISTS r2_key TEXT;
ALTER TABLE video_messages ADD COLUMN IF NOT EXISTS from_name TEXT;
ALTER TABLE video_messages ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;
