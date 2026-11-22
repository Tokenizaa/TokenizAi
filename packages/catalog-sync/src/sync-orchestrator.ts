/**
 * @nettoscorp/catalog-sync — SyncOrchestrator (Fase 6)
 *
 * Orquesta el ciclo completo de sincronización del catálogo Agency Agents:
 *
 *   webhook (GitHub push) → validación HMAC → diff (SHA por agente) →
 *   aplicar diff al corpus-baseline → snapshot inmutable → notificación.
 *
 * Todo mutación del corpus está detrás de una confirmación explícita
 * (dry-run por defecto). Cada ejecución queda auditada con correlation ID.
 */

import { randomBytes } from 'node:crypto';
import {
  GitHubWebhookListener,
  type ValidatedPushEvent,
  SyncJob,
  DiffEngine,
  RollbackManager,
  type DiffResult,
  type ApplyResult,
  type Snapshot,
  type AgentRecord,
  type Notifier,
  ConsoleNotifier,
} from './index';

export interface SyncOrchestratorOptions {
  webhookListener: GitHubWebhookListener;
  syncJob: SyncJob;
  rollbackManager: RollbackManager;
  notifier?: Notifier;
  /** Cuando true (default), solo se informa del diff sin modificar el corpus. */
  dryRun?: boolean;
  /** Etiqueta opcional para el snapshot tomado antes de aplicar. */
  snapshotLabel?: string;
}

/** Resultado completo de una orquestación de sincronización. */
export interface SyncOrchestrationResult {
  correlationId: string;
  trigger: 'webhook' | 'manual';
  event?: ValidatedPushEvent;
  diff: DiffResult;
  applied: boolean;
  applyResult?: ApplyResult;
  snapshot?: Snapshot;
  notificationSent: boolean;
  error?: { message: string; stage: string };
}

/**
 * SyncOrchestrator — coordina webhook → diff → sync → notificación.
 *
 * Reglas de confiabilidad:
 *  - Nunca aplica sin confirmación explícita (dryRun default true).
 *  - Snapshot inmutable antes de cada aplicación (garantía de rollback).
 *  - Cada etapa se loguea de forma estructurada y se notifica incluso en fallo.
 *  - El rollback está disponible one-click vía RollbackManager.
 */
export class SyncOrchestrator {
  private readonly webhookListener: GitHubWebhookListener;
  private readonly syncJob: SyncJob;
  private readonly rollbackManager: RollbackManager;
  private readonly notifier: Notifier;
  private readonly dryRun: boolean;
  private readonly snapshotLabel?: string;

  constructor(options: SyncOrchestratorOptions) {
    this.webhookListener = options.webhookListener;
    this.syncJob = options.syncJob;
    this.rollbackManager = options.rollbackManager;
    this.notifier = options.notifier ?? new ConsoleNotifier();
    this.dryRun = options.dryRun ?? true;
    this.snapshotLabel = options.snapshotLabel;
  }

  /* ------------------------------------------------------------------ */
  /* Punto de entrada: push event desde webhook de GitHub               */
  /* ------------------------------------------------------------------ */

