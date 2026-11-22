-- Migration: 0000_initial_schema
-- Creates all base tables for NettosCorp Enterprise

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    tier VARCHAR(50) NOT NULL DEFAULT 'Mid-Market',
    status VARCHAR(50) NOT NULL DEFAULT 'prospect',
    primary_contact VARCHAR(255),
    contact_email VARCHAR(255),
    mrr NUMERIC(12, 2) DEFAULT 0,
    health_score VARCHAR(20) DEFAULT 'estável',
    owner_id UUID,
    last_interaction TIMESTAMP WITH TIME ZONE,
    origin VARCHAR(50) NOT NULL DEFAULT 'real_local',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX companies_slug_idx ON companies(slug);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role_title VARCHAR(255),
    department VARCHAR(255),
    department_id UUID,
    position_id UUID,
    manager_id UUID,
    avatar_url VARCHAR(500),
    capacity_percent INTEGER NOT NULL DEFAULT 100,
    access_role VARCHAR(50) NOT NULL DEFAULT 'operacional',
    authority_level VARCHAR(50) NOT NULL DEFAULT 'operacional',
    competencies JSONB DEFAULT '[]' NOT NULL,
    assigned_project_ids JSONB DEFAULT '[]' NOT NULL,
    origin VARCHAR(50) NOT NULL DEFAULT 'real_local',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX users_email_idx ON users(email);

-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL,
    authority_level VARCHAR(50) NOT NULL,
    description TEXT,
    allowed_modules JSONB DEFAULT '[]' NOT NULL,
    can_approve_governance BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_finance BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit_projects BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_org BOOLEAN NOT NULL DEFAULT FALSE,
    can_homologate_agents BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_runtime BOOLEAN NOT NULL DEFAULT FALSE,
    can_orchestrate_inter_agent BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_admin BOOLEAN NOT NULL DEFAULT FALSE,
    origin VARCHAR(50) NOT NULL DEFAULT 'real_local',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX roles_code_idx ON roles(code);

-- Memberships
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'invited',
    role_id UUID REFERENCES roles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX memberships_user_company_idx ON memberships(user_id, company_id);

-- Agents
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL,
    blueprint_code VARCHAR(100) NOT NULL,
    instance_name VARCHAR(255) NOT NULL,
    division VARCHAR(100) NOT NULL,
    position_id UUID,
    department_id UUID,
    project_id UUID NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    runtime_engine VARCHAR(100) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(255) NOT NULL,
    adapter VARCHAR(100) NOT NULL,
    tools JSONB DEFAULT '[]' NOT NULL,
    permissions JSONB DEFAULT '[]' NOT NULL,
    credential_ref VARCHAR(255) NOT NULL,
    env_ref_keys JSONB DEFAULT '[]' NOT NULL,
    max_executions_per_day INTEGER NOT NULL,
    monthly_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
    spent_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
    heartbeat_interval_sec INTEGER NOT NULL,
    execution_state VARCHAR(50) NOT NULL DEFAULT 'aguardando_paperclip',
    assigned_tasks_count INTEGER NOT NULL DEFAULT 0,
    guardrail_policy TEXT NOT NULL,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    origin VARCHAR(50) NOT NULL DEFAULT 'real_local',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX agents_project_idx ON agents(project_id);
CREATE INDEX agents_blueprint_idx ON agents(blueprint_id);

-- Skills
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    division VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    competencies JSONB DEFAULT '[]' NOT NULL,
    knowledge_areas JSONB DEFAULT '[]' NOT NULL,
    homologation_status VARCHAR(50) NOT NULL DEFAULT 'catalogo',
    paperclip_compatible BOOLEAN NOT NULL DEFAULT FALSE,
    source_catalog VARCHAR(100) NOT NULL DEFAULT 'Agency Agents (Acervo 283)',
    origin VARCHAR(50) NOT NULL DEFAULT 'real_local',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX skills_code_idx ON skills(code);
CREATE INDEX skills_division_idx ON skills(division);

-- Positions
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    department_id UUID NOT NULL,
    reports_to_position_id UUID,
    authority_level VARCHAR(50) NOT NULL,
    holder_type VARCHAR(50) NOT NULL,
    holder_id UUID,
    budget_limit_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
    responsibilities JSONB DEFAULT '[]' NOT NULL,
    project_ids JSONB DEFAULT '[]' NOT NULL,
    operational_state VARCHAR(50) NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX positions_dept_idx ON positions(department_id);
