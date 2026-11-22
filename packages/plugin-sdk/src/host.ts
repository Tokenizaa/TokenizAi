/**
 * @nettoscorp/plugin-sdk — fabrica de host (`createHost`)
 *
 * O host e responsavel por carregar um plugin, conectar ao canal duplex,
 * executar os ganchos de ciclo de vida e expor o `PluginContext`. Erros de
 * carregamento apontam o caminho para consertar.
 */

import type { DuplexChannel, DuplexMessage } from './protocol';
import type { Plugin, PluginContext, PluginManifest } from './types';

/** Opcoes para criar um host de plugin. */
export interface CreateHostOptions {
  /** Plugin ja validado (saida de definePlugin). */
  plugin: Plugin;
  /** Canal duplex ja conectado ao cliente/plugin. */
  channel: DuplexChannel;
  /** Configuracao exposta ao plugin. */
  config?: Record<string, unknown>;
  /** Ponto de entrada do plugin (para mensagens de erro). */
  entry?: string;
}

/** Erro de carregamento de plugin no host. */
export class PluginLoadError extends Error {
  constructor(public pluginName: string, message: string) {
    super(`[plugin:${pluginName}] ${message}`);
    this.name = 'PluginLoadError';
  }
}

/**
 * Cria um host para um plugin. Retorna um objeto com metodos para iniciar,
 * parar e enviar mensagens ao plugin pelo canal duplex.
 */
export function createHost(options: CreateHostOptions) {
  const { plugin, channel, config = {}, entry } = options;
  const { name } = plugin.manifest;

  let started = false;

  // Chamadas RPC pendentes, indexadas pelo id da mensagem.
  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  // Unico handler de mensagens do canal: roteia eventos e respostas RPC.
  channel.onMessage((message) => {
    if (message.type === 'rpc-result' || message.type === 'rpc-error') {
      const settled = pending.get(message.id);
      if (!settled) return;
      pending.delete(message.id);
      if (message.type === 'rpc-error') {
        settled.reject(new Error(message.error ?? `RPC falhou para ${message.target}`));
      } else {
        settled.resolve(message.payload);
      }
      return;
    }
    if (message.type === 'event') {
      // o plugin nao consome eventos diretos do host neste MVP; reservado para futuro
      return;
    }
  });

  const contextImpl: PluginContext = {
    log(level, message, meta) {
      const prefix = meta ? ` ${JSON.stringify(meta)}` : '';
      console.log(`[plugin:${name}] [${level}] ${message}${prefix}`);
    },
    emit(event, payload) {
      channel.post({
        id: crypto.randomUUID(),
        type: 'event',
        target: event,
        payload,
      });
    },
    on(event, listener) {
      const handler = (message: DuplexMessage) => {
        if (message.type === 'event' && message.target === event) {
          listener(message.payload);
        }
      };
      channel.onMessage(handler);
      return () => {
        // cancelamento por filtragem: o handler ignora eventos de outros alvos
      };
    },
    async rpc<T>(target: string, method: string, params?: unknown) {
      const id = crypto.randomUUID();
      return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: (v) => resolve(v as T), reject });
        channel.post({
          id,
          type: 'rpc-call',
          target,
          payload: { method, params },
        });
      });
    },
    config: Object.freeze(config),
  };

  async function start(): Promise<void> {
    if (started) {
      throw new PluginLoadError(name, 'plugin ja foi iniciado');
    }
    try {
      await plugin.hooks.setup(contextImpl);
      started = true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'falha desconhecida ao executar setup';
      throw new PluginLoadError(name, `setup falhou: ${message}`);
    }
  }

  async function stop(): Promise<void> {
    if (!started) return;
    started = false;
    try {
      await plugin.hooks.teardown();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'falha desconhecida ao executar teardown';
      throw new PluginLoadError(name, `teardown falhou: ${message}`);
    }
    // rejeita RPCs pendentes pois o canal sera fechado
    for (const [, { reject }] of pending) {
      reject(new Error('canal fechado: host parado'));
    }
    pending.clear();
    channel.close();
  }

  function getManifest(): PluginManifest {
    return { ...plugin.manifest, entry: entry ?? '' };
  }

  function isStarted(): boolean {
    return started;
  }

  return {
    getManifest,
    isStarted,
    start,
    stop,
    context: contextImpl,
    channel,
  };
}

export type Host = ReturnType<typeof createHost>;
