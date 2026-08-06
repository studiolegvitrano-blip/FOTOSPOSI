-- 00051_security_advisor_fixes.sql
-- Risolve 1 ERROR + 49 WARN del Supabase Security Advisor
--
-- 1) ERROR security_definer_view: v_review_inbox → SECURITY INVOKER
-- 2) WARN function_search_path_mutable × 8 (search_path = '' )
-- 3) WARN anon/authenticated_security_definer_function_executable × 4 (REVOKE EXECUTE)
--
-- NOTA: Leaked Password Protection è toggle dashboard (non SQL).

-- ── 1. ERROR: v_review_inbox SECURITY DEFINER → INVOKER ──────────
-- Vista reale: JOIN content_queue × brands, filtra per status in
-- ['pending_review','approved'], ORDER BY created_at DESC.
-- Ricreiamo identica body con WITH (security_invoker = true).
CREATE OR REPLACE VIEW public.v_review_inbox
  WITH (security_invoker = true) AS
SELECT
  cq.id,
  cq.brand_id,
  b.name AS brand_name,
  cq.caption,
  cq.status,
  cq.risk_flag,
  cq.risk_reason,
  cq.language,
  cq.hashtags,
  cq.call_to_action,
  cq.scheduled_for,
  cq.created_at,
  cq.updated_at,
  cq.asset_urls,
  cq.video_url,
  cq.thumbnail_url,
  cq.translations,
  cq.trend_sound_name
FROM public.content_queue cq
JOIN public.brands b ON cq.brand_id = b.id
WHERE cq.status = ANY (ARRAY['pending_review'::public.content_status,
                              'approved'::public.content_status])
ORDER BY cq.created_at DESC;

COMMENT ON VIEW public.v_review_inbox IS
  'Inbox recensioni/contenuti GTE in attesa di review (admin). '
  'SECURITY INVOKER per rispettare policy RLS del chiamante.';
ALTER VIEW public.v_review_inbox OWNER TO postgres;

-- ── 2. WARN: function_search_path_mutable × 8 ───────────────────
ALTER FUNCTION public.generate_event_code(p_country text) SET search_path TO '';
ALTER FUNCTION public.recalculate_wall_scores(p_event_id uuid) SET search_path TO '';
ALTER FUNCTION public.trigger_recalculate_wall_scores() SET search_path TO '';
ALTER FUNCTION public.pg_database_size() SET search_path TO '';
ALTER FUNCTION public.get_table_sizes() SET search_path TO '';
ALTER FUNCTION public.increment_partner_qr(supplier_id uuid) SET search_path TO '';
ALTER FUNCTION public.increment_partner_sales(supplier_id uuid) SET search_path TO '';
ALTER FUNCTION public.update_gte_updated_at() SET search_path TO '';
ALTER FUNCTION public.rls_auto_enable() SET search_path TO 'pg_catalog';

-- ── 3. WARN: anon/authenticated SECURITY DEFINER EXECUTE × 4 ────
REVOKE EXECUTE ON FUNCTION public.get_table_sizes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pg_database_size() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_recalculate_wall_scores() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
