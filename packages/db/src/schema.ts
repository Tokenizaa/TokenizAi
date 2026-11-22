import { pgTable, uuid, text, varchar, timestamp, integer, boolean, jsonb, numeric, serial, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Empresas / contas organizacionais
 */
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    tier: varchar('tier', { length: 50 }).notNull().default('Mid-Market'), // Enterprise | Mid-Market | Strategic
    status: varchar('status', { length: 50 }).notNull().default('prospect'), // ativo | onboarding | prospect
    primaryContact: varchar('primary_contact', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    mrr: numeric('mrr', { precision: 12, scale: 2 }).default('0'),
    healthScore: varchar('health_score', { length: 20 }).default('estável'), // estável | atenção | crítico
    ownerId: uuid('owner_id'),
    lastInteraction: timestamp('last_interaction'),
    origin: varchar('origin', { length: 50 }).notNull().default('real_local'), // demonstrativo | integrado | calculado | real_local
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index('companies_slug_idx').on(table.slug),
  }),
);

/**
 * Pessoas / usuários do sistema
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    roleTitle: varchar('role_title', { length: 255 }),
    department: varchar('department', { length: 255 }),
    departmentId: uuid('department_id'),
    positionId: uuid('position_id'),
    managerId: uuid('manager_id'),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    capacityPercent: integer('capacity_percent').notNull().default(100),
    accessRole: varchar('access_role', { length: 50 }).notNull().default('operacional'), // UserRole
    authorityLevel: varchar('authority_level', { length: 50 }).notNull().default('operacional'), // AuthorityLevel
    competencies: jsonb('competencies').default([]).notNull(), // string[]
    assignedProjectIds: jsonb('assigned_project_ids').default([]).notNull(), // uuid[]
    origin: varchar('origin', { length: 50 }).notNull().default('real_local'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
  }),
);

/**
 * Papéis organizacionais (RBAC base)
 */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(), // direcao_executiva | gestor | financeiro | ...
    label: varchar('label', { length: 255 }).notNull(),
    authorityLevel: varchar('authority_level', { length: 50 }).notNull(), // AuthorityLevel
    description: text('description'),
    allowedModules: jsonb('allowed_modules').default([]).notNull(), // ModuleId[]
    canApproveGovernance: boolean('can_approve_governance').notNull().default(false),
    canManageFinance: boolean('can_manage_finance').notNull().default(false),
    canEditProjects: boolean('can_edit_projects').notNull().default(false),
    canManageOrg: boolean('can_manage_org').notNull().default(false),
    canHomologateAgents: boolean('can_homologate_agents').notNull().default(false),
    canManageRuntime: boolean('can_manage_runtime').notNull().default(false),
    canOrchestrateInterAgent: boolean('can_orchestrate_inter_agent').notNull().default(false),
    canManageAdmin: boolean('can_manage_admin').notNull().default(false),
    origin: varchar('origin', { length: 50 }).notNull().default('real_local'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index('roles_code_idx').on(table.code),
  }),
);

/**
 * Vínculos organizacional usuário ↔ empresa
 */
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull().default('invited'), // invited | active | suspended
    roleId: uuid('role_id').references(() => roles.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userCompanyIdx: index('memberships_user_company_idx').on(table.userId, table.companyId),
  }),
);

/**
 * Agentes operacionais (instâncias runtime)
 */
export const agents = pgTable(
  'agents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    blueprintId: uuid('blueprint_id').notNull(),
    blueprintCode: varchar('blueprint_code', { length: 100 }).notNull(),
    instanceName: varchar('instance_name', { length: 255 }).notNull(),
    division: varchar('division', { length: 100 }).notNull(), // AgentDivision
    positionId: uuid('position_id'),
    departmentId: uuid('department_id'),
    projectId: uuid('project_id').notNull(),
    projectName: varchar('project_name', { length: 255 }).notNull(),
    runtimeEngine: varchar('runtime_engine', { length: 100 }).notNull(), // Paperclip Runtime | TokenizAi Native Orchestrator
    provider: varchar('provider', { length: 100 }).notNull(), // Google Gemini | Paperclip External | OpenAI | Anthropic
    model: varchar('model', { length: 255 }).notNull(),
    adapter: varchar('adapter', { length: 100 }).notNull(), // gemini-server-native | paperclip-http-adapter
    tools: jsonb('tools').default([]).notNull(), // string[]
    permissions: jsonb('permissions').default([]).notNull(), // string[]
    credentialRef: varchar('credential_ref', { length: 255 }).notNull(),
    envRefKeys: jsonb('env_ref_keys').default([]).notNull(), // string[]
    maxExecutionsPerDay: integer('max_executions_per_day').notNull(),
    monthlyBudgetBRL: numeric('monthly_brl', { precision: 12, scale: 2 }).notNull().default('0'),
    spentBudgetBRL: numeric('spent_brl', { precision: 12, scale: 2 }).notNull().default('0'),
    heartbeatIntervalSec: integer('heartbeat_interval_sec').notNull(),
    executionState: varchar('execution_state', { length: 50 }).notNull().default('aguardando_paperclip'),
    assignedTasksCount: integer('assigned_tasks_count').notNull().default(0),
    guardrailPolicy: text('guardrail_policy').notNull(),
    lastHeartbeat: timestamp('last_heartbeat'),
    origin: varchar('origin', { length: 50 }).notNull().default('real_local'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('agents_project_idx').on(table.projectId),
    blueprintIdx: index('agents_blueprint_idx').on(table.blueprintId),
  }),
);

