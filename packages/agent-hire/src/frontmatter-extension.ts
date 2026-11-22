/**
 * @nettoscorp/agent-hire/src/frontmatter-extension
 *
 * Extensão de frontmatter YAML para agentes Agency:
 *
 *   ---
 *   name: Frontend Developer
 *   description: ...
 *   color: cyan
 *   emoji: 🖥️
 *   vibe: ...
 *   nettoscorp:
 *     department: Engenharia de Software
 *     clearance: restrito
 *     authority: operacional
 *     knowledge_domains:
 *       - TypeScript
 *       - React
 *   ---
 *
 * O bloco `nettoscorp` nunca substitui campos de identidade do agente
 * (name/description/color/emoji/vibe); apenas acrescenta governança NettosCorp.
 * Parse e serialização são feitos à mão (sem dependência de YAML) porque o
 * corpus usa YAML simples e delimitado por `---`.
 */

import { z } from 'zod';
import type { AuthorityLevel, ClearanceLevel } from '@nettoscorp/shared';
import type { NettoscorpFrontmatter } from './types';

export const NETTOSCORP_BLOCK_KEY = 'nettoscorp';

const VALID_CLEARANCE: ClearanceLevel[] = [
  'publico',
  'restrito',
  'gerencial',
  'estratégica',
  'confidencial',
];

const VALID_AUTHORITY: AuthorityLevel[] = [
  'executiva_humana',
  'estrategica_delegada',
  'gerencial',
  'operacional',
  'tecnica',
];

export const NettoscorpFrontmatterSchema = z.object({
  department: z.string().min(1, 'department é obrigatório'),
  clearance: z
    .custom<ClearanceLevel>(
      (val): val is ClearanceLevel =>
        typeof val === 'string' && VALID_CLEARANCE.includes(val),
      `clearance deve ser um de: ${VALID_CLEARANCE.join(', ')}`,
    ),
  authority: z
    .custom<AuthorityLevel>(
      (val): val is AuthorityLevel =>
        typeof val === 'string' && VALID_AUTHORITY.includes(val),
      `authority deve ser um de: ${VALID_AUTHORITY.join(', ')}`,
    ),
  knowledge_domains: z
    .array(z.string().min(1))
    .min(1, 'knowledge_domains deve conter pelo menos um domínio'),
});

export interface ParsedAgentFrontmatter {
  name?: string;
  description?: string;
  color?: string;
  emoji?: string;
  vibe?: string;
  rawYaml: string;      // conteúdo entre os delimiters --- (sem os delimiters)
  body: string;         // tudo após o frontmatter
}

const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/;

/**
 * Lê o frontmatter delimitado por `---` de um agente do corpus.
 * Mesmo parser simples usado por packages/catalog-sync (parseFrontmatter),
 * para garantir leitura idêntica entre sync e hire.
 */
export function parseAgentFrontmatter(content: string): ParsedAgentFrontmatter {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { body: content, rawYaml: '' };
  }
  const rawYaml = match[1];
  const body = content.slice(match[0].length);
  const fields: Record<string, string> = {};
  for (const line of rawYaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (key && value.length > 0) {
      fields[key] = value;
    }
  }
  return {
    name: fields.name || undefined,
    description: fields.description || undefined,
    color: fields.color || undefined,
    emoji: fields.emoji || undefined,
    vibe: fields.vibe || undefined,
    rawYaml,
    body,
  };
}

/**
 * Extrai o bloco `nettoscorp:` de um frontmatter YAML bruto.
 * Lê linhas indentadas sob a chave `nettoscorp:`; `knowledge_domains` aceita
 * lista YAML (`- item`) ou string separada por vírgula/ponto-e-vírgula.
 */
