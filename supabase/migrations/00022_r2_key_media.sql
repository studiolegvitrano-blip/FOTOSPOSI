ALTER TABLE media_uploads ADD COLUMN r2_key TEXT;
CREATE INDEX idx_media_uploads_r2_key ON media_uploads(r2_key);
