/**
 * @nettoscorp/plugin-sdk — Tipos centrais do SDK v2
 *
 * Contrato entre o host (aplicacao) e um plugin. Um plugin eh um modulo ESM que
 * exporta um objeto criado com `definePlugin()`. O host carrega o plugin, executa
 * seus ciclos de vida e expande capacidades via `PluginContext`.
 */

export interface PluginManifest {
  /** Nome unico do plugin (usado no barramento e logs). */
  name: string;
  /** Versao semantica do plugin. */
  version: string;
  /** Descricao curta para o --help e listagem de plugins. */
  description?: string;
  /** Ponto de entrada do plugin (resolvido pelo host). */
  entry: string;
}

/** Capacidades que o host oferece ao plugin. */
export interface PluginContext {
  /** Escreve uma mensagem de log com nível. */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: unknown): void;
  /** Emite um evento no barramento interno do host. */
  emit(event: string, payload: unknown): void;
  /** Assina a um evento do host. Retorna funcao de cancelamento. */
  on(event: string, listener: (payload: unknown) => void): () => void;
  /** Chamada RPC tipada para outro plugin/servico do host. */
  rpc<T = unknown>(target: string, method: string, params?: unknown): Promise<T>;
  /** Configuracao do host (somente leitura). */
  config: Record<string, unknown>;
}

/** Resultado de registro de um plugin. */
export interface PluginRegistration {
  name: string;
  version: string;
  hooks: PluginHooks;
}

/** Ganchos de ciclo de vida expostos pelo plugin ao host. */
export interface PluginHooks {
  /** Executado quando o plugin eh carregado. Pode retornar Promise. */
  setup?: (context: PluginContext) => unknown | Promise<unknown>;
  /** Executado ao desligar o plugin. */
  teardown?: () => unknown | Promise<unknown>;
  /** Lista de eventos que o plugin quer escutar automaticamente. */
  subscriptions?: string[];
}

/** Definicao crua de um plugin, antes da validacao/normalizacao. */
export interface RawPluginDefinition {
  name: string;
  version: string;
  description?: string;
  hooks?: PluginHooks;
}

/** Plugin validado e pronto para ser carregado pelo host. */
export interface Plugin {
  readonly manifest: PluginManifest;
  readonly hooks: Required<PluginHooks>;
}
