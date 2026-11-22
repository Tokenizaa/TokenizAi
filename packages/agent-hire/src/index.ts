/**
 * @nettoscorp/agent-hire/src/index
 *
 * Orquestração da contratação de agentes da Agency (Fase 7).
 *
 * Fluxo:
 *   1. corpusGet(slug) — lê o agente do Paperclip corpus (fallback catalog-sync / HTTP)
 *   2. division-mapping — divisão AA → papel/departamento/clearance/authority NettosCorp
 *   3. frontmatter-extension — mescla bloco `nettoscorp:` do arquivo com defaults do mapeamento
 *   4. Validação Zod do contrato nettoscorp (defesa contra prompt injection)
 *   5. AgentConfig — configuração operacional com permissões de least privilege
 *   6. tool-provisioning — instalação automática em 3+ runtimes ACP/MCP (mcp-stdio, mcp-http, acp)
 *   7. budget-binding — orçamento vinculado ao papel (autoridade → DEFAULT_MONTHLY_BUDGET_BY_AUTHORITY)
 *
 * Observabilidade: cada execução emite logs estruturados com correlation id (cid).
 */

// (1) hireAgent + validação de entrada + erros
export { hireAgent, HireAgentInputSchema, AgentHireError } from './hire-agent';
export type { HireOptions } from './hire-agent';

// (2) tool-provisioning: provisionamento em runtimes ACP/MCP
export { provisionAgentTools } from './tool-provisioning';
export type {
  ToolProvisioningOptions,
  ToolProvisioningResult,
  ToolInstallment,
  ToolRuntime,
} from './tool-provisioning';
export { DEFAULT_PROVISIONING_RUNTIMES } from './tool-provisioning';

// (3) budget-binding: orçamento vinculado ao papel do agente contratado
export { bindAgentBudget } from './budget-binding';
export type {
  BudgetBindingOptions,
  BudgetBindingResult,
  BudgetPolicy,
} from './budget-binding';

// (4) leitura de corpus (Paperclip → catalog-sync → HTTP)
export { corpusGet, type CorpusGetResult } from './corpus-client';

// (5) mapeamento de divisões AA → papéis NettosCorp
export {
  mapDivisionToRole,
  listDivisions,
  liveDivisions,
  nettoscorpDefaultsForDivision,
  type DivisionRoleConfig,
} from './division-mapping';

// (6) extensão de frontmatter `nettoscorp`
export {
  parseAgentFrontmatter,
  extractNettoscorpBlock,
  mergeNettoscorpFrontmatter,
  serializeNettoscorpFrontmatter,
  injectNettoscorpFrontmatter,
  NettoscorpFrontmatterSchema,
  type NettoscorpFrontmatter,
  NETTOSCORP_BLOCK_KEY,
} from './frontmatter-extension';

// (7) tipos de domínio
export type {
  AgentConfig,
  AgentConfigBase,
  AgentSource,
} from './types';
