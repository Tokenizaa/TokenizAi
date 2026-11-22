/**
 * @nettoscorp/agent-hire — tipos de domínio do fluxo de contratação (Fase 7)
 *
 * Contrato estruturado: hireAgent consome um agente do corpus Agency (Paperclip
 * corpus-baseline ou catalog-sync), mapeia a divisão AA para um papel NettosCorp,
 * aplica a extensão de frontmatter `nettoscorp` e devolve um AgentConfig pronto
 * para instanciação operacional. Nada é gravado em banco — é uma factory pura com
 * leitura de corpus (IO) + validação de schema.
 */

import type { AuthorityLevel, ClearanceLevel } from '@nettoscorp/auth';

/** Alvos de provisionamento de ferramentas (protocols ACP/MCP da plataforma). */
export type ToolRuntime = 'mcp-stdio' | 'mcp-http' | 'acp';

/** Runtimes alvo provisionados por padrão — garante o critério de 3+ tools. */
export const DEFAULT_PROVISIONING_RUNTIMES: ToolRuntime[] = [
  'mcp-stdio',
  'mcp-http',
  'acp',
];

export interface ToolInstallment {
  tool: string;            // capacidade da ferramenta instalada (ex. 'typescript', 'git')
  runtime: ToolRuntime;    // alvo ACP/MCP onde foi instalada
  status: 'installed' | 'failed' | 'skipped';
  target: string;          // URI do alvo (ex. mcp-stdio://agents/<slug>/tools/typescript)
  installedAt: string;
  config?: Record<string, unknown>; // contrato de provisionamento (least privilege)
  error?: string;          // preenchido apenas quando status === 'failed' (bulkhead: nunca interrompe os demais)
}

export interface ToolProvisioningOptions {
  runtimes?: ToolRuntime[];   // padrão: DEFAULT_PROVISIONING_RUNTIMES (3 runtimes)
  correlationId?: string;     // trace_id para correlação com logs de hireAgent
  dryRun?: boolean;           // true: não instala, marca como 'skipped'
}

export interface ToolProvisioningResult {
  agentId: string;
  slug: string;
  runtimes: ToolRuntime[];
  provisioned: ToolInstallment[];
  installedCount: number;
  failedCount: number;
  completedAt: string;
}

export interface BudgetPolicy {
  policyId: string;
  agentId: string;
  slug: string;
  role: string;
  authority: AuthorityLevel;    // nível de autoridade que origina o orçamento
  clearance: ClearanceLevel;    // clearance vinculado ao orçamento
  monthlyBudgetBRL: number;     // orçamento mensal vinculado ao papel
  spentBudgetBRL: number;       // gasto acumulado (0 no momento do binding)
  maxExecutionsPerDay: number;  // teto diário de execuções derivado da autoridade
  currency: string;             // 'BRL' por padrão
  source: 'role-authority' | 'override'; // 'role-authority' = default da role; 'override' = exceção explícita
  boundAt: string;
  companyId?: string;           // tenant do contrato (isolamento multi-tenant)
  projectId?: string;           // projeto onde o orçamento será consumido
}

export interface BudgetBindingOptions {
  companyId?: string;
  projectId?: string;
  currency?: string;
  correlationId?: string;
  dryRun?: boolean;             // true: computa política sem gravar efeito colateral
  overrideMonthlyBudgetBRL?: number; // exceção explícita acima do default da role (auditado)
}

export interface BudgetBindingResult {
  agentId: string;
  policy: BudgetPolicy;
  source: 'role-authority' | 'override';
  boundAt: string;
}

export type AgentSource = 'paperclip' | 'catalog-sync' | 'http';

/**
 * Extensão do frontmatter YAML do agente Agency.
 * Bloco `nettoscorp:` acrescido aos campos originais (name/description/color/emoji/vibe).
 * Nunca substitui campos de identidade do agente; apenas acrescenta governança NettosCorp.
 */
export interface NettoscorpFrontmatter {
  department: string;
  clearance: ClearanceLevel;
  authority: AuthorityLevel;
  knowledge_domains: string[];
}

/**
 * Opções de contratação. Todos os campos são opcionais:
 * campos ausentes herdam do mapeamento de divisão (division-mapping) e, por fim,
 * de um fallback degradado — o sistema sempre devolve um AgentConfig.
 */
export interface HireOptions {
  divisionOverride?: string;       // sobrescreve a divisão lida do diretório do corpus
  department?: string;
  clearance?: ClearanceLevel;
  authority?: AuthorityLevel;
  knowledge_domains?: string[];
  runtimeEngine?: 'Paperclip Runtime' | 'TokenizAi Native Orchestrator';
  projectId?: string;              // projeto onde o agente será instanciado (não usado pelo hireAgent)
  dryRun?: boolean;                // true: devolve config sem efeitos colaterais (hireAgent é puro por natureza)
  httpBase?: string;               // base URL opcional para busca remota do agente (fallback HTTP via node-fetch)
  correlationId?: string;          // trace_id para correlação com logs de hireAgent e provisionamento
}

/** Campos comuns de AgentConfig sem os resultados de provisionamento/binding. */
export interface AgentConfigBase {
  id: string;
  code: string;
  slug: string;
  name: string;
  division: string;
  role: string;
  nettoscorp: NettoscorpFrontmatter;
  specialty: string;
  summary: string;
  instructions: string;
  tools: string[];
  permissions: string[];
  rawSource: string;
  source: AgentSource;
  hiredAt: string;
}

/**
 * Saída de hireAgent: configuração completa do agente contratado.
 * Inclui resultado do provisionamento de ferramentas (toolProvisioning) e
 * política de orçamento vinculada ao papel (budgetPolicy).
 */
export interface AgentConfig extends AgentConfigBase {
  toolProvisioning: ToolProvisioningResult;
  budgetPolicy: BudgetPolicy;
}
