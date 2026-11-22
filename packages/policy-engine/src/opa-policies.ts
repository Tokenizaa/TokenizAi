/**
 * @nettoscorp/policy-engine — OPA/Rego policies (Fase 8 — Governance Layer)
 *
 * Fontes Rego válidas (sintaxe OPA) para três domínios de governança:
 *  - agent.hire     — autorização de contratação de agentes da Agency
 *  - data.read      — acesso a dados com isolamento por tenant
 *  - budget.approve — aprovação de orçamentos contra saldo do cost center
 *
 * As fontes Rego são mantidas como strings de auditoria e são avaliadas por
 * `evalRego`, um interpretador do subconjunto Rego utilizado aqui
 * (default, regras com múltiplas definições, comparações, `in`, `not`,
 * referências aninhadas a `input` e objetos de constante). Cada política
 * expõe uma regra `*_allowed` (booleana) e uma regra `*_deny_reason`
 * (string do motivo da negação).
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Entrada OPA                                                        */
/* ------------------------------------------------------------------ */

export const OpaInputSchema = z.object({
  action: z.string(),
  actor: z.object({
    user_id: z.string(),
    tenant_id: z.string(),
    role: z.string(),
    clearance_level: z.string(),
    authority_level: z.string(),
    department_ids: z.array(z.string()).optional(),
    project_ids: z.array(z.string()).optional(),
  }),
  resource: z
    .object({
      tenant_id: z.string().optional(),
      owner_id: z.string().optional(),
      department_id: z.string().optional(),
      cost_center_id: z.string().optional(),
    })
    .optional(),
  context: z
    .object({
      amount: z.number().optional(),
      cost_center: z
        .object({
          remaining: z.number(),
          allocated: z.number(),
          spent: z.number(),
        })
        .optional(),
      budget_threshold: z.number().optional(),
      requires_budget_approval: z.boolean().optional(),
      approved: z.boolean().optional(),
      blocked: z.boolean().optional(),
    })
    .optional(),
});

export type OpaInput = z.infer<typeof OpaInputSchema>;

