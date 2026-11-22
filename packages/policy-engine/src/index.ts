/**
 * @nettoscorp/policy-engine — Policy Engine (Fase 8 — Governance Layer)
 *
 * Orquestra a avaliação das políticas OPA/Rego e o Approval Gateway:
 *  - evaluate(input) — avalia a política aplicável à ação com trace_id
 *  - integração com ApprovalGateway para ações irreversíveis
 *  - consultas à fila, decisões (approve/reject) e processamento de timeouts
 *
 * Entrada:
 *  - action: ação solicitada (agent.hire, agent.provision, data.read, budget.approve)
 *  - actor: { user_id, tenant_id, role, clearance_level, authority_level, ... }
 *  - resource: recurso alvo (tenant_id, owner_id, ...)
 *  - context: contexto da ação (amount, cost_center, requires_budget_approval, approved, ...)
 *  - trace_id: trace_id de observabilidade distribuída (gerado quando omitido)
 *
 * Saída: PolicyDecision com veredito da política, motivo, resultados por regra,
 * flag requires_approval e, quando aplicável, a ApprovalRequest criada.
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { ClearanceLevel, AuthorityLevel, UserRole } from '@nettoscorp/auth';
import { z } from 'zod';
import {
  AGENT_HIRE_POLICY,
  BUDGET_POLICY,
  OpaInputSchema,
  POLICY_REGISTRY,
  TENANT_DATA_POLICY,
  type EvalResult,
  type OpaInput,
  type PolicyRegistration,
  evaluateRego,
  evaluateRegoDenyReason,
} from './opa-policies';
import {
  ApprovalGateway,
  type ApprovalActor,
  type ApprovalDecision,
  type ApprovalRequest,
  type GatewayConfig,
  DEFAULT_GATEWAY_CONFIG,
} from './approval-gateway';

const tracer = trace.getTracer('@nettoscorp/policy-engine', '0.1.0');

export type PolicyAction = 'agent.hire' | 'agent.provision' | 'data.read' | 'budget.approve';

export interface PolicyActorInput {
  user_id: string;
  tenant_id: string;
  role: string;
  clearance_level: string;
  authority_level: string;
  department_ids?: string[];
  project_ids?: string[];
}

export interface PolicyResourceInput {
  tenant_id?: string;
  owner_id?: string;
  department_id?: string;
  cost_center_id?: string;
  [key: string]: unknown;
}

export interface PolicyContextInput {
  amount?: number;
  cost_center?: { remaining: number; allocated: number; spent: number };
  budget_threshold?: number;
  requires_budget_approval?: boolean;
  approved?: boolean;
  blocked?: boolean;
  [key: string]: unknown;
}

export interface PolicyInput {
  action: string;
  actor: PolicyActorInput;
  resource?: PolicyResourceInput;
  context?: PolicyContextInput;
  trace_id?: string;
}

export interface PolicyRuleResult {
  rule: string;
  allowed: boolean;
  reason?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  trace_id: string;
  action: string;
  policy_results: PolicyRuleResult[];
  requires_approval: boolean;
  approval_request?: ApprovalRequest;
}

function normalizeTraceId(traceId?: string): string {
  if (traceId && /^[0-9a-fA-F-]{8,}$/.test(traceId)) {
    return traceId.replace(/-/g, '').slice(0, 32);
  }
  return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
}

export class PolicyEngine {
  private readonly gateway: ApprovalGateway;
  private readonly config: GatewayConfig;
  private readonly registry: Map<string, PolicyRegistration>;

  constructor(config?: Partial<GatewayConfig>) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.gateway = new ApprovalGateway(this.config);
    this.registry = new Map(POLICY_REGISTRY.map((p) => [p.action, p]));
  }

  /**
   * Avalia a política aplicável à ação e, quando a política permite e a ação
   * exige aprovação, cria a solicitação no Approval Gateway.
   *
   * O veredito final respeita o gateway: se requires_approval é true, a ação
   * só está efetivamente liberada após decisão `approve` no gateway
   * (PolicyEngine#approveRequest / #rejectRequest).
   */
  evaluate(input: PolicyInput): PolicyDecision {
    return tracer.startActiveSpan(
      'policy-engine.evaluate',
      {
        attributes: {
          'policy.action': input.action,
          'policy.actor': input.actor.user_id,
          'policy.tenant_id': input.actor.tenant_id,
          'policy.trace_id': normalizeTraceId(input.trace_id),
        },
      },
      (span) => {
        const traceId = normalizeTraceId(input.trace_id);
        const opaInput: OpaInput = {
          action: input.action,
          actor: input.actor,
          resource: input.resource,
          context: input.context,
        };

        const decision: PolicyDecision = {
          allowed: false,
          reason: 'policy_not_found',
          trace_id: traceId,
          action: input.action,
          policy_results: [],
          requires_approval: false,
        };

        const inputValidation = OpaInputSchema.safeParse(opaInput);
        if (!inputValidation.success) {
          decision.reason = 'invalid_input';
          span.setAttributes({
            'policy.allowed': false,
            'policy.reason': decision.reason,
            'policy.trace_id': traceId,
          });
          span.setStatus({ code: SpanStatusCode.INVALID_ARGUMENT, message: decision.reason });
          return decision;
        }

        const registration = this.registry.get(input.action);
        let allowed = false;
        let reason = 'policy_not_found';
        const policyResults: PolicyRuleResult[] = [];

        if (registration) {
          const allowedResult: EvalResult = evaluateRego(
            registration.source,
            opaInput,
            registration.allowedRule,
          );
          const denyReason = allowedResult.result
            ? undefined
            : evaluateRegoDenyReason(registration.source, opaInput, registration.denyRule);

          allowed = allowedResult.result;
          reason = denyReason ?? (allowed ? 'authorized' : 'denied');

          policyResults.push({
            rule: registration.allowedRule,
            allowed,
            reason: allowed ? undefined : reason,
          });
        }

        const requiresApproval = this.gateway.requiresApproval(
          input.action as ApprovalAction,
          input.context,
        );
        let approvalRequest: ApprovalRequest | undefined;

        if (requiresApproval) {
          if (allowed) {
            approvalRequest = this.gateway.requestApproval({
              action: input.action as ApprovalAction,
              actor: input.actor,
              resource: input.resource ?? {},
              context: input.context ?? {},
              trace_id: traceId,
            });
            reason = approvalRequest.status === 'pending' ? 'pending_approval' : reason;
          } else {
            reason = `${reason}; approval_required`;
          }
        }

        decision.allowed = allowed && (!requiresApproval || !!approvalRequest);
        decision.reason = reason;
        decision.trace_id = traceId;
        decision.policy_results = policyResults;
        decision.requires_approval = requiresApproval;
        decision.approval_request = approvalRequest;

        span.setAttributes({
          'policy.allowed': decision.allowed,
          'policy.reason': reason,
          'policy.trace_id': traceId,
          'policy.requires_approval': requiresApproval,
          'policy.approval_request_id': approvalRequest?.id ?? '',
        });

        if (!decision.allowed) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: reason });
        }

        return decision;
      },
    );
  }

  /** Aprova uma solicitação de aprovação pendente (gateway). */
  approveRequest(
    request_id: string,
    approver: string,
    reason?: string,
    trace_id?: string,
  ): ApprovalDecision {
    return this.gateway.decide({
      request_id,
      decision: 'approve',
      approver,
      reason,
      trace_id,
    });
  }

  /** Rejeita uma solicitação de aprovação pendente (gateway). */
  rejectRequest(
    request_id: string,
    approver: string,
    reason: string,
    trace_id?: string,
  ): ApprovalDecision {
    return this.gateway.decide({
      request_id,
      decision: 'reject',
      approver,
      reason,
      trace_id,
    });
  }

  /** Retorna a solicitação de aprovação pelo id. */
  getRequest(request_id: string): ApprovalRequest | undefined {
    return this.gateway.getRequest(request_id);
  }

  /** Lista solicitações pendentes ou escalonadas aguardando decisão. */
  listPending(): ApprovalRequest[] {
    return this.gateway.listPending();
  }

  /**
   * Processa timeouts da fila: expirações são escalonadas para o próximo nível
   * de autoridade ou rejeitadas automaticamente. Retorna ids expirados e
   * escalonados (útil para jobs/métricas de observabilidade).
   */
  processTimeouts(now = Date.now()) {
    return this.gateway.processTimeouts(now);
  }

  /** Tamanho da fila de aprovação (métrica). */
  size(): number {
    return this.gateway.size();
  }

  /** Configuração do gateway em uso. */
  getGatewayConfig(): GatewayConfig {
    return this.config;
  }
}

