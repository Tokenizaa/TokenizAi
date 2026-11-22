/**
 * @nettoscorp/agent-hire/src/corpus-client
 *
 * Leitura de agentes do corpus Agency (Fase 7).
 *
 * Ordem de resolução (fallback chain — sempre devolve algo ou falha com erro
 * descritivo, nunca silenciosamente):
 *   1. Paperclip corpus: agency-agents/src-tauri/resources/corpus-baseline/<divisao>/<slug>.md
 *   2. catalog-sync corpus-baseline: packages/catalog-sync/corpus-baseline (se existir)
 *   3. HTTP remoto via node-fetch (AGENT_HIRE_CORPUS_HTTP_BASE ou options.httpBase)
 *
 * Slug = nome do arquivo sem .md (ex. 'engineering-frontend-developer'). A divisão
 * é o diretório pai no corpus.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';
import type { NettoscorpFrontmatter } from './types';
import {
  parseAgentFrontmatter,
  extractNettoscorpBlock,
  type ParsedAgentFrontmatter,
} from './frontmatter-extension';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PAPERCLIP_CORPUS_DIR = resolve(
  __dirname,
  '../../../agency-agents/src-tauri/resources/corpus-baseline',
);

export const CATALOG_SYNC_CORPUS_DIR = resolve(
  __dirname,
  '../../catalog-sync/corpus-baseline',
);

export interface CorpusIndexEntry {
  slug: string;
  division: string;
  path: string;
  source: 'paperclip' | 'catalog-sync';
}

export interface CorpusGetOptions {
  httpBase?: string;
  corpusDirs?: string[];
}

export interface CorpusGetResult {
  slug: string;
  division: string;
  path: string;
  rawSource: string;
  frontmatter: ParsedAgentFrontmatter;
  source: 'paperclip' | 'catalog-sync' | 'http';
}

/**
 * Índice slug → entrada, construído varrendo os diretórios de divisão do corpus.
 * O scripts/ é ignorado (contém utilitários, não agentes).
 */
async function buildIndex(
  corpusDirs: string[],
): Promise<Map<string, CorpusIndexEntry>> {
  const index = new Map<string, CorpusIndexEntry>();
  for (const root of corpusDirs) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      // diretório inexistente: pula silenciosamente (fallback para o próximo)
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'scripts') continue;
      const divisionDir = join(root, entry.name);
      let files: string[];
      try {
        files = await readdir(divisionDir);
      } catch {
        continue;
      }
      const source: CorpusIndexEntry['source'] =
        root.includes('catalog-sync') ? 'catalog-sync' : 'paperclip';
      for (const file of files) {
        if (!file.toLowerCase().endsWith('.md')) continue;
        const slug = file.replace(/\.md$/i, '');
        // primeira ocorrência vence (Paperclip tem prioridade sobre catalog-sync)
        if (!index.has(slug)) {
          index.set(slug, {
            slug,
            division: entry.name,
            path: join(divisionDir, file),
            source,
          });
        }
      }
    }
  }
  return index;
}

/**
 * Lê um agente do corpus e devolve conteúdo bruto + frontmatter parseado.
 */
export async function corpusGet(
  slug: string,
  options: CorpusGetOptions = {},
): Promise<CorpusGetResult> {
  const corpusDirs = options.corpusDirs ?? [
    DEFAULT_PAPERCLIP_CORPUS_DIR,
    CATALOG_SYNC_CORPUS_DIR,
  ];
  const index = await buildIndex(corpusDirs);
  const entry = index.get(slug);

  if (entry) {
    const raw = await readFile(entry.path, 'utf8');
    const frontmatter = parseAgentFrontmatter(raw);
    return {
      slug,
      division: entry.division,
      path: entry.path,
      rawSource: raw,
      frontmatter,
      source: entry.source,
    };
  }

  // Fallback HTTP remoto (node-fetch) — usado quando o corpus é exposto via API
  const httpBase = options.httpBase ?? process.env.AGENT_HIRE_CORPUS_HTTP_BASE;
  if (httpBase) {
    const url = `${httpBase.replace(/\/$/, '')}/agents/${encodeURIComponent(
      slug,
    )}.md`;
    try {
      const response = await fetch(url);
      if (response.ok && response.body) {
        const raw = await response.text();
        const frontmatter = parseAgentFrontmatter(raw);
        return {
          slug,
          division: '',
          path: url,
          rawSource: raw,
          frontmatter,
          source: 'http',
        };
      }
    } catch {
      // falha na busca HTTP: segue para erro descritivo abaixo
    }
  }

  const samples = [...index.keys()].slice(0, 12).join(', ');
  throw new Error(
    `corpusGet: agente "${slug}" não encontrado no corpus.\n` +
      `  paperclip: ${DEFAULT_PAPERCLIP_CORPUS_DIR}\n` +
      `  catalog-sync: ${CATALOG_SYNC_CORPUS_DIR}\n` +
      `  Exemplos de slugs disponíveis: ${samples}`,
  );
}

/**
 * Extrai somente o bloco nettoscorp (se houver) do frontmatter de um agente.
 */
export function extractAgentNettoscorp(
  parsed: ParsedAgentFrontmatter,
): Partial<NettoscorpFrontmatter> {
  return extractNettoscorpBlock(parsed.rawYaml).nettoscorp;
}
