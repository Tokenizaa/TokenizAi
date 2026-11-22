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
 * All UserRole values as array for iteration
 */
export const USER_ROLES: UserRole[] = [
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
];

/**
 * All ModuleId values as array for iteration
 */
export const MODULE_IDS: ModuleId[] = [
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
];

/**
 * All AuthorityLevel values as array for iteration
 */
export const AUTHORITY_LEVELS: AuthorityLevel[] = [
  'executiva_humana',
  'estrategica_delegada',
  'gerencial',
  'operacional',
  'tecnica',
];

/**
 * All DataOrigin values
 */
export const DATA_ORIGINS = [
  'demonstrativo',
  'integrado',
  'calculado',
  'real_local',
] as const;

/**
 * All AccentTheme values
 */
export const ACCENT_THEMES: AccentTheme[] = [
  'amber',
  'cobalt',
  'emerald',
  'slate',
];

/**
 * All AgentDivision values
 */
export const AGENT_DIVISIONS: AgentDivision[] = [
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
];

/**
 * All HomologationStatus values
 */
export const HOMOLOGATION_STATUSES: HomologationStatus[] = [
  'homologado',
  'em_avaliacao',
  'catalogo',
];

/**
 * All GovernanceType values
 */
export const GOVERNANCE_TYPES: GovernanceType[] = [
  'DEC',
  'CNS',
  'DELIB',
  'AUDIT',
];

/**
 * All ConversationKind values
 */
export const CONVERSATION_KINDS: ConversationKind[] = [
  'direct_agent',
  'inter_agent',
  'department',
  'project',
  'committee',
];

/**
 * All MessageLifecycleStatus values
 */
export const MESSAGE_LIFECYCLE_STATUSES: MessageLifecycleStatus[] = [
  'created',
  'delivered',
  'execution_requested',
  'agent_processing',
  'response_received',
  'execution_completed',
  'execution_failed',
  'integration_pending',
];

/**
 * All ProjectStatus values
 */
export const PROJECT_STATUSES: ProjectStatus[] = [
  'planejamento',
  'em_execucao',
  'atencao',
  'concluido',
];

/**
 * All ProjectPriority values
 */
export const PROJECT_PRIORITIES: ProjectPriority[] = [
  'crítica',
  'alta',
  'média',
  'baixa',
];

/**
 * All TaskLifecycleStatus values
 */
export const TASK_LIFECYCLE_STATUSES: TaskLifecycleStatus[] = [
  'planejada',
  'atribuida',
  'em_execucao',
  'bloqueada',
  'em_revisao',
  'concluida',
  'cancelada',
];

/**
 * All MembershipStatus values
 */
export const MEMBERSHIP_STATUSES: MembershipStatus[] = [
  'invited',
  'active',
  'suspended',
];

/**
 * All AgentExecutionState values
 */
export const AGENT_EXECUTION_STATES: AgentExecutionState[] = [
  'ativo_pronto',
  'processando',
  'aguardando_aprovacao',
  'pausado',
  'aguardando_paperclip',
];

/**
 * All HolderType values
 */
export const HOLDER_TYPES: HolderType[] = [
  'humano',
  'agente_operacional',
  'vago',
];

/**
 * All OperationalState values
 */
export const OPERATIONAL_STATES: OperationalState[] = [
  'ativo',
  'vago',
  'pausado',
];

/**
 * All FinancialEntryType values
 */
export const FINANCIAL_ENTRY_TYPES: FinancialEntryType[] = [
  'receita',
  'despesa',
];

/**
 * All FinancialEntryStatus values
 */
export const FINANCIAL_ENTRY_STATUSES: FinancialEntryStatus[] = [
  'pago',
  'previsto',
  'atrasado',
];

/**
 * All ContractStatus values
 */
export const CONTRACT_STATUSES: ContractStatus[] = [
  'vigente',
  'em_renovacao',
  'assinatura_pendente',
];

/**
 * All CampaignStatus values
 */
export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  'ativa',
  'planejada',
  'pausada',
];

/**
 * All ProductLifecycle values
 */
export const PRODUCT_LIFECYCLES: ProductLifecycle[] = [
  'publicado',
  'em_desenvolvimento',
  'estruturacao',
];

/**
 * All CompanyTier values
 */
export const COMPANY_TIERS: CompanyTier[] = [
  'Enterprise',
  'Mid-Market',
  'Strategic',
];

/**
 * All CompanyAccountStatus values
 */
export const COMPANY_ACCOUNT_STATUSES: CompanyAccountStatus[] = [
  'ativo',
  'onboarding',
  'prospect',
];