/**
 * Factories de entrada de política para os três domínios da Fase 8,
 * tipadas sobre os tipos compartilhados (@nettoscorp/auth).
 */
export function hireActorInput(params: {
  user_id: string;
  tenant_id: string;
  role: UserRole;
  clearance_level: ClearanceLevel;
  authority_level: AuthorityLevel;
  department_ids?: string[];
  project_ids?: string[];
}): PolicyActorInput {
  return {
    user_id: params.user_id,
    tenant_id: params.tenant_id,
    role: params.role,
    clearance_level: params.clearance_level,
    authority_level: params.authority_level,
    department_ids: params.department_ids,
    project_ids: params.project_ids,
  };
}

export function tenantResourceInput(params: {
  tenant_id: string;
  owner_id?: string;
  department_id?: string;
  cost_center_id?: string;
}): PolicyResourceInput {
  return {
    tenant_id: params.tenant_id,
    owner_id: params.owner_id,
    department_id: params.department_id,
    cost_center_id: params.cost_center_id,
  };
}

export function budgetContextInput(params: {
  amount: number;
  cost_center: { remaining: number; allocated: number; spent: number };
  budget_threshold?: number;
}): PolicyContextInput {
  return {
    amount: params.amount,
    cost_center: params.cost_center,
    budget_threshold: params.budget_threshold,
  };
}

export { AGENT_HIRE_POLICY, TENANT_DATA_POLICY, BUDGET_POLICY, POLICY_REGISTRY };
export type { OpaInput, EvalResult, GatewayConfig };
export { DEFAULT_GATEWAY_CONFIG, ApprovalGateway, type ApprovalAction };
export { z, OpaInputSchema };
export { parseRego };
export type { ApprovalRequest };
