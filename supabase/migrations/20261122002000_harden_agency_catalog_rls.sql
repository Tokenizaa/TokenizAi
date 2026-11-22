-- NettosCorp Enterprise
-- Hardening: close the three Agency Agents tables that previously exposed
-- permissive PUBLIC policies (USING/WITH CHECK true) to anon/authenticated.
-- RLS remains enabled. Server-side service_role access is intentionally preserved.
-- Reintroduce narrowly scoped tenant policies only after backend identity and
-- organization-membership authorization are implemented and tested.

DROP POLICY IF EXISTS "Permitir gravação de homologações da organização"
  ON public.agency_agent_homologations;
DROP POLICY IF EXISTS "Permitir leitura de homologações da organização"
  ON public.agency_agent_homologations;

DROP POLICY IF EXISTS "Permitir gravação de perfis da organização"
  ON public.agency_agent_profiles;
DROP POLICY IF EXISTS "Permitir leitura de perfis da organização"
  ON public.agency_agent_profiles;

DROP POLICY IF EXISTS "Permitir gravação de seleções da organização"
  ON public.agency_agent_selections;
DROP POLICY IF EXISTS "Permitir leitura de seleções da organização"
  ON public.agency_agent_selections;

REVOKE ALL PRIVILEGES ON TABLE
  public.agency_agent_homologations,
  public.agency_agent_profiles,
  public.agency_agent_selections
FROM anon, authenticated, PUBLIC;
