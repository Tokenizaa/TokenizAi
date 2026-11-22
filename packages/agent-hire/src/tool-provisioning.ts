/**
 * @nettoscorp/agent-hire/src/tool-provisioning
 *
 * Provisionamento automático de um agente contratado nas ferramentas/runtimes
 * configuradas da plataforma (protocols ACP e MCP).
 *
 * Regras de arquitetura (Backend Architect):
 * - Least privilege: cada installment carrega apenas as permissões do papel
 *   (config.permissions), nunca escopo total.
 * - Bulkhead: falha em um runtime/target não interrompe os demais — cada par
 *   (tool, runtime) é provisionado isoladamente e erros são registrados, não propagados.
 * - Idempotência: mesmo input (agent + tools + runtimes) produz o mesmo contrato;
 *   re-executar provisionamento duplica nada (é um contrato de instalação, não grava estado externo).
 * - Observabilidade: log estruturado com correlation id em cada etapa.
 *
 * Esta camada é pura localmente: não acessa rede nem grava sistema de arquivos do
 * alvo. Em produção, cada installment.target é o ponto de integração com o registro
 * ACP/MCP real do tenant.
 */

import { generateUUID } from '@nettoscorp/shared';
import type {
  AgentConfigBase,
  ToolInstallment,
  ToolProvisioningOptions,
  ToolProvisioningResult,
  ToolRuntime,
} from './types';
import { DEFAULT_PROVISIONING_RUNTIMES } from './types';

type LogLevel = 'info' | 'warn' | 'error';

export async function provisionAgentTools(
  config: AgentConfigBase,
  options: ToolProvisioningOptions = {},
): Promise<ToolProvisioningResult> {
  const correlationId = options.correlationId ?? `provision-${generateUUID().slice(0, 8)}`;
  const runtimes: ToolRuntime[] = options.runtimes ?? DEFAULT_PROVISIONING_RUNTIMES;
  const tools = [...new Set(config.tools.filter(Boolean))];
  const now = () => new Date().toISOString();

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level,
        ts: now(),
        cid: correlationId,
        component: 'tool-provisioning',
        message,
        ...(meta ? { meta } : {}),
      }),
    );
  };

  log('info', 'tool-provisioning: iniciado', {
    agentId: config.id,
    slug: config.slug,
    role: config.role,
    tools,
    runtimes,
    dryRun: options.dryRun,
  });

  const provisioned: ToolInstallment[] = [];

  for (const tool of tools) {
    for (const runtime of runtimes) {
      const installedAt = now();
      const target = `${runtime}://agents/${encodeURIComponent(
        config.slug,
      )}/tools/${encodeURIComponent(tool)}`;

      const installmentBase: ToolInstallment = {
        tool,
        runtime,
        status: 'installed',
        target,
        installedAt,
        config: {
          runtime,
          tool,
          agentId: config.id,
          slug: config.slug,
          role: config.role,
          division: config.division,
          permissions: config.permissions, // least privilege: apenas permissões do papel
          authority: config.nettoscorp.authority,
          clearance: config.nettoscorp.clearance,
          provisionedBy: '@nettoscorp/agent-hire',
          protocol: runtime,
        },
      };

      if (options.dryRun) {
        provisioned.push({ ...installmentBase, status: 'skipped' });
        log('warn', 'tool-provisioning: dry-run, instalação pulada', {
          tool,
          runtime,
          target,
        });
        continue;
      }

      try {
        // Deterministic local provisioning: monta o contrato de instalação no alvo
        // ACP/MCP. Não há chamada de rede aqui — o target é o ponto de integração
        // com o registro de ferramentas do tenant (ex. registro MCP do Paperclip
        // Runtime ou gateway ACP do cliente).
        provisioned.push({ ...installmentBase, status: 'installed' });
        log('info', 'tool-provisioning: instalado', { tool, runtime, target });
      } catch (err) {
        // Bulkhead: um alvo falhando não aborta os demais.
        provisioned.push({
          ...installmentBase,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
        log('error', 'tool-provisioning: falha no alvo (isolada)', {
          tool,
          runtime,
          target,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const installedCount = provisioned.filter((i) => i.status === 'installed').length;
  const failedCount = provisioned.filter((i) => i.status === 'failed').length;

  const result: ToolProvisioningResult = {
    agentId: config.id,
    slug: config.slug,
    runtimes,
    provisioned,
    installedCount,
    failedCount,
    completedAt: now(),
  };

  log('info', 'tool-provisioning: concluído', {
    agentId: config.id,
    installedCount,
    failedCount,
    runtimes: result.runtimes,
  });

  return result;
}

export type {
  ToolProvisioningOptions,
  ToolProvisioningResult,
  ToolInstallment,
  ToolRuntime,
} from './types';
export { DEFAULT_PROVISIONING_RUNTIMES } from './types';
