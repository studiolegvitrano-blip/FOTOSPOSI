-- 00053_rls_policies_complete.sql
-- Aggiunge policy RLS complete per 13 tabelle con RLS enabled ma zero policy
-- Risolve 13 INFO del Supabase Security Advisor (rls_enabled_no_policy)
--
-- Pattern: policy per ruolo/evento/tenant coerente con architettura modulare
-- Ogni tabella ha policy SELECT/INSERT/UPDATE/DELETE appropriate
-- Service_role ha accesso totale (bypassa RLS) per cron/n8n/admin API

-- =====================================================================
-- 1. GTE / n8n TABLES (service_role only per operazioni interne)
--    Queste tabelle sono gestite esclusivamente da n8n/worker via service_role
--    Policy esplicite per service_role + lettura authenticated dove serve
-- =====================================================================

-- brands: config brand per GTE. Lettura da authenticated per marketplace/admin
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands_select_authenticated" ON public.brands
  FOR SELECT TO authenticated
  USING (active = true OR active IS NULL);
CREATE POLICY "brands_all_service_role" ON public.brands
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- content_queue: pipeline contenuti GTE. Solo service_role
ALTER TABLE public.content_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_queue_all_service_role" ON public.content_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- content_sources: fonti contenuti GTE. Solo service_role
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_sources_all_service_role" ON public.content_sources
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- engagement_queue: coda engagement GTE. Solo service_role
ALTER TABLE public.engagement_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engagement_queue_all_service_role" ON public.engagement_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- trend_log: log trend GTE. Solo service_role
ALTER TABLE public.trend_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trend_log_all_service_role" ON public.trend_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- performance_log: metriche performance GTE. Solo service_role
ALTER TABLE public.performance_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "performance_log_all_service_role" ON public.performance_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- 2. SYSTEM CORE TABLES (multi-tenant, user profiles)
-- =====================================================================

-- core_tenants: config tenant per brand. Lettura da membri tenant
ALTER TABLE public.core_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "core_tenants_select_tenant_member" ON public.core_tenants
  FOR SELECT TO authenticated
  USING (id = (SELECT tenant_id FROM public.core_users WHERE id = auth.uid()));
CREATE POLICY "core_tenants_all_service_role" ON public.core_tenants
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- core_users: profili utenti. Lettura self + admin tenant
ALTER TABLE public.core_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "core_users_select_self" ON public.core_users
  FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "core_users_select_tenant_admin" ON public.core_users
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.core_users WHERE id = auth.uid())
    AND (SELECT role FROM public.core_users WHERE id = auth.uid()) IN ('admin', 'manager')
  );
CREATE POLICY "core_users_update_self" ON public.core_users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY "core_users_all_service_role" ON public.core_users
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- 3. APP FEATURE TABLES (event-scoped, user-scoped)
-- =====================================================================

-- gift_registry_transactions: lista nozze. Lettura da sposi (event owner)
ALTER TABLE public.gift_registry_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gift_registry_select_event_owner" ON public.gift_registry_transactions
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE created_by = auth.uid()
    )
  );
CREATE POLICY "gift_registry_insert_guest" ON public.gift_registry_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid()
  );
CREATE POLICY "gift_registry_all_service_role" ON public.gift_registry_transactions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- joke_entries: Angolo Scherzi. Lettura da partecipanti evento
ALTER TABLE public.joke_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "joke_entries_select_event_participant" ON public.joke_entries
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      LEFT JOIN public.event_guests g ON g.event_id = e.id AND g.user_id = auth.uid()
      WHERE e.created_by = auth.uid() OR g.user_id = auth.uid()
    )
  );
CREATE POLICY "joke_entries_insert_event_participant" ON public.joke_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid() AND
    event_id IN (
      SELECT e.id FROM public.events e
      LEFT JOIN public.event_guests g ON g.event_id = e.id AND g.user_id = auth.uid()
      WHERE e.created_by = auth.uid() OR g.user_id = auth.uid()
    )
  );
CREATE POLICY "joke_entries_all_service_role" ON public.joke_entries
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- orders: ordini commerce. Lettura da sposi + cliente
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_event_owner" ON public.orders
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE created_by = auth.uid()
    )
  );
CREATE POLICY "orders_select_customer" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "orders_insert_customer" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "orders_all_service_role" ON public.orders
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- products: catalogo pubblico. Lettura anon + authenticated, scrittura admin
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_public" ON public.products
  FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "products_all_service_role" ON public.products
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- social_shares: tracking viral. Lettura da partecipanti evento
ALTER TABLE public.social_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_shares_select_event_participant" ON public.social_shares
  FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      LEFT JOIN public.event_guests g ON g.event_id = e.id AND g.user_id = auth.uid()
      WHERE e.created_by = auth.uid() OR g.user_id = auth.uid()
    )
  );
CREATE POLICY "social_shares_insert_authenticated" ON public.social_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    shared_by = auth.uid() OR shared_by IS NULL
  );
CREATE POLICY "social_shares_all_service_role" ON public.social_shares
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- REFRESH POSTGREST CACHE (regola ferrea AGENTS.md)
-- =====================================================================
NOTIFY pgrst, 'reload schema';