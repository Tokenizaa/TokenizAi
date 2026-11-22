-- Migration: 0001_seed_initial_data
-- Dados iniciais para a empresa NettosCorp Enterprise no Supabase
-- Execute após a migration 0000_initial_schema
-- Pré-requisito: variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY configuradas

-- ============================================================================
-- 1. EMPRESA PRINCIPAL (NettosCorp)
-- ============================================================================
INSERT INTO companies (id, name, slug, tier, status, primary_contact, contact_email, mrr, health_score, owner_id, origin)
VALUES (
    gen_random_uuid(),
    'NettosCorp Enterprise',
    'nettoscorp',
    'Enterprise',
    'active',
    'Netto Farias',
    'netto@nettoscorp.example.br',
    0.00,
    'estável',
    gen_random_uuid(), -- placeholder; será atualizado após criar o usuário admin
    'real_local'
) RETURNING id INTO TEMP temp_company_id;

-- ============================================================================
-- 2. ROLES (papéis do sistema)
-- ============================================================================
INSERT INTO roles (id, code, label, authority_level, description, allowed_modules, can_approve_governance, can_manage_finance, can_edit_projects, can_manage_org, can_homologate_agents, can_manage_runtime, can_orchestrate_inter_agent, can_manage_admin, origin)
VALUES
    (gen_random_uuid(), 'direcao_executiva', 'Direção Executiva', 'executiva_humana', 'Máxima autoridade da empresa. Aprova governança, finanças, projetos e administração.', '["executive","chat","finance","commercial","customers","marketing","products","projects","software-factory","intelligence-factory","operations","agency-library","team-composer","operational-agents","people","governance","admin"]', true, true, true, true, true, true, true, true, 'real_local'),
    (gen_random_uuid(), 'gestor', 'Gestor', 'gerencial', 'Gestão de área. Aprova projetos e finanças dentro do departamento.', '["executive","chat","finance","commercial","customers","marketing","products","projects","operations","team-composer","operational-agents","people","governance"]', false, true, true, false, false, true, false, false, 'real_local'),
    (gen_random_uuid(), 'financeiro', 'Financeiro', 'gerencial', 'Controladoria e FP&A. Gestão financeira completa.', '["executive","chat","finance","commercial","products","projects","operations","people"]', false, true, false, false, false, false, false, false, 'real_local'),
    (gen_random_uuid(), 'comercial', 'Comercial', 'operacional', 'Gestão de pipeline e oportunidades.', '["executive","chat","commercial","customers","marketing","products","projects"]', false, false, false, false, false, false, false, false, 'real_local'),
    (gen_random_uuid(), 'operacoes', 'Operações', 'operacional', 'Operações e entrega. Gestão de tarefas e execuções.', '["executive","chat","operations","team-composer","operational-agents","projects","people"]', false, false, true, false, false, true, false, false, 'real_local'),
    (gen_random_uuid(), 'desenvolvimento', 'Desenvolvimento', 'tecnica', 'Engenharia de software. Gestão de repositórios e deploys.', '["executive","chat","software-factory","projects","operations","team-composer","operational-agents"]', false, false, true, false, false, true, false, false, 'real_local'),
    (gen_random_uuid(), 'ia', 'IA', 'estrategica_delegada', 'Inteligência artificial. Deploy de modelos e soluções de IA.', '["executive","chat","intelligence-factory","projects","operations","operational-agents"]', false, false, false, false, false, true, false, false, 'real_local'),
    (gen_random_uuid(), 'rh', 'RH', 'gerencial', 'Gestão de pessoas e capacidade.', '["executive","chat","people","projects","operations"]', false, false, false, false, false, false, false, false, 'real_local'),
    (gen_random_uuid(), 'auditoria', 'Auditoria', 'executiva_humana', 'Auditoria e compliance. Visualização de governança.', '["executive","chat","governance","audit-trail","projects"]', false, false, false, false, false, false, false, false, 'real_local'),
    (gen_random_uuid(), 'operacional', 'Operacional', 'operacional', 'Papel base. Acesso a chat e execução.', '["executive","chat","projects","team-composer","operational-agents"]', false, false, false, false, false, false, false, false, 'real_local')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. DEPARTAMENTOS
