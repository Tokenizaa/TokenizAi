/**
 * @nettoscorp/auth — Core types and configuration for authentication and authorization
 * 
 * Pure type definitions and constants for clearance, permissions, authority levels,
 * and user roles. Self-contained within the package scope.
 * 
 * Build: tsup (configured in package.json)
 * Type-check: tsc --noEmit (per-file, single module)
 */

/**
 * Clearance level hierarchy — hierarchical clearance levels
 * Publico < Restrito < Gerencial < Estratégica < Confidencial
 * Provides both runtime values and TypeScript types via enum.
 */
export enum ClearanceLevel {
  PUBLICO = 'publico',
  RESTRITO = 'restrito',
  GERENCIAL = 'gerencial',
  ESTRATEGICA = 'estratégica',
  CONFIDENCIAL = 'confidencial',
}

/**
 * Permission level granularity — granular permission levels
 * ler < escrever < gerenciar < admin
 */
export enum PermissionLevel {
  LER = 'ler',
  ESCREVER = 'escrever',
  GERENCIAR = 'gerenciar',
  ADMIN = 'admin',
}

/**
 * Authority level hierarchy — authority levels for RBAC
 * executiva_humana > estratégica_delegada > gerencial > operacional > técnica
 */
export enum AuthorityLevel {
  EXECUTIVA_HUMANA = 'executiva_humana',
  ESTRATEGICA_DELEGADA = 'estrategica_delegada',
  GERENCIAL = 'gerencial',
  OPERACIONAL = 'operacional',
  TECNICA = 'tecnica',
}

/**
 * User role definitions — all available user roles in the system
 */
export enum UserRole {
  DIRECAO_EXECUTIVA = 'direcao_executiva',
  GESTOR = 'gestor',
  FINANCEIRO = 'financeiro',
  COMERCIAL = 'comercial',
  OPERACOES = 'operacoes',
  DESENVOLVIMENTO = 'desenvolvimento',
  IA = 'ia',
  RH = 'rh',
  AUDITORIA = 'auditoria',
  OPERACIONAL = 'operacional',
}

/**
 * Default authority level mapping per role
 * Define o nível de autoridade padrão para cada role
 */
export const ROLE_DEFAULT_AUTHORITY: Record<string, string> = {
  [UserRole.DIRECAO_EXECUTIVA]: AuthorityLevel.EXECUTIVA_HUMANA,
  [UserRole.GESTOR]: AuthorityLevel.GERENCIAL,
  [UserRole.FINANCEIRO]: AuthorityLevel.GERENCIAL,
  [UserRole.COMERCIAL]: AuthorityLevel.OPERACIONAL,
  [UserRole.OPERACOES]: AuthorityLevel.OPERACIONAL,
  [UserRole.DESENVOLVIMENTO]: AuthorityLevel.TECNICA,
  [UserRole.IA]: AuthorityLevel.ESTRATEGICA_DELEGADA,
  [UserRole.RH]: AuthorityLevel.GERENCIAL,
  [UserRole.AUDITORIA]: AuthorityLevel.EXECUTIVA_HUMANA,
  [UserRole.OPERACIONAL]: AuthorityLevel.OPERACIONAL,
}

/**
 * Module ID — all available modules in the NettosCorp platform
 * Provides both runtime values and TypeScript types via enum.
 */
export enum ModuleId {
  EXECUTIVE = 'executive',
  CHAT = 'chat',
  FINANCE = 'finance',
  COMMERCIAL = 'commercial',
  CUSTOMERS = 'customers',
  MARKETING = 'marketing',
  PRODUCTS = 'products',
  PROJECTS = 'projects',
  'SOFTWARE-FACTORY' = 'software-factory',
  'INTELLIGENCE-FACTORY' = 'intelligence-factory',
  OPERATIONS = 'operations',
  'AGENCY-LIBRARY' = 'agency-library',
  'TEAM-COMPOSER' = 'team-composer',
  'OPERATIONAL-AGENTS' = 'operational-agents',
  PEOPLE = 'people',
  GOVERNANCE = 'governance',
  ADMIN = 'admin',
}

/**
 * Module permission mapping — permitted actions per module
 */
export const MODULE_PERMISSIONS: Record<string, string[]> = {
  executive: ['view_dashboard', 'manage_organization'],
  chat: ['send_messages', 'create_threads'],
  finance: ['view_finances', 'manage_contracts'],
  commercial: ['view_pipeline', 'create_opportunities'],
  customers: ['view_customers', 'manage_accounts'],
  marketing: ['create_campaigns', 'view_analytics'],
  products: ['view_products', 'manage_catalog'],
  projects: ['view_projects', 'create_tasks'],
  'software-factory': ['manage_repos', 'run_deploys'],
  'intelligence-factory': ['deploy_models', 'manage_ai_solutions'],
  operations: ['manage_tasks', 'run_executions'],
  'agency-library': ['view_agents', 'hire_agents'],
  'team-composer': ['create_teams', 'manage_compositions'],
  'operational-agents': ['manage_instances', 'configure_tools'],
  people: ['view_org_chart', 'manage_capacity'],
  governance: ['view_audit', 'manage_governance'],
  admin: ['manage_users', 'manage_system'],
}

/**
 * User clearance structure — clearance assignment per user
 */
export interface UserClearance {
  level: ClearanceLevel;
  roles: UserRole[];
  departmentIds: string[];
  projectIds: string[];
}

/**
 * Module permissions structure — permission assignment per module
 */
export interface ModulePermissionsStruct {
  module: string;
  permission: PermissionLevel;
  grantedBy: string;
  grantedAt: string;
}

/**
 * Role authority configuration — authority assignment per role
 */
export interface RoleAuthority {
  role: string;
  authorityLevel: AuthorityLevel;
  allowedClearance: ClearanceLevel[];
  minPermission: PermissionLevel;
}
