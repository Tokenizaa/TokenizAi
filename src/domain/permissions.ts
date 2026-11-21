import type { ModuleId, UserRole } from '../types/enterprise';

export interface RoleDefinition {
  id: UserRole;
  label: string;
  description: string;
  allowedModules: ModuleId[];
  canApproveGovernance: boolean;
  canManageFinance: boolean;
  canEditProjects: boolean;
  canHomologateAgents: boolean;
  canManageAdmin: boolean;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  direcao_executiva: {
    id: 'direcao_executiva',
    label: 'Direção Executiva',
    description: 'Visão consolidada da empresa, aprovações DEC/CNS/DELIB e direcionamento estratégico.',
    allowedModules: [
      'executive', 'finance', 'commercial', 'customers', 'marketing', 'products',
      'projects', 'software-factory', 'intelligence-factory', 'operations',
      'agency-library', 'team-composer', 'operational-agents', 'people', 'governance', 'admin',
    ],
    canApproveGovernance: true,
    canManageFinance: true,
    canEditProjects: true,
    canHomologateAgents: true,
    canManageAdmin: true,
  },
  gestor: {
    id: 'gestor',
    label: 'Gestor de Operações & Portfólio',
    description: 'Gestão transversal de projetos, produtos, entregas e composição de equipes.',
    allowedModules: [
      'executive', 'commercial', 'customers', 'products', 'projects',
      'software-factory', 'intelligence-factory', 'operations',
      'agency-library', 'team-composer', 'operational-agents', 'people', 'governance',
    ],
    canApproveGovernance: true,
    canManageFinance: false,
    canEditProjects: true,
    canHomologateAgents: true,
    canManageAdmin: false,
  },
  financeiro: {
    id: 'financeiro',
    label: 'Financeiro & Controladoria',
    description: 'Fluxo de caixa, contas a pagar/receber, orçamentos, conciliação e contratos.',
    allowedModules: ['executive', 'finance', 'commercial', 'customers', 'products', 'governance'],
    canApproveGovernance: false,
    canManageFinance: true,
    canEditProjects: false,
    canHomologateAgents: false,
    canManageAdmin: false,
  },
  comercial: {
    id: 'comercial',
    label: 'Comercial & CRM',
    description: 'Pipeline comercial, contas, contratos, marketing e projeção de receitas.',
    allowedModules: ['executive', 'commercial', 'customers', 'marketing', 'products', 'projects'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: false,
    canHomologateAgents: false,
    canManageAdmin: false,
  },
  operacoes: {
    id: 'operacoes',
    label: 'Operações & Entrega',
    description: 'Execução diária, tarefas, incidentes, SLA e runtime Paperclip.',
    allowedModules: ['executive', 'projects', 'operations', 'software-factory', 'operational-agents', 'people', 'governance'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: true,
    canHomologateAgents: false,
    canManageAdmin: false,
  },
  desenvolvimento: {
    id: 'desenvolvimento',
    label: 'Fábrica de Software',
    description: 'Repositórios GitHub, arquitetura, deploys, incidentes e equipes técnicas.',
    allowedModules: ['projects', 'software-factory', 'operations', 'agency-library', 'team-composer'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: true,
    canHomologateAgents: false,
    canManageAdmin: false,
  },
  ia: {
    id: 'ia',
    label: 'Inteligência Artificial',
    description: 'Biblioteca de 283 agentes, composição de equipes, homologações e Paperclip.',
    allowedModules: [
      'executive', 'projects', 'intelligence-factory', 'agency-library',
      'team-composer', 'operational-agents', 'governance',
    ],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: true,
    canHomologateAgents: true,
    canManageAdmin: false,
  },
  rh: {
    id: 'rh',
    label: 'Pessoas & RH',
    description: 'Colaboradores, estrutura organizacional, capacidade e alocação.',
    allowedModules: ['executive', 'people', 'projects', 'governance'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: false,
    canHomologateAgents: false,
    canManageAdmin: false,
  },
  auditoria: {
    id: 'auditoria',
    label: 'Auditoria & Governança',
    description: 'Rastreabilidade DEC, CNS, DELIB, logs e conformidade corporativa.',
    allowedModules: ['executive', 'finance', 'governance', 'admin'],
    canApproveGovernance: true,
    canManageFinance: false,
    canEditProjects: false,
    canHomologateAgents: false,
    canManageAdmin: false,
  },
  operacional: {
    id: 'operacional',
    label: 'Usuário Operacional',
    description: 'Acompanhamento de tarefas atribuídas, entregas e operações do projeto.',
    allowedModules: ['projects', 'operations', 'agency-library'],
    canApproveGovernance: false,
    canManageFinance: false,
    canEditProjects: false,
    canHomologateAgents: false,
    canManageAdmin: false,
  },
};

export function canAccessModule(role: UserRole, moduleId: ModuleId): boolean {
  return ROLE_DEFINITIONS[role].allowedModules.includes(moduleId);
}

export function getFirstAllowedModule(role: UserRole): ModuleId {
  return ROLE_DEFINITIONS[role].allowedModules[0] ?? 'executive';
}