/**
 * All HealthScore values
 */
export const HEALTH_SCORES: HealthScore[] = [
  'estável',
  'atenção',
  'crítico',
];

/**
 * All OpportunityStage values
 */
export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  'prospeccao',
  'diagnostico',
  'proposta',
  'negociacao',
  'fechado',
];

/**
 * All CampaignChannel values
 */
export const CAMPAIGN_CHANNELS: CampaignChannel[] = [
  'Inbound Orgânico',
  'LinkedIn B2B',
  'Eventos Executivos',
  'Outbound ABM',
  'Parcerias',
];

/**
 * All ProductKind values
 */
export const PRODUCT_KINDS: ProductKind[] = [
  'Produto',
  'Serviço',
];

/**
 * All IncidentSeverity values
 */
export const INCIDENT_SEVERITIES: IncidentSeverity[] = [
  'sev1',
  'sev2',
  'sev3',
];

/**
 * All IncidentStatus values
 */
export const INCIDENT_STATUSES: IncidentStatus[] = [
  'aberto',
  'mitigado',
  'resolvido',
];

/**
 * All AISolutionStatus values
 */
export const AI_SOLUTION_STATUSES: AISolutionStatus[] = [
  'homologada',
  'em_avaliacao',
  'rascunho',
];

/**
 * All Provider values
 */
export const PROVIDERS: Provider[] = [
  'Google Gemini',
  'Paperclip External',
  'OpenAI',
  'Anthropic',
];

/**
 * All Adapter values
 */
export const ADAPTERS: Adapter[] = [
  'gemini-server-native',
  'paperclip-http-adapter',
];

/**
 * All RuntimeEngine values
 */
export const RUNTIME_ENGINES: RuntimeEngine[] = [
  'Paperclip Runtime',
  'TokenizAi Native Orchestrator',
];

/**
 * All ParticipantKind values
 */
export const PARTICIPANT_KINDS: ParticipantKind[] = [
  'humano',
  'agente_operacional',
  'sistema',
];

/**
 * All ContextRefKind values
 */
export const CONTEXT_REF_KINDS: ContextRefKind[] = [
  'project',
  'task',
  'department',
  'governance',
  'agent_profile',
];

/**
 * All NotificationSeverity values
 */
export const NOTIFICATION_SEVERITIES: NotificationSeverity[] = [
  'info',
  'alerta',
  'critico',
];

/**
 * All IntegrationCategory values
 */
export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  'Persistência',
  'Código & CI/CD',
  'Runtime de Agentes',
  'Modelos de IA',
  'Financeiro & Fiscal',
  'Produtividade & Agenda',
];

/**
 * All IntegrationStatus values
 */
export const INTEGRATION_STATUSES: IntegrationStatus[] = [
  'não configurado',
  'ativo',
  'parcial',
];

/**
 * All CalendarCategory values
 */
export const CALENDAR_CATEGORIES: CalendarCategory[] = [
  'Executivo',
  'Comercial',
  'Entrega',
  'Governança',
];

/**
 * All SessionStatus values
 */
export const SESSION_STATUSES: SessionStatus[] = [
  'concluida',
  'falhou',
  'integracao_pendente',
];

/**
 * Module metadata for UI display
 */
