import { z } from 'zod';
import type {
  UserRole,
  ModuleId,
  AuthorityLevel,
  DataOrigin,
  AccentTheme,
  AgentDivision,
  HomologationStatus,
  GovernanceType,
  ConversationKind,
  MessageLifecycleStatus,
  ProjectStatus,
  ProjectPriority,
  TaskLifecycleStatus,
  MembershipStatus,
  AgentExecutionState,
  HolderType,
  OperationalState,
  FinancialEntryType,
  FinancialEntryStatus,
  ContractStatus,
  CampaignStatus,
  ProductLifecycle,
  CompanyTier,
  CompanyAccountStatus,
  HealthScore,
  OpportunityStage,
  CampaignChannel,
  ProductKind,
  IncidentSeverity,
  IncidentStatus,
  AISolutionStatus,
  Provider,
  Adapter,
  RuntimeEngine,
  ParticipantKind,
  ContextRefKind,
  NotificationSeverity,
  IntegrationCategory,
  IntegrationStatus,
  CalendarCategory,
  SessionStatus,
} from './types';

/**
 * Zod schemas re-exported from types for validation use
 */
export {
  UserRoleSchema,
  ModuleIdSchema,
  AuthorityLevelSchema,
  DataOriginSchema,
  AccentThemeSchema,
  AgentDivisionSchema,
  HomologationStatusSchema,
  GovernanceTypeSchema,
  ConversationKindSchema,
  MessageLifecycleStatusSchema,
  ProjectStatusSchema,
  ProjectPrioritySchema,
  TaskLifecycleStatusSchema,
  MembershipStatusSchema,
  AgentExecutionStateSchema,
  HolderTypeSchema,
  OperationalStateSchema,
  FinancialEntryTypeSchema,
  FinancialEntryStatusSchema,
  ContractStatusSchema,
  CampaignStatusSchema,
  ProductLifecycleSchema,
  CompanyTierSchema,
  CompanyAccountStatusSchema,
  HealthScoreSchema,
  OpportunityStageSchema,
  CampaignChannelSchema,
  ProductKindSchema,
  IncidentSeveritySchema,
  IncidentStatusSchema,
  AISolutionStatusSchema,
  ProviderSchema,
  AdapterSchema,
  RuntimeEngineSchema,
  ParticipantKindSchema,
  ContextRefKindSchema,
  NotificationSeveritySchema,
  IntegrationCategorySchema,
  IntegrationStatusSchema,
  CalendarCategorySchema,
  SessionStatusSchema,
} from './types';

/**
 * Composite schemas for complex entities
 */

// RoleDefinition schema
export const RoleDefinitionSchema = z.object({
  id: z.custom<UserRole>(),
  label: z.string().min(1),
  authorityLevel: z.custom<AuthorityLevel>(),
  description: z.string().min(1),
  allowedModules: z.array(z.custom<ModuleId>()).min(1),
  canApproveGovernance: z.boolean(),
  canManageFinance: z.boolean(),
  canEditProjects: z.boolean(),
  canManageOrg: z.boolean(),
  canHomologateAgents: z.boolean(),
  canManageRuntime: z.boolean(),
  canOrchestrateInterAgent: z.boolean(),
  canManageAdmin: z.boolean(),
});

export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;

// Module schema
export const ModuleSchema = z.object({
  id: z.custom<ModuleId>(),
  label: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  allowedRoles: z.array(z.custom<UserRole>()),
});

export type Module = z.infer<typeof ModuleSchema>;

// AgentBlueprint schema
export const AgentBlueprintSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  division: z.custom<AgentDivision>(),
  specialty: z.string().min(1),
  summary: z.string().min(1),
  archetype: z.string().min(1),
  personality: z.string().min(1),
  communicationStyle: z.string().min(1),
  workStyle: z.string().min(1),
  decisionMakingStyle: z.string().min(1),
  vibe: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  emoji: z.string().min(1),
  version: z.string().min(1),
  originPath: z.string().min(1),
  competencies: z.array(z.string()).min(1),
  knowledgeAreas: z.array(z.string()).min(1),
  skills: z.array(z.string()).min(1),
  responsibilities: z.array(z.string()).min(1),
  limitations: z.array(z.string()).min(1),
  methodology: z.string().min(1),
  instructions: z.string().min(1),
  runbook: z.array(z.string()),
  nexusGates: z.array(z.string()),
  homologationStatus: z.custom<HomologationStatus>(),
  paperclipCompatible: z.boolean(),
  sourceCatalog: z.string().min(1),
});

