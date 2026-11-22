/**
 * @nettoscorp/catalog-sync — fallback-chain.ts (Fase 6)
 *
 * Cadeia de fallback para estágios críticos do pipeline de sincronização
 * do catálogo Agency Agents.
 *
 * Estratégia (least privilege, graceful degradation):
 *   1. Primary — operação normal (download do tarball do GitHub, diff, sync)
 *   2. Fallback — versão cacheada localmente (último tarball conhecido bom)
 *   3. Degraded — corpus-baseline local sem atualização (dados estaleiros, mas válidos)
 *   4. Human — escalada para operador (todos os caminhos automatizados falharam)
 *
 * O sistema SEMPRE produz algo — uma resposta estruturada em modo degradado
 * é preferível a uma falha silenciosa.
 */

import { createTraceId, PipelineObserver, SyncStage, SYNC_STAGES, withTrace } from './observability';
import { CircuitBreaker, CircuitBreakerOpenError, createGitHubTarballCircuitBreaker } from './circuit-breaker';

/* -------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* -------------------------------------------------------------------------- */

/** Resultado de uma etapa executada dentro de uma cadeia de fallback. */
export interface StepExecution<TOutput> {
  stepName: string;
  stepIndex: number;
  output: TOutput;
  durationMs: number;
  status: 'success' | 'failure' | 'skipped';
  error?: Error;
}

/** Resultado completo da execução de uma cadeia de fallback. */
export interface FallbackChainResult<TOutput> {
  output: TOutput;
  stepUsed: string;
  stepIndex: number;
  attempts: number;
  totalDurationMs: number;
  stepExecutions: StepExecution<TOutput>[];
  degraded: boolean;      // true se não executou o step primário
  escalated: boolean;     // true se nenhum step conseguiu produzir saída
}

/** Configuração de uma etapa de fallback. */
export interface FallbackStepConfig<TInput, TOutput> {
  name: string;
  description: string;
  priority: number;          // menor = executado primeiro
  canExecute: (input: TInput) => boolean | Promise<boolean>;
  execute: (input: TInput) => Promise<TOutput>;
  isCritical?: boolean;      // se false, falha não interrompe a cadeia
  fallbackToNextOnError?: boolean; // se true, erro deste step tenta o próximo
}

/** Configuração da cadeia de fallback. */
export interface FallbackChainConfig<TInput, TOutput> {
  name: string;
  stage: SyncStage;
  steps: FallbackStepConfig<TInput, TOutput>[];
  observer?: PipelineObserver;
  traceId?: string;
}

/* -------------------------------------------------------------------------- */
/* FallbackChain                                                              */
/* -------------------------------------------------------------------------- */

/**
 * FallbackChain — executa etapas em ordem de prioridade até uma produzir
 * saída com sucesso. Cada etapa pode declarar se pode executar para a entrada
 * dada e se sua falha deve ser tentada na próxima etapa.
 */
export class FallbackChain<TInput, TOutput> {
  private readonly name: string;
  private readonly stage: SyncStage;
  private readonly steps: FallbackStepConfig<TInput, TOutput>[];
  private readonly observer: PipelineObserver;
  private readonly traceId: string;

  constructor(config: FallbackChainConfig<TInput, TOutput>) {
    this.name = config.name;
    this.stage = config.stage;
    this.traceId = config.traceId ?? createTraceId('fallback');
    this.observer =
      config.observer ??
      new PipelineObserver(this.traceId, { minLevel: 'info' });
    // Ordena por prioridade (menor número = maior prioridade)
    this.steps = [...config.steps].sort((a, b) => a.priority - b.priority);
  }

  /** Nome da cadeia (útil para logs e métricas). */
  getName(): string {
    return this.name;
  }

  /** Estágio do pipeline ao qual esta cadeia pertence. */
  getStage(): SyncStage {
    return this.stage;
  }