export const MODULE_METADATA: Record<string, {
  label: string;
  description: string;
  icon: string;
  category: 'core' | 'business' | 'technical' | 'governance';
  order: number;
}> = {
  executive: {
    label: 'Executivo',
    description: 'Visão estratégica, métricas consolidadas e síntese corporativa',
    icon: 'layout-dashboard',
    category: 'core',
    order: 1,
  },
  chat: {
    label: 'Chat',
    description: 'Comunicação nativa, agentes operacionais e delegação',
    icon: 'message-square',
    category: 'core',
    order: 2,
  },
  finance: {
    label: 'Financeiro',
    description: 'Fluxo de caixa, orçamentos, centros de custo e contratos',
    icon: 'dollar-sign',
    category: 'business',
    order: 3,
  },
  commercial: {
    label: 'Comercial',
    description: 'Pipeline, contas, oportunidades e projeção de receitas',
    icon: 'target',
    category: 'business',
    order: 4,
  },
  customers: {
    label: 'Clientes',
    description: 'CRM, contas, contratos e health scores',
    icon: 'users',
    category: 'business',
    order: 5,
  },
  marketing: {
    label: 'Marketing',
    description: 'Campanhas, leads, canais e CAC',
    icon: 'megaphone',
    category: 'business',
    order: 6,
  },
  products: {
    label: 'Produtos',
    description: 'Catálogo de produtos/serviços, roadmap e receitas',
    icon: 'package',
    category: 'business',
    order: 7,
  },
  projects: {
    label: 'Projetos',
    description: 'Portfólio, NEXUS gates, tarefas e delegação',
    icon: 'folder-kanban',
    category: 'technical',
    order: 8,
  },
  'software-factory': {
    label: 'Fábrica de Software',
    description: 'Repositórios, deploys, CI/CD, incidentes e cobertura',
    icon: 'code',
    category: 'technical',
    order: 9,
  },
  'intelligence-factory': {
    label: 'Fábrica de Inteligência',
    description: 'Soluções de IA, modelos, avaliação e guardrails',
    icon: 'brain',
    category: 'technical',
    order: 10,
  },
  operations: {
    label: 'Operações',
    description: 'Entregas, tarefas, delegação e runtime Paperclip',
    icon: 'activity',
    category: 'technical',
    order: 11,
  },
  'agency-library': {
    label: 'Biblioteca de Agentes',
    description: 'Catálogo de 283 agentes, especialidades e homologação',
    icon: 'book-open',
    category: 'technical',
    order: 11,
  },
  'team-composer': {
    label: 'Compositor de Equipes',
    description: 'Formação de times, NEXUS workflows e cobertura',
    icon: 'users',
    category: 'technical',
    order: 12,
  },
  'operational-agents': {
    label: 'Agentes Operacionais',
    description: 'Instâncias runtime, adaptadores, orçamentos e heartbeats',
    icon: 'bot',
    category: 'technical',
    order: 13,
  },
  people: {
    label: 'Pessoas',
    description: 'RH, organograma, departamentos, posições e capacidade',
    icon: 'user-group',
    category: 'governance',
    order: 14,
  },
  governance: {
    label: 'Governança',
    description: 'DEC/CNS/DELIB/AUDIT, auditoria e aprovações',
    icon: 'gavel',
    category: 'governance',
    order: 15,
  },
  admin: {
    label: 'Administração',
    description: 'Configurações, integrações, sincronização e logs',
    icon: 'settings',
    category: 'governance',
    order: 16,
  },
};

/**
 * Authority level labels for display
 */
export const AUTHORITY_LABELS: Record<string, string> = {
  executiva_humana: 'Autoridade Executiva Humana',
  estrategica_delegada: 'Autoridade Estratégica Delegada',
  gerencial: 'Autoridade Gerencial',
  operacional: 'Autoridade Operacional',
  tecnica: 'Autoridade Técnica',
};

/**
 * DataOrigin labels for display
 */
export const DATA_ORIGIN_LABELS: Record<string, string> = {
  demonstrativo: 'Demonstrativo',
  integrado: 'Integrado',
  calculado: 'Calculado',
  real_local: 'Real (Local)',
};

/**
 * Currency formatting
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: value > 0 && value < 100 ? 2 : 0,
  }).format(value);
}

/**
 * Date formatting (pt-BR)
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

/**
 * DateTime formatting (pt-BR)
 */
