/**
 * @nettoscorp/catalog-sync — diff-engine.ts (Fase 6)
 *
 * Motor de diff do catálogo Agency Agents.
 * - SHA-256 por agente para detecção de mudanças.
 * - Classificação: novo / atualizado / removido / inalterado.
 * - Relatório de diff legível por humanos e máquinas.
 *
 * Todas as operações de leitura de disco e rede são injetáveis para testes.
 */

import { createHash } from 'node:crypto';
import fetch from 'node-fetch';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { createWriteStream, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { generateUUID, retry, sleep } from '@nettoscorp/shared';

const streamPipeline = promisify(pipeline);

/* -------------------------------------------------------------------------- */
/* Tipos de domínio                                                           */
/* -------------------------------------------------------------------------- */

/** Classificação de um agente após o diff entre corpus local e upstream. */
export type DiffClassification = 'novo' | 'atualizado' | 'removido' | 'inalterado';

/** Registro de um agente do corpus (Markdown com frontmatter YAML). */
export interface AgentRecord {
  slug: string;
  path: string;              // caminho absoluto ao arquivo .md
  relativePath: string;      // caminho relativo à raiz do corpus
  division: string;          // diretório pai (ex. "engineering")
  sha: string;               // SHA-256 do conteúdo completo do arquivo
  content: string;           // conteúdo raw do arquivo
  frontmatter: Record<string, unknown>;
  body: string;
  name?: string;
  version?: string;
  description?: string;
}

/** Entrada individual do diff. */
export interface DiffEntry {
  slug: string;
  classification: DiffClassification;
  before: AgentRecord | null;
  after: AgentRecord | null;
}

/** Resultado do diff entre dois corpora. */
export interface DiffResult {
  releaseSha: string;
  generatedAt: string;
  new: DiffEntry[];
  updated: DiffEntry[];
  removed: DiffEntry[];
  unchanged: DiffEntry[];
  summary: {
    totalLocal: number;
    totalUpstream: number;
    added: number;
    modified: number;
    deleted: number;
    unchanged: number;
  };
}

/** Relatório de diff legível (texto/markdown). */
export interface DiffReport {
  releaseSha: string;
  generatedAt: string;
  summary: string;
  byClassification: Record<DiffClassification, string[]>;
}

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                 */
/* -------------------------------------------------------------------------- */

const CID_PREFIX = 'cat-sync-diff';

export function correlationId(): string {
  return `${CID_PREFIX}-${generateUUID()}`;
}

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export const logger = {
  info: (cid: string, message: string, meta?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'info', ts: new Date().toISOString(), cid, message, ...(meta ? { meta } : {}) })),
  warn: (cid: string, message: string, meta?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'warn', ts: new Date().toISOString(), cid, message, ...(meta ? { meta } : {}) })),
  error: (cid: string, message: string, error?: unknown) =>
    console.error(JSON.stringify({
      level: 'error',
      ts: new Date().toISOString(),
      cid,
      message,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    })),
};

/** Extrai frontmatter YAML delimitado por `---` no início do arquivo. */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!frontmatterMatch) return { frontmatter: {}, body: content };
  const rawYaml = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);
  const frontmatter: Record<string, unknown> = {};
  for (const line of rawYaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    frontmatter[key] = value.length > 0 ? value : '';
  }
  return { frontmatter, body };
}

/** Slug de um agente a partir do caminho relativo dentro de uma divisão. */
export function agentSlugFromPath(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.md$/i, '');
  return withoutExt.split(sep).join('-');
}

/** Valida que um caminho de destino não escape do diretório base. */
export function isPathWithin(baseDir: string, targetPath: string): boolean {
  const base = resolve(baseDir);
  const target = resolve(targetPath);
  return target === base || target.startsWith(base + sep);
}

/* -------------------------------------------------------------------------- */
/* fetchUpstreamTarball                                                       */
/* -------------------------------------------------------------------------- */

export interface FetchTarballOptions {
  outDir: string;
  requestTimeoutMs?: number;
  maxRetries?: number;
  httpFetch?: typeof fetch;
}

/**
 * Baixa o tarball upstream com reententativa com backoff e timeout.
 * Retorna o caminho do arquivo, seu SHA-256 e tamanho.
 */
