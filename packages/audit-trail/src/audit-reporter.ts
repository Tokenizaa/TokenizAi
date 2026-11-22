import {
  type AuditEvent,
  type ISO27001Report,
  type SOC2Report,
  type ControlAssessment,
  REQUIRED_EVENT_TYPES,
} from './types';
import { ImmutableLog } from './immutable-log';

/**
 * @nettoscorp/audit-trail — compliance reporter
 *
 * Generates compliance reports from the immutable audit trail. Evidence is
 * drawn exclusively from frozen log entries — an auditor can re-derive every
 * assessment from the event IDs listed in each control.
 */

function assessControl(
  controlId: string,
  title: string,
  evidence: readonly string[],
  status: 'compliant' | 'partial' | 'non-compliant',
  findings: readonly string[] = [],
): ControlAssessment {
  return Object.freeze({
    controlId,
    title,
    status,
    evidence: Object.freeze([...evidence]),
    findings: Object.freeze([...findings]),
  });
}

function firstLastPeriod(entries: readonly AuditEvent[]): {
  start: string;
  end: string;
} {
  const now = new Date().toISOString();
  if (entries.length === 0) {
    return { start: now, end: now };
  }
  return { start: entries[0]!.timestamp, end: entries[entries.length - 1]!.timestamp };
}

function overallStatus(controls: readonly ControlAssessment[]) {
  if (controls.some((c) => c.status === 'non-compliant')) {
    return 'non-compliant';
  }
  if (controls.some((c) => c.status === 'partial')) {
    return 'partial';
  }
  return 'compliant';
}

export class AuditReporter {
  constructor(private readonly log: ImmutableLog) {}

  /** SOC 2 report covering CC6.1, CC7.1, CC7.2 trust service criteria. */
  generateSOC2Report(): SOC2Report {
    const entries = this.log.getEntries();
    const period = firstLastPeriod(entries);

    const authEvents = entries.filter(
      (e) =>
        e.type === 'auth.login' ||
        e.type === 'auth.logout' ||
        e.type === 'auth.token_refresh',
    );
    const successfulAuth = authEvents.filter((e) => e.outcome === 'success');
    const failedAuth = authEvents.filter((e) => e.outcome === 'failure');

    // CC6.1 — Logical access controls: authentication events must exist and be
    // attributable to individual actors.
    const cc61Findings: string[] = [];
    let cc61Status: 'compliant' | 'partial' | 'non-compliant';
    if (authEvents.length === 0) {
      cc61Status = 'non-compliant';
      cc61Findings.push('No authentication events recorded in the audit period');
    } else {
      cc61Findings.push(
        `${successfulAuth.length} successful authentication events`,
      );
      if (failedAuth.length > 0) {
        cc61Findings.push(
          `${failedAuth.length} failed authentication events require review`,
        );
      }
      if (!authEvents.some((e) => e.actorType === 'user')) {
        cc61Status = 'partial';
        cc61Findings.push('No user-attributed authentication events found');
      } else {
        cc61Status = 'compliant';
      }
    }

    // CC7.1 — System monitoring: every required event type must be represented
    // in the log so nothing happens without a trace.
    const presentTypes = new Set(entries.map((e) => e.type));
    const missingTypes = REQUIRED_EVENT_TYPES.filter((t) => !presentTypes.has(t));
    const cc71Findings: string[] = [
      `${entries.length} total events logged across ${presentTypes.size} event types`,
    ];
    let cc71Status: 'compliant' | 'partial' | 'non-compliant';
    if (entries.length === 0) {
      cc71Status = 'non-compliant';
      cc71Findings.push('No events logged — monitoring not operative');
    } else if (missingTypes.length > 0) {
      cc71Status = 'partial';
      cc71Findings.push(
        `Missing required event types: ${missingTypes.join(', ')}`,
      );
    } else {
      cc71Status = 'compliant';
    }

    // CC7.2 — Incident response: failure events are detected incidents; each
    // carries its own evidence ID for postmortem traceability.
    const failures = entries.filter((e) => e.outcome === 'failure');
    const cc72Findings: string[] = [];
    let cc72Status: 'compliant' | 'partial' | 'non-compliant';
    if (failures.length === 0) {
      cc72Status = 'compliant';
      cc72Findings.push('No failure events recorded in the audit period');
    } else {
      cc72Findings.push(
        `${failures.length} failure event(s) detected and preserved as evidence`,
      );
      const uncontextualized = failures.filter(
        (e) => Object.keys(e.metadata).length === 0,
      );
      if (uncontextualized.length > 0) {
        cc72Status = 'partial';
        cc72Findings.push(
          `${uncontextualized.length} failure event(s) lack operational context (empty metadata)`,
        );
      } else {
        cc72Status = 'compliant';
      }
    }

    const controls = Object.freeze([
      assessControl(
        'CC6.1',
        'Logical access controls',
        authEvents.map((e) => e.id),
        cc61Status,
        cc61Findings,
      ),
      assessControl(
        'CC7.1',
        'System monitoring',
        entries.map((e) => e.id),
        cc71Status,
        cc71Findings,
      ),
      assessControl(
        'CC7.2',
        'Incident response',
        failures.map((e) => e.id),
        cc72Status,
        cc72Findings,
      ),
    ]);

    return Object.freeze({
      framework: 'SOC 2',
      trustServiceCriteria: Object.freeze(['CC6.1', 'CC7.1', 'CC7.2']),
      generatedAt: new Date().toISOString(),
      auditPeriod: Object.freeze(period),
      totalEvents: entries.length,
      controls,
      overallStatus: overallStatus(controls),
    });
  }

