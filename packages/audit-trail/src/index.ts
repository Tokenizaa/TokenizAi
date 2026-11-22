/**
 * @nettoscorp/audit-trail — Fase 8 Governance Layer
 *
 * Immutable audit trail with a verifiable SHA-256 hash chain and compliance
 * reporting (SOC 2 CC6.1/CC7.1/CC7.2, ISO 27001 Annex A).
 *
 * AuditTrail is the main entry point. It composes ImmutableLog (append-only
 * hash-chained store) with AuditReporter (compliance report generation).
 *
 * Example:
 *   import { AuditTrail } from '@nettoscorp/audit-trail';
 *   const trail = new AuditTrail();
 *   trail.record({ type: 'auth.login', actorId: 'user-1', actorType: 'user', action: 'sign-in', outcome: 'success' });
 *   trail.verifyIntegrity(); // { valid: true, ... }
 *   trail.generateSOC2Report();
 */

import { ImmutableLog } from './immutable-log';
import { AuditReporter } from './audit-reporter';
import {
  type AuditEvent,
  type AuditEventType,
  type AppendResult,
  type IntegrityResult,
  type NewAuditEvent,
  type SOC2Report,
  type ISO27001Report,
  type ControlAssessment,
  REQUIRED_EVENT_TYPES,
  NewAuditEventSchema,
} from './types';

export interface AuditTrailOptions {
  readonly sealed?: boolean;
}

export class AuditTrail {
  private readonly log: ImmutableLog;
  private readonly reporter: AuditReporter;

  constructor(options: AuditTrailOptions = {}) {
    this.log = new ImmutableLog();
    this.reporter = new AuditReporter(this.log);
    if (options.sealed) {
      this.log.seal();
    }
  }

  /**
   * Record an immutable audit event. The event is validated, timestamped,
   * chained to the previous entry via SHA-256, and frozen before storage.
   */
  record(event: NewAuditEvent): AppendResult {
    const parsed = NewAuditEventSchema.parse(event);
    return this.log.append(parsed);
  }

  /** Verify the SHA-256 hash chain and entry immutability. */
  verifyIntegrity(): IntegrityResult {
    return this.log.verifyIntegrity();
  }

  /** SOC 2 compliance report (CC6.1, CC7.1, CC7.2). */
  generateSOC2Report(): SOC2Report {
    return this.reporter.generateSOC2Report();
  }

  /** ISO 27001 compliance report (Annex A controls). */
  generateISO27001Report(): ISO27001Report {
    return this.reporter.generateISO27001Report();
  }

  /** Append-only view of all log entries (frozen copy). */
  getEntries(): readonly AuditEvent[] {
    return this.log.getEntries();
  }

  getEntry(index: number): AuditEvent | undefined {
    return this.log.getEntry(index);
  }

  size(): number {
    return this.log.size();
  }

  lastHash(): string | undefined {
    return this.log.lastHash();
  }

  getByType(type: AuditEventType): readonly AuditEvent[] {
    return this.log.getByType(type);
  }

  getByActor(actorId: string): readonly AuditEvent[] {
    return this.log.getByActor(actorId);
  }

  seal(): void {
    this.log.seal();
  }

  isSealed(): boolean {
    return this.log.isSealed();
  }

  /** Event types the governance layer requires to be recordable. */
  static requiredEventTypes(): readonly AuditEventType[] {
    return REQUIRED_EVENT_TYPES;
  }
}

export { ImmutableLog } from './immutable-log';
export { AuditReporter } from './audit-reporter';
export {
  AuditEventType,
  REQUIRED_EVENT_TYPES,
  type AuditEvent,
  type NewAuditEvent,
  type AppendResult,
  type IntegrityResult,
  type ControlAssessment,
  type SOC2Report,
  type ISO27001Report,
} from './types';
export { NewAuditEventSchema } from './types';
