import type { AuthorityLevel, ModuleId, UserRole } from '../types/enterprise';

export interface RoleDefinition {
  id: UserRole;
  label: string;
  authorityLevel: AuthorityLevel;
  description: string;
  allowedModules: ModuleId[];
  canApproveGovernance: boolean;
  canManageFinance: boolean;
  canEditProjects: boolean;
  canManageOrg: boolean;
  canHomologateAgents: boolean;
  canManageRuntime: boolean;
  canOrchestrateInterAgent: boolean;
  canManageAdmin: boolean;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  direcao_executiva: {
    id: 'direcao_executiva',
    label: 'Direção Executiva',
    authorityLevel: 'executiva_humana',
    description: 'Autoridade executiva humana máxima: estratégia, aprovações DEC/CNS/DELIB, organograma e orçamentos.',
    allowedModules: [
      'executive', 'chat', 'finance', 'commercial', 'customers', 'marketing', 'products',
      'projects', 'software-factory', 'intelligence-factory', 'operations',
      'agency-library', 'team-composer', 'operational-agents', 'people', 'governance', 'admin',
    ],
    canApproveGovernance: true,
    canManageFinance: true,
    canEditProjects: true,
    canManageOrg: true,
    canHomologateAgents: true,
    canManageRuntime: true,
    canOrchestrateInterAgent: true,
    canManageAdmin: true,
  },
  gestor: {
    id: 'gestor',
    label: 'Gestor de Operações & Portfólio',
    authorityLevel: 'gerencial',
    description: 'Gestão transversal de projetos, delegação de tarefas, organograma e equipes.',
    allowedModules: [
      'executive', 'chat', 'commercial', 'customers', 'products', 'projects',
      'software-factory', 'intelligence-factory', 'operations',
      'agency-library', 'team-composer', 'operational-agents', 'people', 'governance',
    ],
    canApproveGovernance: true,
    canManageFinance: false,
    canEditProjects: true,
    canManageOrg: true,
    canHomologateAgents: true,
    canManageRuntime: true,
    canOrchestrateInterAgent: true,
    canManageAdmin: false,
  },
  financeiro: {
    id: 'financeiro',
    label: 'Financeiro & Controladoria',
    authorityLevel: 'gerencial',
    description: 'Fluxo de caixa, contas a pagar/receber, orçamentos, custos de runtime e contratos.',
    allowedModules: ['executive', 'chat', 'finance', 'commercial', 'customers', 'products', 'governance'],
    canApproveGovernance: false,
    canManageFinance: true,
    canEditProjects: false,
    canManageOrg: false,
    canHomologateAgents: false,
    canManageRuntime: false,
    canOrchestrateInterAgent: false,
    canManageAdmin: false,
  },
  comercial: {
    id: 'comercial',
    label: 'Comercial & CRM',
    authorityLevel: 'operacional',
    description: 'Pipeline comercial, contas, contratos, marketing e projeção de receitas.',
    allowedModules: ['executive', 'chat', 'commercial', 'customers', 'marketing', 'products', 'projects'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: false,
    canManageOrg: false,
    canHomologateAgents: false,
    canManageRuntime: false,
    canOrchestrateInterAgent: false,
    canManageAdmin: false,
  },
  operacoes: {
    id: 'operacoes',
    label: 'Operações & Entrega',
    authorityLevel: 'operacional',
    description: 'Execução diária, tarefas, delegação, incidentes e runtime Paperclip.',
    allowedModules: ['executive', 'chat', 'projects', 'operations', 'software-factory', 'operational-agents', 'people', 'governance'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: true,
    canManageOrg: false,
    canHomologateAgents: false,
    canManageRuntime: true,
    canOrchestrateInterAgent: true,
    canManageAdmin: false,
  },
  desenvolvimento: {
    id: 'desenvolvimento',
    label: 'Fábrica de Software',
    authorityLevel: 'tecnica',
    description: 'Repositórios GitHub, arquitetura, deploys, incidentes e equipes técnicas.',
    allowedModules: ['chat', 'projects', 'software-factory', 'operations', 'agency-library', 'team-composer'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: true,
    canManageOrg: false,
    canHomologateAgents: false,
    canManageRuntime: false,
    canOrchestrateInterAgent: false,
    canManageAdmin: false,
  },
  ia: {
    id: 'ia',
    label: 'Inteligência Artificial',
    authorityLevel: 'estrategica_delegada',
    description: 'Biblioteca de 283 agentes, composição de equipes, homologações e runtime Paperclip.',
    allowedModules: [
      'executive', 'chat', 'projects', 'intelligence-factory', 'agency-library',
      'team-composer', 'operational-agents', 'people', 'governance',
    ],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: true,
    canManageOrg: true,
    canHomologateAgents: true,
    canManageRuntime: true,
    canOrchestrateInterAgent: true,
    canManageAdmin: false,
  },
  rh: {
    id: 'rh',
    label: 'Pessoas & RH',
    authorityLevel: 'gerencial',
    description: 'Colaboradores, departamentos, organograma, capacidade e alocação.',
    allowedModules: ['executive', 'chat', 'people', 'projects', 'governance'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: false,
    canManageOrg: true,
    canHomologateAgents: false,
    canManageRuntime: false,
    canOrchestrateInterAgent: false,
    canManageAdmin: false,
  },
  auditoria: {
    id: 'auditoria',
    label: 'Auditoria & Governança',
    authorityLevel: 'executiva_humana',
    description: 'Rastreabilidade DEC, CNS, DELIB, logs, auditoria de execuções e conformidade.',
    allowedModules: ['executive', 'chat', 'finance', 'governance', 'admin'],
    canApproveGovernance: true,
    canManageFinance: false,
    canEditProjects: false,
    canManageOrg: false,
    canHomologateAgents: false,
    canManageRuntime: false,
    canOrchestrateInterAgent: false,
    canManageAdmin: false,
  },
  operacional: {
    id: 'operacional',
    label: 'Usuário Operacional',
    authorityLevel: 'operacional',
    description: 'Acompanhamento de tarefas atribuídas, chat operacional e consulta ao catálogo.',
    allowedModules: ['chat', 'projects', 'operations', 'agency-library'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: false,
    canManageOrg: false,
    canHomologateAgents: false,
    canManageRuntime: false,
    canOrchestrateInterAgent: false,
    canManageAdmin: false,
  },
};

export const AUTHORITY_LABELS: Record<AuthorityLevel, string> = {
  executiva_humana: 'Autoridade Executiva Humana',
  estrategica_delegada: 'Autoridade Estratégica Delegada',
  gerencial: 'Autoridade Gerencial',
  operacional: 'Autoridade Operacional',
  tecnica: 'Autoridade Técnica',
};

export function canAccessModule(role: UserRole, moduleId: ModuleId): boolean {
  return ROLE_DEFINITIONS[role].allowedModules.includes(moduleId);
}

export function getFirstAllowedModule(role: UserRole): ModuleId {
  return ROLE_DEFINITIONS[role].allowedModules[0] ?? 'executive';
}
