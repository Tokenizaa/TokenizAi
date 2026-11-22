import { describe, it, expect } from 'vitest';
import { bindAgentBudget, type AgentConfigBase } from '../src/index';
import type { NettoscorpFrontmatter } from '../src/types';

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function baseConfig(
  overrides: Partial<AgentConfigBase> = {},
): AgentConfigBase {
  return {
    id: 'agent-test-0001',
    code: 'engineering-senior-developer',
    slug: 'engineering-senior-developer',
    name: 'Senior Developer',
    division: 'engineering',
    role: 'engenheiro-de-software',
    nettoscorp: {
      department: 'Engenharia de Software',
      clearance: 'restrito',
      authority: 'tecnica',
      knowledge_domains: [
        'TypeScript',
        'Node.js',
        'Arquitetura de Software',
      ],
    } as NettoscorpFrontmatter,
    specialty: 'Desenvolvimento de software e arquitetura de sistemas',
    summary: '',
    instructions: 'instrucoes do agente',
    tools: ['typescript', 'node', 'git', 'docker'],
    permissions: ['manage_repos', 'run_deploys'],
    rawSource: '---\nname: x\n---\n',
    source: 'paperclip',
    hiredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('bindAgentBudget (vinculacao de orçamento por papel)', () => {
  it('vincula policy pela autoridade do papel (role-authority, sem override)', async () => {
    const result = await bindAgentBudget(baseConfig());

    expect(result.source).toBe('role-authority');
    expect(result.policy.agentId).toBe('agent-test-0001');
    expect(result.policy.slug).toBe('engineering-senior-developer');
    expect(result.policy.role).toBe('engenheiro-de-software');
    expect(result.policy.authority).toBe('tecnica');
    expect(result.policy.clearance).toBe('restrito');

    // DEFAULT_MONTHLY_BUDGET_BY_AUTHORITY['tecnica'] = 3000 BRL
    expect(result.policy.monthlyBudgetBRL).toBe(3000);
    expect(result.policy.spentBudgetBRL).toBe(0);
    expect(result.policy.maxExecutionsPerDay).toBe(150);
    expect(result.policy.currency).toBe('BRL');
    expect(result.policy.policyId).toBe('budget-agent-test-0001');
    expect(result.policy.boundAt).toMatch(ISO_RE);
    expect(result.boundAt).toBe(result.policy.boundAt);
  });

  it('é determinístico: mesma entrada gera mesma política (exceto boundAt)', async () => {
    const base = baseConfig();
    const a = await bindAgentBudget(base);
    const b = await bindAgentBudget(base);

    expect(a.policy.policyId).toBe(b.policy.policyId);
    expect(a.policy.monthlyBudgetBRL).toBe(b.policy.monthlyBudgetBRL);
    expect(a.policy.maxExecutionsPerDay).toBe(b.policy.maxExecutionsPerDay);
    expect(a.policy.source).toBe(b.policy.source);
    expect(a.policy.role).toBe(b.policy.role);
    expect(a.policy.authority).toBe(b.policy.authority);
    expect(a.policy.boundAt).not.toBe(b.policy.boundAt); // timestamp do momento
  });

  it('override explícito sobe o teto e muda a fonte para override (auditado)', async () => {
    const result = await bindAgentBudget(baseConfig(), {
      overrideMonthlyBudgetBRL: 12000,
    });

    expect(result.source).toBe('override');
    expect(result.policy.source).toBe('override');
    expect(result.policy.monthlyBudgetBRL).toBe(12000);
    // teto de execucoes ainda vem da autoridade, não do override
    expect(result.policy.maxExecutionsPerDay).toBe(150);
  });

  it('autoridades diferentes produzem orçamentos diferentes por role', async () => {
    const nettoscorpGerencial = {
      ...baseConfig().nettoscorp,
      authority: 'gerencial',
    } as unknown as NettoscorpFrontmatter;
    const nettoscorpOperacional = {
      ...baseConfig().nettoscorp,
      authority: 'operacional',
    } as unknown as NettoscorpFrontmatter;
    const gerencial = baseConfig({ nettoscorp: nettoscorpGerencial });
    const operacional = baseConfig({ nettoscorp: nettoscorpOperacional });

    const [g, o] = await Promise.all([
      bindAgentBudget(gerencial),
      bindAgentBudget(operacional),
    ]);

    expect(g.policy.monthlyBudgetBRL).toBe(5000);
    expect(o.policy.monthlyBudgetBRL).toBe(2000);
    expect(g.policy.monthlyBudgetBRL).not.toBe(o.policy.monthlyBudgetBRL);
    expect(g.policy.authority).toBe('gerencial');
    expect(o.policy.authority).toBe('operacional');
  });

  it('companyId/projectId vêm do contexto do contratante (isolamento multi-tenant)', async () => {
    const result = await bindAgentBudget(baseConfig(), {
      companyId: 'tenant-1',
      projectId: 'proj-42',
    });

    expect(result.policy.companyId).toBe('tenant-1');
    expect(result.policy.projectId).toBe('proj-42');
  });
});
