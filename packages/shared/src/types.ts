import { z } from 'zod';

/**
 * UserRole — Papéis de aplicação no NettosCorp Enterprise
 * Mapeamento direto dos papéis definidos em permissions.ts
 */
export const UserRoleSchema = z.enum([
  'direcao_executiva',
  'gestor',
  'financeiro',
  'comercial',
  'operacoes',
  'desenvolvimento',
  'ia',
  'rh',
  'auditoria',
  'operacional',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * ModuleId — Identificadores de módulos da plataforma
 */
export const ModuleIdSchema = z.enum([
  'executive',
  'chat',
  'finance',
  'commercial',
  'customers',
  'marketing',
  'products',
  'projects',
  'software-factory',
  'intelligence-factory',
  'operations',
  'agency-library',
  'team-composer',
  'operational-agents',
  'people',
  'governance',
  'admin',
]);

export type ModuleId = z.infer<typeof ModuleIdSchema>;

/**
 * AuthorityLevel — Níveis de autoridade hierárquica
 */
export const AuthorityLevelSchema = z.enum([
  'executiva_humana',
  'estrategica_delegada',
  'gerencial',
  'operacional',
  'tecnica',
]);

export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>;

/**
 * DataOrigin — Classificação de origem dos dados
 */
export const DataOriginSchema = z.enum([
  'demonstrativo',
  'integrado',
  'calculado',
  'real_local',
]);

export type DataOrigin = z.infer<typeof DataOriginSchema>;

/**
 * AccentTheme — Temas de cor de destaque da UI
 */
export const AccentThemeSchema = z.enum([
  'amber',
  'cobalt',
  'emerald',
  'slate',
]);

export type AccentTheme = z.infer<typeof AccentThemeSchema>;

/**
 * AgentDivision — Divisões do catálogo Agency Agents
 */
export const AgentDivisionSchema = z.enum([
  'Engenharia de Software',
  'Inteligência Artificial & ML',
  'Arquitetura & Cloud',
  'Segurança & AppSec',
  'Dados & Engenharia Analítica',
  'Produto & Estratégia',
  'Design & Experiência UX',
  'Qualidade & Automação QA',
  'Operações & SRE',
  'Finanças & Controladoria',
  'Comercial & Revenue Ops',
  'Governança, Risco & Jurídico',
]);

export type AgentDivision = z.infer<typeof AgentDivisionSchema>;

/**
 * HomologationStatus — Status de homologação de perfis de agente
 */
export const HomologationStatusSchema = z.enum([
  'homologado',
  'em_avaliacao',
  'catalogo',
]);

export type HomologationStatus = z.infer<typeof HomologationStatusSchema>;

/**
 * GovernanceType — Tipos de registro de governança
 */
export const GovernanceTypeSchema = z.enum([
  'DEC',
  'CNS',
  'DELIB',
  'AUDIT',
]);

export type GovernanceType = z.infer<typeof GovernanceTypeSchema>;

/**
 * ConversationKind — Tipos de conversa no chat nativo
 */
export const ConversationKindSchema = z.enum([
  'direct_agent',
  'inter_agent',
  'department',
  'project',
  'committee',
]);

export type ConversationKind = z.infer<typeof ConversationKindSchema>;

/**
 * MessageLifecycleStatus — Ciclo de vida das mensagens de chat
 */
export const MessageLifecycleStatusSchema = z.enum([
  'created',
  'delivered',
  'execution_requested',
  'agent_processing',
  'response_received',
  'execution_completed',
  'execution_failed',
  'integration_pending',
]);

export type MessageLifecycleStatus = z.infer<typeof MessageLifecycleStatusSchema>;

/**
 * ProjectStatus — Status de projetos
 */
export const ProjectStatusSchema = z.enum([
  'planejamento',
  'em_execucao',
  'atencao',
  'concluido',
]);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

/**
 * ProjectPriority — Prioridades de projetos
 */
export const ProjectPrioritySchema = z.enum([
  'crítica',
  'alta',
  'média',
  'baixa',
]);

export type ProjectPriority = z.infer<typeof ProjectPrioritySchema>;

/**
 * TaskLifecycleStatus — Ciclo de vida de tarefas
 */
export const TaskLifecycleStatusSchema = z.enum([
  'planejada',
  'atribuida',
  'em_execucao',
  'bloqueada',
  'em_revisao',
  'concluida',
  'cancelada',
]);

export type TaskLifecycleStatus = z.infer<typeof TaskLifecycleStatusSchema>;

/**
 * MembershipStatus — Status de vínculo organizacional
 */
export const MembershipStatusSchema = z.enum([
  'invited',
  'active',
  'suspended',
]);

export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;

/**
 * AgentExecutionState — Estado de execução de instância de agente
 */
export const AgentExecutionStateSchema = z.enum([
  'ativo_pronto',
  'processando',
  'aguardando_aprovacao',
  'pausado',
  'aguardando_paperclip',
]);

export type AgentExecutionState = z.infer<typeof AgentExecutionStateSchema>;

/**
 * HolderType — Tipo de ocupante de posição organizacional
 */
export const HolderTypeSchema = z.enum([
  'humano',
  'agente_operacional',
  'vago',
]);

export type HolderType = z.infer<typeof HolderTypeSchema>;

/**
 * OperationalState — Estado operacional de posição
 */
export const OperationalStateSchema = z.enum([
  'ativo',
  'vago',
  'pausado',
]);

export type OperationalState = z.infer<typeof OperationalStateSchema>;

/**
 * FinancialEntryType — Tipo de lançamento financeiro
 */
export const FinancialEntryTypeSchema = z.enum([
  'receita',
  'despesa',
]);

export type FinancialEntryType = z.infer<typeof FinancialEntryTypeSchema>;

/**
 * FinancialEntryStatus — Status de lançamento financeiro
 */
export const FinancialEntryStatusSchema = z.enum([
  'pago',
  'previsto',
  'atrasado',
]);

export type FinancialEntryStatus = z.infer<typeof FinancialEntryStatusSchema>;

/**
 * ContractStatus — Status de contratos
 */
export const ContractStatusSchema = z.enum([
  'vigente',
  'em_renovacao',
  'assinatura_pendente',
]);

export type ContractStatus = z.infer<typeof ContractStatusSchema>;

/**
 * CampaignStatus — Status de campanhas de marketing
 */
export const CampaignStatusSchema = z.enum([
  'ativa',
  'planejada',
  'pausada',
]);

export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

/**
 * ProductLifecycle — Ciclo de vida de produtos/serviços
 */
export const ProductLifecycleSchema = z.enum([
  'publicado',
  'em_desenvolvimento',
  'estruturacao',
]);

export type ProductLifecycle = z.infer<typeof ProductLifecycleSchema>;

/**
 * CompanyTier — Níveis de conta de empresa
 */
export const CompanyTierSchema = z.enum([
  'Enterprise',
  'Mid-Market',
  'Strategic',
]);

export type CompanyTier = z.infer<typeof CompanyTierSchema>;

/**
 * CompanyAccountStatus — Status de conta de empresa
 */
export const CompanyAccountStatusSchema = z.enum([
  'ativo',
  'onboarding',
  'prospect',
]);

export type CompanyAccountStatus = z.infer<typeof CompanyAccountStatusSchema>;

/**
 * HealthScore — Score de saúde de conta
 */
export const HealthScoreSchema = z.enum([
  'estável',
  'atenção',
  'crítico',
]);

export type HealthScore = z.infer<typeof HealthScoreSchema>;

/**
 * OpportunityStage — Estágios de oportunidade comercial
 */
export const OpportunityStageSchema = z.enum([
  'prospeccao',
  'diagnostico',
  'proposta',
  'negociacao',
  'fechado',
]);

export type OpportunityStage = z.infer<typeof OpportunityStageSchema>;

/**
 * CampaignChannel — Canais de campanha de marketing
 */
export const CampaignChannelSchema = z.enum([
  'Inbound Orgânico',
  'LinkedIn B2B',
  'Eventos Executivos',
  'Outbound ABM',
  'Parcerias',
]);

export type CampaignChannel = z.infer<typeof CampaignChannelSchema>;

/**
 * ProductKind — Tipo de produto/serviço
 */
export const ProductKindSchema = z.enum([
  'Produto',
  'Serviço',
]);

export type ProductKind = z.infer<typeof ProductKindSchema>;

/**
 * IncidentSeverity — Severidade de incidentes técnicos
 */
export const IncidentSeveritySchema = z.enum([
  'sev1',
  'sev2',
  'sev3',
]);

export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

/**
 * IncidentStatus — Status de incidentes técnicos
 */
export const IncidentStatusSchema = z.enum([
  'aberto',
  'mitigado',
  'resolvido',
]);

export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

/**
 * AISolutionStatus — Status de homologação de solução de IA
 */
export const AISolutionStatusSchema = z.enum([
  'homologada',
  'em_avaliacao',
  'rascunho',
]);

export type AISolutionStatus = z.infer<typeof AISolutionStatusSchema>;

/**
 * Provider — Provedores de modelo de IA
 */
export const ProviderSchema = z.enum([
  'Google Gemini',
  'Paperclip External',
  'OpenAI',
  'Anthropic',
]);

export type Provider = z.infer<typeof ProviderSchema>;

/**
 * Adapter — Adaptadores de runtime
 */
export const AdapterSchema = z.enum([
  'gemini-server-native',
  'paperclip-http-adapter',
]);

export type Adapter = z.infer<typeof AdapterSchema>;

/**
 * RuntimeEngine — Engines de runtime
 */
export const RuntimeEngineSchema = z.enum([
  'Paperclip Runtime',
  'TokenizAi Native Orchestrator',
]);

export type RuntimeEngine = z.infer<typeof RuntimeEngineSchema>;

/**
 * ParticipantKind — Tipo de participante de chat
 */
export const ParticipantKindSchema = z.enum([
  'humano',
  'agente_operacional',
  'sistema',
]);

export type ParticipantKind = z.infer<typeof ParticipantKindSchema>;

/**
 * ContextRefKind — Tipos de referência de contexto de chat
 */
export const ContextRefKindSchema = z.enum([
  'project',
  'task',
  'department',
  'governance',
  'agent_profile',
]);

export type ContextRefKind = z.infer<typeof ContextRefKindSchema>;

/**
 * NotificationSeverity — Severidade de notificações
 */
export const NotificationSeveritySchema = z.enum([
  'info',
  'alerta',
  'critico',
]);

export type NotificationSeverity = z.infer<typeof NotificationSeveritySchema>;

/**
 * IntegrationCategory — Categorias de integração
 */
export const IntegrationCategorySchema = z.enum([
  'Persistência',
  'Código & CI/CD',
  'Runtime de Agentes',
  'Modelos de IA',
  'Financeiro & Fiscal',
  'Produtividade & Agenda',
]);

export type IntegrationCategory = z.infer<typeof IntegrationCategorySchema>;

/**
 * IntegrationStatus — Status de configuração de integração
 */
export const IntegrationStatusSchema = z.enum([
  'não configurado',
  'ativo',
  'parcial',
]);

export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

/**
 * CalendarCategory — Categorias de compromissos de calendário
 */
export const CalendarCategorySchema = z.enum([
  'Executivo',
  'Comercial',
  'Entrega',
  'Governança',
]);

export type CalendarCategory = z.infer<typeof CalendarCategorySchema>;

/**
 * SessionStatus — Status de sessão de execução de agente
 */
export const SessionStatusSchema = z.enum([
  'concluida',
  'falhou',
  'integracao_pendente',
]);

export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/**
 * Entity Interfaces
 */

export interface FinancialEntry {
  id: string;
  title: string;
  type: 'receita' | 'despesa';
  category: string;
  costCenter: string;
  amount: number;
  dueDate: string;
  status: 'pago' | 'previsto' | 'atrasado';
  reconciled: boolean;
  linkedContractId?: string;
  linkedProjectId?: string;
  linkedAgentInstanceId?: string;
  origin: DataOrigin;
}

export interface CostCenterBudget {
  id: string;
  name: string;
  department: string;
  allocated: number;
  spent: number;
  origin: DataOrigin;
}

export interface CompanyAccount {
  id: string;
  name: string;
  segment: string;
  tier: 'Enterprise' | 'Mid-Market' | 'Strategic';
  status: 'ativo' | 'onboarding' | 'prospect';
  primaryContact: string;
  contactEmail: string;
  mrr: number;
  healthScore: 'estável' | 'atenção' | 'crítico';
  ownerId: string;
  lastInteraction: string;
  origin: DataOrigin;
}

export interface CommercialOpportunity {
  id: string;
  title: string;
  accountId: string;
  accountName: string;
  stage: 'prospeccao' | 'diagnostico' | 'proposta' | 'negociacao' | 'fechado';
  value: number;
  probability: number;
  expectedClose: string;
  ownerId: string;
  linkedProductId?: string;
  linkedProjectId?: string;
  origin: DataOrigin;
}

export interface ContractItem {
  id: string;
  code: string;
  accountId: string;
  accountName: string;
  title: string;
  annualValue: number;
  startDate: string;
  endDate: string;
  status: 'vigente' | 'em_renovacao' | 'assinatura_pendente';
  linkedProjectId?: string;
  origin: DataOrigin;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  channel: 'Inbound Orgânico' | 'LinkedIn B2B' | 'Eventos Executivos' | 'Outbound ABM' | 'Parcerias';
  status: 'ativa' | 'planejada' | 'pausada';
  budget: number;
  spent: number;
  leadsGenerated: number;
  qualifiedSql: number;
  cacEstimate: number;
  origin: DataOrigin;
}

export interface ProductServiceItem {
  id: string;
  name: string;
  kind: 'Produto' | 'Serviço';
  lifecycle: 'publicado' | 'em_desenvolvimento' | 'estruturacao';
  ownerId: string;
  monthlyRevenue: number;
  operationalCost: number;
  activeClients: number;
  roadmapPhase: string;
  linkedProjectIds: string[];
  origin: DataOrigin;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  assigneeName: string;
  assigneeKind: 'humano' | 'agente_operacional';
  delegatedBy?: string;
  status: 'planejada' | 'atribuida' | 'em_execucao' | 'bloqueada' | 'em_revisao' | 'concluida' | 'cancelada';
  dueDate: string;
  priority: 'crítica' | 'alta' | 'média' | 'baixa';
  completionCriteria: string;
  completionEvidence?: string;
  subtasks?: Array<{ id: string; title: string; done: boolean }>;
  sourceConversationId?: string;
  sourceMessageId?: string;
  commentsCount?: number;
}

export interface NexusPhaseGate {
  id: string;
  phase: 'Discovery' | 'Architecture' | 'Execution' | 'Verification' | 'Release';
  gateCriteria: string;
  passed: boolean;
  verifiedBy?: string;
}

export interface EnterpriseProject {
  id: string;
  code: string;
  name: string;
  objective: string;
  description: string;
  area: string;
  leadId: string;
  leadName: string;
  budgetBRL?: number;
  spentBRL?: number;
  humanTeamIds: string[];
  selectedAgentIds: string[];
  operationalInstanceIds: string[];
  status: 'planejamento' | 'em_execucao' | 'atencao' | 'concluido';
  priority: 'crítica' | 'alta' | 'média' | 'baixa';
  deadline: string;
  progress: number;
  repoSlug?: string;
  architectureSummary?: string;
  requirements: string[];
  nexusGates?: NexusPhaseGate[];
  linkedAccountId?: string;
  linkedContractId?: string;
  linkedProductId?: string;
  linkedConversationId?: string;
  origin: DataOrigin;
  updatedAt: string;
}

export interface SoftwareRepo {
  id: string;
  slug: string;
  projectId: string;
  stack: string;
  branch: string;
  lastDeployStatus: 'sucesso' | 'falha' | 'em_andamento';
  lastDeployAt: string;
  testCoverage: number;
  openIncidents: number;
  ciProvider: string;
  origin: DataOrigin;
}

export interface TechIncident {
  id: string;
  title: string;
  severity: 'sev1' | 'sev2' | 'sev3';
  status: 'aberto' | 'mitigado' | 'resolvido';
  projectId: string;
  ownerName: string;
  openedAt: string;
}

export interface AISolution {
  id: string;
  name: string;
  projectId: string;
  modelProvider: string;
  modelName: string;
  evaluationStatus: 'homologada' | 'em_avaliacao' | 'rascunho';
  accuracyNote: string;
  guardrails: string[];
  origin: DataOrigin;
}

// Dimensão 1: Identidade Profissional (Agency Agents)
export interface AgentBlueprint {
  id: string;
  code: string;
  slug: string;
  name: string;
  division: AgentDivision;
  specialty: string;
  summary: string;
  // Metadados preservados do Agency Agents Markdown
  archetype: string;
  personality: string;
  communicationStyle: string;
  workStyle: string;
  decisionMakingStyle: string;
  vibe: string;
  color: string;
  emoji: string;
  version: string;
  originPath: string;
  competencies: string[];
  knowledgeAreas: string[];
  skills: string[];
  responsibilities: string[];
  limitations: string[];
  methodology: string;
  instructions: string;
  runbook: string[];
  nexusGates: string[];
  homologationStatus: HomologationStatus;
  paperclipCompatible: boolean;
  sourceCatalog: 'Agency Agents (Acervo 283)';
}

export interface NexusPresetTeam {
  id: string;
  name: string;
  scenario: string;
  description: string;
  agentCodes: string[];
  nexusWorkflow: string[];
}

// Dimensão 2: Posição Organizacional (Paperclip / NettosCorp Org)
export interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  headPositionId?: string;
  budgetAllocatedBRL: number;
  linkedChannelId?: string;
}

export interface OrgPosition {
  id: string;
  title: string;
  departmentId: string;
  reportsToPositionId?: string;
  authorityLevel: AuthorityLevel;
  holderType: 'humano' | 'agente_operacional' | 'vago';
  holderId?: string; // PersonRecord.id or OperationalAgentInstance.id
  budgetLimitBRL: number;
  responsibilities: string[];
  projectIds: string[];
  operationalState: 'ativo' | 'vago' | 'pausado';
}

export interface AgentExecutionSession {
  id: string;
  instanceId: string;
  triggeredBy: string;
  channelId?: string;
  taskId?: string;
  adapterUsed: string;
  modelUsed: string;
  status: 'concluida' | 'falhou' | 'integracao_pendente';
  tokensEstimated: number;
  costBRL: number;
  summary: string;
  startedAt: string;
  finishedAt: string;
}

// Dimensão 3: Configuração & Instância Operacional (Paperclip Runtime)
export interface OperationalAgentInstance {
  id: string;
  blueprintId: string;
  blueprintCode: string;
  instanceName: string;
  division: AgentDivision;
  positionId?: string;
  departmentId?: string;
  projectId: string;
  projectName: string;
  runtimeEngine: 'Paperclip Runtime' | 'TokenizAi Native Orchestrator';
  provider: 'Google Gemini' | 'Paperclip External' | 'OpenAI' | 'Anthropic';
  model: string;
  adapter: 'gemini-server-native' | 'paperclip-http-adapter';
  tools: string[];
  permissions: string[];
  credentialRef: string;
  envRefKeys: string[];
  maxExecutionsPerDay: number;
  monthlyBudgetBRL: number;
  spentBudgetBRL: number;
  heartbeatIntervalSec: number;
  executionState:
    | 'ativo_pronto'
    | 'processando'
    | 'aguardando_aprovacao'
    | 'pausado'
    | 'aguardando_paperclip';
  assignedTasksCount: number;
  guardrailPolicy: string;
  lastHeartbeat: string;
  origin: DataOrigin;
}

export interface DeterministicRecommendation {
  agent: AgentBlueprint;
  score: number;
  matchedCompetencies: string[];
  rationale: string;
}

export interface TeamCompositionRecord {
  id: string;
  projectId: string;
  createdAt: string;
  authorName: string;
  selectedBlueprintIds: string[];
  coveragePercent: number;
  identifiedGaps: string[];
  deterministicSummary: string;
  aiNote?: string;
  humanApprovalStatus: 'aprovada' | 'pendente_revisao';
}

export interface PersonRecord {
  id: string;
  name: string;
  roleTitle: string;
  department: string;
  departmentId?: string;
  positionId?: string;
  managerId?: string;
  avatarUrl?: string;
  capacityPercent: number;
  competencies: string[];
  assignedProjectIds: string[];
  accessRole: UserRole;
  authorityLevel: AuthorityLevel;
  email: string;
}

export interface GovernanceRecord {
  id: string;
  code: string;
  type: GovernanceType;
  title: string;
  summary: string;
  status: 'aprovado' | 'em_deliberacao' | 'pendente';
  authorName: string;
  authorityRole: string;
  linkedProjectId?: string;
  linkedConversationId?: string;
  createdAt: string;
  auditHash: string;
}

export interface IntegrationConfig {
  id: string;
  name: string;
  category:
    | 'Persistência'
    | 'Código & CI/CD'
    | 'Runtime de Agentes'
    | 'Modelos de IA'
    | 'Financeiro & Fiscal'
    | 'Produtividade & Agenda';
  status: 'não configurado' | 'ativo' | 'parcial';
  endpointLabel: string;
  description: string;
  requiredEnvVars: string[];
}

export interface WeeklyProgressPoint {
  weekLabel: string;
  deliveriesCompleted: number;
  deliveriesPlanned: number;
  revenueK: number;
  expenseK: number;
  capacityUsedPercent: number;
}

export interface CalendarCommitment {
  id: string;
  title: string;
  dateISO: string;
  durationMinutes: number;
  category: 'Executivo' | 'Comercial' | 'Entrega' | 'Governança';
  participants: string;
  location: string;
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'alerta' | 'critico';
  targetModule: ModuleId;
  createdAt: string;
  read: boolean;
}

// Domínio de Comunicação & Chat Nativo (Paperclip-Inspired)
export interface ChatParticipant {
  id: string;
  kind: 'humano' | 'agente_operacional';
  name: string;
  roleTitle: string;
  department?: string;
  avatarUrl?: string;
  color?: string;
  emoji?: string;
}

export interface ChatContextRef {
  kind: 'project' | 'task' | 'department' | 'governance' | 'agent_profile';
  id: string;
  label: string;
}

export interface ChatConversation {
  id: string;
  kind: ConversationKind;
  title: string;
  subtitle: string;
  participantIds: string[];
  participants: ChatParticipant[];
  contextRef?: ChatContextRef;
  departmentId?: string;
  projectId?: string;
  unreadCount: number;
  mentionsCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  allowedRoles: UserRole[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderKind: 'humano' | 'agente_operacional' | 'sistema';
  senderName: string;
  senderRole: string;
  recipientId?: string;
  recipientName?: string;
  content: string;
  lifecycleStatus: MessageLifecycleStatus;
  createdAt: string;
  mentions?: string[];
  attachments?: Array<{ name: string; kind: string; refId?: string }>;
  contextRef?: ChatContextRef;
  linkedTaskId?: string;
  linkedGovernanceId?: string;
  sessionId?: string;
  modelUsed?: string;
  isDelegationRequest?: boolean;
}

export interface EnterpriseState {
  financialEntries: FinancialEntry[];
  costCenters: CostCenterBudget[];
  accounts: CompanyAccount[];
  opportunities: CommercialOpportunity[];
  contracts: ContractItem[];
  campaigns: MarketingCampaign[];
  products: ProductServiceItem[];
  projects: EnterpriseProject[];
  tasks: ProjectTask[];
  repos: SoftwareRepo[];
  incidents: TechIncident[];
  aiSolutions: AISolution[];
  departments: DepartmentRecord[];
  orgPositions: OrgPosition[];
  operationalInstances: OperationalAgentInstance[];
  executionSessions: AgentExecutionSession[];
  compositions: TeamCompositionRecord[];
  people: PersonRecord[];
  governance: GovernanceRecord[];
  integrations: IntegrationConfig[];
  weeklyProgress: WeeklyProgressPoint[];
  commitments: CalendarCommitment[];
  notifications: AppNotification[];
  conversations: ChatConversation[];
  messages: ChatMessage[];
  homologationOverrides: Record<string, HomologationStatus>;
}

export interface SyncQueueItem {
  id: string;
  action: string;
  timestamp: string;
  synced: boolean;
}