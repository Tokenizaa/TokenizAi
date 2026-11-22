import { createHash } from 'node:crypto';
import { generateShortId } from '@nettoscorp/shared';
import {
  type AuditEvent,
  type AuditEventType,
  type AppendResult,
  type IntegrityResult,
  type NewAuditEvent,
  REQUIRED_EVENT_TYPES,
} from './types';

/**
 * @nettoscorp/audit-trail — immutable log
 *
 * Append-only event log with a verifiable SHA-256 hash chain. Every entry is
 * Object.frozen at write time; the log itself can be sealed to forbid any
 * further appends. Hash chain:
 *
 *   hash[i] = SHA-256(previousHash || id || type || actorId || ... || timestamp)
 *
 * Tampering with any entry breaks the chain and is detected by verifyIntegrity().
 */

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonical).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(record)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonical(record[key]))
      .join(',') +
    '}'
  );
}

function computeHash(previousHash: string | undefined, event: NewAuditEvent): string {
  const payload = [
    previousHash ?? '',
    event.id,
    event.type,
    event.actorId,
    event.actorType,
    event.targetId ?? '',
    event.targetType ?? '',
    event.action,
    event.outcome,
    canonical(event.metadata),
    event.timestamp,
  ].join('|');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export class ImmutableLog {
  private entries: AuditEvent[] = [];
  private sealed = false;

  /**
   * Append a new event. The entry is frozen before storage, so it cannot be
   * mutated in place without breaking Object.isFrozen checks.
   */
  append(event: NewAuditEvent): AppendResult {
    if (this.sealed) {
      throw new Error(
        'ImmutableLog is sealed: append-only log cannot accept new entries after sealing',
      );
    }

    const previousHash =
      this.entries.length > 0 ? this.entries[this.entries.length - 1]!.hash : undefined;
    const id = event.id ?? generateShortId('at');
    const timestamp = event.timestamp ?? new Date().toISOString();
    const metadata = Object.freeze({ ...event.metadata });

    const normalized: NewAuditEvent = {
      ...event,
      id,
      timestamp,
      metadata,
    };

    const hash = computeHash(previousHash, normalized);
    const entry: AuditEvent = { ...normalized, previousHash, hash };
    Object.freeze(entry);

    this.entries.push(entry);
    return { entry, index: this.entries.length - 1 };
  }

  /** Returns a frozen copy of the log entries (append-only view). */
  getEntries(): readonly AuditEvent[] {
    return Object.freeze([...this.entries]);
  }

  getEntry(index: number): AuditEvent | undefined {
    return this.entries[index];
  }

  size(): number {
    return this.entries.length;
  }

  lastHash(): string | undefined {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1]!.hash : undefined;
  }

  getByType(type: AuditEventType): readonly AuditEvent[] {
    return Object.freeze(this.entries.filter((entry) => entry.type === type));
  }

  getByActor(actorId: string): readonly AuditEvent[] {
    return Object.freeze(this.entries.filter((entry) => entry.actorId === actorId));
  }

  seal(): void {
    this.sealed = true;
    Object.freeze(this.entries);
  }

  isSealed(): boolean {
    return this.sealed;
  }

  /**
   * Recomputes the hash chain from genesis and verifies every entry against it.
   * Also asserts each entry remains frozen (no in-place mutation).
   */
  verifyIntegrity(): IntegrityResult {
    const entries = this.entries;
    let previousHash: string | undefined;
    let verifiedHashes = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;

      if (!Object.isFrozen(entry)) {
        return {
          valid: false,
          failedAt: i,
          reason: `entry at index ${i} is not frozen (mutated in place)`,
          totalEntries: entries.length,
          verifiedHashes,
        };
      }

      const { hash, ...rest } = entry;
      const expected = computeHash(previousHash, rest as NewAuditEvent);

      if (expected !== hash) {
        return {
          valid: false,
          failedAt: i,
          reason: `hash mismatch at index ${i}: expected ${expected}, got ${hash}`,
          totalEntries: entries.length,
          verifiedHashes,
        };
      }

      if (entry.previousHash !== previousHash) {
        return {
          valid: false,
          failedAt: i,
          reason: `previousHash mismatch at index ${i}`,
          totalEntries: entries.length,
          verifiedHashes,
        };
      }

      previousHash = entry.hash;
      verifiedHashes++;
    }

    return {
      valid: true,
      totalEntries: entries.length,
      verifiedHashes,
    };
  }

  /** Event types the governance layer requires to be recordable. */
  static requiredEventTypes(): readonly AuditEventType[] {
    return REQUIRED_EVENT_TYPES;
  }
}
