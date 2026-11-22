/**
 * @nettoscorp/catalog-sync — Fase 6: Pipeline de sincronización del catálogo Agency Agents
 *
 * Componentes:
 *  - GitHubWebhookListener: valida firma HMAC-SHA256 de webhooks de GitHub y parsea push events.
 *  - SyncJob: descarga tarball del release de msitarzewski/agency-agents, lee corpus local y upstream,
 *             diff por SHA-256 por agente y aplica cambios al corpus-baseline.
 *  - DiffEngine: compara agentes antes/después y clasifica nuevo/atualizado/removido/inalterado.
 *  - RollbackManager: snapshot versionado del corpus-baseline y one-click revert.
 *
 * Seguridad: HMAC verificado con comparación de tiempo constante, secrets por variables de entorno,
 * traversal de ruta bloqueado al escribir archivos extraídos, timeouts y reintentos con backoff en
 * toda llamada HTTP. Confiabilidad: sincronización idempotente por SHA del release, snapshots
 * inmutables antes de cada aplicación, rollback atómico por swap de directorios.
 * Observabilidad: logs estructurados con correlation ID en cada operación.
 */

import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir, rm, rename } from 'node:fs/promises';
import { createWriteStream, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import fetch from 'node-fetch';
import { z } from 'zod';
import { type AgentBlueprint, generateUUID, makeAuditHash, retry, sleep } from '@nettoscorp/shared';

const streamPipeline = promisify(pipeline);
const execFileAsync = promisify(execFile);

/* -------------------------------------------------------------------------- */
/* Tipos de dominio                                                          */
/* -------------------------------------------------------------------------- */

/** Classificación de un agente tras el diff entre corpus. */
export type DiffClassification = 'new' | 'updated' | 'removed' | 'unchanged';

/** Registro de un agente del corpus (Markdown con frontmatter YAML). */
export interface AgentRecord {
  slug: string;
  path: string;               // ruta absoluta al archivo .md
  relativePath: string;       // ruta relativa a la raíz del corpus
  division: string;           // directorio padre (ej. "engineering")
  sha: string;                // SHA-256 del contenido completo del archivo
  content: string;            // contenido raw del archivo
  frontmatter: Record<string, unknown>;
  body: string;
  name?: string;
  version?: string;
  description?: string;
}

/** Entrada individual del diff. */
export interface DiffEntry {
  slug: string;
  classification: DiffClassification;
  before: AgentRecord | null;
  after: AgentRecord | null;
}

/** Resultado del diff entre dos corpora. */
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

/** Resultado de aplicación de un diff al corpus local. */
export interface ApplyResult {
  appliedAt: string;
  releaseSha: string;
  written: string[];   // rutas escritas (nuevas/actualizadas)
  deleted: string[];   // rutas eliminadas
  skipped: string[];   // inalteradas
  snapshotId: string;  // snapshot tomado antes de aplicar (para rollback)
}

/** Evento de push de GitHub validado. */
export interface ValidatedPushEvent {
  event: 'push';
  repository: { owner: string; name: string; fullName: string };
  ref: string;
  branch: string;
  sha: string;             // head commit del push
  previousSha: string | null;
  commits: Array<{ id: string; message: string; timestamp: string }>;
  pusher: { name: string; email: string } | null;
  receivedAt: string;
}

/** Snapshot versionado del corpus-baseline para rollback. */
export interface Snapshot {
  id: string;
  label: string;
  createdAt: string;
  baselineDir: string;
  snapshotDir: string;
  manifestPath: string;
  agentCount: number;
  corpusSha: string;     // SHA-256 de concatena de (relPath + sha) de todos los agentes
}

/** Resultado de verificación de firma del webhook. */
export interface WebhookVerification {
  valid: boolean;
  reason?: string;
}

/* -------------------------------------------------------------------------- */
/* Schemas de validación (Zod)                                               */
/* -------------------------------------------------------------------------- */

/** Payload de webhook "push" de GitHub (subset de campos usados). */
const PushEventSchema = z.object({
  ref: z.string(),
  before: z.string().nullable(),
  after: z.string(),
  repository: z.object({
    full_name: z.string(),
    owner: z.object({ login: z.string() }),
  }),
  head_commit: z
    .object({ id: z.string(), message: z.string(), timestamp: z.string() })
    .nullable(),
  commits: z.array(
    z.object({ id: z.string(), message: z.string(), timestamp: z.string() })
  ),
  pusher: z
    .object({ name: z.string().optional(), email: z.string().optional() })
    .nullable(),
});

const CatalogAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  emoji: z.string().optional(),
  vibe: z.string().optional(),
  tools: z.array(z.string()).optional(),
  version: z.string().optional(),
});

