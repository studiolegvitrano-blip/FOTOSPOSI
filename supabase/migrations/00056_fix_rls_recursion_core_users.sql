-- =====================================================================
-- 00056 — FIX RLS infinite recursion on core_users
-- ---------------------------------------------------------------
-- Sintomo: qualsiasi query authenticated su tabelle con policy che
-- referenziano core_users (events, media_uploads, votes, ecc.) fallisce
-- con 42P17 "infinite recursion detected in policy for relation core_users".
--
-- Root cause: la policy core_users_select_tenant_admin contiene subquery
-- su core_users stessa dentro il proprio USING:
--   tenant_id = (SELECT tenant_id FROM core_users WHERE id = auth.uid())
-- Ogni valutazione RLS di core_users ri-valuta quella policy, che fa
-- un'altra subquery su core_users -> recursion infinito.
--
-- Fix: helper SECURITY DEFINER che leggono tenant_id/role dell'utente
-- corrente bypassando RLS (definer = postgres). Le policy riferiscono
-- le funzioni invece di subquery autoreferenziali.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.core_users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.core_users WHERE id = auth.uid();
$$;

-- Riscrive la policy incriminata usando gli helper (niente subquery
-- autoreferenziale dentro core_users).
DROP POLICY IF EXISTS core_users_select_tenant_admin ON public.core_users;
CREATE POLICY core_users_select_tenant_admin ON public.core_users
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_user_tenant_id()
    AND public.current_user_role() IN ('admin', 'manager')
  );

-- Altre policy che referenziano core_users restano valide: ora la
-- valutazione RLS di core_users non recursa piu.

-- Gli helper sono usati solo DENTRO le policy RLS (che girano come
-- authenticated): niente RPC pubblico. Revocare EXECUTE ad anon/PUBLIC.
REVOKE EXECUTE ON FUNCTION public.current_user_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

NOTIFY pgrst, 'reload schema';
