import { describe, it, expect } from 'vitest';
import { hireAgent, type AgentConfig } from '../src/index';

/** Contratos gerados em runtime: assertar formato, nunca valor exato. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function assertBaseContract(config: AgentConfig) {
  expect(typeof config.id).toBe('string');
  expect(config.id).toMatch(UUID_RE);
  expect(config.code).toBe('engineering-senior-developer');
  expect(config.slug).toBe('engineering-senior-developer');
  expect(config.name).toBe('Senior Developer');
  expect(typeof config.instructions).toBe('string');
  expect(config.instructions.length).toBeGreaterThan(0);
  expect(typeof config.rawSource).toBe('string');
  expect(config.rawSource.length).toBeGreaterThan(0);
  expect(config.source).toBe('paperclip');
  expect(config.hiredAt).toMatch(ISO_RE);
}

describe('hireAgent (Fase 7 — Agent Hire Flow)', () => {
  it('contrata engineering-senior-developer e devolve AgentConfig válido', async () => {
    const config = await hireAgent('engineering-senior-developer');

    assertBaseContract(config);

    // Divisão AA → papel NettosCorp (mapeamento config-driven em division-mapping)
    expect(config.division).toBe('engineering');
    expect(config.role).toBe('engenheiro-de-software');

    // Frontmatter `nettoscorp` aplicada (defaults do mapeamento de divisão;
    // o arquivo do agente não possui bloco `nettoscorp` próprio)
    expect(config.nettoscorp.department).toBe('Engenharia de Software');
    expect(config.nettoscorp.clearance).toBe('restrito');
    expect(config.nettoscorp.authority).toBe('tecnica');
    expect(Array.isArray(config.nettoscorp.knowledge_domains)).toBe(true);
    expect(config.nettoscorp.knowledge_domains).toContain('TypeScript');
    expect(config.nettoscorp.knowledge_domains).toContain('Node.js');
    expect(config.nettoscorp.knowledge_domains).toContain('Arquitetura de Software');

    // Ferramentas do papel (least privilege)
    expect(config.tools).toEqual(['typescript', 'node', 'git', 'docker']);

    // Permissões derivadas do módulo software-factory, nunca escopo total
    expect(config.permissions).toEqual(['manage_repos', 'run_deploys']);

    // Fluxo completo: provisionamento + orçamento preenchidos
    expect(config.toolProvisioning.installedCount).toBeGreaterThan(0);
    expect(config.toolProvisioning.runtimes).toEqual([
      'mcp-stdio',
      'mcp-http',
      'acp',
    ]);
    expect(config.budgetPolicy.monthlyBudgetBRL).toBe(3000); // autoridade 'tecnica'
    expect(config.budgetPolicy.source).toBe('role-authority');
    expect(config.budgetPolicy.policyId).toBe(`budget-${config.id}`);
  });

  it('slug inválido lança erro descritivo, nunca falha silenciosamente', async () => {
    await expect(hireAgent('')).rejects.toThrow(/slug é obrigatório/);
  });

  it('slug ausente no corpus lança AgentHireError com mensagem descritiva', async () => {
    await expect(hireAgent('nao-existe-qualquer-coisa')).rejects.toThrow(
      /não encontrado no corpus/,
    );
  });

  it('divisão desconhecida aplica fallback degradado sem quebrar o pipeline', async () => {
    const config = await hireAgent('qualquer-coisa', {
      divisionOverride: 'divisao-inexistente',
    });

    expect(config.division).toBe('divisao-inexistente');
    expect(config.role).toBe('agente-operacional');
    expect(config.nettoscorp.department).toBe('Operações');
    expect(config.nettoscorp.authority).toBe('operacional');
    expect(config.nettoscorp.clearance).toBe('restrito');
  });

  it('é determinístico: mesma entrada produz mesmo contrato (exceto id e timestamps)', async () => {
    const a = await hireAgent('engineering-senior-developer');
    const b = await hireAgent('engineering-senior-developer');

    expect(a.slug).toBe(b.slug);
    expect(a.division).toBe(b.division);
    expect(a.role).toBe(b.role);
    expect(a.name).toBe(b.name);
    expect(a.nettoscorp).toEqual(b.nettoscorp);
    expect(a.tools).toEqual(b.tools);
    expect(a.permissions).toEqual(b.permissions);
    expect(a.instructions).toBe(b.instructions);
    expect(a.source).toBe(b.source);

    // Valores gerados por runtime diferem a cada chamada
    expect(a.id).not.toBe(b.id);
    expect(a.hiredAt).not.toBe(b.hiredAt);
    expect(a.toolProvisioning.completedAt).not.toBe(b.toolProvisioning.completedAt);
  });
});
