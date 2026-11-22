/**
 * @nettoscorp/agent-hire/src/division-mapping
 *
 * Mapeamento config-driven das divisões Agency Agents (AA) → papéis NettosCorp.
 *
 * Cada entrada define, para uma divisão do corpus-baseline (diretório pai do .md),
 * o papel, departamento, clearance, authority, domínios de conhecimento, módulo da
 * plataforma e ferramentas padrão (least privilege) do agente contratado.
 *
 * O registro contém 21 entradas: as 19 divisões presentes no corpus-baseline
 * (agency-agents/src-tauri/resources/corpus-baseline, 282 agentes) + 2 entradas
 * reservadas (data-analytics, devops-sre) prontas para expansão até 21 divisões
 * sem alterar código — apenas este arquivo de configuração.
 *
 * Divisões desconhecidas não quebram o pipeline: retornam um fallback degradado
 * (agente-operacional / Operações / restrito / operacional), cumprindo a regra de
 * arquitetura: o sistema sempre devolve algo; nunca falha silenciosamente.
 */

import type { AuthorityLevel, ClearanceLevel } from '@nettoscorp/auth';
import type { ModuleId } from '@nettoscorp/auth';
import type { NettoscorpFrontmatter } from './types';

export interface DivisionRoleConfig {
  aaDivision: string;          // nome do diretório no corpus-baseline (ex. 'engineering')
  nettoscorpRole: string;      // papel NettosCorp (ex. 'engenheiro-de-software')
  department: string;          // departamento NettosCorp
  clearance: ClearanceLevel;   // nível de sigilo (do @nettoscorp/auth)
  authority: AuthorityLevel;   // nível de autoridade hierárquica
  knowledgeDomains: string[];  // domínios de conhecimento do papel
  module: ModuleId;            // módulo da plataforma (define permissões via MODULE_PERMISSIONS)
  defaultTools: string[];      // ferramentas permitidas (least privilege)
  defaultSpecialty: string;
  reserved?: boolean;          // true: divisão prevista, ainda sem agentes no corpus
}

/**
 * Registro de mapeamento divisão AA → papel NettosCorp.
 * Config-driven: adicionar uma divisão é incluir uma entrada aqui.
 */