export interface EvalResult {
  result: boolean;
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Políticas Rego                                                     */
/* ------------------------------------------------------------------ */

export const AGENT_HIRE_POLICY = `
package nettoscorp.policy.governance

default agent_hire_allowed := false
default agent_hire_deny_reason := "not_applicable"

clearance_order := {
  "publico": 0,
  "restrito": 1,
  "gerencial": 2,
  "estratégica": 3,
  "confidencial": 4,
}

authority_order := {
  "tecnica": 0,
  "operacional": 1,
  "gerencial": 2,
  "estrategica_delegada": 3,
  "executiva_humana": 4,
}

hire_authorized_roles := ["direcao_executiva", "gestor", "rh"]

# Contratação de agente: permitido quando o ator tem papel de contratação,
# clearance >= gerencial, autoridade >= gerencial e, se houver orçamento
# vinculado, já existe aprovação de orçamento.
agent_hire_allowed {
  input.action == "agent.hire"
  input.actor.role in hire_authorized_roles
  clearance_order[input.actor.clearance_level] >= clearance_order["gerencial"]
  authority_order[input.actor.authority_level] >= authority_order["gerencial"]
  not input.context.requires_budget_approval == true
}

agent_hire_allowed {
  input.action == "agent.hire"
  input.actor.role in hire_authorized_roles
  clearance_order[input.actor.clearance_level] >= clearance_order["gerencial"]
  authority_order[input.actor.authority_level] >= authority_order["gerencial"]
  input.context.requires_budget_approval == true
  input.context.approved == true
}

agent_hire_deny_reason := "role_not_authorized_for_hire" {
  input.action == "agent.hire"
  not input.actor.role in hire_authorized_roles
}

agent_hire_deny_reason := "clearance_insufficient_for_hire" {
  input.action == "agent.hire"
  input.actor.role in hire_authorized_roles
  clearance_order[input.actor.clearance_level] < clearance_order["gerencial"]
}

agent_hire_deny_reason := "authority_insufficient_for_hire" {
  input.action == "agent.hire"
  input.actor.role in hire_authorized_roles
  clearance_order[input.actor.clearance_level] >= clearance_order["gerencial"]
  authority_order[input.actor.authority_level] < authority_order["gerencial"]
}

agent_hire_deny_reason := "budget_approval_required_for_hire" {
  input.action == "agent.hire"
  input.actor.role in hire_authorized_roles
  input.context.requires_budget_approval == true
  not input.context.approved == true
}
`;

export const TENANT_DATA_POLICY = `
package nettoscorp.policy.governance

default tenant_data_access_allowed := false
default tenant_data_access_deny_reason := "not_applicable"

# Leitura de dados: permitida dentro do próprio tenant com clearance >= restrito,
# ou para auditoria com clearance >= confidencial (mesmo cross-tenant, apenas leitura).
tenant_data_access_allowed {
  input.action == "data.read"
  input.resource.tenant_id == input.actor.tenant_id
  clearance_order[input.actor.clearance_level] >= clearance_order["restrito"]
}

tenant_data_access_allowed {
  input.action == "data.read"
  input.actor.role == "auditoria"
  clearance_order[input.actor.clearance_level] >= clearance_order["confidencial"]
}

tenant_data_access_deny_reason := "cross_tenant_access_denied" {
  input.action == "data.read"
  input.resource.tenant_id != input.actor.tenant_id
  input.actor.role != "auditoria"
}

tenant_data_access_deny_reason := "clearance_insufficient_for_data_access" {
  input.action == "data.read"
  input.resource.tenant_id == input.actor.tenant_id
  clearance_order[input.actor.clearance_level] < clearance_order["restrito"]
}
`;

export const BUDGET_POLICY = `
package nettoscorp.policy.governance

default budget_approved := false
default budget_deny_reason := "not_applicable"

clearance_order := {
  "publico": 0,
  "restrito": 1,
  "gerencial": 2,
  "estratégica": 3,
  "confidencial": 4,
}

budget_authorized_roles := ["direcao_executiva", "gestor", "financeiro"]

# Orçamento aprovado quando o papel está autorizado, clearance >= gerencial,
# valor positivo e dentro do restante do cost center.
budget_approved {
  input.action == "budget.approve"
  input.actor.role in budget_authorized_roles
  clearance_order[input.actor.clearance_level] >= clearance_order["gerencial"]
  input.context.amount > 0
  input.context.amount <= input.context.cost_center.remaining
}

budget_deny_reason := "role_not_authorized_for_budget" {
  input.action == "budget.approve"
  not input.actor.role in budget_authorized_roles
}

budget_deny_reason := "clearance_insufficient_for_budget" {
  input.action == "budget.approve"
  input.actor.role in budget_authorized_roles
  clearance_order[input.actor.clearance_level] < clearance_order["gerencial"]
}

budget_deny_reason := "budget_exceeds_cost_center_remaining" {
  input.action == "budget.approve"
  input.actor.role in budget_authorized_roles
  input.context.amount > input.context.cost_center.remaining
}

budget_deny_reason := "invalid_budget_amount" {
  input.action == "budget.approve"
  not input.context.amount > 0
}
`;

export interface PolicyRegistration {
  action: string;
  source: string;
  allowedRule: string;
  denyRule: string;
  description: string;
  irreversible: boolean;
}

export const POLICY_REGISTRY: ReadonlyArray<PolicyRegistration> = [
  {
    action: 'agent.hire',
    source: AGENT_HIRE_POLICY,
    allowedRule: 'agent_hire_allowed',
    denyRule: 'agent_hire_deny_reason',
    description: 'Autorização de contratação de agentes da Agency',
    irreversible: true,
  },
  {
    action: 'agent.provision',
    source: AGENT_HIRE_POLICY,
    allowedRule: 'agent_hire_allowed',
    denyRule: 'agent_hire_deny_reason',
    description: 'Autorização de provisionamento de agente operacional',
    irreversible: true,
  },
  {
    action: 'data.read',
    source: TENANT_DATA_POLICY,
    allowedRule: 'tenant_data_access_allowed',
    denyRule: 'tenant_data_access_deny_reason',
    description: 'Acesso a dados com isolamento por tenant',
    irreversible: false,
  },
  {
    action: 'budget.approve',
    source: BUDGET_POLICY,
    allowedRule: 'budget_approved',
    denyRule: 'budget_deny_reason',
    description: 'Aprovação de orçamento contra saldo do cost center',
    irreversible: true,
  },
] as const;

/* ------------------------------------------------------------------ */
/* Interpretador do subconjunto Rego utilizado pelas políticas        */
/* ------------------------------------------------------------------ */

type RegoLiteral = string | number | boolean;

interface RegoRefSegment {
  kind: 'field' | 'key';
  name: string;
}

interface RegoPrimary {
  kind: 'literal' | 'ref';
  value?: RegoLiteral;
  root?: string;
  segments?: RegoRefSegment[];
}

interface RegoArray {
  kind: 'array';
  items: RegoValue[];
}

interface RegoObject {
  kind: 'object';
  entries: [string, RegoValue][];
}

type RegoValue = RegoLiteral | RegoArray | RegoObject;

interface RegoTerm {
  kind: 'compare' | 'in' | 'literal';
  not: boolean;
  op?: '==' | '!=' | '>' | '<' | '>=' | '<=';
  left?: RegoPrimary;
  right?: RegoPrimary | RegoArray;
  value?: boolean;
}

interface RegoRuleDefinition {
  value?: RegoLiteral;
  terms: RegoTerm[];
}

interface RegoRule {
  name: string;
  definitions: RegoRuleDefinition[];
}

interface RegoAst {
  defaults: Record<string, RegoLiteral>;
  objects: Record<string, RegoObject>;
  rules: RegoRule[];
}

interface RegoToken {
  type: 'ident' | 'string' | 'number' | 'op' | 'punct' | 'nl' | 'eof';
  value: string;
  line: number;
}

const COMPARISON_OPS = new Set(['==', '!=', '>', '<', '>=', '<=']);
const PUNCT_CHARS = new Set([':', '=', ',', '{', '}', '[', ']', '(', ')']);

function tokenize(source: string): RegoToken[] {
  const tokens: RegoToken[] = [];
  let i = 0;
  let line = 1;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === '#') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '\n') {
      line++;
      i++;
      tokens.push({ type: 'nl', value: '\n', line });
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let s = '';
      let closed = false;
      while (j < n) {
        const c = source[j];
        if (c === '\\') {
          j++;
          s += source[j] ?? '';
          j++;
          continue;
        }
        if (c === '"') {
          closed = true;
          j++;
          break;
        }
        s += c;
        j++;
      }
      if (!closed) throw new SyntaxError(`Rego: string não fechada na linha ${line}`);
      tokens.push({ type: 'string', value: s, line });
      i = j;
      continue;
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let j = i;
      if (ch === '-') j++;
      while (j < n && source[j] >= '0' && source[j] <= '9') j++;
      if (j < n && source[j] === '.') {
        j++;
        while (j < n && source[j] >= '0' && source[j] <= '9') j++;
      }
      tokens.push({ type: 'number', value: source.slice(i, j), line });
      i = j;
      continue;
    }
    if (ch === '=' || ch === '!' || ch === '>' || ch === '<') {
      let j = i + 1;
      if (source[j] === '=') j++;
      tokens.push({ type: 'op', value: source.slice(i, j), line });
      i = j;
      continue;
    }
    if (PUNCT_CHARS.has(ch)) {
      tokens.push({ type: 'punct', value: ch, line });
      i++;
      continue;
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      let j = i;
      while (
        j < n &&
        ((source[j] >= 'a' && source[j] <= 'z') ||
          (source[j] >= 'A' && source[j] <= 'Z') ||
          (source[j] >= '0' && source[j] <= '9') ||
          source[j] === '_' ||
          source[j] === '$')
      ) {
        j++;
      }
      tokens.push({ type: 'ident', value: source.slice(i, j), line });
      i = j;
      continue;
    }
    i++;
  }
  tokens.push({ type: 'eof', value: '', line });
  return tokens;
}

