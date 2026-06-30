-- 1. Face Recognition
CREATE TABLE IF NOT EXISTS face_recognition_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES core_users(id),
  consented BOOLEAN NOT NULL DEFAULT false,
  consented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS face_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media_uploads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES core_users(id),
  face_box JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Notifications
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'push')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, channel)
);

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'push')),
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Analytics / B2B
CREATE TABLE IF NOT EXISTS b2b_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core_tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  event_count INT NOT NULL DEFAULT 0,
  total_uploads INT NOT NULL DEFAULT 0,
  total_orders INT NOT NULL DEFAULT 0,
  total_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Marketplace
CREATE TABLE IF NOT EXISTS marketplace_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fotografo', 'catering', 'fiori', 'musica', 'location', 'abiti', 'torte', 'video', 'altro')),
  description TEXT,
  city TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES marketplace_suppliers(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, event_id)
);

-- 5. Concierge
CREATE TABLE IF NOT EXISTS concierge_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES core_users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE face_recognition_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_messages ENABLE ROW LEVEL SECURITY;

-- Face Recognition RLS
CREATE POLICY "Users manage own consent" ON face_recognition_consent
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Event owners view consent" ON face_recognition_consent
  FOR SELECT USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));
CREATE POLICY "Users view own face tags" ON face_tags
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Event owners manage face tags" ON face_tags
  FOR ALL USING (media_id IN (SELECT id FROM media_uploads WHERE event_id IN (SELECT id FROM events WHERE created_by = auth.uid())));

-- Notifications RLS
CREATE POLICY "Event owners manage notification prefs" ON notification_preferences
  FOR ALL USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));
CREATE POLICY "Event owners view notification logs" ON notification_log
  FOR SELECT USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));

-- B2B RLS
CREATE POLICY "Tenant admins view reports" ON b2b_reports
  FOR SELECT USING (tenant_id IN (SELECT id FROM core_tenants WHERE id IN (SELECT tenant_id FROM core_users WHERE id = auth.uid())));

-- Marketplace RLS
CREATE POLICY "Anyone can view approved suppliers" ON marketplace_suppliers
  FOR SELECT USING (approved = true);
CREATE POLICY "Admins manage suppliers" ON marketplace_suppliers
  FOR ALL USING (auth.uid() IN (SELECT id FROM core_users WHERE role = 'admin'));
CREATE POLICY "Users manage own reviews" ON marketplace_reviews
  FOR ALL USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));
CREATE POLICY "Anyone can view reviews" ON marketplace_reviews
  FOR SELECT USING (true);

-- Concierge RLS
CREATE POLICY "Users manage own messages" ON concierge_messages
  FOR ALL USING (user_id = auth.uid());

-- Seed suppliers (Italia)
INSERT INTO marketplace_suppliers (name, category, description, city, approved) VALUES
  ('Marco Ferri Fotografo', 'fotografo', 'Fotografo di matrimoni dal 2005. Servizio digitale e album stampato.', 'Firenze', true),
  ('Dolci Sogni Pasticceria', 'torte', 'Torte da sogno per il giorno più bello. Consegna in tutta Italia.', 'Milano', true),
  ('Fioreria Bella', 'fiori', 'Allestimenti floreali per chiese, location e bouquet sposa.', 'Roma', true),
  ('Rock Wedding Band', 'musica', 'Cover band dal vivo per il tuo ricevimento. Repertorio personalizzabile.', 'Bologna', true),
  ('Catering Deluxe', 'catering', 'Menu degustazione per matrimoni. Cucina tradizionale e internazionale.', 'Torino', true);
