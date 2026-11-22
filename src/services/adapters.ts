import type {
  AgentBlueprintOverride,
  AgentExecutionSession,
  CalendarCommitment,
  ChatConversation,
  ChatMessage,
  DepartmentRecord,
  EnterpriseProject,
  EnterpriseState,
  FinancialEntry,
  GovernanceRecord,
  HomologationStatus,
  OperationalAgentInstance,
  OrgPosition,
  ProjectTask,
  TaskComment,
  TeamCompositionRecord,
  UserRole,
} from '../types/enterprise';

export interface GitHubRepoInspection {
  fullName: string;
  description: string;
  primaryLanguage: string;
  languages: string[];
  stars: number;
  openIssues: number;
  defaultBranch: string;
  topics: string[];
  htmlUrl: string;
  updatedAt: string;
  isPrivate: boolean;
  recentCommits: Array<{ sha: string; message: string; date: string; author: string }>;
}

export interface ProjectAIScopingResult {
  suggestedTitle: string;
  objective: string;
  area: string;
  detectedArchitecture: string;
  keyRequirements: string[];
  recommendedCompetencies: string[];
  risks: string[];
  questionsToConfirm: string[];
}

export interface ExecutiveAIBrief {
  executiveSummary: string;
  risksAndBottlenecks: string[];
  priorityActions: string[];
}

export interface ServerHealthStatus {
  status: string;
  timestamp: string;
  integrations: {
    gemini: boolean;
    supabase: boolean;
    paperclip: boolean;
    githubToken: boolean;
  };
}