class RegoParser {
  private tokens: RegoToken[];
  private pos = 0;

  constructor(source: string) {
    this.tokens = tokenize(source);
  }

  private peek(): RegoToken {
    return this.tokens[this.pos];
  }

  private next(): RegoToken {
    return this.tokens[this.pos++];
  }

  private expect(type: RegoToken['type'], value?: string): RegoToken {
    const tok = this.next();
    if (tok.type !== type) {
      throw new SyntaxError(
        `Rego: esperado token ${type}${value ? ` "${value}"` : ''} na linha ${tok.line}, recebido "${tok.value}"`,
      );
    }
    if (value !== undefined && tok.value !== value) {
      throw new SyntaxError(
        `Rego: esperado "${value}" na linha ${tok.line}, recebido "${tok.value}"`,
      );
    }
    return tok;
  }

  private skipNewlines(): void {
    while (this.peek().type === 'nl') this.next();
  }

  parse(): RegoAst {
    const ast: RegoAst = { defaults: {}, objects: {}, rules: [] };
    while (this.peek().type !== 'eof') {
      this.skipNewlines();
      if (this.peek().type === 'eof') break;
      const nameTok = this.next();
      if (nameTok.type !== 'ident') {
        throw new SyntaxError(`Rego: esperado identificador na linha ${nameTok.line}`);
      }
      this.skipNewlines();
      const tok = this.peek();
      if (tok.type === 'ident' && tok.value === 'default') {
        this.next();
        this.skipNewlines();
        const defName = this.expect('ident').value;
        this.skipNewlines();
        this.expect('punct', ':');
        this.expect('punct', '=');
        this.skipNewlines();
        ast.defaults[defName] = this.parseLiteral();
        continue;
      }
      if (tok.type === 'punct' && tok.value === ':') {
        this.next();
        this.expect('punct', '=');
        this.skipNewlines();
        const obj = this.parseObject();
        ast.objects[nameTok.value] = obj;
        continue;
      }
      // regra: name { body } [ { body } ] ; valor opcional antes do corpo: name := "x" { body }
      let ruleValue: RegoLiteral | undefined;
      if (tok.type === 'punct' && tok.value === ':') {
        this.next();
        this.expect('punct', '=');
        this.skipNewlines();
        ruleValue = this.parseLiteral();
        this.skipNewlines();
      }
      const definitions: RegoRuleDefinition[] = [];
      while (this.peek().type === 'punct' && this.peek().value === '{') {
        definitions.push({ value: ruleValue, terms: this.parseBody() });
      }
      if (definitions.length === 0) {
        throw new SyntaxError(`Rego: esperado corpo de regra "{}" para "${nameTok.value}" na linha ${nameTok.line}`);
      }
      ast.rules.push({ name: nameTok.value, definitions });
    }
    return ast;
  }

