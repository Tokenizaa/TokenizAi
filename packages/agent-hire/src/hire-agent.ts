/**
 * @nettoscorp/agent-hire/src/hire-agent
 *
 * Endpoint de contratação de agentes da Agency (Fase 7).
 *
 * Fluxo (Backend Architect — contrato estruturado, sem side effects silenciosos):
 *   1. Validação de entrada (Zod): slug obrigatório + opções de contratação.
 *   2. corpusGet(slug) — leitura do agente no corpus (fallback chain: Paperclip
 *      → catalog-sync → HTTP; erro descritivo, nunca silencioso).
 *   3. Parse do frontmatter Agency + mapeamento divisão AA → papel NettosCorp
 *      (config-driven; fallback degradado para divisões desconhecidas).
 *   4. Extensão frontmatter `nettoscorp` com precedência:
 *      defaults do mapeamento < bloco do arquivo < opções de contratação.
 *   5. Validação Zod do contrato nettoscorp (defesa contra prompt injection:
 *      conteúdo externo só entra no AgentConfig após passar pelo schema).
 *   6. Permissões de least privilege via MODULE_PERMISSIONS do módulo da divisão.
 *   7. Provisionamento de ferramentas (tool-provisioning): instala em 3+
 *      runtimes ACP/MCP por padrão (mcp-stdio, mcp-http, acp).
 *   8. Vinculação de orçamento (budget-binding): budget_policy derivada da
 *      autoridade do papel (DEFAULT_MONTHLY_BUDGET_BY_AUTHORITY).
 *
 * Observabilidade: logs estruturados com correlation id (cid) em cada etapa.
 * Não escreve em banco nem cria instâncias — devolve o contrato de contratação.
 */

import { z } from 'zod';
import { generateUUID } from '@nettoscorp/shared';
import { MODULE_PERMISSIONS } from '@nettoscorp/auth';
import { corpusGet, type CorpusGetResult } from './corpus-client';
import {
  mapDivisionToRole,
  type DivisionRoleConfig,
} from './division-mapping';
import {
  NettoscorpFrontmatterSchema,
  extractNettoscorpBlock,
  mergeNettoscorpFrontmatter,
  parseAgentFrontmatter,
} from './frontmatter-extension';
import { bindAgentBudget } from './budget-binding';
import { provisionAgentTools } from './tool-provisioning';
import {
  authorizeHire,
  type HireContext,
} from './rbac-hire';
import {
  PaperclipClient,
  PaperclipClientError,
  buildPaperclipSpec,
  validateHireSpec,
} from './paperclip-client';
import type {
  AgentConfig,
  AgentConfigBase,
  HireOptions,
  NettoscorpFrontmatter,
  PaperclipAgentResult,
} from './types';

/** Validação de entrada do endpoint hireAgent. */
export const HireAgentInputSchema = z.object({
  slug: z.string().min(1, 'slug é obrigatório').trim(),
  divisionOverride: z.string().optional(),
  department: z.string().optional(),
  clearance: z.string().optional(),
  authority: z.string().optional(),
  knowledge_domains: z.array(z.string()).optional(),
  runtimeEngine: z
    .enum(['Paperclip Runtime', 'TokenizAi Native Orchestrator'])
    .optional(),
  projectId: z.string().optional(),
  dryRun: z.boolean().optional(),
  httpBase: z.string().url().optional(),
  correlationId: z.string().optional(),
});

export class AgentHireError extends Error {
  constructor(message: string, public readonly slug?: string) {
    super(message);
    this.name = 'AgentHireError';
  }
}

/**
 * Contrata um agente da Agency por slug.
 *
 * Devolve AgentConfig completo: contrato de instância + provisionamento de
 * ferramentas (3+ runtimes ACP/MCP) + orçamento vinculado ao papel.
 *
 * Exemplo:
 *   import { hireAgent } from '@nettoscorp/agent-hire';
 *   const config = await hireAgent('engineering-senior-developer');
 *   // config.tools → ['typescript','node','git','docker']
 *   // config.toolProvisioning.installedCount → 12 (4 tools × 3 runtimes)
 *   // config.budgetPolicy.monthlyBudgetBRL → 3000 (autoridade 'tecnica')
 */
