/**
 * @nettoscorp/catalog-sync — audit-logger.ts (Fase 6)
 *
 * Registro imutável de eventos de sincronização do catálogo Agency Agents.
 *
 * Garantias de conformidade (SOC 2 CC7.1 — monitoramento, CC7.2 — resposta a incidentes):
 *  - Todo evento de sync carrega trace_id, timestamp e status (campos obrigatórios;
 *    a gravação rejeita o evento se faltar algum deles).
 *  - Log append-only: após a gravação não há método de edição, atualização ou
 *    exclusão de entradas já registradas (imutabilidade).
 *  - Cadeia de integridade: cada entrada é hash-encadeada com a anterior
 *    (SHA-256 sobre prev_entry_hash + conteúdo canônico); qualquer alteração
 *    retroativa é detectada por verifyIntegrity().
 *  - Armazenamento JSONL append-only (uma linha por entrada) quando logDir é
 *    informado.
 */

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';

/* -------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Tipos de evento de sync que devem ser auditados (seis tipos obrigatórios da Fase 6).
 * Cada sincronização do catálogo deve emitir, no mínimo, os eventos de seu ciclo de vida.
 */
export type SyncAuditEventType =
  | 'webhook.received'
  | 'diff.started'
  | 'diff.completed'
  | 'sync.applied'
  | 'sync.rolled-back'
  | 'sync.failed';

/** Status de fim de ciclo de um evento de sync. */
export type AuditStatus = 'pending' | 'success' | 'failure' | 'rolled-back' | 'escalated';

/** Estágio do pipeline de sincronização. */
export type AuditStage = 'webhook' | 'diff' | 'sync' | 'rollback' | 'notify';

/** Ator que originou o evento. */
export type AuditActor = 'webhook' | 'operator' | 'schedule' | 'system';

/**
 * Evento de sync gravado na trilha de auditoria.
 * Todos os campos são só-leitura: a entrada é congelada (Object.freeze) na gravação
 * e nunca é mutada depois.
 */
export interface SyncAuditEvent {
  /** Identificador de rastreamento da execução (webhook → diff → sync → notify). */
  readonly trace_id: string;
  /** Data/hora da ocorrência no formato ISO 8601 UTC. */
  readonly timestamp: string;
  /** Status do evento. */
  readonly status: AuditStatus;
  /** Tipo do evento (um dos seis tipos obrigatórios). */
  readonly type: SyncAuditEventType;
  /** Estágio do pipeline onde ocorreu. */
  readonly stage: AuditStage;
  /** Ator que disparou o evento. */
  readonly actor: AuditActor;
  /** Componente de origem (ex.: SyncOrchestrator, SyncJob, RollbackManager). */
  readonly source: string;
  /** Detalhes estruturados do evento (somente leitura). */
  readonly details: Readonly<Record<string, unknown>>;
  /** Número sequencial da entrada no log (inicia em 1). */
  readonly sequence: number;
  /** Hash SHA-256 da entrada (prev_entry_hash + conteúdo canônico). */
  readonly entry_hash: string;
  /** Hash da entrada anterior na cadeia (null na primeira entrada/genesis). */
  readonly prev_entry_hash: string | null;
}

/** Campos para gravação de um novo evento (sem os campos de integridade). */
export interface NewSyncAuditEvent {
  trace_id: string;
  timestamp?: string; // default: agora (ISO 8601 UTC)
  status: AuditStatus;
  type: SyncAuditEventType;
  stage: AuditStage;
  actor: AuditActor;
  source: string;
  details?: Record<string, unknown>;
}

/** Opções do AuditLogger. */
export interface AuditLoggerOptions {
  /** Diretório de persistência do log JSONL append-only. */
  logDir?: string;
  /** Retenção dos logs ativos em dias (padrão: 365). */
  maxRetentionDays?: number;
  /** Desativa a persistência em arquivo (útil em ambientes sem gravador). */
  enabled?: boolean;
}

/** Resultado da verificação de integridade da cadeia de hash. */
export interface IntegrityVerification {
  valid: boolean;
  totalEntries: number;
  tamperedEntries: number;
  firstTamperedSequence?: number;
  chainBrokenAtSequence?: number;
}

/* -------------------------------------------------------------------------- */
/* Constantes e validadores                                                   */
/* -------------------------------------------------------------------------- */

const VALID_STATUSES = new Set<AuditStatus>([
  'pending',
  'success',
  'failure',
  'rolled-back',
  'escalated',
]);

