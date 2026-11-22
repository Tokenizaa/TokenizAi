/**
 * @nettoscorp/agent-hire/src/rbac-hire
 *
 * Camada de autorização para o fluxo de contratação de agentes (Fase 7).
 *
 * Padrões (Identity & Access Engineer):
 * - Nenhum primitivo de autorização inventado: RBAC estático, tipos explícitos, decisão
 *   tomada sempre no servidor. Esta camada é pura e determinística — sem side effects de negócio.
 * - O cliente nunca é a autoridade: cada ação de contratação é checada aqui antes de qualquer
 *   gravação; a UI apenas esconde opções (UX, não segurança).
 * - Isolamento multi-tenant: company_id do ator vem do contexto autenticado (claims JWT),
 *   NUNCA de parâmetros de requisição. company_admin não escapa do próprio tenant;
 *   platform_admin é o único com escopo cross-tenant.
 * - Auditoria: toda decisão emite um HireAuditEvent estruturado (permitido ou negado).
 *
 * Papéis (6): recruiter, hiring_manager, department_head, security_officer, company_admin,
 * platform_admin.
 *
 * Matriz de contratação:
 *   - recruiter:        SOLICITA contratações do próprio departamento. Não aprova, não provisiona.
 *   - hiring_manager:   SOLICITA e APROVA contratações do próprio departamento. Não provisiona.
 *   - department_head:  APROVA contratações do seu departamento. Não solicita, não provisiona.
 *   - security_officer: APROVA/rejeita a revisão de segurança (clearance) em escopo da empresa.
 *                       Não solicita, não provisiona. Tem acesso à auditoria.
 *   - company_admin:    SOLICITA, APROVA e PROVISIONA em escopo da própria empresa.
 *   - platform_admin:   SOLICITA, APROVA e PROVISIONA em qualquer empresa (escopo plataforma).
 */

import type { ClearanceLevel } from '@nettoscorp/auth';

/* ---------------------------------------------------------------- tipos */

export type HireRole =
  | 'recruiter'
  | 'hiring_manager'
  | 'department_head'
  | 'security_officer'
  | 'company_admin'
  | 'platform_admin';

export const HIRE_ROLES: HireRole[] = [
  'recruiter',
  'hiring_manager',
  'department_head',
  'security_officer',
  'company_admin',
  'platform_admin',
];

export type HireAction =
  | 'hire.request'    // solicitar contratação de agente
  | 'hire.approve'    // aprovar contratação (gestor / departamento / segurança)
  | 'hire.provision'  // provisionar instância operacional (cria agente contratado)
  | 'hire.revoke'     // revogar sessão/agente contratado (offboarding)
  | 'hire.view_audit' // ler trilha de auditoria de contratações
  | 'hire.manage_matrix'; // alterar matriz de papéis (apenas platform_admin)

export type HireScope = 'own-department' | 'company' | 'platform';

export interface HireContext {
  actorId: string;              // id do usuário autenticado (sub dos claims JWT)
  actorRole: HireRole;
  actorCompanyId: string;       // company_id dos claims JWT — fonte de verdade do tenant
  actorDepartment?: string;     // departamento do ator (escopo own-department)
  targetCompanyId?: string;     // empresa alvo da ação (quando cross-tenant)
  targetDepartment?: string;    // departamento alvo
  agentId?: string;             // id do agente contratado (revoke / view)
  correlationId?: string;       // trace_id para correlação com logs de hireAgent
}

export interface HireGrant {
  role: HireRole;
  canRequest: boolean;
  canApprove: boolean;
  canProvision: boolean;
  canRevoke: boolean;
  canViewAudit: boolean;
  canManageMatrix: boolean;
  scope: HireScope;             // limite de tenant do papel
  clearanceFloor?: ClearanceLevel; // clearance mínimo do agente alvo para o papel agir
  description: string;
}

export interface HireAuthorizationDecision {
  allowed: boolean;
  actor: HireContext;
  action: HireAction;
  role: HireRole;
  scope: HireScope;
  reason: string;
  /** Evento de auditoria estruturado — sempre emitido, permitido ou negado. */
  audit: HireAuditEvent;
}