  private parseBody(): RegoTerm[] {
    const terms: RegoTerm[] = [];
    while (true) {
      this.skipNewlines();
      if (this.peek().type === 'punct' && this.peek().value === '}') break;
      if (this.peek().type === 'eof') break;
      terms.push(this.parseTerm());
      this.skipNewlines();
    }
    return terms;
  }

  private parseTerm(): RegoTerm {
    let not = false;
    if (this.peek().type === 'ident' && this.peek().value === 'not') {
      this.next();
      not = true;
    }
    const left = this.parsePrimary();
    this.skipNewlines();
    const tok = this.peek();
    if (tok.type === 'op' && tok.value === 'in') {
      this.next();
      this.skipNewlines();
      const right = this.parseArray();
      return { kind: 'in', not, left, right };
    }
    if (tok.type === 'op' && COMPARISON_OPS.has(tok.value)) {
      this.next();
      this.skipNewlines();
      const right = this.parsePrimary();
      return { kind: 'compare', not, op: tok.value as RegoTerm['op'], left, right };
    }
    // termo isolado: literal booleano (true/false) significa verdadeiro
    if (left.kind === 'literal' && typeof left.value === 'boolean') {
      return { kind: 'literal', not, value: left.value };
    }
    return { kind: 'compare', not, op: '==', left, right: { kind: 'literal', value: true } };
  }

