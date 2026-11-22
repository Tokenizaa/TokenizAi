/**
 * @nettoscorp/plugin-sdk — ponto de entrada do pacote
 *
 * SDK v2: protocolo duplex, definePlugin (ganchos de ciclo de vida),
 * fabrica de host e tipos. Plugin authors importam `definePlugin` aqui.
 */

export { createHost, type CreateHostOptions, type Host, PluginLoadError } from './host';
export { definePlugin, type DefinePluginOptions, PluginDefinitionError } from './define-plugin';
export {
  createChannelPair,
  type DuplexChannel,
  type DuplexMessage,
  type MessageType,
  type RpcError,
  type RpcResult,
  type RpcResponse,
} from './protocol';
export type { Plugin, PluginContext, PluginManifest, PluginHooks, PluginRegistration } from './types';