const VALID_TYPES = new Set<SyncAuditEventType>([
  'webhook.received',
  'diff.started',
  'diff.completed',
  'sync.applied',
  'sync.rolled-back',
  'sync.failed',
]);

const TRACE_ID_RE = /^[a-z0-9_-]+$/i;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function validateTraceId(traceId: string): void {
  if (typeof traceId !== 'string' || !traceId.trim()) {
    throw new Error('audit-logger: trace_id é obrigatório');
  }
  if (!TRACE_ID_RE.test(traceId)) {
    throw new Error(`audit-logger: trace_id contém caracteres inválidos: ${traceId}`);
  }
}

function validateStatus(status: AuditStatus): void {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`audit-logger: status inválido: ${status}`);
  }
}

function validateType(type: SyncAuditEventType): void {
  if (!VALID_TYPES.has(type)) {
    throw new Error(`audit-logger: tipo de evento inválido: ${type}`);
  }
}

function isIsoTimestamp(value: string): boolean {
  if (!ISO_TIMESTAMP_RE.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/* -------------------------------------------------------------------------- */
/* Helpers de imutabilidade e integridade                                     */
/* -------------------------------------------------------------------------- */

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Serialização determinística (chaves ordenadas recursivamente) para que o
 * hash de uma entrada seja estável independentemente da ordem das chaves em details.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

/** Congela profundamente um valor para imutabilidade em tempo de execução. */
function deepFreeze(value: unknown): unknown {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function deepFreezeEntry(entry: SyncAuditEvent): SyncAuditEvent {
  deepFreeze(entry.details);
  return Object.freeze(entry);
}

/** Constrói uma entrada congelada, com hash e encadeamento de integridade. */
function buildEntry(
  sequence: number,
  prevEntryHash: string | null,
  event: NewSyncAuditEvent & { timestamp: string },
): SyncAuditEvent {
  const payload: Omit<
    SyncAuditEvent,
    'sequence' | 'entry_hash' | 'prev_entry_hash'
  > = {
    trace_id: event.trace_id,
    timestamp: event.timestamp,
    status: event.status,
    type: event.type,
    stage: event.stage,
    actor: event.actor,
    source: event.source,
    details: { ...(event.details ?? {}) },
  };

  const entry_hash = sha256Hex(
    `${prevEntryHash ?? 'genesis'}\n${stableStringify(payload)}`,
  );

  const entry: SyncAuditEvent = {
    ...payload,
    sequence,
    entry_hash,
    prev_entry_hash: prevEntryHash,
  };

  deepFreeze(entry.details);
  Object.freeze(entry);

  return entry;
}

/* -------------------------------------------------------------------------- */
/* AuditLogger                                                                */
/* -------------------------------------------------------------------------- */

/**
 * AuditLogger — registra eventos de sync de forma imutável e verificável.
 *
 * Uso:
 *   const logger = await createAuditLogger({ logDir: './.audit-logs' });
 *   await logger.record({ trace_id, status: 'success', type: 'sync.applied', ... });
 *   logger.verifyIntegrity(); // detecta adulteração retroativa
 */
export class AuditLogger {
  private readonly logDir: string;
  private readonly logPath: string;
  private readonly maxRetentionDays: number;
  private readonly enabled: boolean;
  private entries: SyncAuditEvent[] = [];
  private sequence = 0;
  private prevEntryHash: string | null = null;
  private initialized = false;

  constructor(options: AuditLoggerOptions = {}) {
    this.logDir = options.logDir ?? join(process.cwd(), '.audit-logs');
    this.logPath = join(this.logDir, 'sync-audit.jsonl');
    this.maxRetentionDays = options.maxRetentionDays ?? 365;
    this.enabled = options.enabled ?? true;
  }

  /**
   * Carrega o log existente (se houver), valida a cadeia de integridade e
   * prepara a gravação. Obrigatório antes de record().
   */
  async init(): Promise<void> {
    if (!this.enabled) {
      this.initialized = true;
      return;
    }

    await mkdir(this.logDir, { recursive: true });

    let raw = '';
    try {
      raw = await readFile(this.logPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.entries = [];
        this.sequence = 0;
        this.prevEntryHash = null;
        this.initialized = true;
        return;
      }
      throw error;
    }

    this.entries = raw.split('\n').filter(Boolean).map((line) => {
      const parsed = JSON.parse(line) as SyncAuditEvent;
      return deepFreezeEntry(parsed);
    });

    const verification = this.verifyIntegrityUnsafe();
    if (!verification.valid) {
      throw new Error(
        `audit-logger: cadeia de integridade rompida (${
          verification.tamperedEntries
        } entrada(s) adulterada(s), primeira em ${
          verification.firstTamperedSequence
        })`,
      );
    }

    const last = this.entries[this.entries.length - 1];
    if (last) {
      this.sequence = last.sequence;
      this.prevEntryHash = last.entry_hash;
    }

    this.initialized = true;
  }

  /** Retorna cópia congelada de todas as entradas carregadas (somente leitura). */
  getEntries(): ReadonlyArray<SyncAuditEvent> {
    return Object.freeze([...this.entries]);
  }

  /**
   * Retorna apenas as entradas dentro do período de retenção configurado.
   * A retenção física (arquivamento/destruição) segue a política definida em
   * docs/audit-trail.md e é executada fora da cadeia ativa.
   */
  getEntriesWithinRetention(days?: number): ReadonlyArray<SyncAuditEvent> {
    const retentionDays = days ?? this.maxRetentionDays;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    return this.entries.filter((e) => new Date(e.timestamp) >= cutoff);
  }

  /**
   * Grava um novo evento de sync.
   * Rejeita se faltar trace_id, status ou timestamp inválido.
   * A entrada gravada é imutável: não pode ser alterada nem removida depois.
   */
  async record(event: NewSyncAuditEvent): Promise<SyncAuditEvent> {
    if (!this.initialized) {
      await this.init();
    }

    validateTraceId(event.trace_id);
    validateStatus(event.status);
    validateType(event.type);

    const timestamp = event.timestamp ?? new Date().toISOString();
    if (!isIsoTimestamp(timestamp)) {
      throw new Error(`audit-logger: timestamp inválido: ${timestamp}`);
    }

    const entry = buildEntry(this.sequence + 1, this.prevEntryHash, {
      ...event,
      timestamp,
    });

    this.entries.push(entry);
    this.sequence = entry.sequence;
    this.prevEntryHash = entry.entry_hash;

    if (this.enabled) {
      await appendFile(this.logPath, JSON.stringify(entry) + '\n', 'utf8');
    }

    return entry;
  }

  /** Verifica a cadeia de integridade de todas as entradas carregadas. */
  verifyIntegrity(): IntegrityVerification {
    return this.verifyIntegrityUnsafe();
  }

  /** Exporta o log completo no formato JSONL (uma entrada por linha). */
  exportLog(): string {
    const body = this.entries.map((e) => JSON.stringify(e)).join('\n');
    return this.entries.length ? `${body}\n` : '';
  }

  /* ------------------------------------------------------------------ */
  /* Privados                                                           */
  /* ------------------------------------------------------------------ */

  private verifyIntegrityUnsafe(): IntegrityVerification {
    let prevHash: string | null = null;
    let expectedSequence = 0;
    let tamperedEntries = 0;
    let firstTamperedSequence: number | undefined;
    let chainBrokenAtSequence: number | undefined;

    for (const entry of this.entries) {
      expectedSequence += 1;

      const sequenceOk = entry.sequence === expectedSequence;
      const chainOk = entry.prev_entry_hash === prevHash;

      const payload = {
        trace_id: entry.trace_id,
        timestamp: entry.timestamp,
        status: entry.status,
        type: entry.type,
        stage: entry.stage,
        actor: entry.actor,
        source: entry.source,
        details: entry.details,
      };
      const expectedHash = sha256Hex(
        `${prevHash ?? 'genesis'}\n${stableStringify(payload)}`,
      );
      const hashOk = entry.entry_hash === expectedHash;

      if (!sequenceOk || !chainOk || !hashOk) {
        tamperedEntries += 1;
        if (firstTamperedSequence === undefined) {
          firstTamperedSequence = entry.sequence;
        }
        if (!chainOk && chainBrokenAtSequence === undefined) {
          chainBrokenAtSequence = entry.sequence;
        }
      }

      prevHash = entry.entry_hash;
    }

    return {
      valid: tamperedEntries === 0,
      totalEntries: this.entries.length,
      tamperedEntries,
      ...(firstTamperedSequence !== undefined
        ? { firstTamperedSequence }
        : {}),
      ...(chainBrokenAtSequence !== undefined
        ? { chainBrokenAtSequence }
        : {}),
    };
  }
}

/** Cria e inicializa um AuditLogger pronto para gravação. */
export async function createAuditLogger(
  options: AuditLoggerOptions = {},
): Promise<AuditLogger> {
  const logger = new AuditLogger(options);
  await logger.init();
  return logger;
}
