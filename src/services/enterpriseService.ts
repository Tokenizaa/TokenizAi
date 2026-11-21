import { INITIAL_ENTERPRISE_STATE } from '../domain/enterpriseSeed';
import { ROLE_DEFINITIONS } from '../domain/permissions';
import type {
  AgentBlueprint,
  EnterpriseProject,
  EnterpriseState,
  FinancialEntry,
  GovernanceRecord,
  HomologationStatus,
  OperationalAgentInstance,
  ProjectTask,
  SyncQueueItem,
  TeamCompositionRecord,
  UserRole,
} from '../types/enterprise';

const STATE_STORAGE_KEY = 'nettoscorp_enterprise_state_v1';
const SYNC_QUEUE_KEY = 'nettoscorp_enterprise_sync_queue_v1';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

export function loadPersistedState(): EnterpriseState {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return INITIAL_ENTERPRISE_STATE;
    const parsed = JSON.parse(raw) as Partial<EnterpriseState>;
    return {
      ...INITIAL_ENTERPRISE_STATE,
      ...parsed,
    };
  } catch {
    return INITIAL_ENTERPRISE_STATE;
  }
}

export function savePersistedState(state: EnterpriseState): void {
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota fallback
  }
}

export function loadSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveSyncQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage errors
  }
}

export function resetDemoState(): EnterpriseState {
  localStorage.removeItem(STATE_STORAGE_KEY);
  localStorage.removeItem(SYNC_QUEUE_KEY);
  return INITIAL_ENTERPRISE_STATE;
}

