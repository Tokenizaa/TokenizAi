/**
 * Catalogo de modulos da plataforma NettosCorp Enterprise (Fase 5).
 *
 * Cada entrada associa o id do modulo ao caminho do entrypoint `module.ts`.
 * O `ModuleLoader` carrega dinamicamente e ordena por `dependencies`.
 */

export const MODULES = [
  { id: 'gateway', path: './modules/gateway/module.ts' },
  { id: 'chat', path: './modules/chat/module.ts' },
  { id: 'org', path: './modules/org/module.ts' },
  { id: 'tasks', path: './modules/tasks/module.ts' },
  { id: 'runtime', path: './modules/runtime/module.ts' },
  { id: 'projects', path: './modules/projects/module.ts' },
  { id: 'finance', path: './modules/finance/module.ts' },
  { id: 'commercial', path: './modules/commercial/module.ts' },
  { id: 'marketing', path: './modules/marketing/module.ts' },
  { id: 'products', path: './modules/products/module.ts' },
  { id: 'customers', path: './modules/customers/module.ts' },
  { id: 'people', path: './modules/people/module.ts' },
  { id: 'operations', path: './modules/operations/module.ts' },
  { id: 'agency-library', path: './modules/agency-library/module.ts' },
  { id: 'team-composer', path: './modules/team-composer/module.ts' },
  { id: 'operational-agents', path: './modules/operational-agents/module.ts' },
  { id: 'governance', path: './modules/governance/module.ts' },
  { id: 'admin', path: './modules/admin/module.ts' },
] as const;

export type ModuleId = (typeof MODULES)[number]['id'];