export type AgentBlueprint = z.infer<typeof AgentBlueprintSchema>;

// PersonRecord schema
export const PersonRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  roleTitle: z.string().min(1),
  department: z.string().min(1),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  capacityPercent: z.number().int().min(0).max(100),
  competencies: z.array(z.string()),
  assignedProjectIds: z.array(z.string().uuid()),
  accessRole: z.custom<UserRole>(),
  authorityLevel: z.custom<AuthorityLevel>(),
  email: z.string().email(),
});

export type PersonRecord = z.infer<typeof PersonRecordSchema>;

// OrgPosition schema
export const OrgPositionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  departmentId: z.string().uuid(),
  reportsToPositionId: z.string().uuid().optional(),
  authorityLevel: z.custom<AuthorityLevel>(),
  holderType: z.custom<HolderType>(),
  holderId: z.string().uuid().optional(),
  budgetLimitBRL: z.number().nonnegative(),
  responsibilities: z.array(z.string()).min(1),
  projectIds: z.array(z.string().uuid()),
  operationalState: z.custom<OperationalState>(),
});

export type OrgPosition = z.infer<typeof OrgPositionSchema>;

// DepartmentRecord schema
export const DepartmentRecordSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(10),
  name: z.string().min(1),
  description: z.string().min(1),
  headPositionId: z.string().uuid().optional(),
  budgetAllocatedBRL: z.number().nonnegative(),
  linkedChannelId: z.string().uuid().optional(),
});

export type DepartmentRecord = z.infer<typeof DepartmentRecordSchema>;

// OperationalAgentInstance schema
export const OperationalAgentInstanceSchema = z.object({
  id: z.string().uuid(),
  blueprintId: z.string().uuid(),
  blueprintCode: z.string().min(1),
  instanceName: z.string().min(1),
  division: z.custom<AgentDivision>(),
  positionId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  projectName: z.string().min(1),
  runtimeEngine: z.custom<RuntimeEngine>(),
  provider: z.custom<Provider>(),
  model: z.string().min(1),
  adapter: z.custom<Adapter>(),
  tools: z.array(z.string()),
  permissions: z.array(z.string()),
  credentialRef: z.string().min(1),
  envRefKeys: z.array(z.string()),
  maxExecutionsPerDay: z.number().int().positive(),
  monthlyBudgetBRL: z.number().nonnegative(),
  spentBudgetBRL: z.number().nonnegative(),
  heartbeatIntervalSec: z.number().int().positive(),
  executionState: z.custom<AgentExecutionState>(),
  assignedTasksCount: z.number().int().nonnegative(),
  guardrailPolicy: z.string().min(1),
  lastHeartbeat: z.string().datetime(),
  origin: z.custom<DataOrigin>(),
});

export type OperationalAgentInstance = z.infer<typeof OperationalAgentInstanceSchema>;

// ProjectTask schema
export const ProjectTaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().uuid().optional(),
  assigneeName: z.string().min(1),
  assigneeKind: z.custom<ParticipantKind>(),
  delegatedBy: z.string().min(1),
  status: z.custom<TaskLifecycleStatus>(),
  dueDate: z.string().date(),
  priority: z.custom<ProjectPriority>(),
  completionCriteria: z.string().min(1),
  completionEvidence: z.string().optional(),
  subtasks: z.array(z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    done: z.boolean(),
  })).optional(),
  sourceConversationId: z.string().uuid().optional(),
  sourceMessageId: z.string().uuid().optional(),
  commentsCount: z.number().int().nonnegative().optional(),
});

export type ProjectTask = z.infer<typeof ProjectTaskSchema>;