export async function fetchUpstreamTarball(
  url: string,
  options: FetchTarballOptions,
): Promise<{ tarballPath: string; sha: string; size: number }> {
  const { outDir, requestTimeoutMs = 120_000, maxRetries = 3, httpFetch = fetch } = options;
  const cid = correlationId();
  await mkdir(outDir, { recursive: true });
  const tarballPath = join(outDir, `upstream-${Date.now()}.tar.gz`);

  const attempt = async (attemptNr: number): Promise<void> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    logger.info(cid, `fetchUpstreamTarball: tentativa ${attemptNr}`, { url, tarballPath });

    try {
      const response = await httpFetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/gzip, application/octet-stream',
          'User-Agent': 'nettoscorp-catalog-sync/0.1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub respondeu ${response.status} ${response.statusText} ao baixar ${url}`);
      }
      if (!response.body) {
        throw new Error('Sem corpo na resposta do tarball');
      }

      await streamPipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(tarballPath));
    } finally {
      clearTimeout(timeoutId);
    }
  };

  await retry(attempt, maxRetries, 1000).catch((err) => {
    logger.error(cid, 'fetchUpstreamTarball: falha após reententativas', err);
    throw err;
  });

  const content = await readFile(tarballPath);
  return { tarballPath, sha: sha256(content), size: content.length };
}

/* -------------------------------------------------------------------------- */
/* parseCorpusManifest                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Lê todo o corpus de um diretório: mapa slug → AgentRecord com SHA-256
 * por arquivo. Exclui o subdiretório scripts/.
 */
export async function parseCorpusManifest(rootDir: string): Promise<Map<string, AgentRecord>> {
  const corpus = new Map<string, AgentRecord>();
  const files = await listMarkdownFiles(rootDir);

  for (const filePath of files) {
    const rel = relative(rootDir, filePath);
    const division = rel.split(sep)[0];
    const content = await readFile(filePath, 'utf8');
    const sha = sha256(content);
    const { frontmatter, body } = parseFrontmatter(content);
    const slug = agentSlugFromPath(rel);

    const record: AgentRecord = {
      slug,
      path: filePath,
      relativePath: rel,
      division,
      sha,
      content,
      frontmatter,
      body,
      name: typeof frontmatter.name === 'string' ? frontmatter.name : undefined,
      version: typeof frontmatter.version === 'string' ? frontmatter.version : undefined,
      description: typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
    };

    corpus.set(slug, record);
  }

  return corpus;
}

/* -------------------------------------------------------------------------- */
/* classificarAgente                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Classifica um agente com base na presença/igualdade de SHA antes e depois.
 * novo:      só existe depois (não existia antes)
 * atualizado: existe em ambos, mas SHA diferente
 * removido:  só existe antes (não existe mais depois)
 * inalterado: existe em ambos com SHA igual
 */
export function classificarAgente(
  beforeSha: string | null | undefined,
  afterSha: string | null | undefined,
): DiffClassification {
  if (beforeSha == null && afterSha != null) return 'novo';
  if (beforeSha != null && afterSha == null) return 'removido';
  if (beforeSha != null && afterSha != null && beforeSha !== afterSha) return 'atualizado';
  return 'inalterado';
}

/* -------------------------------------------------------------------------- */
/* diffAgents                                                                 */
/* -------------------------------------------------------------------------- */

/** Registro mínimo (apenas slug + sha) usado quando só há SHA disponível. */
function minimalRecord(slug: string, sha: string): AgentRecord {
  return {
    slug,
    path: '',
    relativePath: '',
    division: '',
    sha,
    content: '',
    frontmatter: {},
    body: '',
  };
}

/**
 * Diff puro por SHA: compara dois mapas slug → SHA e classifica cada agente.
 * Não requer leitura de conteúdo; ideal para comparar fingerprints de release.
 */
export function diffAgents(
  localSHA: Map<string, string>,
  upstreamSHA: Map<string, string>,
): DiffResult {
  const cid = correlationId();
  const now = new Date().toISOString();

  const newEntries: DiffEntry[] = [];
  const updatedEntries: DiffEntry[] = [];
  const removedEntries: DiffEntry[] = [];
  const unchangedEntries: DiffEntry[] = [];

  // Removidos: presentes no local, ausentes no upstream
  for (const [slug, beforeSha] of localSHA) {
    if (!upstreamSHA.has(slug)) {
      removedEntries.push({
        slug,
        classification: classificarAgente(beforeSha, null),
        before: minimalRecord(slug, beforeSha),
        after: null,
      });
    }
  }

  // Novos / atualizados / inalterados
  for (const [slug, afterSha] of upstreamSHA) {
    const beforeSha = localSHA.get(slug);
    const classification = classificarAgente(beforeSha ?? null, afterSha);
    const entry: DiffEntry = {
      slug,
      classification,
      before: beforeSha == null ? null : minimalRecord(slug, beforeSha),
      after: minimalRecord(slug, afterSha),
    };
    switch (classification) {
      case 'novo':
        newEntries.push(entry);
        break;
      case 'atualizado':
        updatedEntries.push(entry);
        break;
      case 'inalterado':
        unchangedEntries.push(entry);
        break;
      // removido já tratado acima
    }
  }

  const sortBySlug = (arr: DiffEntry[]) => arr.sort((x, y) => x.slug.localeCompare(y.slug));
  sortBySlug(newEntries);
  sortBySlug(updatedEntries);
  removedEntries.sort((x, y) => x.slug.localeCompare(y.slug));
  unchangedEntries.sort((x, y) => x.slug.localeCompare(y.slug));

  const upstreamFingerprint = [...upstreamSHA.entries()]
    .map(([slug, sha]) => `${slug}:${sha}`)
    .sort()
    .join('|');

  const result: DiffResult = {
    releaseSha: sha256(upstreamFingerprint),
    generatedAt: now,
    new: newEntries,
    updated: updatedEntries,
    removed: removedEntries,
    unchanged: unchangedEntries,
    summary: {
      totalLocal: localSHA.size,
      totalUpstream: upstreamSHA.size,
      added: newEntries.length,
      modified: updatedEntries.length,
      deleted: removedEntries.length,
      unchanged: unchangedEntries.length,
    },
  };

  logger.info(cid, 'Diff por SHA calculado', { releaseSha: result.releaseSha, ...result.summary });
  return result;
}

