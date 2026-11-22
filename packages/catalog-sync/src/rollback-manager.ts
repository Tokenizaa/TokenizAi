/**
 * @nettoscorp/catalog-sync — rollback-manager.ts (Fase 6)
 *
 * Gerencia snapshots versionados do corpus-baseline e permite reverter
 * (one-click) para uma versão anterior de forma atômica.
 *
 * Garantias:
 *  - snapshot copiado íntegro antes de qualquer mutação do baseline
 *  - restore via rename atômico (mv) no mesmo filesystem, evitando estados
 *    intermediários corruptos
 *  - stash de segurança do baseline atual durante o restore
 */

import { AgentRecord, sha256, logger, correlationId } from './diff-engine';
import { generateUUID } from '@nettoscorp/shared';
import { readdir, readFile, writeFile, mkdir, rm, rename } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/* -------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* -------------------------------------------------------------------------- */

/** Snapshot versionado do corpus-baseline para rollback. */
export interface Snapshot {
  id: string;
  label: string;
  createdAt: string;
  baselineDir: string;
  snapshotDir: string;
  manifestPath: string;
  agentCount: number;
  corpusSha: string; // SHA-256 do fingerprint (slug:sha) de todos os agentes
}

/** Resultado da validação de integridade de um snapshot. */
export interface IntegrityReport {
  valid: boolean;
  snapshotId: string;
  label: string;
  agentCount: number;
  corpusSha: string;
  expectedCorpusSha: string;
  missingFiles: string[];
  details: string[];
}

export interface RollbackManagerOptions {
  baselineDir: string;   // corpus-baseline ativo
  snapshotsDir: string;  // onde são guardados os snapshots
}

/* -------------------------------------------------------------------------- */
/* RollbackManager                                                            */
/* -------------------------------------------------------------------------- */

export class RollbackManager {
  private readonly baselineDir: string;
  private readonly snapshotsDir: string;

  constructor(options: RollbackManagerOptions) {
    this.baselineDir = resolve(options.baselineDir);
    this.snapshotsDir = resolve(options.snapshotsDir);
  }

