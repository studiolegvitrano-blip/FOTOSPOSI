ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS discount_offer TEXT;
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS is_partner BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS qr_scan_count INT NOT NULL DEFAULT 0;
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS confirmed_sales INT NOT NULL DEFAULT 0;
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

ALTER TABLE marketplace_suppliers DROP CONSTRAINT IF EXISTS marketplace_suppliers_category_check;
ALTER TABLE marketplace_suppliers ADD CONSTRAINT marketplace_suppliers_category_check
  CHECK (category IN ('fotografo', 'catering', 'fiori', 'musica', 'location', 'abiti', 'torte', 'video', 'parrucchiere', 'estetista', 'autonoleggio', 'makeup', 'wedding_planner', 'animazione', 'altro'));

CREATE TABLE IF NOT EXISTS partner_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES marketplace_suppliers(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id),
  user_id UUID REFERENCES core_users(id),
  source TEXT DEFAULT 'qr',
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partner_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_visits_select" ON partner_visits FOR SELECT USING (true);
CREATE POLICY "partner_visits_insert" ON partner_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "partner_visits_update" ON partner_visits FOR UPDATE USING (true);

CREATE OR REPLACE FUNCTION increment_partner_qr(supplier_id UUID)
RETURNS void AS $$
  UPDATE marketplace_suppliers SET qr_scan_count = qr_scan_count + 1 WHERE id = supplier_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_partner_sales(supplier_id UUID)
RETURNS void AS $$
  UPDATE marketplace_suppliers SET confirmed_sales = confirmed_sales + 1 WHERE id = supplier_id;
$$ LANGUAGE sql;

INSERT INTO marketplace_suppliers (name, category, description, city, approved, is_partner, slug, discount_offer) VALUES
  ('Parrucchiere di Prova', 'parrucchiere', 'Acconciature per spose e invitati', 'Roma', true, true, 'parrucchiere-prova', '10% di sconto su acconciatura sposa mostrando l\'app'),
  ('Estetica di Prova', 'estetista', 'Trattamenti viso e corpo per la sposa', 'Roma', true, true, 'estetica-prova', '15% su trattamento viso completo'),
  ('Auto Noleggio di Prova', 'autonoleggio', 'Noleggio auto per il grande giorno', 'Roma', true, true, 'auto-prova', '50€ di sconto sul noleggio wedding'),
  ('Makeup Artist di Prova', 'makeup', 'Trucco professionale sposa e invitati', 'Roma', true, true, 'makeup-prova', 'Omaggio prova trucco con l\'app');