  /** ISO 27001 report covering Annex A controls exercised by audit-trail events. */
  generateISO27001Report(): ISO27001Report {
    const entries = this.log.getEntries();
    const period = firstLastPeriod(entries);

    const hireEvents = entries.filter(
      (e) =>
        e.type === 'hire.request' ||
        e.type === 'hire.approve' ||
        e.type === 'hire.provision' ||
        e.type === 'hire.revoke',
    );
    const authEvents = entries.filter(
      (e) =>
        e.type === 'auth.login' ||
        e.type === 'auth.logout' ||
        e.type === 'auth.token_refresh',
    );
    const adminEvents = entries.filter(
      (e) =>
        e.type === 'approval.request' ||
        e.type === 'approval.approve' ||
        e.type === 'approval.reject' ||
        e.type === 'rls.policy_change',
    );
    const failures = entries.filter((e) => e.outcome === 'failure');

    const controls = Object.freeze([
      // A.9.2.1 User registration and de-registration
      assessControl(
        'A.9.2.1',
        'User registration and de-registration',
        hireEvents.filter(
          (e) => e.type === 'hire.request' || e.type === 'hire.revoke',
        ).map((e) => e.id),
        hireEvents.some((e) => e.type === 'hire.request' || e.type === 'hire.revoke')
          ? 'compliant'
          : 'partial',
        !hireEvents.length
          ? ['No hire lifecycle events recorded']
          : [],
      ),
      // A.9.2.2 User access provisioning
      assessControl(
        'A.9.2.2',
        'User access provisioning',
        hireEvents.filter(
          (e) => e.type === 'hire.approve' || e.type === 'hire.provision',
        ).map((e) => e.id),
        hireEvents.some((e) => e.type === 'hire.approve' || e.type === 'hire.provision')
          ? 'compliant'
          : 'partial',
        !hireEvents.length ? ['No hire provisioning events recorded'] : [],
      ),
      // A.9.4.2 Secure log-on procedures
      assessControl(
        'A.9.4.2',
        'Secure log-on procedures',
        authEvents.map((e) => e.id),
        authEvents.length > 0 ? 'compliant' : 'partial',
        authEvents.length === 0
          ? ['No authentication events recorded in the audit period']
          : [],
      ),
      // A.12.4.1 Event logging
      assessControl(
        'A.12.4.1',
        'Event logging',
        entries.map((e) => e.id),
        entries.length > 0 ? 'compliant' : 'non-compliant',
        entries.length === 0 ? ['No events logged in the audit period'] : [],
      ),
      // A.12.4.3 Administrator and operator logs
      assessControl(
        'A.12.4.3',
        'Administrator and operator logs',
        adminEvents.map((e) => e.id),
        adminEvents.length > 0 ? 'compliant' : 'partial',
        adminEvents.length === 0
          ? ['No administrator or operator actions recorded']
          : [],
      ),
      // A.16.1.1 Responsibilities and procedures (incident evidence)
      assessControl(
        'A.16.1.1',
        'Incident management responsibilities and procedures',
        failures.map((e) => e.id),
        'compliant',
        failures.length === 0
          ? ['No failure events recorded in the audit period']
          : [`${failures.length} failure event(s) preserved for incident review`],
      ),
    ]);

    return Object.freeze({
      framework: 'ISO 27001',
      annexAControls: Object.freeze([
        'A.9.2.1',
        'A.9.2.2',
        'A.9.4.2',
        'A.12.4.1',
        'A.12.4.3',
        'A.16.1.1',
      ]),
      generatedAt: new Date().toISOString(),
      auditPeriod: Object.freeze(period),
      totalEvents: entries.length,
      controls,
      overallStatus: overallStatus(controls),
    });
  }
}