export interface HireAuditEvent {
  event: 'hire.authorization.decision';
  action: HireAction;
  actorId: string;
  actorRole: HireRole;
  actorCompanyId: string;
  targetCompanyId?: string;
  targetDepartment?: string;
  agentId?: string;
  allowed: boolean;
  reason: string;
  scope: HireScope;
  correlationId?: string;
  ts: string;
}

export class HireAuthorizationError extends Error {
  constructor(public readonly decision: HireAuthorizationDecision) {
    super(decision.reason);
    this.name = 'HireAuthorizationError';
  }
}

/* ---------------------------------------------------------------- matriz de papéis */

export const HIRE_ROLE_GRANTS: Record<HireRole, HireGrant> = {
  recruiter: {
    role: 'recruiter',
    canRequest: true,
    canApprove: false,
    canProvision: false,
    canRevoke: false,
    canViewAudit: false,
    canManageMatrix: false,
    scope: 'own-department',
    description:
      'Solicita contratações de agentes dentro do próprio departamento. Sem poder de aprovação nem provisionamento.',
  },
  hiring_manager: {
    role: 'hiring_manager',
    canRequest: true,
    canApprove: true,
    canProvision: false,
    canRevoke: false,
    canViewAudit: false,
    canManageMatrix: false,
    scope: 'own-department',
    clearanceFloor: 'restrito',
    description:
      'Solicita e aprova contratações do próprio departamento. Não provisiona instâncias operacionais.',
  },
  department_head: {
    role: 'department_head',
    canRequest: false,
    canApprove: true,
    canProvision: false,
    canRevoke: false,
    canViewAudit: false,
    canManageMatrix: false,
    scope: 'own-department',
    clearanceFloor: 'gerencial',
    description:
      'Aprova contratações do seu departamento (alinhamento orçamentário e de cabeça).',
  },
  security_officer: {
    role: 'security_officer',
    canRequest: false,
    canApprove: true,
    canProvision: false,
    canRevoke: false,
    canViewAudit: true,
    canManageMatrix: false,
    scope: 'company',
    clearanceFloor: 'confidencial',
    description:
      'Revisa segurança e clearance do agente contratado em escopo da empresa. Acesso à auditoria de contratações.',
  },
  company_admin: {
    role: 'company_admin',
    canRequest: true,
    canApprove: true,
    canProvision: true,
    canRevoke: true,
    canViewAudit: true,
    canManageMatrix: false,
    scope: 'company',
    description:
      'Solicita, aprova e provisiona contratações dentro da própria empresa. Não escapa do tenant.',
  },
  platform_admin: {
    role: 'platform_admin',
    canRequest: true,
    canApprove: true,
    canProvision: true,
    canRevoke: true,
    canViewAudit: true,
    canManageMatrix: true,
    scope: 'platform',
    description:
      'Solicita, aprova e provisiona em qualquer empresa. Único papel com escopo cross-tenant e gestão da matriz.',
  },
} as const;

/**
 * Matriz completa de quem solicita / aprova / provisiona contratações, por papel.
 */
export function hireMatrix(): HireGrant[] {
  return Object.values(HIRE_ROLE_GRANTS);
}

/**
 * Papéis autorizados para executar uma dada ação de contratação.
 */
export function rolesForAction(action: HireAction): HireRole[] {
  return HIRE_ROLES.filter((role) => {
    const grant = HIRE_ROLE_GRANTS[role];
    switch (action) {
      case 'hire.request': return grant.canRequest;
      case 'hire.approve': return grant.canApprove;
      case 'hire.provision': return grant.canProvision;
      case 'hire.revoke': return grant.canRevoke;
      case 'hire.view_audit': return grant.canViewAudit;
      case 'hire.manage_matrix': return grant.canManageMatrix;
    }
  });
}

/* ---------------------------------------------------------------- decisão de autorização */

function actionGranted(grant: HireGrant, action: HireAction): boolean {
  switch (action) {
    case 'hire.request': return grant.canRequest;
    case 'hire.approve': return grant.canApprove;
    case 'hire.provision': return grant.canProvision;
    case 'hire.revoke': return grant.canRevoke;
    case 'hire.view_audit': return grant.canViewAudit;
    case 'hire.manage_matrix': return grant.canManageMatrix;
  }
}

