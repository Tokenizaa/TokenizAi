/**
 * @nettoscorp/catalog-sync — sync-job.ts (Fase 6)
 *
 * Job de sincronização do catálogo Agency Agents:
 * - baixa o tarball upstream (com reententativa, backoff e timeout)
 * - extrai os agentes do tarball
 * - re-indexa o corpus-baseline local
 * - diff local vs upstream (SHA por agente)
 * - aplica o diff ao corpus-baseline de forma idempotente com snapshot prévio
 *
 * Idempotência: aplicar o mesmo release duas vezes resulta no mesmo estado do
 * corpus (arquivos inalterados são sobrescritos com conteúdo idêntico e não são
 * contados como mudanças na segunda execução).
 */

import {
  AgentRecord,
  DiffResult,
  sha256,
  parseFrontmatter,
  agentSlugFromPath,
  isPathWithin,
  parseCorpusManifest,
  DiffEngine,
  logger,
  correlationId,
} from './diff-engine';
import { RollbackManager } from './rollback-manager';
import { generateUUID } from '@nettoscorp/shared';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createWriteStream, statSync, readdirSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import fetch from 'node-fetch';

const streamPipeline = promisify(pipeline);

/* -------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* -------------------------------------------------------------------------- */

export interface SyncJobOptions {
  upstreamRepo: string;              // "msitarzewski/agency-agents"
  releaseTag?: string;               // ex. "v0.3.2" (omitido = latest)
  tarballUrl?: string;               // URL direta ao tarball (sobrescreve releaseTag)
  corpusDir: string;                 // corpus-baseline local
  workDir: string;                   // diretório temporário de trabalho
  httpFetch?: typeof fetch;          // injeção para testes
  requestTimeoutMs?: number;         // timeout de download (default 120s)
  maxRetries?: number;               // reententativas de download (default 3)
}

/** Resultado da aplicação de um diff ao corpus local. */
export interface ApplyResult {
  appliedAt: string;
  releaseSha: string;
  written: string[];    // caminhos gravados (novos/atualizados)
  deleted: string[];    // caminhos removidos
  skipped: string[];    // inalterados (não tocados)
  snapshotId: string;   // snapshot tirado antes de aplicar (rollback)
}

/* -------------------------------------------------------------------------- */
/* SyncJob                                                                    */
/* -------------------------------------------------------------------------- */

export class SyncJob {
  private readonly options: Required<SyncJobOptions>;
  private readonly fetch: typeof fetch;
  private readonly diffEngine: DiffEngine;

  constructor(options: SyncJobOptions) {
    this.options = {
      upstreamRepo: options.upstreamRepo,
      releaseTag: options.releaseTag ?? 'latest',
      tarballUrl: options.tarballUrl ?? '',
      corpusDir: resolve(options.corpusDir),
      workDir: resolve(options.workDir),
      httpFetch: options.httpFetch ?? fetch,
      requestTimeoutMs: options.requestTimeoutMs ?? 120_000,
      maxRetries: options.maxRetries ?? 3,
    };
    this.fetch = this.options.httpFetch;
    this.diffEngine = new DiffEngine();
  }

  /** URL do tarball do release (GitHub ou direta). */
  releaseTarballUrl(): string {
    if (this.options.tarballUrl) return this.options.tarballUrl;
    return `https://github.com/${this.options.upstreamRepo}/releases/download/${this.options.releaseTag}/corpus-baseline.tar.gz`;
  }

  /**
   * baixarTarball — baixa o tarball upstream com reententativas com backoff
   * e timeout. Retorna caminho, SHA-256 e tamanho.
   */
  async baixarTarball(cid: string): Promise<{ tarballPath: string; sha: string; size: number }> {
    const url = this.releaseTarballUrl();
    logger.info(cid, 'baixarTarball: iniciando', { url, workDir: this.options.workDir });

    const result = await this.diffEngine.fetchUpstreamTarball(url, {
      outDir: this.options.workDir,
      requestTimeoutMs: this.options.requestTimeoutMs,
      maxRetries: this.options.maxRetries,
      httpFetch: this.options.httpFetch,
    });

    logger.info(cid, 'baixarTarball: concluído', {
      tarballPath: result.tarballPath,
      sha: result.sha,
      size: result.size,
    });
    return result;
  }

  /**
   * extrairAgentes — extrai um tarball .tar.gz em um diretório destino usando
   * tar do sistema.
   */
  async extrairAgentes(tarballPath: string, destDir: string): Promise<void> {
    await mkdir(destDir, { recursive: true });
    const { stderr } = await promisify(execFile)('tar', ['-xzf', tarballPath, '-C', destDir], {
      maxBuffer: 50 * 1024 * 1024,
    });
    if (stderr && stderr.includes('tar:')) {
      logger.warn('sync-job', `tar stderr: ${stderr.slice(0, 500)}`);
    }
  }

  /**
   * readCorpus — lê o corpus-baseline de um diretório (mapa slug → AgentRecord
   * com SHA por arquivo). Alias de parseCorpusManifest.
   */
  async readCorpus(rootDir: string): Promise<Map<string, AgentRecord>> {
    return parseCorpusManifest(rootDir);
  }

