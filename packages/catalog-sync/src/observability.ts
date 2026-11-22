/**
 * @nettoscorp/catalog-sync — observability.ts (Fase 6)
 *
 * Observabilidade do pipeline de sincronização do catálogo Agency Agents.
 *
 * Garante:
 *  - trace_id compartilhado por toda a execução (webhook → diff → sync → notify)
 *  - Logs estruturados por etapa com span_id, duração e status
 *  - Métricas de duração por etapa (histograma em memória)
 *  - Observabilidade não-negociável: se não é possível rastrear, não prossegue silenciosamente.
 *
 * Estágios do pipeline:
 *   webhook  → recepção e validação do push event do GitHub
 *   diff     → download do tarball, extração e diff local vs upstream
 *   sync     → aplicação do diff ao corpus-baseline (com snapshot)
 *   notify   → notificação do resultado ao operador
 */

import { randomBytes } from 'node:crypto';

export const SYNC_STAGES = {
  WEBHOOK: 'webhook',
  DIFF: 'diff',
  SYNC: 'sync',
  NOTIFY: 'notify',
} as const;

export type SyncStage = (typeof SYNC_STAGES)[keyof typeof SYNC_STAGES];

export const LOG_LEVELS = { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' } as const;
export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

/* -------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* -------------------------------------------------------------------------- */

/** Contexto de rastreamento compartilhado por todo o pipeline. */
export interface TraceContext {
  traceId: string;
  stage: SyncStage;
  attempt?: number;
}

/** Entrada de log estruturada (uma por chamada de etapa). */
export interface StructuredLogEntry {
  level: LogLevel;
  ts: string;
  traceId: string;
  spanId: string;
  stage: SyncStage;
  message: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

/** Métrica agregada de um estágio. */
export interface StageMetric {
  stage: SyncStage;
  count: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgDurationMs: number;
  failures: number;
  lastFailureAt?: string;
}

/** Resultado de uma etapa observada. */
export interface StageResult<T = unknown> {
  output: T;
  traceId: string;
  spanId: string;
  stage: SyncStage;
  durationMs: number;
  status: 'success' | 'failure' | 'escalated';
}

/** Configuração do observador. */
export interface ObservabilityConfig {
  enabled?: boolean;
  minLevel?: LogLevel;
  onSpanEnd?: (entry: StructuredLogEntry) => void;
  onMetric?: (metric: StageMetric) => void;
}

/* -------------------------------------------------------------------------- */
/* Nível de log — ordenado para filtragem                                    */
/* -------------------------------------------------------------------------- */

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function isLevelEnabled(level: LogLevel, minLevel: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

const NOOP = () => {};

/* -------------------------------------------------------------------------- */
/* PipelineObserver                                                           */
/* -------------------------------------------------------------------------- */

/**
 * PipelineObserver — emite logs estruturados e agrega métricas por estágio.
 *
 * Cada execução do pipeline tem um trace_id único. Cada estágio dentro da
 * execução recebe um span_id. A duração de cada chamada é medida e registrada.
 */
export class PipelineObserver {
  private readonly traceId: string;
  private readonly enabled: boolean;
  private readonly minLevel: LogLevel;
  private readonly onSpanEnd: (entry: StructuredLogEntry) => void;
  private readonly onMetric: (metric: StageMetric) => void;
  private readonly metrics: Map<SyncStage, StageMetric> = new Map();
  private spanCounter = 0;

  constructor(traceId: string, config: ObservabilityConfig = {}) {
    this.traceId = traceId;
    this.enabled = config.enabled ?? true;
    this.minLevel = config.minLevel ?? 'info';
    this.onSpanEnd = config.onSpanEnd ?? NOOP;
    this.onMetric = config.onMetric ?? NOOP;

    // Inicializa métricas para todos os estágios conhecidos
    for (const stage of Object.values(SYNC_STAGES)) {
      this.metrics.set(stage, this.emptyMetric(stage));
    }
  }

  /** O trace_id da execução atual (compartilhado por todos os spans). */
  getTraceId(): string {
    return this.traceId;
  }

  /** Cria um novo span dentro do trace atual. */
  createSpan(stage: SyncStage): { spanId: string; startTime: number } {
    return {
      spanId: `span-${this.traceId}-${++this.spanCounter}`,
      startTime: Date.now(),
    };
  }

  /**
   * Registra o fim de um span: emite log estruturado e atualiza métricas.
   * Nunca lança exceção — falha de observabilidade é logada a stderr, não bloqueia o pipeline.
   */
  endSpan(
    spanId: string,
    stage: SyncStage,
    status: 'success' | 'failure' | 'escalated',
    options: {
      message: string;
      durationMs: number;
      meta?: Record<string, unknown>;
      error?: Error;
    },
  ): void {
    const { message, durationMs, meta, error } = options;

    const entry: StructuredLogEntry = {
      level: status === 'failure' || status === 'escalated' ? 'error' : 'info',
      ts: new Date().toISOString(),
      traceId: this.traceId,
      spanId,
      stage,
      message,
      durationMs,
      ...(meta ? { meta } : {}),
      ...(error
        ? {
            error: {
              name: error.name,
              message: error.message,
              ...(error.stack ? { stack: error.stack } : {}),
            },
          }
        : {}),
    };

    this.emitLog(entry);
    this.updateMetric(stage, durationMs, status === 'failure');
  }

  /**
   * observe — envolve uma operação assíncrona com observabilidade completa.
   *
   *   const result = await observer.observe(traceId, 'diff', async () => {
   *     return await syncJob.diff(cid);
   *   }, { message: 'diff calculado' });
   *
   * Emite logs de início/fim, mede duração, captura erros e atualiza métricas.
   * Em caso de erro, o span é marcado como failure e o erro é relançado.
   */
  async observe<T>(
    stage: SyncStage,
    fn: () => Promise<T>,
    options: {
      message: string;
      meta?: Record<string, unknown>;
      attempt?: number;
    },
  ): Promise<StageResult<T>> {
    const span = this.createSpan(stage);
    const start = Date.now();

    // Log de início do span
    this.emitLog({
      level: 'info',
      ts: new Date().toISOString(),
      traceId: this.traceId,
      spanId: span.spanId,
      stage,
      message: options.message,
      meta: { ...options.meta, attempt: options.attempt, phase: 'started' },
    });

    try {
      const output = await fn();
      const durationMs = Date.now() - start;

      this.endSpan(span.spanId, stage, 'success', {
        message: `${options.message} — concluído`,
        durationMs,
        meta: options.meta,
      });

      return {
        output,
        traceId: this.traceId,
        spanId: span.spanId,
        stage,
        durationMs,
        status: 'success',
      };
    } catch (error) {
      const durationMs = Date.now() - start;

      this.endSpan(span.spanId, stage, 'failure', {
        message: `${options.message} — falhou`,
        durationMs,
        meta: options.meta,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      throw error;
    }
  }

  /** Log simples sem span (usado para eventos pontuais do pipeline). */
  log(
    level: LogLevel,
    stage: SyncStage,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    if (!this.enabled || !isLevelEnabled(level, this.minLevel)) return;

    this.emitLog({
      level,
      ts: new Date().toISOString(),
      traceId: this.traceId,
      spanId: `span-${this.traceId}-${++this.spanCounter}`,
      stage,
      message,
      ...(meta ? { meta } : {}),
    });
  }

  /** Retorna a métrica agregada de um estágio. */
  getStageMetric(stage: SyncStage): StageMetric | undefined {
    return this.metrics.get(stage);
  }

  /** Retorna todas as métricas de estágio. */
  getMetrics(): StageMetric[] {
    return Array.from(this.metrics.values());
  }

  /** Reseta as métricas (útil entre execuções de teste). */
  resetMetrics(): void {
    for (const stage of Object.values(SYNC_STAGES)) {
      this.metrics.set(stage, this.emptyMetric(stage));
    }
  }

  /* ---------- privados ---------- */

  private emptyMetric(stage: SyncStage): StageMetric {
    return {
      stage,
      count: 0,
      totalDurationMs: 0,
      minDurationMs: Infinity,
      maxDurationMs: 0,
      avgDurationMs: 0,
      failures: 0,
    };
  }

  private updateMetric(stage: SyncStage, durationMs: number, isFailure: boolean): void {
    const current = this.metrics.get(stage);
    if (!current) return;

    const count = current.count + 1;
    const total = current.totalDurationMs + durationMs;
    const failures = current.failures + (isFailure ? 1 : 0);

    const updated: StageMetric = {
      ...current,
      count,
      totalDurationMs: total,
      minDurationMs: Math.min(current.minDurationMs, durationMs),
      maxDurationMs: Math.max(current.maxDurationMs, durationMs),
      avgDurationMs: total / count,
      failures,
      ...(isFailure ? { lastFailureAt: new Date().toISOString() } : {}),
    };
    this.metrics.set(stage, updated);

    try {
      this.onMetric(updated);
    } catch {
      // callback de métrica não deve quebrar o pipeline
    }
  }

  private emitLog(entry: StructuredLogEntry): void {
    if (!this.enabled || !isLevelEnabled(entry.level, this.minLevel)) return;

    const line = JSON.stringify(entry);
    // eslint-disable-next-line no-console
    if (entry.level === 'error') console.error(line);
    else console.log(line);

    try {
      this.onSpanEnd(entry);
    } catch {
      // callback de span não deve quebrar o pipeline
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers de trace_id                                                        */
/* -------------------------------------------------------------------------- */

/** Gera um trace_id único para uma execução do pipeline. */
export function createTraceId(prefix: string = 'sync'): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(4).toString('hex');
  return `${prefix}-${ts}-${rand}`;
}

/**
 * withTrace — executa um callback dentro de um trace compartilhado.
 * Útil para pontos de entrada do pipeline (webhook, manual, schedule).
 */
export async function withTrace<T>(
  stage: SyncStage,
  fn: (observer: PipelineObserver) => Promise<T>,
  config?: ObservabilityConfig,
): Promise<T> {
  const traceId = createTraceId('sync');
  const observer = new PipelineObserver(traceId, config);

  observer.log('info', stage, 'Execução do pipeline iniciada', {
    traceId,
    stage,
    pid: process.pid,
    nodeVersion: process.version,
  });

  try {
    const result = await fn(observer);

    observer.log('info', stage, 'Execução do pipeline concluída', {
      traceId,
      stage,
      metrics: observer.getMetrics(),
    });

    return result;
  } catch (error) {
    observer.log('error', stage, 'Execução do pipeline falhou', {
      traceId,
      stage,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
      metrics: observer.getMetrics(),
    });
    throw error;
  }
}