function makeAuditHash(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function appendAuditRecord(
  state: EnterpriseState,
  title: string,
  summary: string,
  authorName: string,
  authorityRole: string,
  linkedProjectId?: string
): EnterpriseState {
  const nextIndex = state.governance.filter((g) => g.type === 'AUDIT').length + 101;
  const code = `AUDIT-2026-${nextIndex}`;
  const createdAt = new Date().toISOString().slice(0, 10);
  const record: GovernanceRecord = {
    id: `gov-${Date.now()}`,
    code,
    type: 'AUDIT',
    title,
    summary,
    status: 'aprovado',
    authorName,
    authorityRole,
    linkedProjectId,
    createdAt,
    auditHash: makeAuditHash(`${code}-${title}-${Date.now()}`),
  };
  return {
    ...state,
    governance: [record, ...state.governance],
  };
}

export function assertPermission(allowed: boolean, actionLabel: string): void {
  if (!allowed) {
    throw new Error(`Permissão insuficiente para: ${actionLabel}. Altere o papel ativo ou solicite à diretoria.`);
  }
}

export const EnterpriseDomainActions = {
  createProject(
    state: EnterpriseState,
    role: UserRole,
    actorName: string,
    projectInput: Omit<EnterpriseProject, 'id' | 'code' | 'updatedAt'>
  ): EnterpriseState {
    assertPermission(ROLE_DEFINITIONS[role].canEditProjects, 'criar projeto');
    const code = `PRJ-0${state.projects.length + 45}`;
    const newProject: EnterpriseProject = {
      ...projectInput,
      id: `proj-${Date.now()}`,
      code,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const nextState: EnterpriseState = {
      ...state,
      projects: [newProject, ...state.projects],
    };
    return appendAuditRecord(
      nextState,
      `Abertura de projeto ${code}: ${newProject.name}`,
      `Área: ${newProject.area}. Equipe inicial: ${newProject.selectedAgentIds.length} agente(s) e ${newProject.humanTeamIds.length} colaborador(es).`,
      actorName,
      ROLE_DEFINITIONS[role].label,
      newProject.id
    );
  },

  addFinancialEntry(
    state: EnterpriseState,
    role: UserRole,
    actorName: string,
    entry: Omit<FinancialEntry, 'id' | 'origin'>
  ): EnterpriseState {
    assertPermission(ROLE_DEFINITIONS[role].canManageFinance, 'registrar lançamento financeiro');
    const created: FinancialEntry = {
      ...entry,
      id: `fin-${Date.now()}`,
      origin: 'demonstrativo',
    };
    const nextState: EnterpriseState = {
      ...state,
      financialEntries: [created, ...state.financialEntries],
    };
    return appendAuditRecord(
      nextState,
      `Lançamento financeiro registrado (${created.type})`,
      `${created.title} — ${formatBRL(created.amount)} (${created.costCenter})`,
      actorName,
      ROLE_DEFINITIONS[role].label
    );
  },

  toggleTaskStatus(
    state: EnterpriseState,
    taskId: string,
    nextStatus: ProjectTask['status']
  ): EnterpriseState {
    return {
      ...state,
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)),
    };
  },

  setAgentHomologation(
    state: EnterpriseState,
    role: UserRole,
    actorName: string,
    agent: AgentBlueprint,
    nextStatus: HomologationStatus
  ): EnterpriseState {
    assertPermission(ROLE_DEFINITIONS[role].canHomologateAgents, 'alterar homologação de agente');
    const nextState: EnterpriseState = {
      ...state,
      homologationOverrides: {
        ...state.homologationOverrides,
        [agent.id]: nextStatus,
      },
    };
    return appendAuditRecord(
      nextState,
      `Homologação de perfil ${agent.code} alterada para "${nextStatus}"`,
      `${agent.name} (${agent.division})`,
      actorName,
      ROLE_DEFINITIONS[role].label
    );
  },

  saveTeamComposition(
    state: EnterpriseState,
    role: UserRole,
    actorName: string,
    composition: Omit<TeamCompositionRecord, 'id' | 'createdAt'>
  ): EnterpriseState {
    assertPermission(ROLE_DEFINITIONS[role].canEditProjects, 'salvar composição de equipe');
    const fullRecord: TeamCompositionRecord = {
      ...composition,
      id: `cmp-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const nextState: EnterpriseState = {
      ...state,
      compositions: [fullRecord, ...state.compositions],
      projects: state.projects.map((p) =>
        p.id === composition.projectId
          ? { ...p, selectedAgentIds: composition.selectedBlueprintIds, updatedAt: new Date().toISOString().slice(0, 10) }
          : p
      ),
    };
    return appendAuditRecord(
      nextState,
      `Composição de equipe aprovada para projeto`,
      `${composition.selectedBlueprintIds.length} perfis selecionados · Cobertura determinística ${composition.coveragePercent}%`,
      actorName,
      ROLE_DEFINITIONS[role].label,
      composition.projectId
    );
  },

  deployOperationalInstance(
    state: EnterpriseState,
    role: UserRole,
    actorName: string,
    blueprint: AgentBlueprint,
    project: EnterpriseProject,
    guardrailPolicy: string
  ): EnterpriseState {
    assertPermission(ROLE_DEFINITIONS[role].canHomologateAgents, 'preparar instância operacional Paperclip');
    const instance: OperationalAgentInstance = {
      id: `op-${Date.now()}`,
      blueprintId: blueprint.id,
      blueprintCode: blueprint.code,
      instanceName: `${project.code}-${blueprint.code}-Runtime`,
      division: blueprint.division,
      projectId: project.id,
      projectName: project.name,
      runtimeEngine: 'Paperclip Runtime',
      executionState: 'aguardando_paperclip',
      assignedTasksCount: 0,
      guardrailPolicy,
      lastHeartbeat: 'Aguardando conexão Paperclip',
      origin: 'demonstrativo',
    };
    const nextState: EnterpriseState = {
      ...state,
      operationalInstances: [instance, ...state.operationalInstances],
      projects: state.projects.map((p) =>
        p.id === project.id
          ? { ...p, operationalInstanceIds: [...p.operationalInstanceIds, instance.id] }
          : p
      ),
    };
    return appendAuditRecord(
      nextState,
      `Instância operacional preparada (${instance.instanceName})`,
      `Blueprint ${blueprint.code} preparado para Paperclip Runtime no projeto ${project.code}.`,
      actorName,
      ROLE_DEFINITIONS[role].label,
      project.id
    );
  },

  createGovernanceRecord(
    state: EnterpriseState,
    role: UserRole,
    actorName: string,
    input: {
      type: 'DEC' | 'CNS' | 'DELIB';
      title: string;
      summary: string;
      linkedProjectId?: string;
    }
  ): EnterpriseState {
    const seq = state.governance.filter((g) => g.type === input.type).length + 45;
    const code = `${input.type}-2026-0${seq}`;
    const createdAt = new Date().toISOString().slice(0, 10);
    const rec: GovernanceRecord = {
      id: `gov-${Date.now()}`,
      code,
      type: input.type,
      title: input.title,
      summary: input.summary,
      status: ROLE_DEFINITIONS[role].canApproveGovernance ? 'em_deliberacao' : 'pendente',
      authorName: actorName,
      authorityRole: ROLE_DEFINITIONS[role].label,
      linkedProjectId: input.linkedProjectId,
      createdAt,
      auditHash: makeAuditHash(`${code}-${input.title}-${Date.now()}`),
    };
    return {
      ...state,
      governance: [rec, ...state.governance],
    };
  },

  approveGovernanceRecord(
    state: EnterpriseState,
    role: UserRole,
    actorName: string,
    recordId: string
  ): EnterpriseState {
    assertPermission(ROLE_DEFINITIONS[role].canApproveGovernance, 'aprovar decisão de governança');
    const target = state.governance.find((g) => g.id === recordId);
    const nextState: EnterpriseState = {
      ...state,
      governance: state.governance.map((g) =>
        g.id === recordId ? { ...g, status: 'aprovado' } : g
      ),
    };
    if (!target) return nextState;
    return appendAuditRecord(
      nextState,
      `Aprovação registrada: ${target.code}`,
      `${target.title} aprovado por ${actorName}.`,
      actorName,
      ROLE_DEFINITIONS[role].label,
      target.linkedProjectId
    );
  },
};
