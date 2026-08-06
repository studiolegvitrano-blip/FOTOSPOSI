-- 00052_security_advisor_revoke_public.sql
-- Patch di completamento a 00051_security_advisor_fixes.sql
--
-- 00051 ha REVOKE da `anon, authenticated` ma in Postgres/Supabase i ruoli
-- anon e authenticated ereditano implicitamente da PUBLIC → la revoca è
-- no-op ai fini pratici. Per silenziare gli advisor è necessario revocare
-- anche da PUBLIC e re-grantare esplicito solo a service_role.

-- Revoke EXECUTE da PUBLIC (sclerosa anon/authenticated)
REVOKE EXECUTE ON FUNCTION public.get_table_sizes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pg_database_size() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_recalculate_wall_scores() FROM PUBLIC;

-- Re-grant esplicito a service_role (lambda admin/cron/CEO overview)
GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO service_role;
GRANT EXECUTE ON FUNCTION public.pg_database_size() TO service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_recalculate_wall_scores() TO service_role;

NOTIFY pgrst, 'reload schema';