export async function hireAgent(
  slug: string,
  options: HireOptions = {},
): Promise<AgentConfig> {
  const correlationId = options.correlationId ?? `hire-${generateUUID().slice(0, 8)}`;
  const now = () => new Date().toISOString();

  const log = (
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>,
  ) => {
    console.log(
      JSON.stringify({
        level,
        ts: now(),
        cid: correlationId,
        component: 'hire-agent',
        message,
        ...(meta ? { meta } : {}),
      }),
    );
  };

  log('info', 'hireAgent: iniciado', {
    slug,
    dryRun: options.dryRun,
    divisionOverride: options.divisionOverride,
  });

  // 0. Autorização RBAC — nenhuma contratação sem permissão válida
  //    O cliente nunca é a autoridade: a decisão é sempre tomada no servidor.
  const hireCtx: HireContext = {
    actorId: options.actorId ?? 'system',
    actorRole: (options.actorRole ?? 'recruiter') as
      | 'recruiter'
      | 'hiring_manager'
      | 'department_head'
      | 'security_officer'
      | 'company_admin'
      | 'platform_admin',
    actorCompanyId: options.actorCompanyId ?? 'system',
    actorDepartment: options.actorDepartment,
    correlationId,
  };
  try {
    authorizeHire('hire.request', hireCtx);
  } catch (err) {
    log('warn', 'hireAgent: autorização RBAC negada', {
      slug,
      reason: err instanceof Error ? err.message : String(err),
    });
    throw new AgentHireError(
      `Contratação não autorizada: ${err instanceof Error ? err.message : String(err)}`,
      slug,
    );
  }

  // 1. Validação de entrada
  HireAgentInputSchema.parse({ slug, ...options });

  // 2. Leitura do agente no corpus (fallback chain interna ao corpusGet)
  let corpusResult: CorpusGetResult;
  try {
    corpusResult = await corpusGet(slug, {
      httpBase: options.httpBase,
    });
  } catch (err) {
    log('error', 'corpusGet falhou', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AgentHireError(
      `Não foi possível contratar "${slug}": ${err instanceof Error ? err.message : String(err)}`,
      slug,
    );
  }

  // 3. Parse do frontmatter do agente (campos originais da Agency)
  const parsed = parseAgentFrontmatter(corpusResult.rawSource);

  // 4. Mapeamento de divisão AA → papel NettosCorp (config-driven; fallback degradado)
  const division = options.divisionOverride ?? corpusResult.division;
  const roleConfig: DivisionRoleConfig = mapDivisionToRole(division);

  // 5. Extensão frontmatter: nettoscorp com precedência
  //    defaults do mapeamento < bloco nettoscorp do arquivo < opções de contratação
  const fileNettoscorp = extractNettoscorpBlock(parsed.rawYaml).nettoscorp;
  const merged = mergeNettoscorpFrontmatter(
    {
      department: roleConfig.department,
      clearance: roleConfig.clearance,
      authority: roleConfig.authority,
      knowledge_domains: roleConfig.knowledgeDomains,
    },
    fileNettoscorp,
    {
      department: options.department ?? undefined,
      clearance: options.clearance ?? undefined,
      authority: options.authority ?? undefined,
      knowledge_domains: options.knowledge_domains ?? undefined,
    },
  );

  // 6. Validação de schema — contrato estruturado, defesa contra prompt injection
  const nettoscorp: NettoscorpFrontmatter = NettoscorpFrontmatterSchema.parse(
    merged,
  );

  // 7. Permissões de least privilege derivadas do módulo (nunca escopo total)
  const permissions: string[] = [];
  const modulePerms = MODULE_PERMISSIONS[roleConfig.module];
  if (modulePerms) {
    permissions.push(...modulePerms);
  }

  const base: AgentConfigBase = {
    id: generateUUID(),
    code: slug,
    slug,
    name: parsed.name ?? slug,
    division,
    role: roleConfig.nettoscorpRole,
    nettoscorp,
    specialty: parsed.description ?? roleConfig.defaultSpecialty,
    summary: parsed.description ?? '',
    instructions: parsed.body,
    tools: [...roleConfig.defaultTools],
    permissions,
    rawSource: corpusResult.rawSource,
    source: corpusResult.source,
    hiredAt: now(),
  };

  log('info', 'hireAgent: contrato base montado', {
    slug,
    role: base.role,
    department: base.nettoscorp.department,
    clearance: base.nettoscorp.clearance,
    authority: base.nettoscorp.authority,
    tools: base.tools,
    permissions: base.permissions,
    source: base.source,
  });

  // 8. Provisionamento de ferramentas em 3+ runtimes ACP/MCP por padrão
  const toolProvisioning = await provisionAgentTools(base, {
    correlationId,
    dryRun: options.dryRun,
  });

  // 9. Vinculação de orçamento derivada da autoridade do papel
  const budget = await bindAgentBudget(base, {
    correlationId,
    dryRun: options.dryRun,
    companyId: undefined, // preenchido pelo contexto autenticado no serviço caller
    projectId: options.projectId,
  });

  const config: AgentConfig = {
    ...base,
    toolProvisioning,
    budgetPolicy: budget.policy,
  };

  // 10. Cria a instância operacional no Paperclip (se não for dry-run)
  //     Não falha a contratação se o Paperclip estiver indisponível —
  //     o AgentConfig ainda é válido, apenas sem a instância remota.
  let paperclipAgent: PaperclipAgentResult | undefined;
  if (!options.dryRun) {
    try {
      const paperclipClient = new PaperclipClient({
        baseUrl: options.paperclipBaseUrl,
        apiKey: options.paperclipApiKey,
      });
      const spec = buildPaperclipSpec(
        slug,
        roleConfig.nettoscorpRole,
        roleConfig.department,
        roleConfig.clearance,
        roleConfig.authority,
        roleConfig.knowledgeDomains,
        roleConfig.module,
        roleConfig.defaultTools,
        parsed.body,
        budget.policy.monthlyBudgetBRL,
      );
      validateHireSpec(spec);
      const created = await paperclipClient.hireAgent(spec);
      paperclipAgent = {
        id: created.id,
        slug: created.slug,
        name: created.name,
        role: created.role,
        status: created.status,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
      log('info', 'hireAgent: instância criada no Paperclip', {
        slug,
        paperclipAgentId: created.id,
        paperclipAgentStatus: created.status,
      });
    } catch (err) {
      if (err instanceof PaperclipClientError) {
        log('warn', 'hireAgent: Paperclip indisponível, continuando sem instância remota', {
          slug,
          code: err.code,
          reason: err.message,
        });
      } else {
        log('error', 'hireAgent: erro inesperado ao criar instância no Paperclip', {
          slug,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      // Não interrompe a contratação: o AgentConfig ainda é válido localmente
    }
  }

  const configWithPaperclip: AgentConfig = {
    ...config,
    ...(paperclipAgent ? { paperclipAgent } : {}),
  };

  log('info', 'hireAgent: concluído', {
    slug,
    role: configWithPaperclip.role,
    department: configWithPaperclip.nettoscorp.department,
    clearance: configWithPaperclip.nettoscorp.clearance,
    authority: configWithPaperclip.nettoscorp.authority,
    tools: configWithPaperclip.tools,
    permissions: configWithPaperclip.permissions,
    source: configWithPaperclip.source,
    installedTools: configWithPaperclip.toolProvisioning.installedCount,
    runtimes: configWithPaperclip.toolProvisioning.runtimes,
    paperclipAgent: configWithPaperclip.paperclipAgent
      ? { id: configWithPaperclip.paperclipAgent.id, status: configWithPaperclip.paperclipAgent.status }
      : undefined,
    budgetPolicy: {
      policyId: configWithPaperclip.budgetPolicy.policyId,
      monthlyBudgetBRL: configWithPaperclip.budgetPolicy.monthlyBudgetBRL,
      maxExecutionsPerDay: configWithPaperclip.budgetPolicy.maxExecutionsPerDay,
      source: configWithPaperclip.budgetPolicy.source,
    },
  });

  return configWithPaperclip;
}

export type { HireOptions } from './types';
