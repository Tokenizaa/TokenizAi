/**
 * @nettoscorp/catalog-sync — circuit-breaker.ts (Fase 6)
 *
 * Circuit breaker para falhas de download do tarball GitHub no pipeline de
 * sincronização do catálogo Agency Agents.
 *
 * Estados:
 *   CLOSED   — Requisições fluem normalmente. Conta falhas em janela rolante.
 *   OPEN     — Requisições são rejeitadas imediatamente (não chama o agente).
 *              Após cooldown, transiciona para HALF_OPEN.
 *   HALF_OPEN — Permite uma chamada de teste. Sucesso → CLOSED. Falha → OPEN.
 *
 * Regras do Multi-Agent Systems Architect:
 *   - Circuit breaker em todo agente retry-elizível (download do tarball).
 *   - Nunca chama um agente em estado OPEN.
 *   - Estado e contadores são expostos para observabilidade e alertas.
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/** Erro lançado quando o circuit breaker está OPEN e rejeita a chamada. */
export class CircuitBreakerOpenError extends Error {
  public readonly retryAfterMs: number;
  public readonly state: CircuitState = CircuitState.OPEN;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}

const NOOP_CALLBACK = () => {};
const NOOP_CALLBACK2 = (_from: CircuitState, _to: CircuitState) => {};
const NOOP_CALLBACK3 = (_failureCount: number, _windowMs: number) => {};

/* -------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* -------------------------------------------------------------------------- */

export interface CircuitBreakerConfig {
  /** Número de falhas na janela rolante para disparar o circuito. Default 5. */
  failureThreshold?: number;
  /** Janela rolante em ms para contagem de falhas. Default 60_000 (1 min). */
  failureWindowMs?: number;
  /** Tempo em ms antes de tentar meia-abertura. Default 30_000 (30 s). */
  resetTimeoutMs?: number;
  /** Máximo de chamadas de teste em HALF_OPEN. Default 1. */
  halfOpenMaxCalls?: number;
  /** Callback disparado em toda transição de estado. */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Callback disparado quando o circuito é acionado (tripa para OPEN). */
  onTrip?: (failureCount: number, windowMs: number) => void;
  /** Callback disparado quando o circuito se recupera (volta a CLOSED). */
  onRecover?: () => void;
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  failuresInWindow: number;
  lastFailureAt?: string;
  nextAttemptAt?: string;
  trips: number;
  halfOpenCallsUsed: number;
}

export interface FailureRecord {
  timestamp: number;
  error: string;
}

/* -------------------------------------------------------------------------- */
/* CircuitBreaker                                                             */
/* -------------------------------------------------------------------------- */

/**
 * CircuitBreaker — controla chamadas a um serviço instável (download do tarball
 * do GitHub). Implementa CLOSED → OPEN → HALF_OPEN → CLOSED.
 */
export class CircuitBreaker {
  private readonly name: string;
  private readonly config: Required<CircuitBreakerConfig>;
  private state: CircuitState = CircuitState.CLOSED;

  // CLOSED / janela rolante
  private failures: FailureRecord[] = [];
  private successCount = 0;
  private trips = 0;

  // OPEN / cooldown
  private openedAt: number | null = null;

  // HALF_OPEN
  private halfOpenCallsUsed = 0;