export function extractNettoscorpBlock(
  rawYaml: string,
): { nettoscorp: Partial<NettoscorpFrontmatter>; restYaml: string } {
  const lines = rawYaml.split(/\r?\n/);
  const rest: string[] = [];
  let blockLines: string[] | null = null;
  let inBlock = false;
  let baseIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock && /^nettoscorp\s*:(\s*|$)/.test(line)) {
      inBlock = true;
      baseIndent = line.search(/\S|$/);
      blockLines = [];
      continue;
    }
    if (inBlock) {
      const trimmed = line.trim();
      if (trimmed === '' || line.search(/\S|$/) > baseIndent) {
        blockLines.push(line);
        continue;
      }
      inBlock = false;
      baseIndent = -1;
      // re-processa esta linha no bloco de resto
    }
    rest.push(line);
  }

  return {
    nettoscorp: blockLines ? parseNettoscorpBlockLines(blockLines) : {},
    restYaml: rest.join('\n'),
  };
}

/**
 * Parse das linhas do bloco nettoscorp.
 */
function parseNettoscorpBlockLines(lines: string[]): Partial<NettoscorpFrontmatter> {
  const out: Partial<NettoscorpFrontmatter> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    const colon = trimmed.indexOf(':');
    if (colon === -1) {
      i++;
      continue;
    }
    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();

    if (key === 'knowledge_domains') {
      if (value) {
        out.knowledge_domains = value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      } else {
        const items: string[] = [];
        i++;
        while (i < lines.length) {
          const itemLine = lines[i].trim();
          if (!itemLine) {
            i++;
            continue;
          }
          if (itemLine.startsWith('-')) {
            items.push(itemLine.slice(1).trim());
          } else {
            break;
          }
          i++;
        }
        if (items.length > 0) out.knowledge_domains = items;
        continue;
      }
    } else if (key === 'department') {
      out.department = value;
    } else if (key === 'clearance') {
      out.clearance = value as ClearanceLevel;
    } else if (key === 'authority') {
      out.authority = value as AuthorityLevel;
    }
    i++;
  }
  return out;
}

/**
 * Mescla camadas de frontmatter nettoscorp com precedência:
 * defaults (mapeamento de divisão) < arquivo do corpus < opções de contratação.
 * Valores undefined/null nunca sobrescrevem.
 */
export function mergeNettoscorpFrontmatter(
  ...layers: Partial<NettoscorpFrontmatter>[]
): Partial<NettoscorpFrontmatter> {
  const out: Partial<NettoscorpFrontmatter> = {};
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.department) out.department = layer.department;
    if (layer.clearance) out.clearance = layer.clearance;
    if (layer.authority) out.authority = layer.authority;
    if (layer.knowledge_domains?.length) {
      out.knowledge_domains = [...new Set([...(out.knowledge_domains ?? []), ...layer.knowledge_domains])];
    }
  }
  return out;
}

/**
 * Serializa um objeto NettoscorpFrontmatter de volta para bloco YAML.
 */
export function serializeNettoscorpFrontmatter(f: NettoscorpFrontmatter): string {
  const domains = f.knowledge_domains.map((d) => `    - ${d}`).join('\n');
  return `${NETTOSCORP_BLOCK_KEY}:\n  department: ${f.department}\n  clearance: ${f.clearance}\n  authority: ${f.authority}\n  knowledge_domains:\n${domains}\n`;
}

/**
 * Injeta (ou substitui) o bloco `nettoscorp:` no frontmatter de um conteúdo de agente.
 * Útil para gerar arquivos do corpus já enriquecidos com governança NettosCorp.
 */
export function injectNettoscorpFrontmatter(content: string, fields: NettoscorpFrontmatter): string {
  const block = serializeNettoscorpFrontmatter(fields);
  const parsed = parseAgentFrontmatter(content);
  const { rawYaml, body } = parsed;
  const blockYaml = `${NETTOSCORP_BLOCK_KEY}:\n  department: ${fields.department}\n  clearance: ${fields.clearance}\n  authority: ${fields.authority}\n  knowledge_domains:\n${fields.knowledge_domains.map((d) => `    - ${d}`).join('\n')}\n`;
  const newYaml = rawYaml
    ? `${rawYaml.trimEnd()}\n${blockYaml.trimEnd()}`
    : blockYaml.trimEnd();
  return `---\n${newYaml}\n---\n\n${body}`;
}