/**
 * Habilidades / competências do catálogo Agency Agents
 */
export const skills = pgTable(
  'skills',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 100 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    division: varchar('division', { length: 100 }).notNull(), // AgentDivision
    description: text('description').notNull(),
    competencies: jsonb('competencies').default([]).notNull(), // string[]
    knowledgeAreas: jsonb('knowledge_areas').default([]).notNull(), // string[]
    homologationStatus: varchar('homologation_status', { length: 50 }).notNull().default('catalogo'), // homologado | em_avaliacao | catalogo
    paperclipCompatible: boolean('paperclip_compatible').notNull().default(false),
    sourceCatalog: varchar('source_catalog', { length: 100 }).notNull().default('Agency Agents (Acervo 283)'),
    origin: varchar('origin', { length: 50 }).notNull().default('real_local'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index('skills_code_idx').on(table.code),
    divisionIdx: index('skills_division_idx').on(table.division),
  }),
);

/**
 * Posições organizacionais (Paperclip / NettosCorp Org)
 */
export const positions = pgTable(
  'positions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    departmentId: uuid('department_id').notNull(),
    reportsToPositionId: uuid('reports_to_position_id'),
    authorityLevel: varchar('authority_level', { length: 50 }).notNull(), // AuthorityLevel
    holderType: varchar('holder_type', { length: 50 }).notNull(), // humano | agente_operacional | vago
    holderId: uuid('holder_id'), // users.id or agents.id
    budgetLimitBRL: numeric('budget_limit_brl', { precision: 12, scale: 2 }).notNull().default('0'),
    responsibilities: jsonb('responsibilities').default([]).notNull(), // string[]
    projectIds: jsonb('project_ids').default([]).notNull(), // uuid[]
    operationalState: varchar('operational_state', { length: 50 }).notNull().default('ativo'), // ativo | vago | pausado
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    deptIdx: index('positions_dept_idx').on(table.departmentId),
    holderIdx: index('positions_holder_idx').on(table.holderId),
  }),
);

/**
 * Departamentos
 */
export const departments = pgTable(
  'departments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    headPositionId: uuid('head_position_id'),
    budgetAllocatedBRL: numeric('budget_allocated_brl', { precision: 12, scale: 2 }).notNull().default('0'),
    linkedChannelId: uuid('linked_channel_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index('departments_code_idx').on(table.code),
  }),
);

/**
 * Projetos
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    objective: text('objective').notNull(),
    description: text('description').notNull(),
    area: varchar('area', { length: 255 }).notNull(),
    leadId: uuid('lead_id').notNull().references(() => users.id),
    leadName: varchar('lead_name', { length: 255 }).notNull(),
    budgetBRL: numeric('budget_brl', { precision: 12, scale: 2 }),
    spentBRL: numeric('spent_brl', { precision: 12, scale: 2 }),
    humanTeamIds: jsonb('human_team_ids').default([]).notNull(), // uuid[]
    selectedAgentIds: jsonb('selected_agent_ids').default([]).notNull(), // uuid[]
    operationalInstanceIds: jsonb('operational_instance_ids').default([]).notNull(), // uuid[]
    status: varchar('status', { length: 50 }).notNull().default('planejamento'), // planejamento | em_execucao | atencao | concluido
    priority: varchar('priority', { length: 20 }).notNull().default('média'), // crítica | alta | média | baixa
    deadline: timestamp('deadline'),
    progress: integer('progress').notNull().default(0),
    repoSlug: varchar('repo_slug', { length: 255 }),
    architectureSummary: text('architecture_summary'),
    requirements: jsonb('requirements').default([]).notNull(), // string[]
    linkedAccountId: uuid('linked_account_id').references(() => companies.id),
    linkedContractId: uuid('linked_contract_id'),
    linkedProductId: uuid('linked_product_id'),
    linkedConversationId: uuid('linked_conversation_id'),
    origin: varchar('origin', { length: 50 }).notNull().default('real_local'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index('projects_code_idx').on(table.code),
    leadIdx: index('projects_lead_idx').on(table.leadId),
  }),
);

/**
 * Tarefas de projeto
 */
