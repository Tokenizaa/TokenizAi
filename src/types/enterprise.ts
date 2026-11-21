export type UserRole =
  | 'direcao_executiva'
  | 'gestor'
  | 'financeiro'
  | 'comercial'
  | 'operacoes'
  | 'desenvolvimento'
  | 'ia'
  | 'rh'
  | 'auditoria'
  | 'operacional';

export type ModuleId =
  | 'executive'
  | 'finance'
  | 'commercial'
  | 'customers'
  | 'marketing'
  | 'products'
  | 'projects'
  | 'software-factory'
  | 'intelligence-factory'
  | 'operations'
  | 'agency-library'
  | 'team-composer'
  | 'operational-agents'
  | 'people'
  | 'governance'
  | 'admin';

export type DataOrigin = 'demonstrativo' | 'integrado' | 'calculado';

export type AccentTheme = 'amber' | 'cobalt' | 'emerald' | 'slate';

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

export type ProjectStatus = 'planejamento' | 'em_execucao' | 'atencao' | 'concluido';
export type ProjectPriority = 'crítica' | 'alta' | 'média' | 'baixa';

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  assigneeName: string;
  assigneeKind: 'humano' | 'agente_operacional';
  status: 'pendente' | 'em_progresso' | 'revisao' | 'concluida';
  dueDate: string;
  priority: ProjectPriority;
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
  humanTeamIds: string[];
  selectedAgentIds: string[];
  operationalInstanceIds: string[];
  status: ProjectStatus;
  priority: ProjectPriority;
  deadline: string;
  progress: number;
  repoSlug?: string;
  architectureSummary?: string;
  requirements: string[];
  linkedAccountId?: string;
  linkedContractId?: string;
  linkedProductId?: string;
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

export type AgentDivision =
  | 'Engenharia de Software'
  | 'Inteligência Artificial & ML'
  | 'Arquitetura & Cloud'
  | 'Segurança & AppSec'
  | 'Dados & Engenharia Analítica'
  | 'Produto & Estratégia'
  | 'Design & Experiência UX'
  | 'Qualidade & Automação QA'
  | 'Operações & SRE'
  | 'Finanças & Controladoria'
  | 'Comercial & Revenue Ops'
  | 'Governança, Risco & Jurídico';

export type HomologationStatus = 'homologado' | 'em_avaliacao' | 'catalogo';

export interface AgentBlueprint {
  id: string;
  code: string;
  name: string;
  division: AgentDivision;
  specialty: string;
  summary: string;
  competencies: string[];
  responsibilities: string[];
  limitations: string[];
  methodology: string;
  instructions: string;
  runbook: string[];
  homologationStatus: HomologationStatus;
  paperclipCompatible: boolean;
  sourceCatalog: 'Agency Agents (Acervo 283)';
}

export interface OperationalAgentInstance {
  id: string;
  blueprintId: string;
  blueprintCode: string;
  instanceName: string;
  division: AgentDivision;
  projectId: string;
  projectName: string;
  runtimeEngine: 'Paperclip Runtime';
  executionState: 'aguardando_paperclip' | 'pronto_para_execucao' | 'pausado';
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
  managerId?: string;
  avatarUrl?: string;
  capacityPercent: number;
  competencies: string[];
  assignedProjectIds: string[];
  accessRole: UserRole;
  email: string;
}

export type GovernanceType = 'DEC' | 'CNS' | 'DELIB' | 'AUDIT';

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
  createdAt: string;
  auditHash: string;
}

export interface IntegrationConfig {
  id: string;
  name: string;
  category: 'Persistência' | 'Código & CI/CD' | 'Runtime de Agentes' | 'Modelos de IA' | 'Financeiro & Fiscal' | 'Produtividade & Agenda';
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

export interface SyncQueueItem {
  id: string;
  action: string;
  timestamp: string;
  synced: boolean;
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
  operationalInstances: OperationalAgentInstance[];
  compositions: TeamCompositionRecord[];
  people: PersonRecord[];
  governance: GovernanceRecord[];
  integrations: IntegrationConfig[];
  weeklyProgress: WeeklyProgressPoint[];
  commitments: CalendarCommitment[];
  notifications: AppNotification[];
  homologationOverrides: Record<string, HomologationStatus>;
}