// EnterpriseProject schema
export const EnterpriseProjectSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  objective: z.string().min(1),
  description: z.string().min(1),
  area: z.string().min(1),
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
  budgetBRL: z.number().nonnegative().optional(),
  spentBRL: z.number().nonnegative().optional(),
  humanTeamIds: z.array(z.string().uuid()),
  selectedAgentIds: z.array(z.string().uuid()),
  operationalInstanceIds: z.array(z.string().uuid()),
  status: z.custom<ProjectStatus>(),
  priority: z.custom<ProjectPriority>(),
  deadline: z.string().date(),
  progress: z.number().int().min(0).max(100),
  repoSlug: z.string().optional(),
  architectureSummary: z.string().optional(),
  requirements: z.array(z.string()),
  nexusGates: z.array(z.object({
    id: z.string().uuid(),
    phase: z.enum(['Discovery', 'Architecture', 'Execution', 'Verification', 'Release']),
    gateCriteria: z.string().min(1),
    passed: z.boolean(),
    verifiedBy: z.string().optional(),
  })).optional(),
  linkedAccountId: z.string().uuid().optional(),
  linkedContractId: z.string().uuid().optional(),
  linkedProductId: z.string().uuid().optional(),
  linkedConversationId: z.string().uuid().optional(),
  origin: z.custom<DataOrigin>(),
  updatedAt: z.string().date(),
});

export type EnterpriseProject = z.infer<typeof EnterpriseProjectSchema>;

// FinancialEntry schema
export const FinancialEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  type: z.custom<FinancialEntryType>(),
  category: z.string().min(1),
  costCenter: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().date(),
  status: z.custom<FinancialEntryStatus>(),
  reconciled: z.boolean(),
  linkedContractId: z.string().uuid().optional(),
  linkedProjectId: z.string().uuid().optional(),
  linkedAgentInstanceId: z.string().uuid().optional(),
  origin: z.custom<DataOrigin>(),
});

export type FinancialEntry = z.infer<typeof FinancialEntrySchema>;

// CostCenterBudget schema
export const CostCenterBudgetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  department: z.string().min(1),
  allocated: z.number().nonnegative(),
  spent: z.number().nonnegative(),
  origin: z.custom<DataOrigin>(),
});

export type CostCenterBudget = z.infer<typeof CostCenterBudgetSchema>;

// CompanyAccount schema
export const CompanyAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  segment: z.string().min(1),
  tier: z.custom<CompanyTier>(),
  status: z.custom<CompanyAccountStatus>(),
  primaryContact: z.string().min(1),
  contactEmail: z.string().email(),
  mrr: z.number().nonnegative(),
  healthScore: z.custom<HealthScore>(),
  ownerId: z.string().uuid(),
  lastInteraction: z.string().date(),
  origin: z.custom<DataOrigin>(),
});

export type CompanyAccount = z.infer<typeof CompanyAccountSchema>;

// CommercialOpportunity schema
export const CommercialOpportunitySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  accountId: z.string().uuid(),
  accountName: z.string().min(1),
  stage: z.custom<OpportunityStage>(),
  value: z.number().positive(),
  probability: z.number().min(0).max(100),
  expectedClose: z.string().date(),
  ownerId: z.string().uuid(),
  linkedProductId: z.string().uuid().optional(),
  linkedProjectId: z.string().uuid().optional(),
  origin: z.custom<DataOrigin>(),
});

export type CommercialOpportunity = z.infer<typeof CommercialOpportunitySchema>;

// ContractItem schema
export const ContractItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  accountId: z.string().uuid(),
  accountName: z.string().min(1),
  title: z.string().min(1),
  annualValue: z.number().positive(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  status: z.custom<ContractStatus>(),
  linkedProjectId: z.string().uuid().optional(),
  origin: z.custom<DataOrigin>(),
});

export type ContractItem = z.infer<typeof ContractItemSchema>;

// MarketingCampaign schema
export const MarketingCampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  channel: z.custom<CampaignChannel>(),
  status: z.custom<CampaignStatus>(),
  budget: z.number().nonnegative(),
  spent: z.number().nonnegative(),
  leadsGenerated: z.number().int().nonnegative(),
  qualifiedSql: z.number().int().nonnegative(),
  cacEstimate: z.number().nonnegative(),
  origin: z.custom<DataOrigin>(),
});

export type MarketingCampaign = z.infer<typeof MarketingCampaignSchema>;