-- ============================================================================
INSERT INTO departments (id, code, name, description, budget_allocated_brl, linked_channel_id)
VALUES
    (gen_random_uuid(), 'direcao_executiva', 'Direção Executiva', 'Liderança estratégica e governança da empresa.', 50000.00, NULL),
    (gen_random_uuid(), 'engenharia_software', 'Engenharia de Software', 'Desenvolvimento de software e arquitetura de sistemas.', 30000.00, NULL),
    (gen_random_uuid(), 'design_ux', 'Design & Experiência UX', 'Design de interfaces e experiência do usuário.', 15000.00, NULL),
    (gen_random_uuid(), 'gestao_produto', 'Gestão de Produto', 'Gestão de produto e roadmap.', 20000.00, NULL),
    (gen_random_uuid(), 'escritorio_projetos', 'Escritório de Projetos', 'Gestão de projetos e entrega.', 15000.00, NULL),
    (gen_random_uuid(), 'operacoes', 'Operações', 'Operações e confiabilidade de serviços.', 20000.00, NULL),
    (gen_random_uuid(), 'seguranca_appsec', 'Segurança & AppSec', 'Segurança da informação e aplicação.', 15000.00, NULL),
    (gen_random_uuid(), 'financeiro_controladoria', 'Finanças & Controladoria', 'Análise financeira e controladoria.', 25000.00, NULL),
    (gen_random_uuid(), 'comercial_revenue_ops', 'Comercial & Revenue Ops', 'Gestão comercial e revenue operations.', 20000.00, NULL),
    (gen_random_uuid(), 'marketing', 'Marketing', 'Marketing e comunicação.', 15000.00, NULL),
    (gen_random_uuid(), 'pesquisa_ia_ml', 'Pesquisa & IA/ML', 'Pesquisa aplicada e IA/ML.', 20000.00, NULL),
    (gen_random_uuid(), 'saude', 'Saúde & Ciências da Vida', 'Soluções para o setor de saúde.', 10000.00, NULL),
    (gen_random_uuid(), 'geo_dados_espaciais', 'Geo & Dados Espaciais', 'Sistemas de informação geográfica.', 10000.00, NULL),
    (gen_random_uuid(), 'desenvolvimento_jogos', 'Desenvolvimento de Jogos', 'Desenvolvimento de jogos.', 10000.00, NULL),
    (gen_random_uuid(), 'suporte_cliente', 'Suporte ao Cliente', 'Suporte e atendimento ao cliente.', 10000.00, NULL),
    (gen_random_uuid(), 'qualidade_automacao', 'Qualidade & Automação QA', 'Qualidade de software e automação de testes.', 15000.00, NULL),
    (gen_random_uuid(), 'dados_analytics', 'Dados & Analytics', 'Engenharia de dados e analytics.', 15000.00, NULL),
    (gen_random_uuid(), 'infraestrutura_sre', 'Infraestrutura & SRE', 'DevOps e confiabilidade de infraestrutura.', 20000.00, NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3b. SKILLS (catálogo de habilidades da Agency Agents)
-- ============================================================================
INSERT INTO skills (id, code, name, division, description, competencies, knowledge_areas, homologation_status, paperclip_compatible, source_catalog, origin)
VALUES
    (gen_random_uuid(), 'engineering-senior-developer', 'Senior Software Developer', 'engineering', 'Engenheiro sênior com foco em sistemas escaláveis.', '["TypeScript", "Node.js", "React", "System Design"]', '["TypeScript", "Node.js", "Arquitetura de Software"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'engineering-frontend-developer', 'Frontend Developer', 'engineering', 'Desenvolvedor frontend especializado em React/Vue/Angular.', '["React", "TypeScript", "Tailwind CSS", "UI Implementation"]', '["TypeScript", "React", "UI Components"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'design-product-designer', 'Product Designer', 'design', 'Designer de produto com foco em UX/UI.', '["Figma", "Design System", "User Research"]', '["UI/UX", "Figma", "Design System"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'product-product-manager', 'Product Manager', 'product', 'Gerente de produto com foco em roadmap e métricas.', '["Product Discovery", "Roadmap", "Metrics"]', '["Product Discovery", "Roadmap", "Métricas de Produto"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'operations-sre-engineer', 'Site Reliability Engineer', 'operations', 'Engenheiro de confiabilidade de sites.', '["Kubernetes", "AWS", "Monitoring", "Incident Response"]', '["SRE", "Operações", "Gerenciamento de Incidentes"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'security-appsec-engineer', 'Application Security Engineer', 'security', 'Especialista em segurança de aplicações.', '["OWASP", "SAST", "DAST", "Threat Modeling"]', '["AppSec", "Segurança da Informação", "LGPD"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'finance-financial-analyst', 'Financial Analyst', 'finance', 'Analista financeiro com foco em controladoria.', '["Excel", "SQL", "Cash Flow", "Budgeting"]', '["Controladoria", "Fluxo de Caixa", "Orçamento"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'commercial-sales-manager', 'Sales Manager', 'commercial', 'Gestor comercial com foco em pipeline B2B.', '["CRM", "Negotiation", "Pipeline Management"]', '["Vendas B2B", "Funil Comercial", "CRM"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'marketing-content-analyst', 'Content Marketing Analyst', 'marketing', 'Analista de marketing de conteúdo.', '["SEO", "Copywriting", "Content Strategy"]', '["Marketing de Conteúdo", "Inbound", "Branding"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'research-ai-researcher', 'AI Researcher', 'research', 'Cientista de pesquisa em IA/ML.', '["Python", "PyTorch", "LLMs", "Experiments"]', '["Pesquisa Científica", "IA/ML", "Experimentos"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'support-customer-support', 'Customer Support Agent', 'support', 'Agente de suporte ao cliente.', '["Zendesk", "Communication", "Technical Support"]', '["Atendimento ao Cliente", "Sucesso do Cliente", "Suporte Técnico"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local'),
    (gen_random_uuid(), 'testing-qa-engineer', 'QA Engineer', 'testing', 'Engenheiro de qualidade com foco em automação.', '["Playwright", "Cypress", "Test Automation"]', '["QA", "Automação de Testes", "Playwright"]', 'aprovado', true, 'Agency Agents (Acervo 283)', 'real_local')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 4. ATUALIZAR owner_id DA EMPRESA (após criar o primeiro usuário admin)
-- ============================================================================
-- Isso será feito após o cadastro do primeiro usuário via /api/auth/register
-- ou pode ser atualizado manualmente com o ID do usuário admin.

-- ============================================================================
-- 5. COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================================
COMMENT ON TABLE companies IS 'Empresas/tenants do sistema NettosCorp Enterprise';
COMMENT ON TABLE users 'Usuários do sistema (autenticados via Supabase Auth)';
COMMENT ON TABLE roles 'Papéis de autorização (RBAC)';
COMMENT ON TABLE memberships 'Vínculos usuário-empresa (multi-tenancy)';
COMMENT ON TABLE agents 'Agentes operacionais contratados via Paperclip';
COMMENT ON TABLE skills 'Catálogo de habilidades da Agency Agents';
COMMENT ON TABLE positions 'Posições organizacionais (organograma)';
COMMENT ON TABLE departments 'Departamentos da empresa';
COMMENT ON TABLE projects 'Projetos empresariais';
COMMENT ON TABLE project_tasks 'Tarefas de projetos';
COMMENT ON TABLE governance_records 'Registros de governança e auditoria';