  private parsePrimary(): RegoPrimary {
    const tok = this.next();
    if (tok.type === 'string') return { kind: 'literal', value: tok.value };
    if (tok.type === 'number') return { kind: 'literal', value: Number(tok.value) };
    if (tok.type === 'ident') {
      if (tok.value === 'true') return { kind: 'literal', value: true };
      if (tok.value === 'false') return { kind: 'literal', value: false };
      const root = tok.value;
      const segments: RegoRefSegment[] = [];
      while (true) {
        this.skipNewlines();
        const nxt = this.peek();
        if (nxt.type === 'punct' && nxt.value === '.') {
          this.next();
          this.skipNewlines();
          const field = this.expect('ident');
          segments.push({ kind: 'field', name: field.value });
          continue;
        }
        if (nxt.type === 'punct' && nxt.value === '[') {
          this.next();
          this.skipNewlines();
          const keyTok = this.expect('string');
          segments.push({ kind: 'key', name: keyTok.value });
          this.skipNewlines();
          this.expect('punct', ']');
          continue;
        }
        break;
      }
      return { kind: 'ref', root, segments };
    }
    throw new SyntaxError(`Rego: primário inesperado "${tok.value}" na linha ${tok.line}`);
  }

  private parseArray(): RegoArray {
    this.expect('punct', '[');
    const items: RegoValue[] = [];
    while (true) {
      this.skipNewlines();
      if (this.peek().type === 'punct' && this.peek().value === ']') {
        this.next();
        break;
      }
      if (this.peek().type === 'eof') throw new SyntaxError('Rego: array não fechado');
      items.push(this.parseValue());
      this.skipNewlines();
      if (this.peek().type === 'punct' && this.peek().value === ',') {
        this.next();
        continue;
      }
      this.skipNewlines();
      if (this.peek().type === 'punct' && this.peek().value === ']') {
        this.next();
        break;
      }
      if (this.peek().type === 'eof') throw new SyntaxError('Rego: array não fechado');
    }
    return { kind: 'array', items };
  }

  private parseValue(): RegoValue {
    const tok = this.peek();
    if (tok.type === 'punct' && tok.value === '[') return this.parseArray();
    if (tok.type === 'punct' && tok.value === '{') return this.parseObject();
    return this.parsePrimary();
  }

  private parseObject(): RegoObject {
    this.expect('punct', '{');
    const entries: [string, RegoValue][] = [];
    while (true) {
      this.skipNewlines();
      if (this.peek().type === 'punct' && this.peek().value === '}') {
        this.next();
        break;
      }
      if (this.peek().type === 'eof') throw new SyntaxError('Rego: objeto não fechado');
      const keyTok = this.expect('string');
      this.skipNewlines();
      this.expect('punct', ':');
      this.skipNewlines();
      const value = this.parseValue();
      entries.push([keyTok.value, value]);
      this.skipNewlines();
      if (this.peek().type === 'punct' && this.peek().value === ',') {
        this.next();
        continue;
      }
      this.skipNewlines();
      if (this.peek().type === 'punct' && this.peek().value === '}') {
        this.next();
        break;
      }
    }
    return { kind: 'object', entries };
  }