async function apiRequest<T>(
  url: string,
  role: UserRole,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-NettosCorp-Role': role,
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erro na requisição (${res.status}).`);
  }
  return data as T;
}

export const EnterpriseApiAdapter = {
  bootstrap(role: UserRole): Promise<{ state: EnterpriseState; role: UserRole }> {
    return apiRequest('/api/bootstrap', role);
  },

  resetState(role: UserRole): Promise<{ ok: boolean; state: EnterpriseState }> {
    return apiRequest('/api/state/reset', role, { method: 'POST' });
  },

  createConversation(
    role: UserRole,
    input: {
      kind: ChatConversation['kind'];
      title: string;
      subtitle?: string;
      participantIds: string[];
      projectId?: string;
      departmentId?: string;
      contextRef?: ChatConversation['contextRef'];
    }
  ): Promise<{ conversation: ChatConversation }> {
    return apiRequest('/api/chat/conversations', role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  sendMessage(
    role: UserRole,
    input: {
      conversationId: string;
      content: string;
      targetInstanceId?: string;
      contextRef?: ChatMessage['contextRef'];
    }
  ): Promise<{ userMessage: ChatMessage; agentMessage: ChatMessage | null; session?: AgentExecutionSession }> {
    return apiRequest('/api/chat/messages', role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  orchestrateInterAgent(
    role: UserRole,
    input: {
      sourceInstanceId: string;
      targetInstanceId: string;
      topic: string;
      projectId?: string;
    }
  ): Promise<{ conversation: ChatConversation; messages: ChatMessage[] }> {
    return apiRequest('/api/chat/inter-agent', role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  convertMessageToTask(
    role: UserRole,
    messageId: string,
    input: {
      projectId?: string;
      title?: string;
      assigneeId?: string;
      assigneeKind?: 'humano' | 'agente_operacional';
      assigneeName?: string;
      dueDate?: string;
      completionCriteria?: string;
    }
  ): Promise<{ task: ProjectTask }> {
    return apiRequest(`/api/chat/messages/${messageId}/convert-task`, role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  createDepartment(
    role: UserRole,
    input: { code: string; name: string; description: string; budgetAllocatedBRL: number }
  ): Promise<{ department: DepartmentRecord }> {
    return apiRequest('/api/org/departments', role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  createOrgPosition(
    role: UserRole,
    input: Partial<OrgPosition>
  ): Promise<{ position: OrgPosition }> {
    return apiRequest('/api/org/positions', role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateOrgPosition(
    role: UserRole,
    positionId: string,
    patch: Partial<OrgPosition>
  ): Promise<{ position: OrgPosition }> {
    return apiRequest(`/api/org/positions/${positionId}`, role, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  createTask(role: UserRole, input: Partial<ProjectTask>): Promise<{ task: ProjectTask }> {
    return apiRequest('/api/tasks', role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateTask(role: UserRole, taskId: string, patch: Partial<ProjectTask>): Promise<{ task: ProjectTask }> {
    return apiRequest(`/api/tasks/${taskId}`, role, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  addTaskComment(
    role: UserRole,
    taskId: string,
    text: string
  ): Promise<{ task: ProjectTask; comment: TaskComment }> {
    return apiRequest(`/api/tasks/${taskId}/comments`, role, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  escalateTask(
    role: UserRole,
    taskId: string,
    reason: string
  ): Promise<{ task: ProjectTask; governanceRecord: GovernanceRecord; escalatedTo: string }> {
    return apiRequest(`/api/tasks/${taskId}/escalate`, role, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  createRuntimeInstance(
    role: UserRole,
    input: {
      blueprintId: string;
      projectId: string;
      positionId?: string;
      guardrailPolicy?: string;
      provider?: OperationalAgentInstance['provider'];
      model?: string;
      adapter?: OperationalAgentInstance['adapter'];
      monthlyBudgetBRL?: number;
      tools?: string[];
    }
  ): Promise<{ instance: OperationalAgentInstance }> {
    return apiRequest('/api/runtime/agents', role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateRuntimeInstance(
    role: UserRole,
    instanceId: string,
    patch: Partial<OperationalAgentInstance>
  ): Promise<{ instance: OperationalAgentInstance }> {
    return apiRequest(`/api/runtime/agents/${instanceId}`, role, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  triggerHeartbeat(
    role: UserRole,
    instanceId: string
  ): Promise<{ instance: OperationalAgentInstance; session: AgentExecutionSession }> {
    return apiRequest(`/api/runtime/agents/${instanceId}/heartbeat`, role, {
      method: 'POST',
    });
  },

  createProject(
    role: UserRole,
    input: Omit<EnterpriseProject, 'id' | 'code' | 'updatedAt'>
  ): Promise<{ project: EnterpriseProject }> {
    return apiRequest('/api/projects', role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  toggleNexusGate(
    role: UserRole,
    projectId: string,
    gateId: string,
    passed: boolean
  ): Promise<{ project: EnterpriseProject }> {
    return apiRequest(`/api/projects/${projectId}/nexus-gates/${gateId}`, role, {
      method: 'PATCH',
      body: JSON.stringify({ passed }),
    });
  },

  addFinancialEntry(
    role: UserRole,
    entry: Omit<FinancialEntry, 'id' | 'origin'>
  ): Promise<{ entry: FinancialEntry }> {
    return apiRequest('/api/finance/entries', role, {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },

  setHomologation(
    role: UserRole,
    agentId: string,
    status: HomologationStatus
  ): Promise<{ agentId: string; status: HomologationStatus }> {
    return apiRequest('/api/agency/homologation', role, {
      method: 'POST',
      body: JSON.stringify({ agentId, status }),
    });
  },

  updateAgentBlueprint(
    role: UserRole,
    blueprintId: string,
    patch: Partial<AgentBlueprintOverride>
  ): Promise<{ blueprintId: string; override: AgentBlueprintOverride }> {
    return apiRequest(`/api/agency/blueprints/${blueprintId}`, role, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  saveTeamComposition(
    role: UserRole,
    composition: Omit<TeamCompositionRecord, 'id' | 'createdAt'> & {
      provisionInstances?: boolean;
      generateNexusTasks?: boolean;
    }
  ): Promise<{
    composition: TeamCompositionRecord;
    createdInstances?: OperationalAgentInstance[];
    createdTasks?: ProjectTask[];
  }> {
    return apiRequest('/api/agency/compositions', role, {
      method: 'POST',
      body: JSON.stringify(composition),
    });
  },

  createGovernanceRecord(
    role: UserRole,
    input: {
      type: 'DEC' | 'CNS' | 'DELIB';
      title: string;
      summary: string;
      linkedProjectId?: string;
      linkedConversationId?: string;
    }
  ): Promise<{ record: GovernanceRecord }> {
    return apiRequest('/api/governance', role, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  approveGovernanceRecord(
    role: UserRole,
    recordId: string
  ): Promise<{ record: GovernanceRecord }> {
    return apiRequest(`/api/governance/${recordId}/approve`, role, {
      method: 'POST',
    });
  },
};

export const GitHubAdapter = {
  async inspectRepo(repoInput: string): Promise<GitHubRepoInspection> {
    const res = await fetch('/api/integrations/github/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao consultar repositório no GitHub.');
    }
    return data as GitHubRepoInspection;
  },
};

export const AIAdapter = {
  async scopeProject(
    brief: string,
    githubContext?: GitHubRepoInspection | null
  ): Promise<{ analysis: ProjectAIScopingResult; model: string }> {
    const res = await fetch('/api/ai/scope-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief, githubContext }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Serviço de IA indisponível no momento.');
    }
    return data as { analysis: ProjectAIScopingResult; model: string };
  },

  async generateExecutiveBrief(
    summary: Record<string, unknown>
  ): Promise<{ brief: ExecutiveAIBrief; model: string }> {
    const res = await fetch('/api/ai/executive-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao gerar análise executiva via Gemini.');
    }
    return data as { brief: ExecutiveAIBrief; model: string };
  },

  async parseVoiceIntent(transcript: string): Promise<{
    action: string;
    moduleId?: string;
    projectId?: string;
    query?: string;
    explanation: string;
  }> {
    const res = await fetch('/api/ai/voice-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao interpretar comando de voz.');
    }
    return data.intent;
  },

  async streamChatbotTurn(
    role: UserRole,
    input: {
      message: string;
      history: Array<{ role: 'user' | 'model'; text: string }>;
      personaId: string;
      customSystemInstruction?: string;
      speedMode: 'balanced' | 'fast';
      activeModule: string;
      onChunk: (delta: string) => void;
    }
  ): Promise<{ text: string; model: string }> {
    const res = await fetch('/api/ai/chatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nettoscorp-role': role,
      },
      body: JSON.stringify({
        message: input.message,
        history: input.history,
        personaId: input.personaId,
        customSystemInstruction: input.customSystemInstruction,
        speedMode: input.speedMode,
        activeModule: input.activeModule,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Erro ao consultar o chatbot Gemini.');
    }

    if (!res.body) {
      throw new Error('Streaming indisponível na resposta do servidor.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';
    let resolvedModel = input.speedMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const block of events) {
        const line = block
          .split('\n')
          .find((l) => l.startsWith('data: '));
        if (!line) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        const parsed = JSON.parse(jsonStr) as {
          chunk?: string;
          done?: boolean;
          model?: string;
          error?: string;
        };
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.chunk) {
          fullText += parsed.chunk;
          input.onChunk(parsed.chunk);
        }
        if (parsed.model) {
          resolvedModel = parsed.model;
        }
      }
    }

    return { text: fullText, model: resolvedModel };
  },
};

export const SystemSyncAdapter = {
  async fetchHealth(): Promise<ServerHealthStatus> {
    const res = await fetch('/api/health');
    if (!res.ok) {
      throw new Error('Servidor indisponível.');
    }
    return res.json() as Promise<ServerHealthStatus>;
  },

  async pushState(deviceId: string, snapshot: Record<string, unknown>): Promise<{ ok: boolean; updatedAt: string }> {
    const res = await fetch('/api/sync/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, snapshot }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao sincronizar com servidor.');
    }
    return data as { ok: boolean; updatedAt: string };
  },

  async pullState(): Promise<{ hasSnapshot: boolean; updatedAt: string | null; snapshot: Record<string, unknown> | null }> {
    const res = await fetch('/api/sync/state');
    if (!res.ok) {
      throw new Error('Falha ao buscar estado remoto.');
    }
    return res.json();
  },
};

export const CalendarAdapter = {
  downloadICS(commitment: CalendarCommitment): void {
    const start = new Date(commitment.dateISO);
    const end = new Date(start.getTime() + commitment.durationMinutes * 60000);

    const toICSDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NettosCorp Enterprise//Agenda Corporativa//PT-BR',
      'BEGIN:VEVENT',
      `UID:${commitment.id}@nettoscorp.enterprise`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${commitment.title}`,
      `DESCRIPTION:Categoria: ${commitment.category} | Participantes: ${commitment.participants}`,
      `LOCATION:${commitment.location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${commitment.id}-${commitment.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
