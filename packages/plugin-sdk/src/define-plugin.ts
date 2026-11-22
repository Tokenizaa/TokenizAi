/**
 * @nettoscorp/plugin-sdk — fabrica de definicao de plugin (`definePlugin`)
 *
 * Plugin authors usam esta funcao para declarar um plugin. Ela valida os campos
 * obrigatorios e normaliza os ganchos ausentes, produzindo um objeto seguro para
 * o host carregar. Erros apontam exatamente o que consertar.
 */

import type { Plugin, RawPluginDefinition, PluginHooks, PluginManifest } from './types';

/** Erro de validacao de definicao de plugin. */
export class PluginDefinitionError extends Error {
  constructor(public field: string, message: string) {
    super(`[definePlugin] ${field}: ${message}`);
    this.name = 'PluginDefinitionError';
  }
}

/** Opcoes de validacao de `definePlugin`. */
export interface DefinePluginOptions {
  definition: RawPluginDefinition;
  /** Nome do arquivo de origem (para mensagens de erro). */
  source?: string;
}

/** Valida e normaliza uma definicao crua de plugin. */
export function definePlugin(options: DefinePluginOptions): Plugin {
  const { definition, source } = options;
  const src = source ? ` (${source})` : '';

  // nome: obrigatorio, nao vazio, kebab-ish (sem espacos)
  if (!definition.name || typeof definition.name !== 'string') {
    throw new PluginDefinitionError(
      'name',
      `nome do plugin e obrigatorio${src}. Ex: definePlugin({ name: 'meu-plugin', version: '1.0.0' })`,
    );
  }
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(definition.name)) {
    throw new PluginDefinitionError(
      'name',
      `nome '${definition.name}' invalido${src}. Use letras minusculas, numeros e hifens, nao comece ou termine com hifen.`,
    );
  }

  // versao: obrigatorio, formato semantico simplificado
  if (!definition.version || typeof definition.version !== 'string') {
    throw new PluginDefinitionError(
      'version',
      `versao e obrigatoria${src}. Ex: version: '1.0.0'`,
    );
  }
  if (!/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/.test(definition.version)) {
    throw new PluginDefinitionError(
      'version',
      `versao '${definition.version}' invalida${src}. Use formato semantico, ex: '1.0.0' ou '1.0.0-beta.1'.`,
    );
  }

  // descricao opcional
  const description =
    definition.description !== undefined && typeof definition.description !== 'string'
      ? (() => {
          throw new PluginDefinitionError(
            'description',
            `descricao deve ser uma string${src}.`,
          );
        })()
      : definition.description;

  const hooks: Required<PluginHooks> = {
    setup: definition.hooks?.setup ?? (async () => undefined),
    teardown: definition.hooks?.teardown ?? (async () => undefined),
    subscriptions: definition.hooks?.subscriptions ?? [],
  };

  const manifest: PluginManifest = {
    name: definition.name,
    version: definition.version,
    ...(description ? { description } : {}),
    entry: '', // preenchido pelo host ao carregar
  };

  return {
    manifest,
    hooks,
  } as Plugin;
}
