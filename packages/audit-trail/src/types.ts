import { z } from 'zod';

/**
 * @nettoscorp/audit-trail — types
 *
 * Event types mandated by the Fase 8 governance layer. These are the events the
 * audit trail must be able to record; any trace that lacks one of them is an
 * audit finding by itself.
 */

export const AuditEventTypeSchema = z.enum([
  'auth.login',
  'auth.logout',
  'auth.token_refresh',
  'hire.request',
  'hire.approve',
  'hire.provision',
  'hire.revoke',
  'rls.policy_change',
  'approval.request',
  'approval.approve',
  'approval.reject',
]);

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

export const REQUIRED_EVENT_TYPES: readonly AuditEventType[] = Object.freeze(
  AuditEventTypeSchema.options as unknown as AuditEventType[],
);

export interface AuditEvent {
  readonly id: string;
  readonly type: AuditEventType;
  readonly actorId: string;
  readonly actorType: 'user' | 'service' | 'system';
  readonly targetId?: string;
  readonly targetType?: string;
  readonly action: string;
  readonly outcome: 'success' | 'failure' | 'partial';
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
  readonly previousHash?: string;
  readonly hash: string;
  readonly signature?: string;
}

export type NewAuditEvent = Omit<AuditEvent, 'hash' | 'previousHash'>;

export interface AppendResult {
  readonly entry: AuditEvent;
  readonly index: number;
}

export interface IntegrityResult {
  readonly valid: boolean;
  readonly failedAt?: number;
  readonly reason?: string;
  readonly totalEntries: number;
  readonly verifiedHashes: number;
}

export interface ControlAssessment {
  readonly controlId: string;
  readonly title: string;
  readonly status: 'compliant' | 'partial' | 'non-compliant';
  readonly evidence: readonly string[];
  readonly findings: readonly string[];
}

export interface ComplianceReportBase {
  readonly framework: string;
  readonly generatedAt: string;
  readonly auditPeriod: { readonly start: string; readonly end: string };
  readonly totalEvents: number;
  readonly controls: readonly ControlAssessment[];
  readonly overallStatus: 'compliant' | 'partial' | 'non-compliant';
}

export interface SOC2Report extends ComplianceReportBase {
  readonly framework: 'SOC 2';
  readonly trustServiceCriteria: readonly string[];
}

export interface ISO27001Report extends ComplianceReportBase {
  readonly framework: 'ISO 27001';
  readonly annexAControls: readonly string[];
}

export const AuditEventSchema = z.object({
  id: z.string().uuid().optional(),
  type: AuditEventTypeSchema,
  actorId: z.string().min(1, 'actorId is required'),
  actorType: z.enum(['user', 'service', 'system']),
  targetId: z.string().optional(),
  targetType: z.string().optional(),
  action: z.string().min(1, 'action is required'),
  outcome: z.enum(['success', 'failure', 'partial']),
  metadata: z.record(z.string(), z.unknown()).default({}),
  timestamp: z.string().datetime().optional(),
  previousHash: z.string().optional(),
  hash: z.string().min(64),
  signature: z.string().optional(),
});

export const NewAuditEventSchema = AuditEventSchema.omit({
  hash: true,
  previousHash: true,
});
