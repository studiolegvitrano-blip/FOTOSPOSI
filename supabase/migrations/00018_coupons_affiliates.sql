CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  applicable_tiers TEXT[] DEFAULT '{premium,deluxe}',
  min_quantity INT DEFAULT 1,
  max_uses INT,
  current_uses INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  affiliate_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  company TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  coupon_code TEXT UNIQUE,
  total_referrals INT DEFAULT 0,
  total_commission NUMERIC(10,2) DEFAULT 0,
  paid_commission NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id),
  coupon_id UUID REFERENCES coupons(id),
  event_id UUID,
  order_id UUID,
  tier_acquistato TEXT,
  coupon_code TEXT,
  sconto_coupon NUMERIC(10,2),
  commission_amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_select" ON coupons FOR SELECT USING (true);
CREATE POLICY "coupons_insert" ON coupons FOR INSERT WITH CHECK (true);
CREATE POLICY "coupons_update" ON coupons FOR UPDATE USING (true);
CREATE POLICY "coupons_delete" ON coupons FOR DELETE USING (true);

CREATE POLICY "affiliates_select" ON affiliates FOR SELECT USING (true);
CREATE POLICY "affiliates_insert" ON affiliates FOR INSERT WITH CHECK (true);
CREATE POLICY "affiliates_update" ON affiliates FOR UPDATE USING (true);
CREATE POLICY "affiliates_delete" ON affiliates FOR DELETE USING (true);

CREATE POLICY "referrals_select" ON referrals FOR SELECT USING (true);
CREATE POLICY "referrals_insert" ON referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "referrals_update" ON referrals FOR UPDATE USING (true);
CREATE POLICY "referrals_delete" ON referrals FOR DELETE USING (true);