  constructor(name: string, config: CircuitBreakerConfig = {}) {
    this.name = name;
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      failureWindowMs: config.failureWindowMs ?? 60_000,
      resetTimeoutMs: config.resetTimeoutMs ?? 30_000,
      halfOpenMaxCalls: config.halfOpenMaxCalls ?? 1,
      onStateChange: config.onStateChange ?? NOOP_CALLBACK2,
      onTrip: config.onTrip ?? NOOP_CALLBACK3,
      onRecover: config.onRecover ?? NOOP_CALLBACK,
    };
  }

  /** Estado atual do circuito. */
  getState(): CircuitState {
    return this.state;
  }

  /** Status completo para logs, métricas e alertas. */
  getStatus(): CircuitBreakerStatus {
    this.transitionIfNeeded();
    return {
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successCount,
      failuresInWindow: this.countFailuresInWindow(),
      lastFailureAt:
        this.failures.length > 0
          ? new Date(Math.max(...this.failures.map((f) => f.timestamp))).toISOString()
          : undefined,
      nextAttemptAt: this.nextAttemptAt(),
      trips: this.trips,
      halfOpenCallsUsed: this.halfOpenCallsUsed,
    };
  }

  /**
   * execute — executa `fn` se o circuito permitir.
   *
   *   CLOSED: executa normalmente. Falha incrementa contador; se exceder o
   *           threshold, dispara para OPEN.
   *   OPEN: lança CircuitBreakerOpenError imediatamente.
   *   HALF_OPEN: executa uma chamada de teste. Sucesso fecha o circuito;
   *              falha reabre.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.transitionIfNeeded();

    if (this.state === CircuitState.OPEN) {
      const retryAfter = this.timeUntilNextAttempt();
      throw new CircuitBreakerOpenError(
        `Circuit breaker '${this.name}' está OPEN — chamada rejeitada. ` +
          `Tente novamente em ${retryAfter} ms.`,
        retryAfter,
      );
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCallsUsed++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /** Força o circuito para OPEN (útil para desligamento manual de emergência). */
  forceOpen(): void {
    const from = this.state;
    this.state = CircuitState.OPEN;
    this.openedAt = Date.now();
    this.halfOpenCallsUsed = 0;
    this.notifyStateChange(from, CircuitState.OPEN);
    this.config.onTrip?.(this.failures.length, this.config.failureWindowMs);
  }

  /** Força o circuito para CLOSED (útil para recuperação manual). */
  forceClose(): void {
    const from = this.state;
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.openedAt = null;
    this.halfOpenCallsUsed = 0;
    this.trips = 0;
    this.successCount = 0;
    this.notifyStateChange(from, CircuitState.CLOSED);
    this.config.onRecover?.();
  }

  /* ---------- privados ---------- */

  private transitionIfNeeded(): void {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      const opened = this.openedAt ?? now;
      if (now - opened >= this.config.resetTimeoutMs) {
        this.openToHalfOpen();
      }
    }
  }

  private openToHalfOpen(): void {
    const from = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.openedAt = null;
    this.halfOpenCallsUsed = 0;
    this.notifyStateChange(from, CircuitState.HALF_OPEN);
  }

  private onSuccess(): void {
    this.successCount++;
    if (this.state === CircuitState.HALF_OPEN) {
      // Chamada de teste bem-sucedida: fecha o circuito
      const from = this.state;
      this.state = CircuitState.CLOSED;
      this.failures = [];
      this.openedAt = null;
      this.halfOpenCallsUsed = 0;
      this.trips = 0;
      this.notifyStateChange(from, CircuitState.CLOSED);
      this.config.onRecover?.();
    }
    // Em CLOSED, sucessos não limpam falhas (janela rolante gerencia a expiração)
  }

  private onFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const now = Date.now();

    this.failures.push({ timestamp: now, error: message });
    this.trimFailureWindow();

    if (this.state === CircuitState.HALF_OPEN) {
      // Falha no teste de meia-abertura: reabre imediatamente
      const from = this.state;
      this.state = CircuitState.OPEN;
      this.openedAt = now;
      this.halfOpenCallsUsed = 0;
      this.trips++;
      this.notifyStateChange(from, CircuitState.OPEN);
      this.config.onTrip?.(this.failures.length, this.config.failureWindowMs);
      return;
    }

    // CLOSED: verifica se excedeu o threshold
    if (this.countFailuresInWindow() >= this.config.failureThreshold) {
      const from = this.state;
      this.state = CircuitState.OPEN;
      this.openedAt = now;
      this.trips++;
      this.notifyStateChange(from, CircuitState.OPEN);
      this.config.onTrip?.(this.failures.length, this.config.failureWindowMs);
    }
  }

  private countFailuresInWindow(): number {
    const now = Date.now();
    const cutoff = now - this.config.failureWindowMs;
    return this.failures.filter((f) => f.timestamp >= cutoff).length;
  }

  private trimFailureWindow(): void {
    const cutoff = Date.now() - this.config.failureWindowMs;
    this.failures = this.failures.filter((f) => f.timestamp >= cutoff);
  }

  private timeUntilNextAttempt(): number {
    if (this.state !== CircuitState.OPEN || !this.openedAt) return 0;
    const elapsed = Date.now() - this.openedAt;
    return Math.max(0, this.config.resetTimeoutMs - elapsed);
  }

  private nextAttemptAt(): string | undefined {
    if (this.state !== CircuitState.OPEN || !this.openedAt) return undefined;
    return new Date(this.openedAt + this.config.resetTimeoutMs).toISOString();
  }

  private notifyStateChange(from: CircuitState, to: CircuitState): void {
    if (this.config.onStateChange) {
      try {
        this.config.onStateChange(from, to);
      } catch {
        // callback de estado não deve quebrar o circuito
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Circuit breaker pré-configurado para download de tarball GitHub           */
/* -------------------------------------------------------------------------- */

/**
 * createGitHubTarballCircuitBreaker — circuit breaker com parâmetros adequados
 * para falhas de download do tarball do GitHub (rede, 404, rate limit, timeout).
 *
 * Defaults:
 *   - failureThreshold: 3 falhas em 1 minuto → abre o circuito
 *   - resetTimeout: 60 s antes de tentar meia-abertura
 *   - halfOpenMaxCalls: 1 chamada de teste
 */
export function createGitHubTarballCircuitBreaker(
  name: string = 'github-tarball-download',
  config?: CircuitBreakerConfig,
): CircuitBreaker {
  return new CircuitBreaker(name, {
    failureThreshold: 3,
    failureWindowMs: 60_000,
    resetTimeoutMs: 60_000,
    halfOpenMaxCalls: 1,
    ...config,
  });
}