export function formatDateTimeBR(dateStr: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

/**
 * Default monthly budget per authority level (BRL)
 */
export const DEFAULT_MONTHLY_BUDGET_BY_AUTHORITY: Record<string, number> = {
  executiva_humana: 50000,
  estrategica_delegada: 10000,
  gerencial: 5000,
  operacional: 2000,
  tecnica: 3000,
};

/**
 * Default heartbeat interval per adapter (seconds)
 */
export const DEFAULT_HEARTBEAT_INTERVAL_BY_ADAPTER: Record<string, number> = {
  'gemini-server-native': 300,
  'paperclip-http-adapter': 600,
};

/**
 * Default max executions per day per authority level
 */
export const DEFAULT_MAX_EXECUTIONS_PER_DAY_BY_AUTHORITY: Record<string, number> = {
  executiva_humana: 500,
  estrategica_delegada: 200,
  gerencial: 100,
  operacional: 50,
  tecnica: 150,
};

/**
 * Currency formatting locale
 */
export const CURRENCY_LOCALE = 'pt-BR';
export const CURRENCY_CODE = 'BRL';

/**
 * Date formatting locale
 */
export const DATE_LOCALE = 'pt-BR';

/**
 * Timezone for enterprise operations
 */
export const ENTERPRISE_TIMEZONE = 'America/Sao_Paulo';

/**
 * NEXUS phases in order
 */
export const NEXUS_PHASES = [
  'Discovery',
  'Architecture',
  'Execution',
  'Verification',
  'Release',
] as const;

/**
 * Governance codes prefix by type
 */
export const GOVERNANCE_CODE_PREFIX: Record<string, string> = {
  DEC: 'DEC',
  CNS: 'CNS',
  DELIB: 'DELIB',
  AUDIT: 'AUDIT',
};

/**
 * Module categories for UI grouping
 */
export const MODULE_CATEGORIES = {
  core: ['executive', 'chat'],
  business: ['finance', 'commercial', 'customers', 'marketing', 'products'],
  technical: ['projects', 'software-factory', 'intelligence-factory', 'operations', 'agency-library', 'team-composer', 'operational-agents'],
  governance: ['people', 'governance', 'admin'],
};

/**
 * Default role authority level mapping
 */
export const ROLE_DEFAULT_AUTHORITY: Record<string, string> = {
  direcao_executiva: 'executiva_humana',
  gestor: 'gerencial',
  financeiro: 'gerencial',
  comercial: 'operacional',
  operacoes: 'operacional',
  desenvolvimento: 'tecnica',
  ia: 'estrategica_delegada',
  rh: 'gerencial',
  auditoria: 'executiva_humana',
  operacional: 'operacional',
};

/**
 * Agent division display metadata
 */
export const AGENT_DIVISION_METADATA: Record<string, {
  color: string;
  emoji: string;
  shortName: string;
}> = {
  'Engenharia de Software': { color: '#3B82F6', emoji: '💻', shortName: 'Eng. Software' },
  'Inteligência Artificial & ML': { color: '#8B5CF6', emoji: '🧠', shortName: 'IA & ML' },
  'Arquitetura & Cloud': { color: '#06B6D4', emoji: '☁️', shortName: 'Arq. & Cloud' },
  'Segurança & AppSec': { color: '#EF4444', emoji: '🔒', shortName: 'Segurança' },
  'Dados & Engenharia Analítica': { color: '#10B981', emoji: '📊', shortName: 'Dados' },
  'Produto & Estratégia': { color: '#F59E0B', emoji: '🎯', shortName: 'Produto' },
  'Design & Experiência UX': { color: '#EC4899', emoji: '🎨', shortName: 'Design' },
  'Qualidade & Automação QA': { color: '#6366F1', emoji: '✅', shortName: 'QA' },
  'Operações & SRE': { color: '#F97316', emoji: '⚙️', shortName: 'Ops & SRE' },
  'Finanças & Controladoria': { color: '#84CC16', emoji: '💰', shortName: 'Finanças' },
  'Comercial & Revenue Ops': { color: '#EAB308', emoji: '📈', shortName: 'Comercial' },
  'Governança, Risco & Jurídico': { color: '#64748B', emoji: '⚖️', shortName: 'Gov. & Jur.' },
};

/**
 * Default values for new entities
 */
export const DEFAULTS = {
  membershipStatus: 'invited',
  agentExecutionState: 'aguardando_paperclip',
  operationalState: 'vago',
  holderType: 'vago',
  projectStatus: 'planejamento',
  projectPriority: 'média',
  taskStatus: 'planejada',
  financialEntryStatus: 'previsto',
  contractStatus: 'assinatura_pendente',
  campaignStatus: 'planejada',
  productLifecycle: 'estruturacao',
  companyAccountStatus: 'prospect',
  companyTier: 'Mid-Market',
  healthScore: 'estável',
  opportunityStage: 'prospeccao',
  campaignStatusDefault: 'planejada',
  productKindDefault: 'Produto',
  incidentSeverityDefault: 'sev3',
  incidentStatusDefault: 'aberto',
  aiSolutionStatusDefault: 'rascunho',
  adapterDefault: 'gemini-server-native',
  providerDefault: 'Google Gemini',
  runtimeEngineDefault: 'TokenizAi Native Orchestrator',
  participantKindDefault: 'humano',
  conversationKindDefault: 'direct_agent',
  messageLifecycleStatusDefault: 'created',
  notificationSeverityDefault: 'info',
  integrationStatusDefault: 'não configurado',
  calendarCategoryDefault: 'Executivo',
  sessionStatusDefault: 'concluida',
  governanceTypeDefault: 'DELIB',
  authorityLevelDefault: 'operacional',
  userRoleDefault: 'operacional',
  dataOriginDefault: 'real_local',
  homologationStatusDefault: 'catalogo',
  projectPriorityDefault: 'média',
  taskPriorityDefault: 'média',
} as const;