/* -------------------------------------------------------------------------- */
/* gerarDiffReport                                                            */
/* -------------------------------------------------------------------------- */

/** Gera um relatório de texto de um DiffResult. */
export function gerarDiffReport(diff: DiffResult): DiffReport {
  const line = (classification: DiffClassification, entries: DiffEntry[]): string[] => {
    const out: string[] = [`\n[${classification.toUpperCase()}] (${entries.length})`];
    for (const entry of entries) {
      if (entry.classification === 'atualizado') {
        out.push(
          `  - ${entry.slug} (SHA mudou: ${entry.before?.sha.slice(0, 8)} → ${entry.after?.sha.slice(0, 8)})`,
        );
      } else {
        out.push(`  - ${entry.slug} (SHA: ${(entry.after ?? entry.before)?.sha.slice(0, 8)})`);
      }
    }
    return out;
  };

  const parts: string[] = [
    'Diff Report — catálogo Agency Agents',
    `releaseSha: ${diff.releaseSha}`,
    `gerado em: ${diff.generatedAt}`,
    '',
    'Resumo:',
    `  total local:  ${diff.summary.totalLocal}`,
    `  total upstream: ${diff.summary.totalUpstream}`,
    `  novos:            ${diff.summary.added}`,
    `  atualizados:      ${diff.summary.modified}`,
    `  removidos:        ${diff.summary.deleted}`,
    `  inalterados:      ${diff.summary.unchanged}`,
  ];

  parts.push(...line('novo', diff.new));
  parts.push(...line('atualizado', diff.updated));
  parts.push(...line('removido', diff.removed));
  parts.push(...line('inalterado', diff.unchanged));

  return {
    releaseSha: diff.releaseSha,
    generatedAt: diff.generatedAt,
    summary: parts.join('\n'),
    byClassification: {
      novo: diff.new.map((e) => e.slug),
      atualizado: diff.updated.map((e) => e.slug),
      removido: diff.removed.map((e) => e.slug),
      inalterado: diff.unchanged.map((e) => e.slug),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* DiffEngine                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * DiffEngine — compara dois mapas de agentes (antes/depois) e classifica cada
 * slug. A instância aceita registros completos (com conteúdo) e é usada pelo
 * SyncJob para aplicar as mudanças no corpus-baseline.
 */
export class DiffEngine {
  private static shaMap(corpus: Map<string, AgentRecord>): Map<string, string> {
    const m = new Map<string, string>();
    for (const [slug, rec] of corpus) m.set(slug, rec.sha);
    return m;
  }

  /**
   * Compara dois corpora completos. Usa diffAgents por SHA e enriquece as
   * entradas com os registros completos (conteúdo/frontmatter) para aplicação.
   */
  compare(before: Map<string, AgentRecord>, after: Map<string, AgentRecord>): DiffResult {
    const cid = correlationId();
    const base = diffAgents(DiffEngine.shaMap(before), DiffEngine.shaMap(after));

    const enrich = (entry: DiffEntry): DiffEntry => ({
      ...entry,
      before: entry.before ?? before.get(entry.slug) ?? null,
      after: entry.after ?? after.get(entry.slug) ?? null,
    });

    const result: DiffResult = {
      ...base,
      new: base.new.map(enrich),
      updated: base.updated.map(enrich),
      removed: base.removed.map(enrich),
      unchanged: base.unchanged.map(enrich),
    };

    logger.info(cid, 'Diff de corpus (registros completos) calculado', {
      releaseSha: result.releaseSha,
      ...result.summary,
    });
    return result;
  }

  /** Lista recursivamente todos os .md de um diretório (exclui scripts/). */
  async listMarkdownFiles(dir: string): Promise<string[]> {
    return listMarkdownFiles(dir);
  }
}

/** Lista recursivamente todos os .md de um diretório (exclui scripts/). */
export async function listMarkdownFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'scripts') continue;
      result.push(...(await listMarkdownFiles(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      result.push(full);
    }
  }
  return result;
}
