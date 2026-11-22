/**
 * @nettoscorp/agent-hire/src/budget-binding
 *
 * Vinculação automática de orçamento (budget_policy) ao agente contratado,
 * derivada do papel/autoridade NettosCorp.
 *
 * Regras de arquitetura (Backend Architect):
 * - O orçamento é derivado do nível de autoridade do papel
 *   (config.nettoscorp.authority) usando DEFAULT_MONTHLY_BUDGET_BY_AUTHORITY e
 *   DEFAULT_MAX_EXECUTIONS_PER_DAY_BY_AUTHORITY de @nettoscorp/shared.
 * - Least privilege: nunca excede o teto da role sem override explícito e
 *   auditado (overrideMonthlyBudgetBRL → source: 'override', log de aviso).
 * - Isolamento multi-tenant: companyId/projectId vêm do contexto do contratante,
 *   nunca do agente alvo.
 * - Observabilidade: log estruturado com correlation id; vinculação é
 *   determinística e reexecutável (mesmo input → mesma política).
 * - Não grava estado externo: devolve o contrato BudgetPolicy para consumo do
 *   serviço de instância operacional (Fase 2 / operational-agents).
 */

import type { AuthorityLevel, ClearanceLevel } from '@nettoscorp/auth';
import {
  DEFAULT_MAX_EXECUTIONS_PER_DAY_BY_AUTHORITY,
  DEFAULT_MONTHLY_BUDGET_BY_AUTHORITY,
  generateUUID,
} from '@nettoscorp/shared';
import type {
  AgentConfigBase,
  BudgetBindingOptions,
  BudgetBindingResult,
  BudgetPolicy,
} from './types';

type LogLevel = 'info' | 'warn' | 'error';

export async function bindAgentBudget(
  config: AgentConfigBase,
  options: BudgetBindingOptions = {},
): Promise<BudgetBindingResult> {
  const correlationId = options.correlationId ?? `budget-${generateUUID().slice(0, 8)}`;
  const now = () => new Date().toISOString();

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level,
        ts: now(),
        cid: correlationId,
        component: 'budget-binding',
        message,
        ...(meta ? { meta } : {}),
      }),
    );
  };

  log('info', 'budget-binding: iniciado', {
    agentId: config.id,
    slug: config.slug,
    role: config.role,
    authority: config.nettoscorp.authority,
    clearance: config.nettoscorp.clearance,
    companyId: options.companyId,
    projectId: options.projectId,
    dryRun: options.dryRun,
  });

  const authority = config.nettoscorp.authority as AuthorityLevel;
  const clearance = config.nettoscorp.clearance as ClearanceLevel;

  const defaultMonthlyBRL =
    DEFAULT_MONTHLY_BUDGET_BY_AUTHORITY[authority] ?? 0;
  const defaultMaxExecutionsPerDay =
    DEFAULT_MAX_EXECUTIONS_PER_DAY_BY_AUTHORITY[authority] ?? 0;

  // Least privilege: orçamento começa no teto da role. Override só com
  // solicitação explícita (break-glass/governança) e fica auditado como 'override'.
  let monthlyBudgetBRL = defaultMonthlyBRL;
  let source: BudgetPolicy['source'] = 'role-authority';

  if (options.overrideMonthlyBudgetBRL !== undefined) {
    if (options.overrideMonthlyBudgetBRL > defaultMonthlyBRL) {
      log('warn', 'budget-binding: override acima do teto da role (exige aprovação governança)', {
        override: options.overrideMonthlyBudgetBRL,
        defaultRole: defaultMonthlyBRL,
        authority,
      });
    }
    monthlyBudgetBRL = options.overrideMonthlyBudgetBRL;
    source = 'override';
  }

  const policy: BudgetPolicy = {
    policyId: `budget-${config.id}`,
    agentId: config.id,
    slug: config.slug,
    role: config.role,
    authority,
    clearance,
    monthlyBudgetBRL,
    spentBudgetBRL: 0,
    maxExecutionsPerDay: defaultMaxExecutionsPerDay,
    currency: options.currency ?? 'BRL',
    source,
    boundAt: now(),
    companyId: options.companyId,
    projectId: options.projectId,
  };

  log('info', 'budget-binding: concluído', {
    agentId: config.id,
    policyId: policy.policyId,
    role: config.role,
    authority,
    monthlyBudgetBRL,
    maxExecutionsPerDay: policy.maxExecutionsPerDay,
    source,
  });

  return {
    agentId: config.id,
    policy,
    source,
    boundAt: policy.boundAt,
  };
}

export type { BudgetBindingOptions, BudgetBindingResult, BudgetPolicy } from './types';
