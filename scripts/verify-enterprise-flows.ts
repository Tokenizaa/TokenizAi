const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

interface ApiResult<T = Record<string, unknown>> {
  status: number;
  data: T;
}

async function req<T = Record<string, unknown>>(
  path: string,
  role: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown
): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-NettosCorp-Role': role,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function run(): Promise<void> {
  console.log(`Running TokenizAi — NettosCorp Enterprise integration checks against ${BASE_URL}`);

  // 1. Health check
  const health = await req<{ status: string }>('/api/health', 'direcao_executiva');
  assert(health.status === 200 && health.data.status === 'ok', 'Health check should return 200 ok');
  console.log('✓ GET /api/health');

  // Ensure clean baseline before running mutations
  const resetStart = await req('/api/state/reset', 'direcao_executiva', 'POST');
  assert(resetStart.status === 200, 'Initial state reset by direcao_executiva should succeed');

  // 2. RBAC verification (403 on unauthorized roles)
  const deniedTaskPatch = await req('/api/tasks/tsk-1', 'operacional', 'PATCH', {
    status: 'em_revisao',
  });
  assert(deniedTaskPatch.status === 403, 'operacional role must be blocked (403) on PATCH /api/tasks/:id');

  const deniedBlueprintEdit = await req('/api/agency/blueprints/agent-1', 'desenvolvimento', 'PATCH', {
    specialty: 'Unauthorized edit',
  });
  assert(deniedBlueprintEdit.status === 403, 'desenvolvimento role must be blocked (403) on blueprint edit');

  const deniedGovApprove = await req('/api/governance/gov-4/approve', 'ia', 'POST');
  assert(deniedGovApprove.status === 403, 'ia role must be blocked (403) on governance approval');
  console.log('✓ RBAC 403 guards verified (tasks, blueprints, governance)');

  // 3. Hierarchy cycle detection on Org Chart
  const directCycle = await req('/api/org/positions/pos-cto', 'direcao_executiva', 'PATCH', {
    reportsToPositionId: 'pos-cto',
  });
  assert(directCycle.status === 400, 'Self-reporting org position must return 400');

  const indirectCycle = await req('/api/org/positions/pos-cto', 'direcao_executiva', 'PATCH', {
    reportsToPositionId: 'pos-ag-orch',
  });
  assert(indirectCycle.status === 400, 'Indirect circular hierarchy (pos-cto -> pos-ag-orch) must return 400');
  console.log('✓ Org chart multi-hop cycle detection verified');

  // 4. Blueprint editing & semver version bump
  const bpEdit = await req<{ blueprintId: string; override: { version: string; specialty: string } }>(
    '/api/agency/blueprints/agent-1',
    'ia',
    'PATCH',
    { specialty: 'APIs TypeScript de Alta Disponibilidade & FinOps' }
  );
  assert(bpEdit.status === 200 && bpEdit.data.override.version === '1.0.1', 'Blueprint patch should bump version to 1.0.1');
  console.log('✓ Blueprint editable & semver versioned (1.0.0 -> 1.0.1)');

  // 5. Fluxo A: Homologation enforcement + Instantiation into vacant org position
  const nonHomologatedDeploy = await req('/api/runtime/agents', 'ia', 'POST', {
    blueprintId: 'agent-10',
    projectId: 'proj-1',
  });
  assert(nonHomologatedDeploy.status === 400, 'Deploying non-homologated blueprint must be rejected (400)');

  const homologate = await req('/api/agency/homologation', 'ia', 'POST', {
    agentId: 'agent-10',
    status: 'homologado',
  });
  assert(homologate.status === 200, 'Homologating agent-10 by IA role should succeed');

  const deployFluxoA = await req<{ instance: { id: string; positionId?: string } }>(
    '/api/runtime/agents',
    'ia',
    'POST',
    {
      blueprintId: 'agent-10',
      projectId: 'proj-1',
      positionId: 'pos-vago-finops',
      monthlyBudgetBRL: 4000,
    }
  );
  assert(
    deployFluxoA.status === 200 && deployFluxoA.data.instance.positionId === 'pos-vago-finops',
    'Fluxo A runtime instantiation should link to vacant org position'
  );
  console.log('✓ Fluxo A verified (homologation gate + runtime deploy + org position link)');

  // 6. Fluxo B: Team composition -> NEXUS tasks & runtime instances
  const compRes = await req<{
    composition: { id: string };
    createdInstances: Array<{ id: string }>;
    createdTasks: Array<{ id: string }>;
  }>('/api/agency/compositions', 'ia', 'POST', {
    projectId: 'proj-2',
    authorName: 'Clara Azevedo',
    selectedBlueprintIds: ['agent-1', 'agent-10'],
    coveragePercent: 88,
    identifiedGaps: [],
    deterministicSummary: 'Cobertura validada pelo teste de integração.',
    humanApprovalStatus: 'aprovada',
    provisionInstances: true,
    generateNexusTasks: true,
  });
  assert(
    compRes.status === 200 &&
      compRes.data.createdInstances.length >= 1 &&
      compRes.data.createdTasks.length === 2,
    'Fluxo B should provision instances and generate NEXUS tasks'
  );
  console.log('✓ Fluxo B verified (composition -> runtime instances + NEXUS tasks)');

  // 7. Fluxo C: Task comments, mandatory completion evidence & escalation to Governance
  const createdTaskId = compRes.data.createdTasks[0].id;
  const commentRes = await req<{ task: { commentsCount: number } }>(
    `/api/tasks/${createdTaskId}/comments`,
    'operacoes',
    'POST',
    { text: 'Checkpoint inicial verificado.' }
  );
  assert(commentRes.status === 200 && commentRes.data.task.commentsCount === 1, 'Task comment should increment commentsCount');

  const closeWithoutEvidence = await req(`/api/tasks/${createdTaskId}`, 'operacoes', 'PATCH', {
    status: 'concluida',
  });
  assert(closeWithoutEvidence.status === 400, 'Closing task without completionEvidence must return 400');

  const escalateRes = await req<{
    task: { status: string };
    governanceRecord: { code: string; type: string };
  }>(`/api/tasks/${createdTaskId}/escalate`, 'operacoes', 'POST', {
    reason: 'Solicita aprovação executiva de orçamento de evals.',
  });
  assert(
    escalateRes.status === 200 &&
      escalateRes.data.task.status === 'bloqueada' &&
      escalateRes.data.governanceRecord.type === 'DELIB',
    'Fluxo C escalation should mark task bloqueada and create DELIB governance record'
  );

  const closeWithEvidence = await req<{ task: { status: string } }>(
    `/api/tasks/${createdTaskId}`,
    'direcao_executiva',
    'PATCH',
    {
      status: 'concluida',
      completionEvidence: 'Evidência validada via suíte automatizada.',
    }
  );
  assert(
    closeWithEvidence.status === 200 && closeWithEvidence.data.task.status === 'concluida',
    'Closing task with evidence must return 200'
  );
  console.log('✓ Fluxo C verified (comments + mandatory evidence + escalation DELIB)');

  // 8. Fluxo D: Heartbeat session tracking + Audit log presence
  const hbRes = await req<{ session: { id: string; instanceId: string } }>(
    `/api/runtime/agents/${deployFluxoA.data.instance.id}/heartbeat`,
    'operacoes',
    'POST'
  );
  assert(hbRes.status === 200 && Boolean(hbRes.data.session.id), 'Fluxo D heartbeat should record execution session');

  const bootstrap = await req<{
    state: { governance: Array<{ type: string; auditHash: string }> };
  }>('/api/bootstrap', 'auditoria');
  const auditCount = bootstrap.data.state.governance.filter((g) => g.type === 'AUDIT' && g.auditHash.length >= 8).length;
  assert(auditCount >= 4, 'Audit trail should record hashed AUDIT governance entries for mutations');
  console.log(`✓ Fluxo D & Audit trail verified (${auditCount} hashed AUDIT records)`);

  // 9. Restore clean seed state
  const resetEnd = await req('/api/state/reset', 'direcao_executiva', 'POST');
  assert(resetEnd.status === 200, 'Final state reset should succeed');
  console.log('✓ Seed state cleanly restored. All enterprise integration checks passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
