CREATE TABLE IF NOT EXISTS public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_role text NOT NULL CHECK (app_role IN (
    'direcao_executiva',
    'gestor',
    'financeiro',
    'comercial',
    'operacoes',
    'desenvolvimento',
    'ia',
    'rh',
    'auditoria',
    'operacional'
  )),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_memberships_company_user_unique UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_memberships_user_status
  ON public.company_memberships (user_id, status);

CREATE INDEX IF NOT EXISTS idx_company_memberships_company_status
  ON public.company_memberships (company_id, status);

ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.company_memberships FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.company_memberships TO authenticated;

CREATE POLICY company_memberships_select_self
  ON public.company_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.company_memberships IS
  'Vínculo de identidade humana autenticada com organização e papel de aplicação NettosCorp. Alterações administrativas somente pelo backend autorizado.';