export const DIVISION_ROLE_REGISTRY: Record<string, DivisionRoleConfig> = {
  engineering: {
    aaDivision: 'engineering',
    nettoscorpRole: 'engenheiro-de-software',
    department: 'Engenharia de Software',
    clearance: 'restrito',
    authority: 'tecnica',
    knowledgeDomains: ['TypeScript', 'Node.js', 'Arquitetura de Software'],
    module: 'software-factory',
    defaultTools: ['typescript', 'node', 'git', 'docker'],
    defaultSpecialty: 'Desenvolvimento de software e arquitetura de sistemas',
  },
  design: {
    aaDivision: 'design',
    nettoscorpRole: 'designer-de-produto',
    department: 'Design & Experiência UX',
    clearance: 'restrito',
    authority: 'tecnica',
    knowledgeDomains: ['UI/UX', 'Figma', 'Design System'],
    module: 'products',
    defaultTools: ['figma'],
    defaultSpecialty: 'Design de interfaces e experiência do usuário',
  },
  product: {
    aaDivision: 'product',
    nettoscorpRole: 'gerente-de-produto',
    department: 'Gestão de Produto',
    clearance: 'gerencial',
    authority: 'gerencial',
    knowledgeDomains: ['Product Discovery', 'Roadmap', 'Métricas de Produto'],
    module: 'products',
    defaultTools: [],
    defaultSpecialty: 'Gestão de produto e roadmap',
  },
  'project-management': {
    aaDivision: 'project-management',
    nettoscorpRole: 'gerente-de-projetos',
    department: 'Escritório de Projetos',
    clearance: 'gerencial',
    authority: 'gerencial',
    knowledgeDomains: ['Gestão de Projetos', 'Scrum', 'Kanban'],
    module: 'operations',
    defaultTools: [],
    defaultSpecialty: 'Gestão de projetos e entrega',
  },
  operations: {
    aaDivision: 'operations',
    nettoscorpRole: 'especialista-de-operacoes',
    department: 'Operações',
    clearance: 'restrito',
    authority: 'operacional',
    knowledgeDomains: ['SRE', 'Operações', 'Gerenciamento de Incidentes'],
    module: 'operations',
    defaultTools: [],
    defaultSpecialty: 'Operações e confiabilidade de serviços',
  },
  security: {
    aaDivision: 'security',
    nettoscorpRole: 'analista-de-seguranca',
    department: 'Segurança & AppSec',
    clearance: 'confidencial',
    authority: 'gerencial',
    knowledgeDomains: ['AppSec', 'Segurança da Informação', 'LGPD'],
    module: 'governance',
    defaultTools: [],
    defaultSpecialty: 'Segurança da informação e aplicação',
  },
  finance: {
    aaDivision: 'finance',
    nettoscorpRole: 'analista-financeiro',
    department: 'Finanças & Controladoria',
    clearance: 'confidencial',
    authority: 'gerencial',
    knowledgeDomains: ['Controladoria', 'Fluxo de Caixa', 'Orçamento'],
    module: 'finance',
    defaultTools: [],
    defaultSpecialty: 'Análise financeira e controladoria',
  },
  commercial: {
    aaDivision: 'commercial',
    nettoscorpRole: 'gestor-comercial',
    department: 'Comercial & Revenue Ops',
    clearance: 'restrito',
    authority: 'operacional',
    knowledgeDomains: ['Vendas B2B', 'Funil Comercial', 'CRM'],
    module: 'commercial',
    defaultTools: [],
    defaultSpecialty: 'Gestão comercial e revenue operations',
  },
  sales: {
    aaDivision: 'sales',
    nettoscorpRole: 'especialista-de-vendas',
    department: 'Comercial & Revenue Ops',
    clearance: 'restrito',
    authority: 'operacional',
    knowledgeDomains: ['Prospecção', 'Negociação', 'Fechamento'],
    module: 'commercial',
    defaultTools: [],
    defaultSpecialty: 'Vendas e desenvolvimento de negócios',
  },
  marketing: {
    aaDivision: 'marketing',
    nettoscorpRole: 'analista-de-marketing',
    department: 'Marketing',
    clearance: 'restrito',
    authority: 'operacional',
    knowledgeDomains: ['Marketing de Conteúdo', 'Inbound', 'Branding'],
    module: 'marketing',
    defaultTools: [],
    defaultSpecialty: 'Marketing e comunicação',
  },
  'paid-media': {
    aaDivision: 'paid-media',
    nettoscorpRole: 'especialista-de-midia-paga',
    department: 'Marketing',
    clearance: 'restrito',
    authority: 'operacional',
    knowledgeDomains: ['Mídia Paga', 'Performance', 'Tráfego Pago'],
    module: 'marketing',
    defaultTools: [],
    defaultSpecialty: 'Mídia paga e performance',
  },
  research: {
    aaDivision: 'research',
    nettoscorpRole: 'cientista-de-pesquisa',
    department: 'Pesquisa & IA/ML',
    clearance: 'restrito',
    authority: 'estrategica_delegada',
    knowledgeDomains: ['Pesquisa Científica', 'IA/ML', 'Experimentos'],
    module: 'intelligence-factory',
    defaultTools: [],
    defaultSpecialty: 'Pesquisa aplicada e IA/ML',
  },
  healthcare: {
    aaDivision: 'healthcare',
    nettoscorpRole: 'especialista-saude',
    department: 'Saúde & Ciências da Vida',
    clearance: 'confidencial',
    authority: 'operacional',
    knowledgeDomains: ['Saúde Digital', 'LGPD-Saúde', 'Pacientes'],
    module: 'customers',
    defaultTools: [],
    defaultSpecialty: 'Soluções para o setor de saúde',
  },
  gis: {
    aaDivision: 'gis',
    nettoscorpRole: 'especialista-gis',
    department: 'Geo & Dados Espaciais',
    clearance: 'restrito',
    authority: 'tecnica',
    knowledgeDomains: ['GIS', 'Sensoriamento Remoto', 'Drones'],
    module: 'products',
    defaultTools: [],
    defaultSpecialty: 'Sistemas de informação geográfica',
  },
  'spatial-computing': {
    aaDivision: 'spatial-computing',
    nettoscorpRole: 'especialista-computacao-espacial',
    department: 'Geo & Dados Espaciais',
    clearance: 'restrito',
    authority: 'tecnica',
    knowledgeDomains: ['Spatial Computing', 'Digital Twin', '3D'],
    module: 'products',
    defaultTools: [],
    defaultSpecialty: 'Computação espacial e gêmeos digitais',
  },
  'game-development': {
    aaDivision: 'game-development',
    nettoscorpRole: 'desenvolvedor-de-games',
    department: 'Desenvolvimento de Jogos',
    clearance: 'restrito',
    authority: 'tecnica',
    knowledgeDomains: ['Unity', 'Unreal Engine', 'Game Design'],
    module: 'products',
    defaultTools: [],
    defaultSpecialty: 'Desenvolvimento de jogos',
  },
  support: {
    aaDivision: 'support',
    nettoscorpRole: 'agente-de-suporte',
    department: 'Suporte ao Cliente',
    clearance: 'publico',
    authority: 'operacional',
    knowledgeDomains: ['Atendimento ao Cliente', 'Sucesso do Cliente', 'Suporte Técnico'],
    module: 'customers',
    defaultTools: [],
    defaultSpecialty: 'Suporte e atendimento ao cliente',
  },
  testing: {
    aaDivision: 'testing',
    nettoscorpRole: 'engenheiro-de-qe',
    department: 'Qualidade & Automação QA',
    clearance: 'restrito',
    authority: 'tecnica',
    knowledgeDomains: ['QA', 'Automação de Testes', 'Playwright'],
    module: 'software-factory',
    defaultTools: ['playwright'],
    defaultSpecialty: 'Qualidade de software e automação de testes',
  },
  scripts: {
    aaDivision: 'scripts',
    nettoscorpRole: 'especialista-automacao',
    department: 'Operações',
    clearance: 'restrito',
    authority: 'operacional',
    knowledgeDomains: ['Scripts', 'Automação', 'CLI'],
    module: 'operations',
    defaultTools: [],
    defaultSpecialty: 'Automação via scripts e CLI',
  },
  // Entradas reservadas: divisões previstas para expansão do corpus até 21.
  // Ainda sem agentes no corpus-baseline; mapeamento funcional assim que aparecerem.
  'data-analytics': {
    aaDivision: 'data-analytics',
    nettoscorpRole: 'analista-de-dados',
    department: 'Dados & Analytics',
    clearance: 'restrito',
    authority: 'tecnica',
    knowledgeDomains: ['Data Engineering', 'Analytics', 'BI'],
    module: 'intelligence-factory',
    defaultTools: [],
    defaultSpecialty: 'Engenharia de dados e analytics',
    reserved: true,
  },
  'devops-sre': {
    aaDivision: 'devops-sre',
    nettoscorpRole: 'especialista-devops-sre',
    department: 'Infraestrutura & SRE',
    clearance: 'restrito',
    authority: 'tecnica',
    knowledgeDomains: ['DevOps', 'SRE', 'Cloud', 'Kubernetes'],
    module: 'operations',
    defaultTools: [],
    defaultSpecialty: 'DevOps e confiabilidade de infraestrutura',
    reserved: true,
  },
} as const;