  /** Etapas ordenadas por prioridade. */
  getSteps(): readonly FallbackStepConfig<TInput, TOutput>[] {
    return this.steps;
  }

  /**
   * execute — tenta cada etapa em ordem até uma retornar sucesso.
   *
   *   const result = await fallbackChain.execute({ tarballUrl, corpusDir });
   *   if (result.escalated) { // alerta operador
   */
  async execute(input: TInput): Promise<FallbackChainResult<TOutput>> {
    const start = Date.now();
    const executions: StepExecution<TOutput>[] = [];
    let stepIndex = 0;
    let degraded = false;

    this.observer.log('info', this.stage, `Cadeia de fallback iniciada: ${this.name}`, {
      traceId: this.traceId,
      chain: this.name,
      stage: this.stage,
      stepCount: this.steps.length,
    });

    for (const [index, step] of this.steps.entries()) {
      stepIndex = index;

      // Verifica se a etapa pode executar para esta entrada
      let canExecute = false;
      try {
        canExecute = await step.canExecute(input);
      } catch (canExecuteError) {
        this.observer.log('warn', this.stage, `Etapa ${step.name}: canExecute lançou`, {
          traceId: this.traceId,
          chain: this.name,
          step: step.name,
          error: canExecuteError instanceof Error ? canExecuteError.message : String(canExecuteError),
        });
        canExecute = false;
      }

      if (!canExecute) {
        executions.push({
          stepName: step.name,
          stepIndex: index,
          output: undefined as unknown as TOutput,
          durationMs: 0,
          status: 'skipped',
        });
        continue;
      }

      degraded = index > 0; // qualquer etapa além da primária = modo degradado

      const stepStart = Date.now();
      let stepError: Error | undefined;

      try {
        const output = await step.execute(input);
        const durationMs = Date.now() - stepStart;

        executions.push({
          stepName: step.name,
          stepIndex: index,
          output,
          durationMs,
          status: 'success',
        });

        this.observer.log('info', this.stage, `Etapa ${step.name} executada com sucesso`, {
          traceId: this.traceId,
          chain: this.name,
          step: step.name,
          stepIndex: index,
          durationMs,
          degraded,
        });

        return {
          output,
          stepUsed: step.name,
          stepIndex: index,
          attempts: index + 1,
          totalDurationMs: Date.now() - start,
          stepExecutions: executions,
          degraded,
          escalated: false,
        };
      } catch (error) {
        const durationMs = Date.now() - stepStart;
        stepError = error instanceof Error ? error : new Error(String(error));

        executions.push({
          stepName: step.name,
          stepIndex: index,
          output: undefined as unknown as TOutput,
          durationMs,
          status: 'failure',
          error: stepError,
        });

        this.observer.log('warn', this.stage, `Etapa ${step.name} falhou`, {
          traceId: this.traceId,
          chain: this.name,
          step: step.name,
          stepIndex: index,
          durationMs,
          error: stepError.message,
        });

        // Se a etapa não é crítica ou permite fallback, tenta a próxima
        if (!step.isCritical || step.fallbackToNextOnError !== false) {
          continue;
        }

        // Etapa crítica sem fallback permitido: encerra cadeia com erro
        break;
      }
    }

    // Nenhuma etapa conseguiu produzir saída — escalada
    const totalDurationMs = Date.now() - start;
    this.observer.log('error', this.stage, `Cadeia de fallback esgotada: ${this.name}`, {
      traceId: this.traceId,
      chain: this.name,
      stage: this.stage,
      attempts: executions.length,
      totalDurationMs,
      escalated: true,
    });

    return {
      output: undefined as unknown as TOutput,
      stepUsed: 'none',
      stepIndex: stepIndex,
      attempts: executions.length,
      totalDurationMs,
      stepExecutions: executions,
      degraded: true,
      escalated: true,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Fallback de tarball baixado em cache                                       */
/* -------------------------------------------------------------------------- */

/**
 * CachedTarballFallback — lê o último tarball baixado com sucesso de um
 * diretório de cache local. Usado como fallback (prioridade 2) quando o
 * download do GitHub falha e o circuit breaker está OPEN.
 */
export interface CachedTarballFallbackOptions {
  cacheDir: string;           // diretório onde tarballs cacheados são guardados
  maxCacheAgeMs?: number;     // idade máxima do cache (default 24h)
  httpFetch?: typeof fetch;   // injeção para testes (não usado neste fallback)
}

/**
 * createCachedTarballFallback — retorna um FallbackStepConfig que lê o tarball
 * mais recente do diretório de cache local.
 */
export function createCachedTarballFallback(
  options: CachedTarballFallbackOptions,
): FallbackStepConfig<{ tarballUrl: string; cacheDir?: string }, { tarballPath: string; sha: string; size: number; fromCache: boolean }> {
  const { cacheDir, maxCacheAgeMs = 24 * 60 * 60 * 1000 } = options;

  return {
    name: 'cached-tarball',
    description: 'Usa o último tarball baixado com sucesso do cache local',
    priority: 2,
    canExecute: async ({ cacheDir: customCacheDir }) => {
      const dir = customCacheDir ?? cacheDir;
      try {
        const { readdir } = await import('node:fs/promises');
        const entries = await readdir(dir, { withFileTypes: true });
        return entries.some(
          (e) => e.isFile() && e.name.endsWith('.tar.gz'),
        );
      } catch {
        return false;
      }
    },
    execute: async ({ cacheDir: customCacheDir }) => {
      const dir = customCacheDir ?? cacheDir;
      const { readdir, stat, readFile } = await import('node:fs/promises');
      const { createHash } = await import('node:crypto');
      const { join } = await import('node:path');

      const entries = await readdir(dir, { withFileTypes: true });
      const tarballs = entries.filter(
        (e) => e.isFile() && e.name.endsWith('.tar.gz'),
      );

      if (tarballs.length === 0) {
        throw new Error('cached-tarball: nenhum tarball em cache disponível');
      }

      // Seleciona o mais recente por mtime
      let best: { name: string; mtimeMs: number } | null = null;
      for (const entry of tarballs) {
        const fullPath = join(dir, entry.name);
        const s = await stat(fullPath);
        if (!best || s.mtimeMs > best.mtimeMs) {
          best = { name: entry.name, mtimeMs: s.mtimeMs };
        }
      }

      if (!best) {
        throw new Error('cached-tarball: falha ao selecionar tarball em cache');
      }

      // Verifica idade do cache
      const ageMs = Date.now() - best.mtimeMs;
      if (ageMs > maxCacheAgeMs) {
        throw new Error(
          `cached-tarball: cache excedeu idade máxima (${Math.round(ageMs / 1000)}s > ${Math.round(maxCacheAgeMs / 1000)}s)`,
        );
      }

      const tarballPath = join(dir, best.name);
      const content = await readFile(tarballPath);
      const sha = createHash('sha256').update(content).digest('hex');

      return {
        tarballPath,
        sha,
        size: content.length,
        fromCache: true,
      };
    },
    isCritical: false,
    fallbackToNextOnError: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Degraded fallback: corpus-baseline local sem atualização                   */
/* -------------------------------------------------------------------------- */

/**
 * createDegradedCorpusFallback — retorna um FallbackStepConfig que serve o
 * corpus-baseline local sem atualizar (dados estaleiros). Usado quando tanto
 * o download quanto o cache falham.
 */
export function createDegradedCorpusFallback(
  corpusDir: string,
): FallbackStepConfig<{ corpusDir: string }, { corpusDir: string; fromCache: boolean; stale: boolean }> {
  return {
    name: 'degraded-corpus',
    description: 'Serve o corpus-baseline local sem atualização (dados estaleiros)',
    priority: 3,
    canExecute: async ({ corpusDir: customCorpusDir }) => {
      const { stat } = await import('node:fs/promises');
      try {
        await stat(customCorpusDir ?? corpusDir);
        return true;
      } catch {
        return false;
      }
    },
    execute: async ({ corpusDir: customCorpusDir }) => {
      const { readdir } = await import('node:fs/promises');
      const dir = customCorpusDir ?? corpusDir;
      const entries = await readdir(dir, { withFileTypes: true });
      if (entries.length === 0) {
        throw new Error('degraded-corpus: corpus-baseline local está vazio');
      }
      return {
        corpusDir: dir,
        fromCache: true,
        stale: true,
      };
    },
    isCritical: false,
    fallbackToNextOnError: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Cadeias de fallback pré-configuradas por estágio crítico                   */
/* -------------------------------------------------------------------------- */

/**
 * createDownloadFallbackChain — cadeia de fallback para o estágio de download
 * do tarball do GitHub.
 *
 * Etapas:
 *   1. Primary: download direto do GitHub (protegido por circuit breaker)
 *   2. Fallback: tarball em cache local (último conhecido bom)
 *   3. Degraded: corpus-baseline local sem atualização
 *   4. Human: nenhuma etapa automática — escalada para operador
 */
export interface DownloadFallbackChainInput {
  tarballUrl: string;
  cacheDir: string;
  corpusDir: string;
  httpFetch?: typeof fetch;
  circuitBreaker?: CircuitBreaker;
}

export interface DownloadFallbackChainOutput {
  tarballPath: string;
  sha: string;
  size: number;
  fromCache: boolean;
  stale: boolean;
  source: 'github' | 'cache' | 'degraded';
}

export function createDownloadFallbackChain(
  input: DownloadFallbackChainInput,
  observer?: PipelineObserver,
  traceId?: string,
): FallbackChain<DownloadFallbackChainInput, DownloadFallbackChainOutput> {
  const { cacheDir, corpusDir, httpFetch, circuitBreaker } = input;
  const cb =
    circuitBreaker ??
    createGitHubTarballCircuitBreaker('github-tarball-download');

  const primaryStep: FallbackStepConfig<DownloadFallbackChainInput, DownloadFallbackChainOutput> = {
    name: 'github-download',
    description: 'Download do tarball do GitHub (com circuit breaker)',
    priority: 1,
    canExecute: async () => {
      // O circuit breaker decide se a chamada é permitida
      const status = cb.getStatus();
      return status.state !== 'OPEN';
    },
    execute: async ({ tarballUrl, httpFetch: customFetch }) => {
      const fetch = customFetch ?? httpFetch;
      if (!fetch) {
        throw new Error('github-download: nenhum fetch disponível');
      }

      // Executa o download dentro do circuit breaker
      const result = await cb.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120_000);
        try {
          const response = await fetch(tarballUrl, {
            signal: controller.signal,
            headers: {
              Accept: 'application/gzip, application/octet-stream',
              'User-Agent': 'nettoscorp-catalog-sync/0.1.0',
            },
          });
          if (!response.ok) {
            throw new Error(`GitHub respondeu ${response.status} ${response.statusText}`);
          }
          if (!response.body) {
            throw new Error('Sem corpo na resposta do tarball');
          }

          const { pipeline } = await import('node:stream');
          const { promisify } = await import('node:util');
          const { createWriteStream } = await import('node:fs');
          const { mkdtemp } = await import('node:fs/promises');
          const { tmpdir } = await import('node:os');
          const { join } = await import('node:path');

          const streamPipeline = promisify(pipeline);
          const workDir = await mkdtemp(join(tmpdir(), 'catalog-sync-download-'));
          const tarballPath = join(workDir, 'upstream.tar.gz');

          await streamPipeline(
            response.body as unknown as NodeJS.ReadableStream,
            createWriteStream(tarballPath),
          );

          const { createHash } = await import('node:crypto');
          const content = await import('node:fs/promises').then((m) => m.readFile(tarballPath));
          const sha = createHash('sha256').update(content).digest('hex');

          return { tarballPath, sha, size: content.length };
        } finally {
          clearTimeout(timeoutId);
        }
      });

      return {
        ...result,
        fromCache: false,
        stale: false,
        source: 'github',
      };
    },
    isCritical: true,
    fallbackToNextOnError: true,
  };

  const cachedStep = createCachedTarballFallback({ cacheDir });

  const degradedStep = createDegradedCorpusFallback(corpusDir);

  return new FallbackChain<DownloadFallbackChainInput, DownloadFallbackChainOutput>({
    name: 'download-fallback-chain',
    stage: SYNC_STAGES.DIFF,
    steps: [
      primaryStep,
      // Wraps o output do cache para incluir stale/source esperados pelo tipo de saída
      {
        ...cachedStep,
        execute: async (input) => {
          const result = await cachedStep.execute(input);
          return {
            ...result,
            stale: true,
            source: 'cache' as const,
          };
        },
      },
      {
        ...degradedStep,
        execute: async (input) => {
          const result = await degradedStep.execute(input);
          return {
            ...result,
            tarballPath: '',
            sha: '',
            size: 0,
            source: 'degraded' as const,
          };
        },
      },
    ],
    observer,
    traceId,
  });
}

/**
 * createSyncFallbackChain — cadeia de fallback para o estágio de aplicação
 * do diff ao corpus-baseline.
 *
 * Etapas:
 *   1. Primary: aplica diff ao corpus-baseline (com snapshot)
 *   2. Degraded: registra falha e mantém corpus inalterado (sem atualização)
 *   3. Human: escalada para operador (intervenção manual necessária)
 */
export interface SyncFallbackChainInput {
  diff: unknown; // DiffResult
  corpusDir: string;
  workDir: string;
  confirm: boolean;
  snapshotLabel?: string;
}

export interface SyncFallbackChainOutput {
  applied: boolean;
  releaseSha: string;
  written: string[];
  deleted: string[];
  skipped: string[];
  snapshotId?: string;
  degraded: boolean;
}

export function createSyncFallbackChain(
  input: SyncFallbackChainInput,
  observer?: PipelineObserver,
  traceId?: string,
): FallbackChain<SyncFallbackChainInput, SyncFallbackChainOutput> {
  const { corpusDir, workDir, confirm, snapshotLabel } = input;

  const primaryStep: FallbackStepConfig<SyncFallbackChainInput, SyncFallbackChainOutput> = {
    name: 'sync-apply',
    description: 'Aplica o diff ao corpus-baseline (com snapshot prévio)',
    priority: 1,
    canExecute: async ({ confirm: c }) => c === true,
    execute: async ({ diff, corpusDir: customCorpusDir, workDir: customWorkDir, snapshotLabel: label }) => {
      const { RollbackManager } = await import('./rollback-manager');
      const { join } = await import('node:path');

      const rollbackManager = new RollbackManager({
        baselineDir: customCorpusDir ?? corpusDir,
        snapshotsDir: join(customWorkDir ?? workDir, 'snapshots'),
      });

      const snapshot = await rollbackManager.snapshot(label ?? `pre-sync-${(diff as any).releaseSha?.slice(0, 8) ?? 'unknown'}`);

      // Aplica o diff (mesma lógica de SyncJob.apply)
      const written: string[] = [];
      const deleted: string[] = [];
      const skipped: string[] = [];

      const { writeFile, mkdir, rm, readdir } = await import('node:fs/promises');
      const { resolve, relative, sep } = await import('node:path');

      const diffTyped = diff as {
        new: Array<{ after: { relativePath: string; content: string; slug: string; classification: string } | null }>;
        updated: Array<{ after: { relativePath: string; content: string; slug: string; classification: string } | null }>;
        removed: Array<{ before: { relativePath: string } | null }>;
        unchanged: Array<{ after: { relativePath: string } }>;
        releaseSha: string;
      };

      for (const entry of [...diffTyped.new, ...diffTyped.updated]) {
        const record = entry.after!;
        const targetPath = join(customCorpusDir ?? corpusDir, record.relativePath);
        await mkdir(join(customCorpusDir ?? corpusDir, relative(customCorpusDir ?? corpusDir, record.relativePath).split(sep).slice(0, -1).join(sep)), { recursive: true });
        await writeFile(targetPath, record.content, 'utf8');
        written.push(record.relativePath);
      }

      for (const entry of diffTyped.removed) {
        const record = entry.before!;
        const targetPath = join(customCorpusDir ?? corpusDir, record.relativePath);
        await rm(targetPath, { force: true });
        deleted.push(record.relativePath);
      }

      for (const entry of diffTyped.unchanged) {
        skipped.push(entry.after.relativePath);
      }

      return {
        applied: true,
        releaseSha: diffTyped.releaseSha,
        written,
        deleted,
        skipped,
        snapshotId: snapshot.id,
        degraded: false,
      };
    },
    isCritical: true,
    fallbackToNextOnError: true,
  };

  const degradedStep: FallbackStepConfig<SyncFallbackChainInput, SyncFallbackChainOutput> = {
    name: 'sync-degraded',
    description: 'Mantém corpus inalterado — registra falha de aplicação',
    priority: 2,
    canExecute: async () => true,
    execute: async ({ diff }) => {
      const diffTyped = diff as { releaseSha: string };
      return {
        applied: false,
        releaseSha: diffTyped.releaseSha,
        written: [],
        deleted: [],
        skipped: [],
        snapshotId: undefined,
        degraded: true,
      };
    },
    isCritical: false,
    fallbackToNextOnError: true,
  };

  return new FallbackChain<SyncFallbackChainInput, SyncFallbackChainOutput>({
    name: 'sync-fallback-chain',
    stage: SYNC_STAGES.SYNC,
    steps: [primaryStep, degradedStep],
    observer,
    traceId,
  });
}

/**
 * createNotifyFallbackChain — cadeia de fallback para o estágio de notificação.
 *
 * Etapas:
 *   1. Primary: notificador configurado (ConsoleNotifier, webhook, etc.)
 *   2. Degraded: log de notificação no stderr (não bloqueia o pipeline)
 */
export interface NotifyFallbackChainInput {
  type: string;
  payload: unknown;
  correlationId: string;
}

export interface NotifyFallbackChainOutput {
  notified: boolean;
  degraded: boolean;
}

export function createNotifyFallbackChain(
  notifier: { notify: (message: unknown) => Promise<void> },
  observer?: PipelineObserver,
  traceId?: string,
): FallbackChain<NotifyFallbackChainInput, NotifyFallbackChainOutput> {
  const primaryStep: FallbackStepConfig<NotifyFallbackChainInput, NotifyFallbackChainOutput> = {
    name: 'notify-primary',
    description: 'Notificação via canal configurado',
    priority: 1,
    canExecute: async () => true,
    execute: async (input) => {
      await notifier.notify(input);
      return { notified: true, degraded: false };
    },
    isCritical: false,
    fallbackToNextOnError: true,
  };

  const degradedStep: FallbackStepConfig<NotifyFallbackChainInput, NotifyFallbackChainOutput> = {
    name: 'notify-degraded',
    description: 'Log de notificação em stderr (não bloqueante)',
    priority: 2,
    canExecute: async () => true,
    execute: async (input) => {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({
        level: 'notify-degraded',
        ts: new Date().toISOString(),
        ...input,
        reason: 'notificador primário falhou',
      }));
      return { notified: false, degraded: true };
    },
    isCritical: false,
    fallbackToNextOnError: false,
  };

  return new FallbackChain<NotifyFallbackChainInput, NotifyFallbackChainOutput>({
    name: 'notify-fallback-chain',
    stage: SYNC_STAGES.NOTIFY,
    steps: [primaryStep, degradedStep],
    observer,
    traceId,
  });
}
