/**
 * @nettoscorp/kernel — ponto de entrada do pacote.
 *
 * `ModuleLoader` eh exportado apenas como valor (classe) de './module-loader';
 * nao e re-exportado como tipo de './module' para evitar identificador duplicado.
 */

export type {
  Module,
  ModuleConfig,
  ModuleRoute,
  ModuleServiceFactory,
  ModuleUI,
  ModuleMigration,
  ModuleLifecycle,
  ModuleHealth,
  DIContainer,
  EventBus,
} from './module';
export { DiContainer } from './di-container';
export { SimpleEventBus } from './event-bus';
export { ModuleLoader } from './module-loader';
