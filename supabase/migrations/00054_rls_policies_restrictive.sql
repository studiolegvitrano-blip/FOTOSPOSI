-- 00054_rls_policies_restrictive.sql
-- Sostituisce le policy permissive (USING/WITH CHECK = true) con policy restrittive
-- Risolve 30+ WARN rls_policy_always_true del Security Advisor
--
-- Principio: ogni policy mutante (INSERT/UPDATE/DELETE) deve validare ownership
-- o role appropriata. Service_role bypassa sempre RLS per cron/n8n/admin.

-- =====================================================================
-- 1. GTE / n8n TABLES — solo service_role per mutazioni, SELECT per brand owner
-- =====================================================================

-- brands: config brand GTE
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
-- SELECT: authenticated può leggere brand attivi del proprio tenant
CREATE POLICY brands_select_tenant ON public.brands
  FOR SELECT TO authenticated
  USING (
    active = true OR active IS NULL
  );
-- Mutazioni: solo service_role (n8n)
CREATE POLICY brands_all_service_role ON public.brands
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- content_queue: pipeline contenuti
ALTER TABLE public.content_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_queue_select_brand ON public.content_queue
  FOR SELECT TO authenticated
  USING (
    brand_id IN (
      SELECT id FROM public.brands WHERE active = true OR active IS NULL
    )
  );
CREATE POLICY content_queue_all_service_role ON public.content_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- content_sources: fonti contenuti
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_sources_select_brand ON public.content_sources
  FOR SELECT TO authenticated
  USING (
    brand_id IN (
      SELECT id FROM public.brands WHERE active = true OR active IS NULL
    )
  );
CREATE POLICY content_sources_all_service_role ON public.content_sources
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- engagement_queue: coda engagement
ALTER TABLE public.engagement_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY engagement_queue_select_brand ON public.engagement_queue
  FOR SELECT TO authenticated
  USING (
    brand_id IN (
      SELECT id FROM public.brands WHERE active = true OR active IS NULL
    )
  );
CREATE POLICY engagement_queue_all_service_role ON public.engagement_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- trend_log: log trend
ALTER TABLE public.trend_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY trend_log_select_brand ON public.trend_log
  FOR SELECT TO authenticated
  USING (
    brand_ids && (
      SELECT array_agg(id) FROM public.brands WHERE active = true OR active IS NULL
    )
  );
CREATE POLICY trend_log_all_service_role ON public.trend_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- performance_log: metriche
ALTER TABLE public.performance_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY performance_log_select_brand ON public.performance_log
  FOR SELECT TO authenticated
  USING (
    brand_id IN (
      SELECT id FROM public.brands WHERE active = true OR active IS NULL
    )
  );
CREATE POLICY performance_log_all_service_role ON public.performance_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- 2. ADMIN-ONLY TABLES (GTE internal) — solo service_role per mutazioni
-- =====================================================================

-- b2b_leads
ALTER TABLE public.b2b_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY b2b_leads_select_service_role ON public.b2b_leads
  FOR SELECT TO service_role
  USING (true);
CREATE POLICY b2b_leads_all_service_role ON public.b2b_leads
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- brand_config
ALTER TABLE public.brand_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_config_select_service_role ON public.brand_config
  FOR SELECT TO service_role
  USING (true);
CREATE POLICY brand_config_all_service_role ON public.brand_config
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- content_performance
ALTER TABLE public.content_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_performance_select_service_role ON public.content_performance
  FOR SELECT TO service_role
  USING (true);
CREATE POLICY content_performance_all_service_role ON public.content_performance
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- engagement_triage
ALTER TABLE public.engagement_triage ENABLE ROW LEVEL SECURITY;
CREATE POLICY engagement_triage_select_service_role ON public.engagement_triage
  FOR SELECT TO service_role
  USING (true);
CREATE POLICY engagement_triage_all_service_role ON public.engagement_triage
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- lead_to_supplier_conversion
ALTER TABLE public.lead_to_supplier_conversion ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_to_supplier_select_service_role ON public.lead_to_supplier_conversion
  FOR SELECT TO service_role
  USING (true);
