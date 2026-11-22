/**
 * @nettoscorp/policy-engine — Approval Gateway (Fase 8 — Governance Layer)
 *
 * Gateway de aprovação para ações irreversíveis:
 *  - contratação de agentes (agent.hire)
 *  - provisionamento de agente (agent.provision)
 *  - orçamento acima de threshold (budget.approve > budget_threshold)
 *
 * Funcionamento:
 *  - fila de aprovação em memória (ApprovalRequest com status pending)
 *  - decisão humana (approve/reject) com auditoria (quando, por quem, motivo)
 *  - timeout de TTL: solicitações expiradas são escalonadas para o próximo nível
 *    de autoridade ou rejeitadas automaticamente (auto_reject_on_expiry)
 *  - observabilidade distribuída: todo fluxo carrega trace_id e emite spans
 *    OpenTelemetry (@opentelemetry/api)
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';

export type ApprovalAction = 'agent.hire' | 'agent.provision' | 'budget.approve';

export interface ApprovalActor {
  user_id: string;
  tenant_id: string;
  role: string;
  clearance_level: string;
  authority_level: string;
}

export interface ApprovalRequest {
  id: string;
  action: ApprovalAction;
  actor: ApprovalActor;
  resource: Record<string, unknown>;
  context: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';
  trace_id: string;
  created_at: string;
  expires_at: string;
  decided_by?: string;
  decided_at?: string;
  decision_reason?: string;
  escalation_level: number;
}

export interface ApprovalDecision {
  allowed: boolean;
  request_id: string;
  trace_id: string;
  reason: string;
}

export interface GatewayConfig {
  /** Valor acima do qual orçamentos exigem aprovação (BRL) */
  budget_threshold: number;
  /** TTL da solicitação de aprovação em minutos */
  ttl_minutes: number;
  /** Rejeitar automaticamente solicitações expiradas */
  auto_reject_on_expiry: boolean;
  /** Hierarquia de escalonamento por nível de autoridade */
  escalation_authority_levels: string[];
}

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  budget_threshold: 50000,
  ttl_minutes: 60,
  auto_reject_on_expiry: true,
  escalation_authority_levels: ['gerencial', 'estrategica_delegada', 'executiva_humana'],
};

function isUuidLike(value: string): boolean {
  return /^[0-9a-fA-F-]{8,}$/.test(value);
}

function normalizeTraceId(traceId?: string): string {
  if (traceId && isUuidLike(traceId)) return traceId.replace(/-/g, '').slice(0, 32);
  return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
}

const tracer = trace.getTracer('@nettoscorp/policy-engine.approval', '0.1.0');

export class ApprovalGateway {
  private readonly config: GatewayConfig;
  private readonly queue = new Map<string, ApprovalRequest>();