  private parseLiteral(): RegoLiteral {
    const tok = this.next();
    if (tok.type === 'string') return tok.value;
    if (tok.type === 'number') return Number(tok.value);
    if (tok.type === 'ident' && tok.value === 'true') return true;
    if (tok.type === 'ident' && tok.value === 'false') return false;
    throw new SyntaxError(`Rego: literal inesperado "${tok.value}" na linha ${tok.line}`);
  }
}

export function parseRego(source: string): RegoAst {
  return new RegoParser(source).parse();
}

function resolveRef(
  env: Record<string, unknown>,
  root: string,
  segments: RegoRefSegment[],
): unknown {
  let value: unknown = env[root];
  for (const seg of segments) {
    if (value === null || value === undefined) return undefined;
    const obj = value as Record<string, unknown>;
    value = seg.kind === 'field' ? obj[seg.name] : obj[seg.name];
  }
  return value;
}

function evalPrimary(env: Record<string, unknown>, primary: RegoPrimary): RegoValue {
  if (primary.kind === 'literal') return primary.value as RegoValue;
  return resolveRef(env, primary.root!, primary.segments!) as RegoValue;
}

function compareValues(op: string, left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    switch (op) {
      case '==': return left === right;
      case '!=': return left !== right;
      case '>': return left > right;
      case '<': return left < right;
      case '>=': return left >= right;
      case '<=': return left <= right;
    }
  }
  if (typeof left === 'string' && typeof right === 'string') {
    switch (op) {
      case '==': return left === right;
      case '!=': return left !== right;
      case '>': return left > right;
      case '<': return left < right;
      case '>=': return left >= right;
      case '<=': return left <= right;
    }
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    switch (op) {
      case '==': return left === right;
      case '!=': return left !== right;
    }
  }
  if (left === null && right === null && op == '==') return true;
  return false;
}

function evalTerm(env: Record<string, unknown>, term: RegoTerm): boolean {
  let result: boolean;
  if (term.kind === 'literal') {
    result = term.value === true;
  } else if (term.kind === 'in') {
    const needle = evalPrimary(env, term.left!);
    const haystack = (term.right as RegoArray).items;
    result = Array.isArray(haystack) && haystack.includes(needle);
  } else {
    const l = evalPrimary(env, term.left!);
    const r = evalPrimary(env, term.right as RegoPrimary);
    result = compareValues(term.op!, l, r);
  }
  return term.not ? !result : result;
}

function evalDefinition(env: Record<string, unknown>, def: RegoRuleDefinition): boolean {
  return def.terms.every((term) => evalTerm(env, term));
}

export function evaluateRego(
  source: string,
  input: OpaInput,
  ruleName: string,
): EvalResult {
  const ast = parseRego(source);
  const env: Record<string, unknown> = {
    ...ast.defaults,
    ...ast.objects,
    input,
  };
  const rule = ast.rules.find((r) => r.name === ruleName);
  if (!rule) return { result: false, reason: 'rule_not_found' };
  const valueRule = rule.definitions[0].value !== undefined;
  for (const def of rule.definitions) {
    if (evalDefinition(env, def)) {
      if (valueRule) return { result: true, reason: String(def.value) };
      return { result: true };
    }
  }
  return valueRule ? { result: false } : { result: false };
}

export function evaluateRegoDenyReason(
  source: string,
  input: OpaInput,
  ruleName: string,
): string | undefined {
  const ast = parseRego(source);
  const env: Record<string, unknown> = {
    ...ast.defaults,
    ...ast.objects,
    input,
  };
  const rule = ast.rules.find((r) => r.name === ruleName);
  if (!rule) return undefined;
  for (const def of rule.definitions) {
    if (def.value === undefined) continue;
    if (evalDefinition(env, def)) return String(def.value);
  }
  return undefined;
}