export const projectTasks = pgTable(
  'project_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    assigneeId: uuid('assignee_id'),
    assigneeName: varchar('assignee_name', { length: 255 }).notNull(),
    assigneeKind: varchar('assignee_kind', { length: 50 }).notNull(), // humano | agente_operacional
    delegatedBy: uuid('delegated_by').references(() => users.id),
    status: varchar('status', { length: 50 }).notNull().default('planejada'), // planejada | atribuida | em_execucao | bloqueada | em_revisao | concluida | cancelada
    dueDate: timestamp('due_date'),
    priority: varchar('priority', { length: 20 }).notNull().default('média'),
    completionCriteria: text('completion_criteria').notNull(),
    completionEvidence: text('completion_evidence'),
    subtasks: jsonb('subtasks').default([]).notNull(), // { id, title, done }[]
    sourceConversationId: uuid('source_conversation_id'),
    sourceMessageId: uuid('source_message_id'),
    commentsCount: integer('comments_count').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('project_tasks_project_idx').on(table.projectId),
    statusIdx: index('project_tasks_status_idx').on(table.status),
  }),
);

/**
 * Registros de governança (DEC/CNS/DELIB/AUDIT)
 */
export const governanceRecords = pgTable(
  'governance_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 100 }).notNull().unique(),
    type: varchar('type', { length: 20 }).notNull(), // DEC | CNS | DELIB | AUDIT
    title: varchar('title', { length: 255 }).notNull(),
    summary: text('summary').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pendente'), // aprovado | em_deliberacao | pendente
    authorName: varchar('author_name', { length: 255 }).notNull(),
    authorityRole: varchar('authority_role', { length: 255 }).notNull(),
    linkedProjectId: uuid('linked_project_id').references(() => projects.id),
    linkedConversationId: uuid('linked_conversation_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    auditHash: varchar('audit_hash', { length: 512 }).notNull(),
  },
  (table) => ({
    codeIdx: index('governance_code_idx').on(table.code),
  }),
);

/**
 * Zod schemas derivados do Drizzle (para validação de entrada/saída)
 */
export const insertCompanySchema = createInsertSchema(companies);
export const selectCompanySchema = createSelectSchema(companies);

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertRoleSchema = createInsertSchema(roles);
export const selectRoleSchema = createSelectSchema(roles);

export const insertMembershipSchema = createInsertSchema(memberships);
export const selectMembershipSchema = createSelectSchema(memberships);

export const insertAgentSchema = createInsertSchema(agents);
export const selectAgentSchema = createSelectSchema(agents);

export const insertSkillSchema = createInsertSchema(skills);
export const selectSkillSchema = createSelectSchema(skills);

export const insertPositionSchema = createInsertSchema(positions);
export const selectPositionSchema = createSelectSchema(positions);

export const insertDepartmentSchema = createInsertSchema(departments);
export const selectDepartmentSchema = createSelectSchema(departments);

export const insertProjectSchema = createInsertSchema(projects);
export const selectProjectSchema = createSelectSchema(projects);

export const insertProjectTaskSchema = createInsertSchema(projectTasks);
export const selectProjectTaskSchema = createSelectSchema(projectTasks);

export const insertGovernanceRecordSchema = createInsertSchema(governanceRecords);
export const selectGovernanceRecordSchema = createSelectSchema(governanceRecords);

/**
 * Tipos re-exportados para consumo externo
 */
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type NewProjectTask = typeof projectTasks.$inferInsert;
export type GovernanceRecord = typeof governanceRecords.$inferSelect;
export type NewGovernanceRecord = typeof governanceRecords.$inferInsert;

/**
 * Schemas de validação estendidos com Zod (refinamentos)
 */
export const companySchema = insertCompanySchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .refine((data) => Number(data.mrr ?? 0) >= 0, { message: 'MRR deve ser não negativo' });

export const userSchema = insertUserSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .refine((data) => (data.capacityPercent ?? 100) >= 0 && (data.capacityPercent ?? 100) <= 100, {
    message: 'Capacidade deve estar entre 0 e 100',
  });

export const roleSchema = insertRoleSchema
  .omit({ id: true, createdAt: true })
  .refine((data) => Array.isArray(data.allowedModules) && data.allowedModules.length > 0, {
    message: 'Pelo menos um módulo permitido é obrigatório',
  });

export const membershipSchema = insertMembershipSchema
  .omit({ id: true, createdAt: true, updatedAt: true });

export const agentSchema = insertAgentSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .refine((data) => Number(data.monthlyBudgetBRL ?? 0) >= 0, {
    message: 'Orçamento mensal deve ser não negativo',
  })
  .refine((data) => Number(data.spentBudgetBRL ?? 0) >= 0, {
    message: 'Orçamento gasto deve ser não negativo',
  });

export const skillSchema = insertSkillSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .refine((data) => Array.isArray(data.competencies) && data.competencies.length > 0, {
    message: 'Pelo menos uma competência é obrigatória',
  });

export const projectSchema = insertProjectSchema
  .omit({ id: true, updatedAt: true })
  .refine((data) => Array.isArray(data.requirements) && data.requirements.length > 0, {
    message: 'Pelo menos um requisito é obrigatório',
  });

export const projectTaskSchema = insertProjectTaskSchema
  .omit({ id: true, createdAt: true, updatedAt: true });

export const governanceRecordSchema = insertGovernanceRecordSchema
  .omit({ id: true, createdAt: true })
  .refine((data) => data.auditHash.length > 0, {
    message: 'Hash de auditoria é obrigatório',
  });