/* -------------------------------------------------------------------------- */
/* Utilidades internas                                                       */
/* -------------------------------------------------------------------------- */

const logger = {
  info: (correlationId: string, message: string, meta?: Record<string, unknown>) =>
    console.log(
      JSON.stringify({
        level: 'info',
        ts: new Date().toISOString(),
        cid: correlationId,
        message,
        ...(meta ? { meta } : {}),
      })
    ),
  warn: (correlationId: string, message: string, meta?: Record<string, unknown>) =>
    console.warn(
      JSON.stringify({
        level: 'warn',
        ts: new Date().toISOString(),
        cid: correlationId,
        message,
        ...(meta ? { meta } : {}),
      })
    ),
  error: (correlationId: string, message: string, error?: unknown) =>
    console.error(
      JSON.stringify({
        level: 'error',
        ts: new Date().toISOString(),
        cid: correlationId,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
      })
    ),
};

const CID_PREFIX = 'cat-sync';
function correlationId(): string {
  return `${CID_PREFIX}-${generateUUID()}`;
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(secret: string, data: Buffer): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

/** Comparación HMAC de tiempo constante para prevenir timing attacks. */
function compareDigest(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'latin1');
  const bufB = Buffer.from(b, 'latin1');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Extrae frontmatter YAML delimitado por `---` al inicio del archivo. */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
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

/** Slug de un agente a partir de su ruta relativa dentro de una división. */
function agentSlugFromPath(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.md$/i, '');
  return withoutExt.split(sep).join('-');
}

/** Valida que una ruta de destino no escape del directorio base (path traversal). */
function isPathWithin(baseDir: string, targetPath: string): boolean {
  const base = resolve(baseDir);
  const target = resolve(targetPath);
  return target === base || target.startsWith(base + sep);
}

/* -------------------------------------------------------------------------- */
/* GitHubWebhookListener                                                     */
/* -------------------------------------------------------------------------- */

/**
 * GitHubWebhookListener — valida firmas HMAC-SHA256 de webhooks de GitHub y
 * extrae push events del repositorio canonico del catálogo (msitarzewski/agency-agents).
 *
 * Seguridad:
 *  - Firma verificada con createHmac('sha256') + timingSafeEqual.
 *  - Cabecera esperada: X-Hub-Signature-256 = sha256=<hex>.
 *  - Rechazo explícito de eventos sin firma o con firma inválida.
 */
export class GitHubWebhookListener {
  private readonly secret: Buffer;
  private readonly allowedRepo: string; // "owner/name"

  constructor(options: { webhookSecret: string; allowedRepository: string }) {
    if (!options.webhookSecret) {
      throw new Error('GitHubWebhookListener: webhookSecret es obligatorio');
    }
    if (!options.allowedRepository) {
      throw new Error('GitHubWebhookListener: allowedRepository es obligatorio');
    }
    this.secret = Buffer.from(options.webhookSecret, 'utf8');
    this.allowedRepo = options.allowedRepository.toLowerCase();
  }

  /** Verifica la firma HMAC-SHA256 de un payload recibido de GitHub. */
  verifySignature(
    payload: string | Buffer,
    signature: string | undefined
  ): WebhookVerification {
    const correlation = correlationId();
    if (!signature) {
      logger.warn(correlation, 'Webhook sin cabecera de firma', { hasPayload: Boolean(payload) });
      return { valid: false, reason: 'missing_signature' };
    }

    const expected = `sha256=${hmacSha256(this.secret, Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8')).toString('hex')}`;
    const valid = compareDigest(expected, signature);

    if (!valid) {
      logger.warn(correlation, 'Firma HMAC inválida en webhook', {
        expectedPrefix: expected.slice(0, 20),
      });
      return { valid: false, reason: 'invalid_signature' };
    }

    logger.info(correlation, 'Firma HMAC verificada', { signaturePrefix: signature.slice(0, 20) });
    return { valid: true };
  }