/**
 * Lista todas as divisões registradas (21), incluindo reservadas.
 */
export function listDivisions(): DivisionRoleConfig[] {
  return Object.values(DIVISION_ROLE_REGISTRY);
}

/**
 * Lista apenas divisões com agentes presentes no corpus (não reservadas).
 */
export function liveDivisions(): DivisionRoleConfig[] {
  return Object.values(DIVISION_ROLE_REGISTRY).filter((d) => !d.reserved);
}

/**
 * Mapeia uma divisão AA para seu papel NettosCorp.
 * Divisão desconhecida → fallback degradado (nunca lança exceção).
 */
export function mapDivisionToRole(division: string): DivisionRoleConfig {
  const key = division.trim().toLowerCase();
  const exact = DIVISION_ROLE_REGISTRY[key];
  if (exact) return exact;

  return {
    aaDivision: division,
    nettoscorpRole: 'agente-operacional',
    department: 'Operações',
    clearance: 'restrito',
    authority: 'operacional',
    knowledgeDomains: ['operacional'],
    module: 'operations',
    defaultTools: [],
    defaultSpecialty: 'Agente operacional de propósito geral',
  };
}

/**
 * Campos nettoscorp default derivados de uma divisão (para merge no hireAgent).
 */
export function nettoscorpDefaultsForDivision(division: string): NettoscorpFrontmatter {
  const cfg = mapDivisionToRole(division);
  return {
    department: cfg.department,
    clearance: cfg.clearance,
    authority: cfg.authority,
    knowledge_domains: cfg.knowledgeDomains,
  };
}