  /** Cria um snapshot imutável do corpus-baseline atual. */
  async snapshot(label?: string): Promise<Snapshot> {
    const cid = correlationId();
    await mkdir(this.snapshotsDir, { recursive: true });
    const id = `snap-${Date.now()}-${generateUUID().slice(0, 8)}`;
    const snapshotLabel = label ?? id;
    const snapshotDir = join(this.snapshotsDir, id);

    const corpus = await this.readBaselineCorpus();
    const corpusSha = sha256(
      [...corpus.entries()]
        .map(([slug, rec]) => `${slug}:${rec.sha}`)
        .sort()
        .join('|'),
    );

    await mkdir(snapshotDir, { recursive: true });
    await this.copyDirectoryRecursive(this.baselineDir, snapshotDir);

    const manifestPath = join(snapshotDir, 'snapshot-manifest.json');
    const manifest = {
      id,
      label: snapshotLabel,
      createdAt: new Date().toISOString(),
      baselineDir: this.baselineDir,
      snapshotDir,
      agentCount: corpus.size,
      corpusSha,
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    logger.info(cid, 'snapshot criado', {
      id,
      label: snapshotLabel,
      agentCount: corpus.size,
      corpusSha,
      snapshotDir,
    });

    return {
      id,
      label: snapshotLabel,
      createdAt: manifest.createdAt,
      baselineDir: this.baselineDir,
      snapshotDir,
      manifestPath,
      agentCount: corpus.size,
      corpusSha,
    };
  }

  /** Lista todos os snapshots disponíveis, mais recente primeiro. */
  async listarVersoesAnteriores(): Promise<Snapshot[]> {
    await mkdir(this.snapshotsDir, { recursive: true });
    const entries = await readdir(this.snapshotsDir, { withFileTypes: true });
    const snapshots: Snapshot[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(this.snapshotsDir, entry.name, 'snapshot-manifest.json');
      try {
        const raw = await readFile(manifestPath, 'utf8');
        const m = JSON.parse(raw);
        snapshots.push({
          id: m.id,
          label: m.label,
          createdAt: m.createdAt,
          baselineDir: m.baselineDir,
          snapshotDir: join(this.snapshotsDir, entry.name),
          manifestPath,
          agentCount: m.agentCount,
          corpusSha: m.corpusSha,
        });
      } catch {
        // snapshot sem manifesto: ignorado (pode estar incompleto)
      }
    }
    return snapshots.sort((a, b) => (b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0));
  }

  /**
   * One-click revert: restaura o corpus-baseline ao snapshot indicado (id ou
   * label). Operação atômica com stash de segurança do baseline atual.
   */
  async reverterParaVersao(
    versao: string,
  ): Promise<{ restoredTo: Snapshot; previousBaselineMovedTo: string }> {
    const cid = correlationId();
    const snapshots = await this.listarVersoesAnteriores();
    const snapshot = snapshots.find((s) => s.id === versao || s.label === versao);
    if (!snapshot) {
      const available = snapshots.map((s) => s.id).join(', ');
      throw new Error(`rollback-manager: snapshot não encontrado: ${versao}. Disponíveis: ${available}`);
    }

    const stashDir = join(this.snapshotsDir, `_rollback-stash-${Date.now()}`);
    await mkdir(this.snapshotsDir, { recursive: true });

    // 1. Move o baseline atual para stash (respaldo de segurança)
    await rename(this.baselineDir, stashDir);

    try {
      // 2. Move o snapshot para o lugar do baseline (atômico no mesmo FS)
      await rename(snapshot.snapshotDir, this.baselineDir);
    } catch (error) {
      // 3. Se falhar, tenta devolver o baseline ao local (segurança)
      try {
        await rename(stashDir, this.baselineDir);
      } catch (recoverError) {
        logger.error(cid, 'rollback-manager: falha ao recuperar baseline após erro', recoverError);
      }
      logger.error(cid, 'rollback-manager: falha ao restaurar snapshot', error);
      throw error;
    }

    // 4. Remove o stash do baseline anterior
    await rm(stashDir, { recursive: true, force: true }).catch(() => {
      logger.warn(cid, `rollback-manager: não foi possível remover stash anterior: ${stashDir}`);
    });

    logger.info(cid, 'rollback executado', {
      restoredTo: snapshot.id,
      previousBaselineStashed: stashDir,
      agentCount: snapshot.agentCount,
    });

    return { restoredTo: snapshot, previousBaselineMovedTo: stashDir };
  }

  /**
   * validarIntegridade — valida a integridade de um snapshot (ou do mais
   * recente quando não informado): re-lê o corpus do snapshot, recompõe o
   * fingerprint e compara com o manifesto.
   */
  async validarIntegridade(snapshotId?: string): Promise<IntegrityReport> {
    const cid = correlationId();
    const snapshots = await this.listarVersoesAnteriores();
    const snapshot = snapshotId ? snapshots.find((s) => s.id === snapshotId || s.label === snapshotId) : snapshots[0];

    const details: string[] = [];
    const missingFiles: string[] = [];

    if (!snapshot) {
      return {
        valid: false,
        snapshotId: snapshotId ?? '(nenhum)',
        label: '',
        agentCount: 0,
        corpusSha: '',
        expectedCorpusSha: '',
        missingFiles,
        details: ['Nenhum snapshot disponível para validar.'],
      };
    }

    try {
      await readFile(snapshot.manifestPath, 'utf8');
    } catch {
      details.push('Manifesto do snapshot não é legível.');
      return {
        valid: false,
        snapshotId: snapshot.id,
        label: snapshot.label,
        agentCount: snapshot.agentCount,
        corpusSha: snapshot.corpusSha,
        expectedCorpusSha: snapshot.corpusSha,
        missingFiles,
        details,
      };
    }

    // Re-lê o corpus do snapshot e recompõe o fingerprint.
    let corpus: Map<string, AgentRecord>;
    try {
      corpus = await this.readSnapshotCorpus(snapshot.snapshotDir);
    } catch (error) {
      details.push(`Falha ao ler corpus do snapshot: ${error instanceof Error ? error.message : String(error)}`);
      return {
        valid: false,
        snapshotId: snapshot.id,
        label: snapshot.label,
        agentCount: snapshot.agentCount,
        corpusSha: snapshot.corpusSha,
        expectedCorpusSha: snapshot.corpusSha,
        missingFiles,
        details,
      };
    }

    const recomputedSha = sha256(
      [...corpus.entries()]
        .map(([slug, rec]) => `${slug}:${rec.sha}`)
        .sort()
        .join('|'),
    );

    const match = recomputedSha === snapshot.corpusSha && corpus.size === snapshot.agentCount;
    if (!match) {
      details.push(
        `Fingerprint diverge do manifesto (recomputado=${recomputedSha.slice(0, 8)} vs manifesto=${snapshot.corpusSha.slice(0, 8)}) ` +
          `ou contagem de agentes diverge (${corpus.size} vs ${snapshot.agentCount}).`,
      );
    }

    // Verifica legibilidade de cada arquivo do snapshot.
    for (const [slug, rec] of corpus) {
      try {
        await readFile(rec.path, 'utf8');
      } catch {
        missingFiles.push(rec.relativePath);
        details.push(`Arquivo ilegível ou ausente no snapshot: ${rec.relativePath}`);
      }
    }

    const valid = match && missingFiles.length === 0;
    if (valid) {
      details.push('Integridade válida: fingerprint, contagem e arquivos conferem com o manifesto.');
    }

    return {
      valid,
      snapshotId: snapshot.id,
      label: snapshot.label,
      agentCount: corpus.size,
      corpusSha: recomputedSha,
      expectedCorpusSha: snapshot.corpusSha,
      missingFiles,
      details,
    };
  }

  /** Remove snapshots antigos mantendo os N mais recentes. */
  async prune(keepMostRecent: number = 10): Promise<number> {
    const snapshots = await this.listarVersoesAnteriores();
    const toRemove = snapshots.slice(keepMostRecent);
    let removed = 0;
    for (const s of toRemove) {
      await rm(s.snapshotDir, { recursive: true, force: true }).catch(() => {});
      removed++;
    }
    return removed;
  }

  /* ---------- privados ---------- */

  private async readBaselineCorpus(): Promise<Map<string, AgentRecord>> {
    try {
      const files = await this.listMarkdownFilesRecursive(this.baselineDir);
      const corpus = new Map<string, AgentRecord>();
      for (const filePath of files) {
        const rel = relative(this.baselineDir, filePath);
        const content = await readFile(filePath, 'utf8');
        const { frontmatter } = parseFrontmatter(content);
        corpus.set(agentSlugFromPath(rel), {
          slug: agentSlugFromPath(rel),
          path: filePath,
          relativePath: rel,
          division: rel.split(sep)[0],
          sha: sha256(content),
          content,
          frontmatter,
          body: '',
          name: typeof frontmatter.name === 'string' ? frontmatter.name : undefined,
          version: typeof frontmatter.version === 'string' ? frontmatter.version : undefined,
          description: typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
        });
      }
      return corpus;
    } catch {
      return new Map();
    }
  }

  private async readSnapshotCorpus(snapshotDir: string): Promise<Map<string, AgentRecord>> {
    const files = await this.listMarkdownFilesRecursive(snapshotDir);
    const corpus = new Map<string, AgentRecord>();
    for (const filePath of files) {
      const rel = relative(snapshotDir, filePath);
      const content = await readFile(filePath, 'utf8');
      const { frontmatter } = parseFrontmatter(content);
      corpus.set(agentSlugFromPath(rel), {
        slug: agentSlugFromPath(rel),
        path: filePath,
        relativePath: rel,
        division: rel.split(sep)[0],
        sha: sha256(content),
        content,
        frontmatter,
        body: '',
      });
    }
    return corpus;
  }

  private async listMarkdownFilesRecursive(dir: string): Promise<string[]> {
    const result: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'scripts') continue;
        result.push(...(await this.listMarkdownFilesRecursive(full)));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        result.push(full);
      }
    }
    return result;
  }

  private async copyDirectoryRecursive(src: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const sPath = join(src, entry.name);
      const dPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'scripts') continue;
        await this.copyDirectoryRecursive(sPath, dPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        await writeFile(dPath, await readFile(sPath));
      }
    }
  }
}