  /**
   * reIndexarAgentes — rele o corpus-baseline local, recalculando SHA por
   * agente. Útil após aplicações manuais ou para validar o estado atual.
   */
  async reIndexarAgentes(corpusDir?: string): Promise<Map<string, AgentRecord>> {
    const root = corpusDir ? resolve(corpusDir) : this.options.corpusDir;
    logger.info(correlationId(), 'reIndexarAgentes: reindexando corpus', { root });
    return parseCorpusManifest(root);
  }

  /**
   * diff — executa o diff completo: baixa tarball upstream, extrai, lê ambos
   * os corpora e retorna o DiffResult classificado por SHA.
   */
  async diff(cid?: string): Promise<DiffResult> {
    const correlation = cid ?? correlationId();
    logger.info(correlation, 'sync-job: iniciando diff', { corpusDir: this.options.corpusDir });

    const local = await this.readCorpus(this.options.corpusDir);

    const { tarballPath } = await this.baixarTarball(correlation);
    const extractDir = join(this.options.workDir, `upstream-extract-${Date.now()}`);
    await this.extrairAgentes(tarballPath, extractDir);

    const upstreamRoot = this.findCorpusRoot(extractDir);
    const upstream = await this.readCorpus(upstreamRoot);

    const result = this.diffEngine.compare(local, upstream);

    logger.info(correlation, 'sync-job: diff concluído', {
      local: result.summary.totalLocal,
      upstream: result.summary.totalUpstream,
      added: result.summary.added,
      modified: result.summary.modified,
      deleted: result.summary.deleted,
      unchanged: result.summary.unchanged,
    });
    return result;
  }

  /**
   * atualizarCorpusBaseline — aplica um diff ao corpus-baseline local:
   * grava novos/atualizados, remove os marcados como removidos, deixa
   * inalterados intocados. Tira snapshot imutável antes de mutar (rollback).
   * Requer confirm: true.
   */
  async atualizarCorpusBaseline(
    diff: DiffResult,
    options: { confirm: boolean; snapshotLabel?: string },
  ): Promise<ApplyResult> {
    const cid = correlationId();
    if (!options.confirm) {
      throw new Error('sync-job: se requer confirm: true para aplicar mudanças ao corpus-baseline');
    }

    const rollbackManager = new RollbackManager({
      baselineDir: this.options.corpusDir,
      snapshotsDir: join(this.options.workDir, 'snapshots'),
    });

    // Snapshot imutável antes de qualquer mutação (garantia de rollback).
    const snapshot = await rollbackManager.snapshot(options.snapshotLabel ?? `pre-sync-${diff.releaseSha.slice(0, 8)}`);

    const written: string[] = [];
    const deleted: string[] = [];
    const skipped: string[] = [];

    // Novos e atualizados: gravar arquivo
    for (const entry of [...diff.new, ...diff.updated]) {
      const record = entry.after!;
      const targetPath = join(this.options.corpusDir, record.relativePath);
      if (!isPathWithin(this.options.corpusDir, targetPath)) {
        throw new Error(`sync-job: caminho fora do corpus bloqueado: ${record.relativePath}`);
      }
      const parentDir = join(
        this.options.corpusDir,
        relative(this.options.corpusDir, record.relativePath).split(sep).slice(0, -1).join(sep),
      );
      await mkdir(parentDir, { recursive: true });
      await writeFile(targetPath, record.content, 'utf8');
      written.push(record.relativePath);
      logger.info(cid, 'sync-job: agente gravado', {
        slug: entry.slug,
        path: record.relativePath,
        classification: entry.classification,
      });
    }

    // Removidos: excluir arquivo
    for (const entry of diff.removed) {
      const record = entry.before!;
      const targetPath = join(this.options.corpusDir, record.relativePath);
      if (!isPathWithin(this.options.corpusDir, targetPath)) {
        throw new Error(`sync-job: caminho fora do corpus bloqueado: ${record.relativePath}`);
      }
      await rm(targetPath, { force: true });
      deleted.push(record.relativePath);
      logger.info(cid, 'sync-job: agente removido', { slug: entry.slug, path: record.relativePath });
    }

    // Inalterados: não tocar
    for (const entry of diff.unchanged) {
      skipped.push(entry.after!.relativePath);
    }

    const result: ApplyResult = {
      appliedAt: new Date().toISOString(),
      releaseSha: diff.releaseSha,
      written,
      deleted,
      skipped,
      snapshotId: snapshot.id,
    };

    logger.info(cid, 'sync-job: aplicação de diff concluída', {
      releaseSha: diff.releaseSha,
      written: written.length,
      deleted: deleted.length,
      skipped: skipped.length,
      snapshotId: snapshot.id,
    });
    return result;
  }

  /** Alias mantido por compatibilidade com SyncOrchestrator. */
  async apply(diff: DiffResult, options: { confirm: boolean; snapshotLabel?: string }): Promise<ApplyResult> {
    return this.atualizarCorpusBaseline(diff, options);
  }

  /* ---------- privados ---------- */

  private async listMarkdownFiles(dir: string): Promise<string[]> {
    const result: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'scripts') continue;
        result.push(...(await this.listMarkdownFiles(full)));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        result.push(full);
      }
    }
    return result;
  }

  private findCorpusRoot(extractDir: string): string {
    const entries = readdirSync(extractDir, { withFileTypes: true });
    const hasDivisions = entries.some(
      (e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'scripts',
    );
    if (hasDivisions) return extractDir;
    const subDirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
    if (subDirs.length === 1) return join(extractDir, subDirs[0].name);
    return extractDir;
  }
}