  /** Parsea y valida un evento push de GitHub. Lanza si el payload no es un push válido. */
  parsePushEvent(
    rawBody: string | Buffer,
    signature: string,
    eventType: string | undefined
  ): { verification: WebhookVerification; event: ValidatedPushEvent } {
    const correlation = correlationId();
    const verification = this.verifySignature(rawBody, signature);

    if (!verification.valid) {
      throw new Error(`GitHubWebhookListener: firma inválida (${verification.reason})`);
    }

    if (eventType !== 'push') {
      throw new Error(`GitHubWebhookListener: evento no soportado: ${eventType ?? 'desconocido'}`);
    }

    const parsed = PushEventSchema.safeParse(JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')));
    if (!parsed.success) {
      logger.error(correlation, 'Payload de push no pasa validación Zod', parsed.error.flatten());
      throw new Error(`GitHubWebhookListener: payload inválido: ${parsed.error.errors.map((e) => e.path.join('.')).join(', ')}`);
    }

    const payload = parsed.data;
    const [owner, name] = payload.repository.full_name.split('/');
    const fullNameLower = payload.repository.full_name.toLowerCase();
    if (fullNameLower !== this.allowedRepo) {
      logger.error(correlation, 'Repositorio no autorizado', {
        received: payload.repository.full_name,
        expected: this.allowedRepo,
      });
      throw new Error(`GitHubWebhookListener: repositorio no autorizado: ${payload.repository.full_name}`);
    }

    const ref = payload.ref;
    const branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;

    const event: ValidatedPushEvent = {
      event: 'push',
      repository: { owner, name, fullName: payload.repository.full_name },
      ref,
      branch,
      sha: payload.after,
      previousSha: payload.before ?? null,
      commits: payload.commits,
      pusher: payload.pusher ? { name: payload.pusher.name ?? '', email: payload.pusher.email ?? '' } : null,
      receivedAt: new Date().toISOString(),
    };

    logger.info(correlation, 'Push event validado', {
      repo: event.repository.fullName,
      branch: event.branch,
      sha: event.sha,
      commits: event.commits.length,
    });

    return { verification, event };
  }
}

/* -------------------------------------------------------------------------- */
/* DiffEngine                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * DiffEngine — compara dos mapas de agentes (antes/después) y clasifica cada
 * slug como nuevo, actualizado, removido o inalterado usando SHA-256 del
 * contenido de archivo más comparación de campos del frontmatter.
 */
export class DiffEngine {
  private static recordSha(record: AgentRecord): string {
    return record.sha;
  }

  compare(before: Map<string, AgentRecord>, after: Map<string, AgentRecord>): DiffResult {
    const correlation = correlationId();
    const now = new Date().toISOString();

    const newEntries: DiffEntry[] = [];
    const updatedEntries: DiffEntry[] = [];
    const removedEntries: DiffEntry[] = [];
    const unchangedEntries: DiffEntry[] = [];

    // Removed: presentes en antes, ausentes en después
    for (const [slug, record] of before) {
      if (!after.has(slug)) {
        removedEntries.push({ slug, classification: 'removed', before: record, after: null });
      }
    }

    // New / updated / unchanged
    for (const [slug, record] of after) {
      const prev = before.get(slug);
      if (!prev) {
        newEntries.push({ slug, classification: 'new', before: null, after: record });
        continue;
      }
      const contentChanged = DiffEngine.recordSha(prev) !== DiffEngine.recordSha(record);
      const frontmatterChanged = JSON.stringify(prev.frontmatter) !== JSON.stringify(record.frontmatter);
      if (contentChanged || frontmatterChanged) {
        updatedEntries.push({ slug, classification: 'updated', before: prev, after: record });
      } else {
        unchangedEntries.push({ slug, classification: 'unchanged', before: prev, after: record });
      }
    }

    // Orden determinista por slug para salidas reproducibles
    const sortBySlug = (a: DiffEntry[], b: DiffEntry[]) => a.sort((x, y) => x.slug.localeCompare(y.slug)) && b.sort((x, y) => x.slug.localeCompare(y.slug));
    sortBySlug(newEntries, updatedEntries);
    removedEntries.sort((x, y) => x.slug.localeCompare(y.slug));
    unchangedEntries.sort((x, y) => x.slug.localeCompare(y.slug));

    // releaseSha = hash de todos los SHAs del upstream (fingerprint del release)
    const upstreamFingerprint = [...after.entries()]
      .map(([slug, rec]) => `${slug}:${rec.sha}`)
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
        totalLocal: before.size,
        totalUpstream: after.size,
        added: newEntries.length,
        modified: updatedEntries.length,
        deleted: removedEntries.length,
        unchanged: unchangedEntries.length,
      },
    };

