import { describe, it, expect } from 'vitest';
import {
  provisionAgentTools,
  type AgentConfigBase,
  type ToolInstallment,
} from '../src/index';
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

function assertInstallment(
  installment: ToolInstallment,
  runtimes: string[],
): void {
  expect(['typescript', 'node', 'git', 'docker']).toContain(installment.tool);
  expect(runtimes).toContain(installment.runtime);
  expect(installment.target).toBe(
    `${installment.runtime}://agents/${encodeURIComponent(
      'engineering-senior-developer',
    )}/tools/${encodeURIComponent(installment.tool)}`,
  );
  expect(installment.installedAt).toMatch(ISO_RE);
  expect(installment.config).toBeDefined();
  expect(installment.config!.permissions).toEqual([
    'manage_repos',
    'run_deploys',
  ]);
  expect(installment.config!.role).toBe('engenheiro-de-software');
}

describe('provisionAgentTools (auto-instalacao de ferramentas)', () => {
  it('instala cada tool em 3+ runtimes ACP/MCP, sem falhas (bulkhead)', async () => {
    const result = await provisionAgentTools(baseConfig());

    expect(result.runtimes).toEqual(['mcp-stdio', 'mcp-http', 'acp']);
    expect(result.runtimes.length).toBeGreaterThanOrEqual(3);
    expect(result.failedCount).toBe(0);

    // 4 tools x 3 runtimes = 12 installments
    expect(result.provisioned).toHaveLength(12);
    expect(result.installedCount).toBe(12);

    for (const installment of result.provisioned) {
      expect(installment.status).toBe('installed');
      expect(installment.error).toBeUndefined();
      assertInstallment(installment, result.runtimes);
    }

    // Criterio: 3+ tools distintas provisionadas em 3+ runtimes
    const distinctTools = new Set(result.provisioned.map((i) => i.tool));
    expect(distinctTools.size).toBeGreaterThanOrEqual(3);
  });

  it('é idempotente: mesma entrada gera mesmo contrato, sem duplicar', async () => {
    const base = baseConfig();
    const a = await provisionAgentTools(base);
    const b = await provisionAgentTools(base);

    expect(a.provisioned).toHaveLength(b.provisioned.length);
    expect(a.installedCount).toBe(b.installedCount);
    expect(a.failedCount).toBe(b.failedCount);
    expect(a.runtimes).toEqual(b.runtimes);

    for (let i = 0; i < a.provisioned.length; i++) {
      const x = a.provisioned[i];
      const y = b.provisioned[i];
      expect(x.tool).toBe(y.tool);
      expect(x.runtime).toBe(y.runtime);
      expect(x.status).toBe(y.status);
      expect(x.target).toBe(y.target);
      expect(x.config).toEqual(y.config);
    }
  });

  it('dry-run marca todos como skipped e não instala nada', async () => {
    const result = await provisionAgentTools(baseConfig(), { dryRun: true });

    expect(result.installedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    for (const installment of result.provisioned) {
      expect(installment.status).toBe('skipped');
      expect(installment.error).toBeUndefined();
    }
  });

  it('aceita runtimes customizados e provisiona todas as tools em cada um', async () => {
    const result = await provisionAgentTools(baseConfig(), {
      runtimes: ['mcp-stdio'],
    });

    expect(result.runtimes).toEqual(['mcp-stdio']);
    expect(result.installedCount).toBe(4);
    expect(result.failedCount).toBe(0);
    for (const installment of result.provisioned) {
      expect(installment.runtime).toBe('mcp-stdio');
      expect(installment.status).toBe('installed');
    }
  });
});