// ProductServiceItem schema
export const ProductServiceItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  kind: z.custom<ProductKind>(),
  lifecycle: z.custom<ProductLifecycle>(),
  ownerId: z.string().uuid(),
  monthlyRevenue: z.number().nonnegative(),
  operationalCost: z.number().nonnegative(),
  activeClients: z.number().int().nonnegative(),
  roadmapPhase: z.string().min(1),
  linkedProjectIds: z.array(z.string().uuid()),
  origin: z.custom<DataOrigin>(),
});

export type ProductServiceItem = z.infer<typeof ProductServiceItemSchema>;

// SoftwareRepo schema
export const SoftwareRepoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  projectId: z.string().uuid(),
  stack: z.string().min(1),
  branch: z.string().min(1),
  lastDeployStatus: z.enum(['sucesso', 'falha', 'em_andamento']),
  lastDeployAt: z.string().datetime(),
  testCoverage: z.number().min(0).max(100),
  openIncidents: z.number().int().nonnegative(),
  ciProvider: z.string().min(1),
  origin: z.custom<DataOrigin>(),
});

export type SoftwareRepo = z.infer<typeof SoftwareRepoSchema>;

// TechIncident schema
export const TechIncidentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  severity: z.custom<IncidentSeverity>(),
  status: z.custom<IncidentStatus>(),
  projectId: z.string().uuid(),
  ownerName: z.string().min(1),
  openedAt: z.string().datetime(),
});

export type TechIncident = z.infer<typeof TechIncidentSchema>;

// AISolution schema
export const AISolutionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  projectId: z.string().uuid(),
  modelProvider: z.string().min(1),
  modelName: z.string().min(1),
  evaluationStatus: z.custom<AISolutionStatus>(),
  accuracyNote: z.string().min(1),
  guardrails: z.array(z.string()),
  origin: z.custom<DataOrigin>(),
});

export type AISolution = z.infer<typeof AISolutionSchema>;

// GovernanceRecord schema
export const GovernanceRecordSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  type: z.custom<GovernanceType>(),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(['aprovado', 'em_deliberacao', 'pendente']),
  authorName: z.string().min(1),
  authorityRole: z.string().min(1),
  linkedProjectId: z.string().uuid().optional(),
  linkedConversationId: z.string().uuid().optional(),
  createdAt: z.string().date(),
  auditHash: z.string().min(1),
});

export type GovernanceRecord = z.infer<typeof GovernanceRecordSchema>;

// IntegrationConfig schema
export const IntegrationConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.custom<IntegrationCategory>(),
  status: z.custom<IntegrationStatus>(),
  endpointLabel: z.string().min(1),
  description: z.string().min(1),
  requiredEnvVars: z.array(z.string()),
});

export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

// WeeklyProgressPoint schema
export const WeeklyProgressPointSchema = z.object({
  weekLabel: z.string().min(1),
  deliveriesCompleted: z.number().int().nonnegative(),
  deliveriesPlanned: z.number().int().nonnegative(),
  revenueK: z.number().nonnegative(),
  expenseK: z.number().nonnegative(),
  capacityUsedPercent: z.number().min(0).max(100),
});

export type WeeklyProgressPoint = z.infer<typeof WeeklyProgressPointSchema>;

// CalendarCommitment schema
export const CalendarCommitmentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  dateISO: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  category: z.custom<CalendarCategory>(),
  participants: z.string().min(1),
  location: z.string().min(1),
});

export type CalendarCommitment = z.infer<typeof CalendarCommitmentSchema>;

// AppNotification schema
export const AppNotificationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.custom<NotificationSeverity>(),
  targetModule: z.custom<ModuleId>(),
  createdAt: z.string().datetime(),
  read: z.boolean(),
});

export type AppNotification = z.infer<typeof AppNotificationSchema>;