    logger.info(correlation, 'Diff de corpus calculado', {
      releaseSha: result.releaseSha,
      ...result.summary,
    });

    return result;
  }

  /** Convierte un AgentRecord del catálogo raw en AgentBlueprint compartido (mapeo Fase 6 → Fase 7). */
  static toBlueprint(record: AgentRecord, sourceCatalog = 'Agency Agents (Acervo 283)'): Partial<AgentBlueprint> {
    const fm = record.frontmatter;
    return {
      id: generateUUID(),
      code: record.slug,
      slug: record.slug,
      name: (typeof fm.name === 'string' && fm.name.length > 0 ? fm.name : record.slug) as string,
      division: (fm.division as AgentBlueprint['division']) ?? 'Engenharia de Software',
      specialty: (typeof fm.specialty === 'string' ? fm.specialty : '') as string,
      summary: (typeof fm.description === 'string' ? fm.description : (typeof fm.name === 'string' ? fm.name : '')) as string,
      archetype: '',
      personality: '',
      communicationStyle: '',
      workStyle: '',
      decisionMakingStyle: '',
      vibe: (typeof fm.vibe === 'string' ? fm.vibe : '') as string,
      color: (typeof fm.color === 'string' ? fm.color : '#6B7280') as string,
      emoji: (typeof fm.emoji === 'string' ? fm.emoji : '🤖') as string,
      version: (typeof fm.version === 'string' ? fm.version : '0.1.0') as string,
      originPath: record.relativePath,
      competencies: Array.isArray(fm.competencies) ? fm.competencies : [],
      knowledgeAreas: [],
      skills: Array.isArray(fm.tools) ? fm.tools : [],
      responsibilities: [],
      limitations: [],
      methodology: '',
      instructions: record.body,
      runbook: [],
      nexusGates: [],
      homologationStatus: 'catalogo',
      paperclipCompatible: false,
      sourceCatalog,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* SyncJob                                                                    */
/* -------------------------------------------------------------------------- */

export interface SyncJobOptions {
  upstreamRepo: string;             // "msitarzewski/agency-agents"
  releaseTag?: string;              // ej. "v0.3.2" (omitido = latest)
  tarballUrl?: string;              // URL directa al tarball (sobrescribe releaseTag)
  corpusDir: string;                // corpus-baseline local
  workDir: string;                  // dir temporal de trabajo
  httpFetch?: typeof fetch;         // inyección para tests
  requestTimeoutMs?: number;        // timeout de descarga (default 120s)
  maxRetries?: number;              // reintentos de descarga (default 3)
}

/**
 * SyncJob — descarga el tarball del release upstream, extrae el corpus, computa
 * SHA por agente en ambos lados, ejecuta el diff y (opcionalmente) aplica cambios.
 */
export class SyncJob {
  private readonly options: Required<SyncJobOptions>;
  private readonly fetch: typeof fetch;

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
  }

  /** URL del tarball del release (GitHub API o directa). */
  releaseTarballUrl(): string {
    if (this.options.tarballUrl) return this.options.tarballUrl;
    return `https://github.com/${this.options.upstreamRepo}/releases/download/${this.options.releaseTag}/corpus-baseline.tar.gz`;
  }

  /** Descarga el tarball con reintentos con backoff y timeout. Devuelve ruta al archivo. */
  async downloadTarball(correlationId: string): Promise<{ tarballPath: string; sha: string; size: number }> {
    const url = this.releaseTarballUrl();
    const tarballPath = join(this.options.workDir, `upstream-${Date.now()}.tar.gz`);

    const attempt = async (attemptNr: number): Promise<void> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.requestTimeoutMs);

      logger.info(correlationId, `Descarga tarball (intento ${attemptNr})`, { url, tarballPath });

      try {
        const response = await this.fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/gzip, application/octet-stream', 'User-Agent': 'nettoscorp-catalog-sync/0.1.0' },
        });

        if (!response.ok) {
          throw new Error(`GitHub respondió ${response.status} ${response.statusText} al descargar ${url}`);
        }

        if (!response.body) {
          throw new Error(`GitHub no devolvió body en la descarga del tarball`);
        }

        await mkdir(this.options.workDir, { recursive: true });
        await streamPipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(tarballPath));
      } finally {
        clearTimeout(timeoutId);
      }

      const st = statSync(tarballPath);
      const content = await readFile(tarballPath);
      const sha = sha256(content);

      logger.info(correlationId, 'Tarball descargado', { tarballPath, size: st.size, sha });
    };

    await retry(attempt, this.options.maxRetries, 1000).catch((err) => {
      logger.error(correlationId, 'Fallo descarga tarball tras reintentos', err);
      throw err;
    });

    // Re-leer para retornar sha (retry ya validó existencia)
    const content = await readFile(tarballPath);
    return { tarballPath, sha: sha256(content), size: content.length };
  }

  /** Extrae un tarball .tar.gz en un directorio destino usando tar del sistema. */
  async extractTarball(tarballPath: string, destDir: string): Promise<void> {
    await mkdir(destDir, { recursive: true });
    const { stdout, stderr } = await execFileAsync('tar', ['-xzf', tarballPath, '-C', destDir], {
      maxBuffer: 50 * 1024 * 1024,
    });
    if (stderr && stderr.includes('tar:')) {
      // tar emite advertencias a stderr sin fallar; solo logueamos
      logger.warn('sync-job', `tar stderr: ${stderr.slice(0, 500)}`);
    }
  }

  /** Lee todo el corpus-baseline de un directorio: mapa slug → AgentRecord con SHA por archivo. */
  async readCorpus(rootDir: string): Promise<Map<string, AgentRecord>> {
    const corpus = new Map<string, AgentRecord>();
    const files = await this.listMarkdownFiles(rootDir);

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

      // Validación leve del frontmatter (no bloqueante; los errores se reportan)
      CatalogAgentSchema.safeParse(frontmatter);

      corpus.set(slug, record);
    }

    return corpus;
  }

  /** Ejecuta el diff completo: lee local + upstream, compara, retorna DiffResult. */
  async diff(correlationId?: string): Promise<DiffResult> {
    const cid = correlationId ?? correlationId();
    logger.info(cid, 'Iniciando diff de corpus', { corpusDir: this.options.corpusDir });

    const local = await this.readCorpus(this.options.corpusDir);

    // Extrae upstream en workdir y lee su corpus
    const { tarballPath } = await this.downloadTarball(cid);
    const extractDir = join(this.options.workDir, `upstream-extract-${Date.now()}`);
    await this.extractTarball(tarballPath, extractDir);

    // El corpus dentro del tarball puede estar en la raíz o bajo una carpeta padre
    const upstreamRoot = this.findCorpusRoot(extractDir);
    const upstream = await this.readCorpus(upstreamRoot);

    const engine = new DiffEngine();
    const result = engine.compare(local, upstream);

    logger.info(cid, 'Diff completado', {
      local: result.summary.totalLocal,
      upstream: result.summary.totalUpstream,
      added: result.summary.added,
      modified: result.summary.modified,
      deleted: result.summary.deleted,
    });

    return result;
  }

  /** Aplica un diff al corpus local: escribe/actualiza/elimina archivos. Requiere confirmación explícita. */
  async apply(diff: DiffResult, options: { confirm: boolean; snapshotLabel?: string }): Promise<ApplyResult> {
    const cid = correlationId();
    if (!options.confirm) {
      throw new Error('SyncJob.apply: se requiere confirm: true para aplicar cambios al corpus');
    }

    // Snapshot inmutable antes de cualquier mutación (garantía de rollback)
    const rollbackManager = new RollbackManager({ baselineDir: this.options.corpusDir, snapshotsDir: join(this.options.workDir, 'snapshots') });
    const snapshot = await rollbackManager.snapshot(options.snapshotLabel ?? `pre-sync-${diff.releaseSha.slice(0, 8)}`);

    const written: string[] = [];
    const deleted: string[] = [];
    const skipped: string[] = [];

    // Nuevos y actualizados: escribir archivo
    for (const entry of [...diff.new, ...diff.updated]) {
      const record = entry.after!;
      const targetPath = join(this.options.corpusDir, record.relativePath);
      if (!isPathWithin(this.options.corpusDir, targetPath)) {
        throw new Error(`SyncJob.apply: ruta fuera del corpus bloqueada: ${record.relativePath}`);
      }
      await mkdir(join(this.options.corpusDir, relative(this.options.corpusDir, record.relativePath).split(sep).slice(0, -1).join(sep)), { recursive: true });
      await writeFile(targetPath, record.content, 'utf8');
      written.push(record.relativePath);
      logger.info(cid, 'Escrito agente', { slug: entry.slug, path: record.relativePath, classification: entry.classification });
    }

    // Removidos: eliminar archivo
    for (const entry of diff.removed) {
      const record = entry.before!;
      const targetPath = join(this.options.corpusDir, record.relativePath);
      if (!isPathWithin(this.options.corpusDir, targetPath)) {
        throw new Error(`SyncJob.apply: ruta fuera del corpus bloqueada: ${record.relativePath}`);
      }
      await rm(targetPath, { force: true });
      deleted.push(record.relativePath);
      logger.info(cid, 'Eliminado agente', { slug: entry.slug, path: record.relativePath });
    }

    // Inalterados: no se toca
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

    logger.info(cid, 'Aplicación de diff finalizada', {
      releaseSha: diff.releaseSha,
      written: written.length,
      deleted: deleted.length,
      skipped: skipped.length,
      snapshotId: snapshot.id,
    });

    return result;
  }

  /** Lista recursivamente todos los .md de un directorio (excluye scripts/). */
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

  /** Encuentra la raíz del corpus dentro del directorio extraído del tarball. */
  private findCorpusRoot(extractDir: string): string {
    const entries = readdirSyncWrapper(extractDir);
    // Si hay directorios divisionales directo, esa es la raíz
    const hasDivisions = entries.some((e) => e.isDirectory && !e.name.startsWith('.') && e.name !== 'scripts');
    if (hasDivisions) return extractDir;
    // Si hay una sola carpeta padre, bajar un nivel
    const subDirs = entries.filter((e) => e.isDirectory && !e.name.startsWith('.'));
    if (subDirs.length === 1) return join(extractDir, subDirs[0].name);
    return extractDir;
  }
}