CREATE INDEX positions_holder_idx ON positions(holder_id);

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    head_position_id UUID,
    budget_allocated_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
    linked_channel_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX departments_code_idx ON departments(code);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    objective TEXT NOT NULL,
    description TEXT NOT NULL,
    area VARCHAR(255) NOT NULL,
    lead_id UUID NOT NULL REFERENCES users(id),
    lead_name VARCHAR(255) NOT NULL,
    budget_brl NUMERIC(12, 2),
    spent_brl NUMERIC(12, 2),
    human_team_ids JSONB DEFAULT '[]' NOT NULL,
    selected_agent_ids JSONB DEFAULT '[]' NOT NULL,
    operational_instance_ids JSONB DEFAULT '[]' NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'planejamento',
    priority VARCHAR(20) NOT NULL DEFAULT 'média',
    deadline TIMESTAMP WITH TIME ZONE,
    progress INTEGER NOT NULL DEFAULT 0,
    repo_slug VARCHAR(255),
    architecture_summary TEXT,
    requirements JSONB DEFAULT '[]' NOT NULL,
    linked_account_id UUID REFERENCES companies(id),
    linked_contract_id UUID,
    linked_product_id UUID,
    linked_conversation_id UUID,
    origin VARCHAR(50) NOT NULL DEFAULT 'real_local',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX projects_code_idx ON projects(code);
CREATE INDEX projects_lead_idx ON projects(lead_id);

-- Project Tasks
CREATE TABLE project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_id UUID,
    assignee_name VARCHAR(255) NOT NULL,
    assignee_kind VARCHAR(50) NOT NULL,
    delegated_by UUID REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'planejada',
    due_date TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(20) NOT NULL DEFAULT 'média',
    completion_criteria TEXT NOT NULL,
    completion_evidence TEXT,
    subtasks JSONB DEFAULT '[]' NOT NULL,
    source_conversation_id UUID,
    source_message_id UUID,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX project_tasks_project_idx ON project_tasks(project_id);
CREATE INDEX project_tasks_status_idx ON project_tasks(status);

-- Governance Records
CREATE TABLE governance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pendente',
    author_name VARCHAR(255) NOT NULL,
    authority_role VARCHAR(255) NOT NULL,
    linked_project_id UUID REFERENCES projects(id),
    linked_conversation_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    audit_hash VARCHAR(512) NOT NULL
);

CREATE INDEX governance_code_idx ON governance_records(code);

-- A-03: Habilitar Row Level Security em todas as tabelas base.
-- Sem políticas, RLS nega todo acesso (padrão seguro).
-- Políticas abaixo isolam por empresa via memberships (auth.uid() -> user_id -> company_id).

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_records ENABLE ROW LEVEL SECURITY;

-- Helper: empresa do usuário autenticado (via memberships ativas)
CREATE OR REPLACE FUNCTION app_current_company_id() RETURNS uuid AS $$
  SELECT m.company_id
  FROM memberships m
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- companies: usuário vê apenas empresas onde é membro
CREATE POLICY companies_member_view ON companies
  FOR SELECT USING (id = app_current_company_id());
CREATE POLICY companies_member_write ON companies
  FOR ALL USING (id = app_current_company_id());

-- users: usuário vê/edita apenas seu próprio registro
CREATE POLICY users_own_view ON users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY users_own_write ON users
  FOR UPDATE USING (id = auth.uid());

-- roles: leitura pública de roles (metadados), escrita restrita
CREATE POLICY roles_view ON roles FOR SELECT USING (true);

-- memberships: usuário vê apenas suas próprias memberships
CREATE POLICY memberships_own_view ON memberships
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY memberships_own_write ON memberships
  FOR ALL USING (user_id = auth.uid());

-- agents: isolamento por empresa do usuário
CREATE POLICY agents_company_isolation ON agents
  FOR ALL USING (company_id = app_current_company_id());

-- skills: leitura pública do catálogo
CREATE POLICY skills_view ON skills FOR SELECT USING (true);

-- positions: isolamento por empresa
CREATE POLICY positions_company_isolation ON positions
  FOR ALL USING (company_id = app_current_company_id());

-- departments: isolamento por empresa
CREATE POLICY departments_company_isolation ON departments
  FOR ALL USING (company_id = app_current_company_id());

-- projects: isolamento por empresa (via linked_account_id ou lead)
CREATE POLICY projects_company_isolation ON projects
  FOR ALL USING (
    linked_account_id = app_current_company_id()
    OR lead_id = auth.uid()
  );

-- project_tasks: isolamento via projeto
CREATE POLICY project_tasks_company_isolation ON project_tasks
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.linked_account_id = app_current_company_id()
         OR p.lead_id = auth.uid()
    )
  );

-- governance_records: isolamento por empresa
CREATE POLICY governance_company_isolation ON governance_records
  FOR ALL USING (
    linked_project_id IN (
      SELECT p.id FROM projects p
      WHERE p.linked_account_id = app_current_company_id()
         OR p.lead_id = auth.uid()
    )
  );