// ChatConversation schema
export const ChatConversationSchema = z.object({
  id: z.string().uuid(),
  kind: z.custom<ConversationKind>(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  participantIds: z.array(z.string().uuid()),
  participants: z.array(z.object({
    id: z.string().uuid(),
    kind: z.custom<ParticipantKind>(),
    name: z.string().min(1),
    roleTitle: z.string().min(1),
    department: z.string().optional(),
    avatarUrl: z.string().url().optional().nullable(),
    color: z.string().optional(),
    emoji: z.string().optional(),
  })),
  contextRef: z.object({
    kind: z.custom<ContextRefKind>(),
    id: z.string().uuid(),
    label: z.string().min(1),
  }).optional(),
  departmentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  unreadCount: z.number().int().nonnegative(),
  mentionsCount: z.number().int().nonnegative(),
  lastMessageAt: z.string().datetime(),
  lastMessagePreview: z.string().min(1),
  allowedRoles: z.array(z.custom<UserRole>()),
});

export type ChatConversation = z.infer<typeof ChatConversationSchema>;

// ChatMessage schema
export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  senderKind: z.custom<ParticipantKind>(),
  senderName: z.string().min(1),
  senderRole: z.string().min(1),
  recipientId: z.string().uuid().optional(),
  recipientName: z.string().optional(),
  content: z.string().min(1),
  lifecycleStatus: z.custom<MessageLifecycleStatus>(),
  createdAt: z.string().datetime(),
  mentions: z.array(z.string().uuid()).optional(),
  attachments: z.array(z.object({
    name: z.string().min(1),
    kind: z.string().min(1),
    refId: z.string().uuid().optional(),
  })).optional(),
  contextRef: z.object({
    kind: z.custom<ContextRefKind>(),
    id: z.string().uuid(),
    label: z.string().min(1),
  }).optional(),
  linkedTaskId: z.string().uuid().optional(),
  linkedGovernanceId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  modelUsed: z.string().optional(),
  isDelegationRequest: z.boolean().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// AgentExecutionSession schema
export const AgentExecutionSessionSchema = z.object({
  id: z.string().uuid(),
  instanceId: z.string().uuid(),
  triggeredBy: z.string().min(1),
  channelId: z.string().uuid().optional(),
  adapterUsed: z.custom<Adapter>(),
  modelUsed: z.string().min(1),
  status: z.custom<SessionStatus>(),
  tokensEstimated: z.number().int().nonnegative(),
  costBRL: z.number().nonnegative(),
  summary: z.string().min(1),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
});

export type AgentExecutionSession = z.infer<typeof AgentExecutionSessionSchema>;

// TeamCompositionRecord schema
export const TeamCompositionRecordSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  createdAt: z.string().date(),
  authorName: z.string().min(1),
  selectedBlueprintIds: z.array(z.string().uuid()),
  coveragePercent: z.number().min(0).max(100),
  identifiedGaps: z.array(z.string()),
  deterministicSummary: z.string().min(1),
  aiNote: z.string().optional(),
  humanApprovalStatus: z.enum(['aprovada', 'pendente_revisao']),
});

export type TeamCompositionRecord = z.infer<typeof TeamCompositionRecordSchema>;

// NexusPhaseGate schema
export const NexusPhaseGateSchema = z.object({
  id: z.string().uuid(),
  phase: z.enum(['Discovery', 'Architecture', 'Execution', 'Verification', 'Release']),
  gateCriteria: z.string().min(1),
  passed: z.boolean(),
  verifiedBy: z.string().optional(),
});

export type NexusPhaseGate = z.infer<typeof NexusPhaseGateSchema>;

// ChatContextRef schema
export const ChatContextRefSchema = z.object({
  kind: z.custom<ContextRefKind>(),
  id: z.string().uuid(),
  label: z.string().min(1),
});

export type ChatContextRef = z.infer<typeof ChatContextRefSchema>;

// ChatParticipant schema
export const ChatParticipantSchema = z.object({
  id: z.string().uuid(),
  kind: z.custom<ParticipantKind>(),
  name: z.string().min(1),
  roleTitle: z.string().min(1),
  department: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  color: z.string().optional(),
  emoji: z.string().optional(),
});

export type ChatParticipant = z.infer<typeof ChatParticipantSchema>;

// SyncQueueItem schema
export const SyncQueueItemSchema = z.object({
  id: z.string().uuid(),
  action: z.string().min(1),
  timestamp: z.string().datetime(),
  synced: z.boolean(),
});

export type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;

/**
 * Schema map for easy lookup
 */