CREATE POLICY lead_to_supplier_all_service_role ON public.lead_to_supplier_conversion
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- trend_intelligence
ALTER TABLE public.trend_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY trend_intelligence_select_service_role ON public.trend_intelligence
  FOR SELECT TO service_role
  USING (true);
CREATE POLICY trend_intelligence_all_service_role ON public.trend_intelligence
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- 3. SYSTEM CORE — multi-tenant con ownership
-- =====================================================================

-- core_tenants
ALTER TABLE public.core_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_tenants_select_tenant ON public.core_tenants
  FOR SELECT TO authenticated
  USING (
    id = (SELECT tenant_id FROM public.core_users WHERE id = auth.uid())
  );
CREATE POLICY core_tenants_all_service_role ON public.core_tenants
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- core_users
ALTER TABLE public.core_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY core_users_select_self ON public.core_users
  FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY core_users_select_tenant_admin ON public.core_users
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.core_users WHERE id = auth.uid())
    AND (SELECT role FROM public.core_users WHERE id = auth.uid()) IN ('admin', 'manager')
  );
CREATE POLICY core_users_update_self ON public.core_users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY core_users_all_service_role ON public.core_users
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- 4. APP FEATURES — event-scoped con ownership validation
-- =====================================================================

-- gift_registry_transactions: lista nozze
ALTER TABLE public.gift_registry_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY gift_registry_select_event_owner ON public.gift_registry_transactions
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE created_by = auth.uid()
    )
  );
CREATE POLICY gift_registry_insert_guest ON public.gift_registry_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid()
  );
CREATE POLICY gift_registry_all_service_role ON public.gift_registry_transactions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- joke_entries: Angolo Scherzi
ALTER TABLE public.joke_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY joke_entries_select_event_participant ON public.joke_entries
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      LEFT JOIN public.event_guests g ON g.event_id = e.id AND g.user_id = auth.uid()
      WHERE e.created_by = auth.uid() OR g.user_id = auth.uid()
    )
  );
CREATE POLICY joke_entries_insert_event_participant ON public.joke_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid() AND
    event_id IN (
      SELECT e.id FROM public.events e
      LEFT JOIN public.event_guests g ON g.event_id = e.id AND g.user_id = auth.uid()
      WHERE e.created_by = auth.uid() OR g.user_id = auth.uid()
    )
  );
CREATE POLICY joke_entries_all_service_role ON public.joke_entries
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- orders: ordini commerce
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_select_event_owner ON public.orders
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE created_by = auth.uid()
    )
  );
CREATE POLICY orders_select_customer ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY orders_insert_customer ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY orders_all_service_role ON public.orders
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- products: catalogo pubblico (SELECT anon), mutazioni service_role
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select_public ON public.products
  FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY products_all_service_role ON public.products
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- social_shares: tracking viral
ALTER TABLE public.social_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_shares_select_event_participant ON public.social_shares
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      LEFT JOIN public.event_guests g ON g.event_id = e.id AND g.user_id = auth.uid()
      WHERE e.created_by = auth.uid() OR g.user_id = auth.uid()
    )
  );
CREATE POLICY social_shares_insert_authenticated ON public.social_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    shared_by = auth.uid() OR shared_by IS NULL
  );
CREATE POLICY social_shares_all_service_role ON public.social_shares
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- 5. PUBLIC INSERT TABLES (anon allowed) — con validation esplicita
-- =====================================================================

-- coupons: codici sconto (public insert via marketing links)
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupons_select_valid ON public.coupons
  FOR SELECT TO anon, authenticated
  USING (valid_from <= now() AND (valid_until IS NULL OR valid_until >= now()));
CREATE POLICY coupons_all_service_role ON public.coupons
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- event_codes: generati da service_role (createEvent)
ALTER TABLE public.event_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_codes_select_valid ON public.event_codes
  FOR SELECT TO anon, authenticated
  USING (used_at IS NULL OR used_at > now());
