/**
 * @nettoscorp/kernel — Contrato de Módulo (Fase 5)
 *
 * Define a interface `Module` que todo módulo de negócio deve exportar
 * (arquivo default de `modules/<id>/module.ts`).
 *
 * Regras de arquitetura respeitadas:
 *  - Este pacote (kernel) é framework-agnostico: nao depende de Express,
 *    banco de dados, transporte (MCP/ACP) ou UI. Apenas define o contrato.
 *  - Direcao de dependencia protegida: modulos dependem do kernel e do
 *    @nettoscorp/* (shared/auth/db); o kernel nao depende de modulo algum.
 *  - Rotas sao o unico ponto onde o servidor web vaza para dentro de um
 *    modulo; o adapter do kernel converte para a assinatura do servidor web.
 */

export interface ModuleConfig {
  enabled: boolean;
  routePrefix?: string; // ex: '/api/chat'
  features?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface ModuleRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'use';
  path: string;
  /**
   * Handler de rota. Tipado de forma agnostica a framework para nao vazar
   * Express no dominio do modulo. O adapter do kernel converte para a
   * assinatura do servidor web em uso.
   */
  handler: (req: unknown, res: unknown, next?: unknown) => unknown | Promise<unknown>;
  middleware?: unknown[];
}

export interface ModuleServiceFactory<T = unknown> {
  name: string;
  deps?: string[]; // nomes de servicos ja registrados no container DI
  factory: (container: DIContainer) => T | Promise<T>;
}

export interface ModuleUI {
  /**
   * Carregamento preguiçoso do modulo de frontend (React.lazy / code split).
   * Retorna um componente React default.
   */
  lazy: () => Promise<{ default: unknown }>;
  route?: string; // rota do frontend, ex: '/chat'
  navigation?: {
    label: string;
    icon?: string;
    order: number;
    moduleId: string;
  };
}

export interface ModuleMigration {
  version: string; // ex: '20261122000000'
  name: string;
  up: (db: unknown) => unknown | Promise<unknown>;
  down?: (db: unknown) => unknown | Promise<unknown>;
  sql?: string; // SQL bruto (Supabase / Drizzle)
}

export interface ModuleLifecycle {
  init?: (container: DIContainer) => unknown | Promise<unknown>;
  teardown?: () => unknown | Promise<unknown>;
}

export interface ModuleHealth {
  check?: () => Promise<{ ok: boolean; details?: Record<string, unknown> }>;
}

export interface DIContainer {
  register<T>(name: string, factory: () => T | Promise<T>, deps?: string[]): void;
  resolve<T>(name: string): T | undefined;
  has(name: string): boolean;
}

export interface EventBus {
  emit(event: string, payload: unknown): void;
  on(event: string, listener: (payload: unknown) => void): () => void;
  off(event: string, listener: (payload: unknown) => void): void;
}

export interface ModuleLoader {
  load(moduleId: string): Promise<Module>;
  loadAll(moduleIds: string[]): Promise<Module[]>;
  sorted(modules: Module[]): Module[];
}

export interface Module {
  id: string;
  name: string;
  version: string;
  config: ModuleConfig;
  dependencies?: string[]; // outros modulos dos quais este depende (ordem de carga)
  routes?: () => ModuleRoute[] | Promise<ModuleRoute[]>;
  services?: () => ModuleServiceFactory[];
  migrations?: () => ModuleMigration[];
  ui?: ModuleUI;
  init?: ModuleLifecycle['init'];
  teardown?: ModuleLifecycle['teardown'];
  health?: ModuleHealth['check'];
}