export const schemaMap = {
  UserRole: z.custom<UserRole>(),
  ModuleId: z.custom<ModuleId>(),
  AuthorityLevel: z.custom<AuthorityLevel>(),
  DataOrigin: z.custom<DataOrigin>(),
  AccentTheme: z.custom<AccentTheme>(),
  AgentDivision: z.custom<AgentDivision>(),
  HomologationStatus: z.custom<HomologationStatus>(),
  GovernanceType: z.custom<GovernanceType>(),
  ConversationKind: z.custom<ConversationKind>(),
  MessageLifecycleStatus: z.custom<MessageLifecycleStatus>(),
  ProjectStatus: z.custom<ProjectStatus>(),
  ProjectPriority: z.custom<ProjectPriority>(),
  TaskLifecycleStatus: z.custom<TaskLifecycleStatus>(),
  MembershipStatus: z.custom<MembershipStatus>(),
  AgentExecutionState: z.custom<AgentExecutionState>(),
  HolderType: z.custom<HolderType>(),
  OperationalState: z.custom<OperationalState>(),
  FinancialEntryType: z.custom<FinancialEntryType>(),
  FinancialEntryStatus: z.custom<FinancialEntryStatus>(),
  ContractStatus: z.custom<ContractStatus>(),
  CampaignStatus: z.custom<CampaignStatus>(),
  ProductLifecycle: z.custom<ProductLifecycle>(),
  CompanyTier: z.custom<CompanyTier>(),
  CompanyAccountStatus: z.custom<CompanyAccountStatus>(),
  HealthScore: z.custom<HealthScore>(),
  OpportunityStage: z.custom<OpportunityStage>(),
  CampaignChannel: z.custom<CampaignChannel>(),
  ProductKind: z.custom<ProductKind>(),
  IncidentSeverity: z.custom<IncidentSeverity>(),
  IncidentStatus: z.custom<IncidentStatus>(),
  AISolutionStatus: z.custom<AISolutionStatus>(),
  Provider: z.custom<Provider>(),
  Adapter: z.custom<Adapter>(),
  RuntimeEngine: z.custom<RuntimeEngine>(),
  ParticipantKind: z.custom<ParticipantKind>(),
  ContextRefKind: z.custom<ContextRefKind>(),
  NotificationSeverity: z.custom<NotificationSeverity>(),
  IntegrationCategory: z.custom<IntegrationCategory>(),
  IntegrationStatus: z.custom<IntegrationStatus>(),
  CalendarCategory: z.custom<CalendarCategory>(),
  SessionStatus: z.custom<SessionStatus>(),
  RoleDefinition: RoleDefinitionSchema,
  Module: ModuleSchema,
  AgentBlueprint: AgentBlueprintSchema,
  PersonRecord: PersonRecordSchema,
  OrgPosition: OrgPositionSchema,
  DepartmentRecord: DepartmentRecordSchema,
  OperationalAgentInstance: OperationalAgentInstanceSchema,
  ProjectTask: ProjectTaskSchema,
  EnterpriseProject: EnterpriseProjectSchema,
  FinancialEntry: FinancialEntrySchema,
  CostCenterBudget: CostCenterBudgetSchema,
  CompanyAccount: CompanyAccountSchema,
  CommercialOpportunity: CommercialOpportunitySchema,
  ContractItem: ContractItemSchema,
  MarketingCampaign: MarketingCampaignSchema,
  ProductServiceItem: ProductServiceItemSchema,
  SoftwareRepo: SoftwareRepoSchema,
  TechIncident: TechIncidentSchema,
  AISolution: AISolutionSchema,
  GovernanceRecord: GovernanceRecordSchema,
  IntegrationConfig: IntegrationConfigSchema,
  WeeklyProgressPoint: WeeklyProgressPointSchema,
  CalendarCommitment: CalendarCommitmentSchema,
  AppNotification: AppNotificationSchema,
  ChatConversation: ChatConversationSchema,
  ChatMessage: ChatMessageSchema,
  AgentExecutionSession: AgentExecutionSessionSchema,
  TeamCompositionRecord: TeamCompositionRecordSchema,
  NexusPhaseGate: NexusPhaseGateSchema,
  ChatContextRef: ChatContextRefSchema,
  ChatParticipant: ChatParticipantSchema,
  SyncQueueItem: SyncQueueItemSchema,
} as const;

export type SchemaMap = typeof schemaMap;