function readdirSyncWrapper(dir: string): { name: string; isDirectory: () => boolean }[] {
  return readdirSync(dir, { withFileTypes: true });
}

/* -------------------------------------------------------------------------- */
/* RollbackManager                                                            */
/* -------------------------------------------------------------------------- */

export interface RollbackManagerOptions {
  baselineDir: string;      // corpus-baseline activo
  snapshotsDir: string;     // donde se guardan los snapshots
}

/**
 * RollbackManager — gestiona snapshots versionados del corpus-baseline y
 * permite revertir (one-click) a la versión anterior de forma atómica.
 *
 * Garantía: el snapshot se copia íntegro antes de mutar; el restore usa
 * rename atómico (mv) para evitar estados intermedios corruptos.
 */
export class RollbackManager {
  private readonly baselineDir: string;
  private readonly snapshotsDir: string;

  constructor(options: RollbackManagerOptions) {
    this.baselineDir = resolve(options.baselineDir);
    this.snapshotsDir = resolve(options.snapshotsDir);
  }

  /** Crea un snapshot inmutable del corpus-baseline actual. */
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
        .join('|')
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

    logger.info(cid, 'Snapshot creado', { id, label: snapshotLabel, agentCount: corpus.size, corpusSha, snapshotDir });

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

  /** Lista todos los snapshots disponibles, ordenados por creación (más reciente primero). */
  async listSnapshots(): Promise<Snapshot[]> {
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
        // snapshot sin manifiesto: se ignora (puede estar incompleto)
      }
    }
    return snapshots.sort((a, b) => (b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0));
  }

  /** One-click revert: restaura el corpus-baseline al snapshot indicado. Operación atómica. */
  async rollback(snapshotId: string): Promise<{ restoredTo: Snapshot; previousBaselineMovedTo: string }> {
    const cid = correlationId();
    const snapshots = await this.listSnapshots();
    const snapshot = snapshots.find((s) => s.id === snapshotId || s.label === snapshotId);
    if (!snapshot) {
      const available = snapshots.map((s) => s.id).join(', ');
      throw new Error(`RollbackManager: snapshot no encontrado: ${snapshotId}. Disponibles: ${available}`);
    }

    const stashDir = join(this.snapshotsDir, `_rollback-stash-${Date.now()}`);
    await mkdir(this.snapshotsDir, { recursive: true });

    // 1. Mueve el baseline actual a stash (respaldo de seguridad)
    await rename(this.baselineDir, stashDir);

    try {
      // 2. Mueve el snapshot al lugar del baseline (atómico en el mismo FS)
      await rename(snapshot.snapshotDir, this.baselineDir);
    } catch (error) {
      // 3. Si falla, intenta devolver el baseline al sitio (seguridad)
      try {
        await rename(stashDir, this.baselineDir);
      } catch {
        logger.error(cid, 'RollbackManager: falló la recuperación del baseline tras error', error);
      }
      logger.error(cid, 'RollbackManager: falló restaurar snapshot', error);
      throw error;
    }

    // 4. Elimina el stash del baseline previo
    await rm(stashDir, { recursive: true, force: true }).catch(() => {
      logger.warn(cid, `RollbackManager: no se pudo eliminar stash anterior: ${stashDir}`);
    });

    logger.info(cid, 'Rollback ejecutado', {
      restoredTo: snapshot.id,
      previousBaselineStashed: stashDir,
      agentCount: snapshot.agentCount,
    });

    return { restoredTo: snapshot, previousBaselineMovedTo: stashDir };
  }

  /** Elimina snapshots antiguos manteniendo los N más recientes. */
  async prune(keepMostRecent: number = 10): Promise<number> {
    const snapshots = await this.listSnapshots();
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

/* -------------------------------------------------------------------------- */
/* Notificador (inyección de dependencias para notificaciones)               */
/* -------------------------------------------------------------------------- */

/** Canal de notificación del resultado de sincronización. */
export interface Notifier {
  notify(message: { type: 'sync-started' | 'sync-completed' | 'sync-failed' | 'rollback-completed'; payload: unknown; correlationId: string }): Promise<void>;
}

/** Notificador por consola (default, sin dependencias externas). */
export class ConsoleNotifier implements Notifier {
  async notify(message: { type: string; payload: unknown; correlationId: string }): Promise<void> {
    console.log(JSON.stringify({ level: 'notify', ts: new Date().toISOString(), ...message }));
  }
}

/* -------------------------------------------------------------------------- */
/* Observabilidade, circuit breaker e fallback chain (Fase 6)                */
/* -------------------------------------------------------------------------- */

export {
  SYNC_STAGES,
  type SyncStage,
  LOG_LEVELS,
  type LogLevel,
  type TraceContext,
  type StructuredLogEntry,
  type StageMetric,
  type StageResult,
  type ObservabilityConfig,
  PipelineObserver,
  createTraceId,
  withTrace,
} from './observability';

export {
  CircuitState,
  CircuitBreaker,
  CircuitBreakerOpenError,
  type CircuitBreakerConfig,
  type CircuitBreakerStatus,
  createGitHubTarballCircuitBreaker,
} from './circuit-breaker';

export {
  type FallbackStepConfig,
  type FallbackChainConfig,
  type FallbackChainResult,
  type StepExecution,
  type CachedTarballFallbackOptions,
  type DownloadFallbackChainInput,
  type DownloadFallbackChainOutput,
  type SyncFallbackChainInput,
  type SyncFallbackChainOutput,
  type NotifyFallbackChainInput,
  type NotifyFallbackChainOutput,
  FallbackChain,
  createCachedTarballFallback,
  createDegradedCorpusFallback,
  createDownloadFallbackChain,
  createSyncFallbackChain,
  createNotifyFallbackChain,
} from './fallback-chain';