  constructor(config?: Partial<GatewayConfig>) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
  }

  /**
   * Retorna true quando a ação exige aprovação prévia no gateway:
   * contratação e provisionamento são sempre irreversíveis; orçamento só
   * acima do threshold configurado.
   */
  requiresApproval(action: string, context?: Record<string, unknown>): boolean {
    if (action === 'agent.hire' || action === 'agent.provision') return true;
    if (action === 'budget.approve') {
      const amount = Number(context?.amount ?? 0);
      return amount > this.config.budget_threshold;
    }
    return false;
  }

  /**
   * Cria uma solicitação de aprovação na fila. Lança quando a ação não
   * exige aprovação (chamador deve verificar requiresApproval primeiro).
   */
  requestApproval(params: {
    action: ApprovalAction;
    actor: ApprovalActor;
    resource?: Record<string, unknown>;
    context?: Record<string, unknown>;
    trace_id?: string;
  }): ApprovalRequest {
    return tracer.startActiveSpan(
      'approval-gateway.request',
      {
        attributes: {
          'approval.action': params.action,
          'approval.actor': params.actor.user_id,
          'approval.tenant_id': params.actor.tenant_id,
          'approval.trace_id': normalizeTraceId(params.trace_id),
        },
      },
      (span) => {
        if (!this.requiresApproval(params.action, params.context)) {
          span.setStatus({
            code: SpanStatusCode.INVALID_ARGUMENT,
            message: 'action does not require approval',
          });
          throw new Error(`Action ${params.action} does not require approval`);
        }

        const traceId = normalizeTraceId(params.trace_id);
        const now = Date.now();
        const request: ApprovalRequest = {
          id: crypto.randomUUID(),
          action: params.action,
          actor: params.actor,
          resource: params.resource ?? {},
          context: params.context ?? {},
          status: 'pending',
          trace_id: traceId,
          created_at: new Date(now).toISOString(),
          expires_at: new Date(
            now + this.config.ttl_minutes * 60 * 1000,
          ).toISOString(),
          escalation_level: 0,
        };

        this.queue.set(request.id, request);

        span.setAttributes({
          'approval.request_id': request.id,
          'approval.status': request.status,
          'approval.expires_at': request.expires_at,
          'approval.escalation_level': request.escalation_level,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        return request;
      },
    );
  }

  /**
   * Decide uma solicitação pendente (approve/reject). Registra quem decidiu,
   * quando e o motivo. Idempotente por request_id: decisões já tomadas
   * retornam o resultado registrado.
   */
  decide(params: {
    request_id: string;
    decision: 'approve' | 'reject';
    approver: string;
    reason?: string;
    trace_id?: string;
  }): ApprovalDecision {
    return tracer.startActiveSpan(
      'approval-gateway.decide',
      {
        attributes: {
          'approval.request_id': params.request_id,
          'approval.decision': params.decision,
          'approval.approver': params.approver,
          'approval.trace_id': normalizeTraceId(params.trace_id),
        },
      },
      (span) => {
        const request = this.queue.get(params.request_id);
        if (!request) {
          span.setStatus({
            code: SpanStatusCode.NOT_FOUND,
            message: `approval request ${params.request_id} not found`,
          });
          throw new Error(`Approval request ${params.request_id} not found`);
        }

        const alreadyDecided =
          request.status !== 'pending' && request.status !== 'escalated';
        if (alreadyDecided) {
          span.setStatus({ code: SpanStatusCode.OK });
          return {
            allowed: request.status === 'approved',
            request_id: request.id,
            trace_id: request.trace_id,
            reason: request.decision_reason ?? `already ${request.status}`,
          };
        }

        const decision = params.decision === 'approve' ? 'approved' : 'rejected';
        request.status = decision;
        request.decided_by = params.approver;
        request.decided_at = new Date().toISOString();
        request.decision_reason = params.reason ?? decision;

        span.setAttributes({
          'approval.status': request.status,
          'approval.decided_by': request.decided_by,
          'approval.decided_at': request.decided_at,
        });
        span.setStatus({ code: SpanStatusCode.OK });

        return {
          allowed: decision === 'approved',
          request_id: request.id,
          trace_id: request.trace_id,
          reason: request.decision_reason,
        };
      },
    );
  }

  /** Retorna a solicitação pelo id (qualquer status). */
  getRequest(request_id: string): ApprovalRequest | undefined {
    return this.queue.get(request_id);
  }

  /** Lista solicitações pendentes (incluindo escalonadas aguardando decisão). */
  listPending(): ApprovalRequest[] {
    return [...this.queue.values()].filter(
      (r) => r.status === 'pending' || r.status === 'escalated',
    );
  }

  /**
   * Processa timeouts: solicitações pendentes cujo expira_at passou são
   * escalonadas para o próximo nível de autoridade ou rejeitadas
   * automaticamente quando não há mais níveis ou auto_reject_on_expiry está ativo.
   * Retorna os ids expirados e escalonados.
   */
  processTimeouts(now = Date.now()): {
    expired: string[];
    escalated: string[];
  } {
    const expired: string[] = [];
    const escalated: string[] = [];

    for (const request of this.queue.values()) {
      if (request.status !== 'pending' && request.status !== 'escalated')
        continue;
      if (now <= Date.parse(request.expires_at)) continue;

      const level = request.escalation_level;
      const levels = this.config.escalation_authority_levels;

      if (level + 1 < levels.length) {
        request.escalation_level = level + 1;
        request.status = 'escalated';
        request.expires_at = new Date(
          now + this.config.ttl_minutes * 60 * 1000,
        ).toISOString();
        escalated.push(request.id);
      } else if (this.config.auto_reject_on_expiry) {
        request.status = 'expired';
        request.decision_reason = 'approval expired without decision';
        expired.push(request.id);
      }
    }

    return { expired, escalated };
  }

  /** Número total de solicitações na fila (útil para métricas). */
  size(): number {
    return this.queue.size;
  }
}