CREATE POLICY event_codes_all_service_role ON public.event_codes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- event_features: mapping feature/tier
ALTER TABLE public.event_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_features_select_public ON public.event_features
  FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY event_features_all_service_role ON public.event_features
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- marketplace_supplier_applications: form pubblico /collaboratori
ALTER TABLE public.marketplace_supplier_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_app_insert_anon_validated ON public.marketplace_supplier_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    agreed_terms = true AND
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND
    (account_type = 'commerciale' OR account_type = 'privato') AND
    (full_name IS NOT NULL OR business_name IS NOT NULL)
  );
CREATE POLICY supplier_app_all_service_role ON public.marketplace_supplier_applications
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- partner_visits: tracking referral (insert anon con validation)
ALTER TABLE public.partner_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_visits_insert_validated ON public.partner_visits
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    supplier_id IS NOT NULL AND
    visitor_id IS NOT NULL
  );
CREATE POLICY partner_visits_all_service_role ON public.partner_visits
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- photo_hunt_registrations: giochi evento
ALTER TABLE public.photo_hunt_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY photo_hunt_reg_insert_event_participant ON public.photo_hunt_registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE allow_guest_media = true
        AND (window_start <= now() OR window_start IS NULL)
        AND (window_end >= now() OR window_end IS NULL)
    )
  );
CREATE POLICY photo_hunt_reg_select_participant ON public.photo_hunt_registrations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid())
  );
CREATE POLICY photo_hunt_reg_all_service_role ON public.photo_hunt_registrations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- photo_hunt_submissions: submit foto caccia
ALTER TABLE public.photo_hunt_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY photo_hunt_sub_insert_event_participant ON public.photo_hunt_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    registration_id IN (
      SELECT id FROM public.photo_hunt_registrations
      WHERE user_id = auth.uid() OR auth.uid() IS NULL
    )
  );
CREATE POLICY photo_hunt_sub_select_participant ON public.photo_hunt_submissions
  FOR SELECT TO authenticated
  USING (
    registration_id IN (
      SELECT id FROM public.photo_hunt_registrations
      WHERE user_id = auth.uid()
    ) OR
    event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid())
  );
CREATE POLICY photo_hunt_sub_all_service_role ON public.photo_hunt_submissions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- quiz_answers: risposte quiz sposi
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_answers_insert_event_participant ON public.quiz_answers
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    question_id IN (
      SELECT id FROM public.quiz_questions
      WHERE event_id IN (
        SELECT id FROM public.events
        WHERE allow_guest_media = true
      )
    )
  );
CREATE POLICY quiz_answers_select_self ON public.quiz_answers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY quiz_answers_all_service_role ON public.quiz_answers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- quiz_questions: domande quiz (admin event owner)
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY quiz_questions_select_event ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE created_by = auth.uid()
    )
  );
CREATE POLICY quiz_questions_all_service_role ON public.quiz_questions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- referrals: referral program
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY referrals_insert_validated ON public.referrals
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    referrer_id IS NOT NULL AND
    referred_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );
CREATE POLICY referrals_select_referrer ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid());
CREATE POLICY referrals_all_service_role ON public.referrals
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- time_capsule_messages: capsule tempo
ALTER TABLE public.time_capsule_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tcm_insert_event_participant ON public.time_capsule_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE time_capsule_enabled = true
    )
  );
CREATE POLICY tcm_select_event_owner ON public.time_capsule_messages
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid())
  );
CREATE POLICY tcm_all_service_role ON public.time_capsule_messages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- upload_queue: code upload (insert da client, process da service_role)
ALTER TABLE public.upload_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY upload_queue_insert_client ON public.upload_queue
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    event_id IN (
      SELECT id FROM public.events
      WHERE allow_guest_media = true
        AND (window_start <= now() OR window_start IS NULL)
        AND (window_end >= now() OR window_end IS NULL)
    )
  );
CREATE POLICY upload_queue_select_owner ON public.upload_queue
  FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid())
  );
CREATE POLICY upload_queue_update_service ON public.upload_queue
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY upload_queue_all_service_role ON public.upload_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- REFRESH POSTGREST CACHE
-- =====================================================================
NOTIFY pgrst, 'reload schema';