CREATE TABLE IF NOT EXISTS site_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  palette TEXT[] NOT NULL DEFAULT '{}',
  font_family TEXT NOT NULL DEFAULT 'geist',
  preview_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id UUID REFERENCES site_templates(id),
  content JSONB NOT NULL DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT false,
  published_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_generated_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  generated TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'home',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their event drafts" ON site_drafts
  FOR SELECT USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));
CREATE POLICY "Users can insert their event drafts" ON site_drafts
  FOR INSERT WITH CHECK (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));
CREATE POLICY "Users can update their event drafts" ON site_drafts
  FOR UPDATE USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));

CREATE POLICY "Anyone can read templates" ON site_templates FOR SELECT USING (true);
CREATE POLICY "Admin can manage templates" ON site_templates
  FOR ALL USING (auth.uid() IN (SELECT id FROM core_users WHERE role = 'admin'));

CREATE POLICY "Users can read AI texts for their events" ON ai_generated_texts
  FOR SELECT USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));
CREATE POLICY "Users can insert AI texts for their events" ON ai_generated_texts
  FOR INSERT WITH CHECK (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));

INSERT INTO site_templates (name, palette, font_family) VALUES
  ('Elegante', ARRAY['#d4a574','#f5f0eb','#1a1a2e','#ffffff'], 'Georgia, serif'),
  ('Minimal', ARRAY['#2d2d2d','#f8f8f8','#b8860b','#ffffff'], 'Inter, sans-serif'),
  ('Romantico', ARRAY['#e8a0b4','#fff5f7','#4a2c3a','#ffffff'], 'Georgia, serif'),
  ('Giardino', ARRAY['#7ebd7e','#fff8dc','#8b4513','#ffffff'], 'Lora, serif'),
  ('Spiaggia', ARRAY['#00b4d8','#fff5e6','#e07a5f','#ffffff'], 'Poppins, sans-serif'),
  ('Notte Stellata', ARRAY['#1a1a2e','#16213e','#e94560','#ffffff'], 'Montserrat, sans-serif');