/**
 * Avalia se o papel do ator pode executar a ação de contratação no contexto
 * informado. A empresa do ator vem do contexto autenticado (claims JWT) — nunca
 * derivada de parâmetros de entrada — regra de isolamento multi-tenant.
 *
 * Regras de tenant:
 *   - own-department: o ator só atua no próprio departamento (targetDepartment deve
 *     bater com o do ator, ou ser omisso/herdado).
 *   - company: o ator só atua dentro de sua company_id (targetCompanyId omisso ou igual).
 *   - platform: o ator atua em qualquer empresa (apenas platform_admin).
 *
 * Retorna a decisão (sempre com audit event). Lança HireAuthorizationError
 * quando a ação for negada — chamadores tratam explicitamente.
 */
export function authorizeHire(action: HireAction, ctx: HireContext): HireAuthorizationDecision {
  const grant = HIRE_ROLE_GRANTS[ctx.actorRole];
  const now = new Date().toISOString();

  const auditBase = {
    event: 'hire.authorization.decision' as const,
    action,
    actorId: ctx.actorId,
    actorRole: ctx.actorRole,
    actorCompanyId: ctx.actorCompanyId,
    targetCompanyId: ctx.targetCompanyId,
    targetDepartment: ctx.targetDepartment,
    agentId: ctx.agentId,
    scope: grant.scope,
    correlationId: ctx.correlationId,
  };

  // 1. O papel não tem a permissão de ação.
  if (!actionGranted(grant, action)) {
    const reason = `papel '${ctx.actorRole}' não autorizado para '${action}'`;
    const decision: HireAuthorizationDecision = {
      allowed: false,
      actor: ctx,
      action,
      role: ctx.actorRole,
      scope: grant.scope,
      reason,
      audit: { ...auditBase, allowed: false, reason, ts: now },
    };
    throw new HireAuthorizationError(decision);
  }

  // 2. Isolamento de tenant: o ator não atua fora do seu escopo.
  let tenantOk = true;
  let tenantReason = '';

  switch (grant.scope) {
    case 'own-department': {
      const dept = ctx.targetDepartment ?? ctx.actorDepartment;
      if (!dept || dept !== ctx.actorDepartment) {
        tenantOk = false;
        tenantReason =
          `escopo own-department: departamento alvo '${dept ?? '(não informado)'} ` +
          `não confere com o do ator '${ctx.actorDepartment ?? '(não informado)'}'`;
      }
      break;
    }
    case 'company': {
      if (ctx.targetCompanyId && ctx.targetCompanyId !== ctx.actorCompanyId) {
        tenantOk = false;
        tenantReason =
          `escopo company: company_id alvo '${ctx.targetCompanyId} ` +
          `difere do tenant do ator '${ctx.actorCompanyId}'`;
      }
      break;
    }
    case 'platform':
      // cross-tenant permitido apenas para platform_admin
      break;
  }

  if (!tenantOk) {
    const decision: HireAuthorizationDecision = {
      allowed: false,
      actor: ctx,
      action,
      role: ctx.actorRole,
      scope: grant.scope,
      reason: tenantReason,
      audit: { ...auditBase, allowed: false, reason: tenantReason, ts: now },
    };
    throw new HireAuthorizationError(decision);
  }

  const decision: HireAuthorizationDecision = {
    allowed: true,
    actor: ctx,
    action,
    role: ctx.actorRole,
    scope: grant.scope,
    reason: `autorizado: '${ctx.actorRole}' pode '${action}' em escopo '${grant.scope}'`,
    audit: { ...auditBase, allowed: true, reason: 'ok', ts: now },
  };
  return decision;
}

/**
 * Convenience: executa authorizeHire e propaga HireAuthorizationError se negado.
 * O chamador grava decision.audit no log de auditoria antes de prosseguir com a ação.
 */
export function enforceHireAction(action: HireAction, ctx: HireContext): HireAuthorizationDecision {
  return authorizeHire(action, ctx);
}