  /**
   * Procesa un push event recibido del webhook. Valida firma, ejecuta diff
   * y (si no es dry-run) aplica el cambio al corpus-baseline.
   */
  async orchestratePush(
    rawBody: string | Buffer,
    signature: string | undefined,
    eventType: string | undefined
  ): Promise<SyncOrchestrationResult> {
    const cid = `orch-${generateCorrelationId()}`;
    const start = Date.now();

    try {
      const { verification, event } = this.webhookListener.parsePushEvent(rawBody, signature, eventType);

      logger.info(cid, 'Push event recibido — iniciando orquestación', {
        repo: event.repository.fullName,
        branch: event.branch,
        sha: event.sha,
        dryRun: this.dryRun,
      });

      await this.notify(cid, 'sync-started', { event, dryRun: this.dryRun });

      const diff = await this.syncJob.diff(cid);

      let applied = false;
      let applyResult: ApplyResult | undefined;
      let snapshot: Snapshot | undefined;

      if (!this.dryRun) {
        const result = await this.syncJob.apply(diff, {
          confirm: true,
          snapshotLabel: this.snapshotLabel ?? `sync-${event.sha.slice(0, 8)}`,
        });
        applied = true;
        applyResult = result;
        snapshot = await this.rollbackManager.snapshot(`post-sync-${diff.releaseSha.slice(0, 8)}`);
      } else {
        logger.info(cid, 'Dry-run activado: diff calculado, sin aplicar cambios', {
          added: diff.summary.added,
          modified: diff.summary.modified,
          deleted: diff.summary.deleted,
        });
      }

      await this.notify(cid, 'sync-completed', {
        diff,
        applied,
        applyResult,
        snapshot,
        durationMs: Date.now() - start,
      });

      return {
        correlationId: cid,
        trigger: 'webhook',
        event,
        diff,
        applied,
        applyResult,
        snapshot,
        notificationSent: true,
      };
    } catch (error) {
      logger.error(cid, 'Orquestación falló', error);
      await this.notify(cid, 'sync-failed', {
        error: error instanceof Error ? { message: error.message, stage: 'webhook-or-diff' } : { message: String(error) },
        durationMs: Date.now() - start,
      });
      return {
        correlationId: cid,
        trigger: 'webhook',
        diff: emptyDiff(),
        applied: false,
        notificationSent: true,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stage: 'webhook-or-diff',
        },
      };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Disparo manual (CLI / schedule / operador)                         */
  /* ------------------------------------------------------------------ */

  /**
   * Ejecuta una sincronización manual (sin webhook). Útil para pruebas
   * programadas o sincronización bajo demanda del operador.
   */
  async orchestrateManual(): Promise<SyncOrchestrationResult> {
    const cid = `orch-${generateCorrelationId()}`;
    const start = Date.now();

    try {
      logger.info(cid, 'Sincronización manual iniciada', { dryRun: this.dryRun });
      await this.notify(cid, 'sync-started', { manual: true, dryRun: this.dryRun });

      const diff = await this.syncJob.diff(cid);

      let applied = false;
      let applyResult: ApplyResult | undefined;
      let snapshot: Snapshot | undefined;

      if (!this.dryRun) {
        const result = await this.syncJob.apply(diff, {
          confirm: true,
          snapshotLabel: this.snapshotLabel ?? `manual-sync-${diff.releaseSha.slice(0, 8)}`,
        });
        applied = true;
        applyResult = result;
        snapshot = await this.rollbackManager.snapshot(`post-sync-${diff.releaseSha.slice(0, 8)}`);
      }

      await this.notify(cid, 'sync-completed', {
        diff,
        applied,
        applyResult,
        snapshot,
        durationMs: Date.now() - start,
      });

      return {
        correlationId: cid,
        trigger: 'manual',
        diff,
        applied,
        applyResult,
        snapshot,
        notificationSent: true,
      };
    } catch (error) {
      logger.error(cid, 'Sincronización manual falló', error);
      await this.notify(cid, 'sync-failed', {
        error: error instanceof Error ? { message: error.message, stage: 'manual-sync' } : { message: String(error) },
        durationMs: Date.now() - start,
      });
      return {
        correlationId: cid,
        trigger: 'manual',
        diff: emptyDiff(),
        applied: false,
        notificationSent: true,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stage: 'manual-sync',
        },
      };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rollback                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * One-click revert: restaura el corpus-baseline a un snapshot previo.
   * Devuelve información del snapshot restaurado.
   */
  async rollback(snapshotId: string): Promise<{ snapshot: Snapshot; notificationSent: boolean }> {
    const cid = `orch-${generateCorrelationId()}`;

    const result = await this.rollbackManager.rollback(snapshotId);

    await this.notify(cid, 'rollback-completed', {
      restoredTo: result.restoredTo.id,
      label: result.restoredTo.label,
      agentCount: result.restoredTo.agentCount,
    });

    logger.info(cid, 'Rollback notificado y completado', { snapshot: result.restoredTo.id });

    return { snapshot: result.restoredTo, notificationSent: true };
  }

  /** Lista snapshots disponibles (útil para UI del operador). */
  async listSnapshots(): Promise<Snapshot[]> {
    return this.rollbackManager.listSnapshots();
  }

  /* ------------------------------------------------------------------ */
  /* Privados                                                           */
  /* ------------------------------------------------------------------ */

  private async notify(
    cid: string,
    type: 'sync-started' | 'sync-completed' | 'sync-failed' | 'rollback-completed',
    payload: unknown
  ): Promise<void> {
    try {
      await this.notifier.notify({ type, payload, correlationId: cid });
    } catch (notifyError) {
      // Una falla de notificación no debe hacer fallar la sincronización
      logger.warn(cid, 'Notificador falló (no bloqueante)', notifyError);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                  */
/* -------------------------------------------------------------------------- */

function generateCorrelationId(): string {
  return `sync-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

function emptyDiff(): DiffResult {
  return {
    releaseSha: '',
    generatedAt: new Date().toISOString(),
    new: [],
    updated: [],
    removed: [],
    unchanged: [],
    summary: { totalLocal: 0, totalUpstream: 0, added: 0, modified: 0, deleted: 0, unchanged: 0 },
  };
}

/* -------------------------------------------------------------------------- */
/* Logger de uso interno del orquestador                                    */
/* -------------------------------------------------------------------------- */

const logger = {
  info: (cid: string, message: string, meta?: Record<string, unknown>) =>
    console.log(
      JSON.stringify({ level: 'info', ts: new Date().toISOString(), cid, message, ...(meta ? { meta } : {}) })
    ),
  warn: (cid: string, message: string, meta?: unknown) =>
    console.warn(
      JSON.stringify({ level: 'warn', ts: new Date().toISOString(), cid, message, meta })
    ),
  error: (cid: string, message: string, error?: unknown) =>
    console.error(
      JSON.stringify({
        level: 'error',
        ts: new Date().toISOString(),
        cid,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
      })
    ),
};
