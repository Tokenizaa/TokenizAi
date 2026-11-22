/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommandPalette } from './components/Common/CommandPalette';
import { GeminiChatbotDrawer } from './components/Common/GeminiChatbotDrawer';
import { AppShell, NAV_ITEMS } from './components/Layout/AppShell';
import { canAccessModule, getFirstAllowedModule, ROLE_DEFINITIONS } from './domain/permissions';
import { useOnlineStatus } from './hooks/useEnterpriseHooks';
import { AdminModule } from './modules/admin/AdminModule';
import { AgencyLibraryModule } from './modules/agency-library/AgencyLibraryModule';
import { OperationalAgentsModule } from './modules/agency-library/OperationalAgentsModule';
import { TeamComposerModule } from './modules/agency-library/TeamComposerModule';
import { ChatModule } from './modules/chat/ChatModule';
import { CommercialModule } from './modules/commercial/CommercialModule';
import { CustomersModule } from './modules/customers/CustomersModule';
import { ExecutiveDashboard } from './modules/executive/ExecutiveDashboard';
import { FinanceModule } from './modules/finance/FinanceModule';
import { GovernanceModule } from './modules/governance/GovernanceModule';
import { IntelligenceFactoryModule } from './modules/intelligence-factory/IntelligenceFactoryModule';
import { MarketingModule } from './modules/marketing/MarketingModule';
import { OperationsModule } from './modules/operations/OperationsModule';
import { PeopleModule } from './modules/people/PeopleModule';
import { ProductsModule } from './modules/products/ProductsModule';
import { ProjectsModule } from './modules/projects/ProjectsModule';
import { SoftwareFactoryModule } from './modules/software-factory/SoftwareFactoryModule';
import { EnterpriseApiAdapter, SystemSyncAdapter } from './services/adapters';
import {
  loadCachedState,
  loadSyncQueue,
  saveCachedState,
  saveSyncQueue,
} from './services/enterpriseService';
import type {
  AccentTheme,
  AgentBlueprint,
  AgentExecutionSession,
  ChatConversation,
  ChatMessage,
  DepartmentRecord,
  EnterpriseProject,
  EnterpriseState,
  FinancialEntry,
  GovernanceRecord,
  HomologationStatus,
  ModuleId,
  OperationalAgentInstance,
  OrgPosition,
  ProjectTask,
  SyncQueueItem,
  TeamCompositionRecord,
  UserRole,
} from './types/enterprise';

function readInitialModule(): ModuleId {
  const hash = window.location.hash.replace('#', '') as ModuleId;
  if (NAV_ITEMS.some((n) => n.id === hash)) {
    return hash;
  }
  return 'executive';
}

export default function App() {
  const [state, setState] = useState<EnterpriseState>(() => loadCachedState());
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(() => loadSyncQueue());
  const [activeRole, setActiveRole] = useState<UserRole>('direcao_executiva');
  const [activeModule, setActiveModule] = useState<ModuleId>(() => readInitialModule());
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem('nc_theme') === 'dark');
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(
    () => (localStorage.getItem('nc_accent') as AccentTheme) || 'cobalt'
  );

  const [commandOpen, setCommandOpen] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [openProjectWizard, setOpenProjectWizard] = useState(false);
  const [agentSearchSeed, setAgentSearchSeed] = useState<string | undefined>(undefined);
  const [composerProjectId, setComposerProjectId] = useState<string | undefined>(undefined);
  const [selectedChatConvId, setSelectedChatConvId] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const isOnline = useOnlineStatus();
  const pendingGKeyRef = useRef(false);

  // Sync light/dark and accent CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-accent', accentTheme);
    localStorage.setItem('nc_theme', isDark ? 'dark' : 'light');
    localStorage.setItem('nc_accent', accentTheme);
  }, [isDark, accentTheme]);

  // Persist enterprise state cache & offline sync queue
  useEffect(() => {
    saveCachedState(state);
  }, [state]);

  useEffect(() => {
    saveSyncQueue(syncQueue);
  }, [syncQueue]);

  // Sync URL hash navigation
  useEffect(() => {
    window.location.hash = activeModule;
  }, [activeModule]);

  useEffect(() => {
    const onHashChange = () => {
      const candidate = window.location.hash.replace('#', '') as ModuleId;
      if (NAV_ITEMS.some((n) => n.id === candidate) && canAccessModule(activeRole, candidate)) {
        setActiveModule(candidate);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [activeRole]);

  // Authoritative bootstrap from server (respecting RBAC role)
  const refreshFromServer = useCallback(async (roleToLoad: UserRole) => {
    try {
      const res = await EnterpriseApiAdapter.bootstrap(roleToLoad);
      setState(res.state);
      setLastSyncedAt(new Date().toISOString());
    } catch {
      // Offline / fallback uses cached state
    }
  }, []);

  useEffect(() => {
    void refreshFromServer(activeRole);
  }, [activeRole, refreshFromServer]);

  // Real-time Server-Sent Events (SSE) subscription
  useEffect(() => {
    const es = new EventSource('/api/events/stream');

    const safeParse = <T,>(raw: string): T | null => {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    };

    es.addEventListener('chat:conversation_created', (ev) => {
      const conv = safeParse<ChatConversation>((ev as MessageEvent).data);
      if (!conv || !conv.allowedRoles.includes(activeRole)) return;
      setState((prev) => {
        const exists = prev.conversations.some((c) => c.id === conv.id);
        return {
          ...prev,
          conversations: exists
            ? prev.conversations.map((c) => (c.id === conv.id ? conv : c))
            : [conv, ...prev.conversations],
        };
      });
    });

    es.addEventListener('chat:message', (ev) => {
      const msg = safeParse<ChatMessage>((ev as MessageEvent).data);
      if (!msg) return;
      setState((prev) => {
        if (!prev.conversations.some((c) => c.id === msg.conversationId)) return prev;
        const already = prev.messages.some((m) => m.id === msg.id);
        const nextMessages = already ? prev.messages : [...prev.messages, msg];
        const nextConversations = prev.conversations.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessageAt: msg.createdAt,
                lastMessagePreview: msg.content.slice(0, 120),
              }
            : c
        );
        return {
          ...prev,
          messages: nextMessages,
          conversations: nextConversations,
        };
      });
    });

    es.addEventListener('agent:status', (ev) => {
      const payload = safeParse<{
        instanceId: string;
        executionState: OperationalAgentInstance['executionState'];
      }>((ev as MessageEvent).data);
      if (!payload) return;
      setState((prev) => ({
        ...prev,
        operationalInstances: prev.operationalInstances.map((inst) =>
          inst.id === payload.instanceId ? { ...inst, executionState: payload.executionState } : inst
        ),
      }));
    });

    es.addEventListener('agent:session', (ev) => {
      const sess = safeParse<AgentExecutionSession>((ev as MessageEvent).data);
      if (!sess) return;
      setState((prev) => {
        const exists = prev.executionSessions.some((s) => s.id === sess.id);
        if (exists) return prev;
        return {
          ...prev,
          executionSessions: [sess, ...prev.executionSessions],
          operationalInstances: prev.operationalInstances.map((inst) =>
            inst.id === sess.instanceId
              ? {
                  ...inst,
                  spentBudgetBRL: Number((inst.spentBudgetBRL + sess.costBRL).toFixed(2)),
                  lastHeartbeat: sess.finishedAt,
                }
              : inst
          ),
          costCenters: prev.costCenters.map((cc) =>
            cc.id === 'cc-2' ? { ...cc, spent: Number((cc.spent + sess.costBRL).toFixed(2)) } : cc
          ),
        };
      });
    });

    es.addEventListener('task:updated', (ev) => {
      const task = safeParse<ProjectTask>((ev as MessageEvent).data);
      if (!task) return;
      setState((prev) => {
        const exists = prev.tasks.some((t) => t.id === task.id);
        return {
          ...prev,
          tasks: exists
            ? prev.tasks.map((t) => (t.id === task.id ? task : t))
            : [task, ...prev.tasks],
        };
      });
    });

    es.addEventListener('org:updated', (ev) => {
      const payload = safeParse<{
        departments: DepartmentRecord[];
        orgPositions: OrgPosition[];
      }>((ev as MessageEvent).data);
      if (!payload) return;
      setState((prev) => ({
        ...prev,
        departments: payload.departments,
        orgPositions: payload.orgPositions,
      }));
    });

    es.addEventListener('finance:updated', (ev) => {
      const entry = safeParse<FinancialEntry>((ev as MessageEvent).data);
      if (!entry) return;
      setState((prev) => {
        const exists = prev.financialEntries.some((f) => f.id === entry.id);
        return exists ? prev : { ...prev, financialEntries: [entry, ...prev.financialEntries] };
      });
    });

    es.addEventListener('governance:updated', (ev) => {
      const rec = safeParse<GovernanceRecord>((ev as MessageEvent).data);
      if (!rec) return;
      setState((prev) => {
        const exists = prev.governance.some((g) => g.id === rec.id);
        return {
          ...prev,
          governance: exists
            ? prev.governance.map((g) => (g.id === rec.id ? rec : g))
            : [rec, ...prev.governance],
        };
      });
    });

    es.addEventListener('state:reset', () => {
      void refreshFromServer(activeRole);
    });

    return () => {
      es.close();
    };
  }, [activeRole, refreshFromServer]);

  const handleChangeRole = (nextRole: UserRole) => {
    setActiveRole(nextRole);
    setActionError(null);
    if (!canAccessModule(nextRole, activeModule)) {
      setActiveModule(getFirstAllowedModule(nextRole));
    }
  };

  const navigateTo = useCallback(
    (
      moduleId: ModuleId,
      extra?: { searchAgentQuery?: string; openNewProject?: boolean; projectId?: string }
    ) => {
      if (!canAccessModule(activeRole, moduleId)) {
        setActionError(
          `Perfil "${ROLE_DEFINITIONS[activeRole].label}" não possui acesso ao módulo solicitado.`
        );
        return;
      }
      setActionError(null);
      if (extra?.searchAgentQuery !== undefined) {
        setAgentSearchSeed(extra.searchAgentQuery);
      }
      if (extra?.openNewProject) {
        setOpenProjectWizard(true);
      }
      if (extra?.projectId) {
        setComposerProjectId(extra.projectId);
      }
      setActiveModule(moduleId);
    },
    [activeRole]
  );

  // Contextual Chat Navigation from Projects / Org / Agents / Tasks
  const handleOpenChat = useCallback(
    async (target: {
      conversationId?: string;
      targetInstanceId?: string;
      projectId?: string;
      departmentId?: string;
    }) => {
      if (!canAccessModule(activeRole, 'chat')) {
        setActionError('Perfil atual não possui acesso ao módulo de Comunicação & Chat.');
        return;
      }
      setActionError(null);

      if (target.conversationId) {
        const existing = state.conversations.find((c) => c.id === target.conversationId);
        if (existing) {
          setSelectedChatConvId(existing.id);
          setActiveModule('chat');
          return;
        }
      }

      if (target.targetInstanceId) {
        const existingDirect = state.conversations.find(
          (c) => c.kind === 'direct_agent' && c.participantIds.includes(target.targetInstanceId!)
        );
        if (existingDirect) {
          setSelectedChatConvId(existingDirect.id);
          setActiveModule('chat');
          return;
        }
        const inst = state.operationalInstances.find((o) => o.id === target.targetInstanceId);
        if (inst) {
          try {
            const res = await EnterpriseApiAdapter.createConversation(activeRole, {
              kind: 'direct_agent',
              title: inst.instanceName,
              subtitle: `${inst.division} · ${inst.projectName}`,
              participantIds: ['per-2', inst.id],
              projectId: inst.projectId,
              departmentId: inst.departmentId,
              contextRef: { kind: 'project', id: inst.projectId, label: inst.projectName },
            });
            setState((prev) => ({
              ...prev,
              conversations: prev.conversations.some((c) => c.id === res.conversation.id)
                ? prev.conversations
                : [res.conversation, ...prev.conversations],
            }));
            setSelectedChatConvId(res.conversation.id);
            setActiveModule('chat');
            return;
          } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Erro ao abrir chat direto.');
            return;
          }
        }
      }

      if (target.projectId) {
        const existingProj = state.conversations.find(
          (c) => c.kind === 'project' && c.projectId === target.projectId
        );
        if (existingProj) {
          setSelectedChatConvId(existingProj.id);
          setActiveModule('chat');
          return;
        }
        const proj = state.projects.find((p) => p.id === target.projectId);
        if (proj) {
          try {
            const res = await EnterpriseApiAdapter.createConversation(activeRole, {
              kind: 'project',
              title: `Canal · ${proj.code} ${proj.name}`,
              participantIds: [...proj.humanTeamIds, ...proj.operationalInstanceIds],
              projectId: proj.id,
              contextRef: { kind: 'project', id: proj.id, label: `${proj.code} · ${proj.name}` },
            });
            setState((prev) => ({
              ...prev,
              conversations: [res.conversation, ...prev.conversations],
            }));
            setSelectedChatConvId(res.conversation.id);
            setActiveModule('chat');
            return;
          } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Erro ao abrir canal do projeto.');
            return;
          }
        }
      }

      if (target.departmentId) {
        const existingDept = state.conversations.find(
          (c) => c.kind === 'department' && c.departmentId === target.departmentId
        );
        if (existingDept) {
          setSelectedChatConvId(existingDept.id);
          setActiveModule('chat');
          return;
        }
        const dept = state.departments.find((d) => d.id === target.departmentId);
        if (dept) {
          try {
            const holderIds = state.orgPositions
              .filter((p) => p.departmentId === dept.id && p.holderId)
              .map((p) => p.holderId!)
              .filter(Boolean);
            const res = await EnterpriseApiAdapter.createConversation(activeRole, {
              kind: 'department',
              title: `Departamento · ${dept.name}`,
              participantIds: holderIds,
              departmentId: dept.id,
              contextRef: { kind: 'department', id: dept.id, label: dept.name },
            });
            setState((prev) => ({
              ...prev,
              conversations: [res.conversation, ...prev.conversations],
            }));
            setSelectedChatConvId(res.conversation.id);
            setActiveModule('chat');
            return;
          } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Erro ao abrir canal do departamento.');
            return;
          }
        }
      }

      setActiveModule('chat');
    },
    [activeRole, state.conversations, state.operationalInstances, state.projects, state.departments, state.orgPositions]
  );

  // Global keyboard shortcuts (Cmd/Ctrl+K and G + <letter>)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }

      if (inInput || commandOpen) return;

      const key = e.key.toLowerCase();
      if (pendingGKeyRef.current) {
        pendingGKeyRef.current = false;
        const map: Record<string, ModuleId> = {
          e: 'executive',
          m: 'chat',
          f: 'finance',
          c: 'commercial',
          p: 'projects',
          a: 'agency-library',
          o: 'operations',
          g: 'governance',
        };
        if (map[key]) {
          e.preventDefault();
          navigateTo(map[key]);
        }
        return;
      }

      if (key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        pendingGKeyRef.current = true;
        setTimeout(() => {
          pendingGKeyRef.current = false;
        }, 900);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandOpen, navigateTo]);

  const handleSyncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await SystemSyncAdapter.pushState('web-browser', {
        projectsCount: state.projects.length,
        governanceCount: state.governance.length,
        financialCount: state.financialEntries.length,
        messagesCount: state.messages.length,
        updatedAt: new Date().toISOString(),
      });
      await refreshFromServer(activeRole);
      setLastSyncedAt(res.updatedAt);
      setSyncQueue((q) => q.map((item) => ({ ...item, synced: true })));
    } catch {
      // Keep items queued if server unreachable
    } finally {
      setIsSyncing(false);
    }
  }, [
    isOnline,
    isSyncing,
    state.projects.length,
    state.governance.length,
    state.financialEntries.length,
    state.messages.length,
    activeRole,
    refreshFromServer,
  ]);

  useEffect(() => {
    const unsynced = syncQueue.some((q) => !q.synced);
    if (isOnline && unsynced) {
      void handleSyncNow();
    }
  }, [isOnline, syncQueue, handleSyncNow]);

  const recordQueue = (action: string) => {
    setSyncQueue((q) => [
      ...q.slice(-19),
      { id: `sq-${Date.now()}`, action, timestamp: new Date().toISOString(), synced: true },
    ]);
  };

  // Authoritative Server Mutations
  const handleCreateProject = async (input: Omit<EnterpriseProject, 'id' | 'code' | 'updatedAt'>) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.createProject(activeRole, input);
      setState((prev) => ({
        ...prev,
        projects: prev.projects.some((p) => p.id === res.project.id)
          ? prev.projects
          : [res.project, ...prev.projects],
      }));
      recordQueue('create_project');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar projeto.';
      setActionError(msg);
      throw err;
    }
  };

  const handleToggleNexusGate = async (projectId: string, gateId: string, passed: boolean) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.toggleNexusGate(activeRole, projectId, gateId, passed);
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === projectId ? res.project : p)),
      }));
      recordQueue('toggle_nexus_gate');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao atualizar gate NEXUS.');
    }
  };

  const handleAddFinancialEntry = async (entry: Omit<FinancialEntry, 'id' | 'origin'>) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.addFinancialEntry(activeRole, entry);
      setState((prev) => ({
        ...prev,
        financialEntries: prev.financialEntries.some((f) => f.id === res.entry.id)
          ? prev.financialEntries
          : [res.entry, ...prev.financialEntries],
      }));
      recordQueue('add_financial_entry');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao registrar lançamento financeiro.');
    }
  };

  const handleCreateTask = async (input: Partial<ProjectTask>) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.createTask(activeRole, input);
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.some((t) => t.id === res.task.id) ? prev.tasks : [res.task, ...prev.tasks],
      }));
      recordQueue('create_task');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar tarefa.';
      setActionError(msg);
      throw err;
    }
  };

  const handleUpdateTask = async (taskId: string, patch: Partial<ProjectTask>) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.updateTask(activeRole, taskId, patch);
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? res.task : t)),
      }));
      recordQueue('update_task');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar tarefa.';
      setActionError(msg);
      throw err;
    }
  };

  const handleSetHomologation = async (agent: AgentBlueprint, status: HomologationStatus) => {
    setActionError(null);
    try {
      await EnterpriseApiAdapter.setHomologation(activeRole, agent.id, status);
      setState((prev) => ({
        ...prev,
        homologationOverrides: { ...prev.homologationOverrides, [agent.id]: status },
      }));
      recordQueue('set_homologation');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao alterar homologação.');
    }
  };

  const handleSaveComposition = async (composition: Omit<TeamCompositionRecord, 'id' | 'createdAt'>) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.saveTeamComposition(activeRole, composition);
      setState((prev) => ({
        ...prev,
        compositions: [res.composition, ...prev.compositions],
        projects: prev.projects.map((p) =>
          p.id === composition.projectId
            ? { ...p, selectedAgentIds: composition.selectedBlueprintIds }
            : p
        ),
      }));
      recordQueue('save_composition');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao salvar composição de equipe.');
    }
  };

  const handleCreateRuntimeInstance = async (input: {
    blueprintId: string;
    projectId: string;
    positionId?: string;
    guardrailPolicy?: string;
    provider?: OperationalAgentInstance['provider'];
    model?: string;
    adapter?: OperationalAgentInstance['adapter'];
    monthlyBudgetBRL?: number;
  }) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.createRuntimeInstance(activeRole, input);
      await refreshFromServer(activeRole);
      recordQueue('create_runtime_instance');
      void res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao instanciar agente.';
      setActionError(msg);
      throw err;
    }
  };

  const handleUpdateRuntimeInstance = async (
    instanceId: string,
    patch: Partial<OperationalAgentInstance>
  ) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.updateRuntimeInstance(activeRole, instanceId, patch);
      setState((prev) => ({
        ...prev,
        operationalInstances: prev.operationalInstances.map((o) =>
          o.id === instanceId ? res.instance : o
        ),
      }));
      recordQueue('update_runtime_instance');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao configurar runtime.';
      setActionError(msg);
      throw err;
    }
  };

  const handleTriggerHeartbeat = async (instanceId: string) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.triggerHeartbeat(activeRole, instanceId);
      setState((prev) => ({
        ...prev,
        operationalInstances: prev.operationalInstances.map((o) =>
          o.id === instanceId ? res.instance : o
        ),
        executionSessions: [res.session, ...prev.executionSessions],
      }));
      recordQueue('trigger_heartbeat');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao executar heartbeat.';
      setActionError(msg);
      throw err;
    }
  };

  const handleCreateDepartment = async (input: {
    code: string;
    name: string;
    description: string;
    budgetAllocatedBRL: number;
  }) => {
    setActionError(null);
    try {
      await EnterpriseApiAdapter.createDepartment(activeRole, input);
      await refreshFromServer(activeRole);
      recordQueue('create_department');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar departamento.';
      setActionError(msg);
      throw err;
    }
  };

  const handleCreatePosition = async (input: Partial<OrgPosition>) => {
    setActionError(null);
    try {
      await EnterpriseApiAdapter.createOrgPosition(activeRole, input);
      await refreshFromServer(activeRole);
      recordQueue('create_position');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar posição.';
      setActionError(msg);
      throw err;
    }
  };

  const handleUpdatePosition = async (positionId: string, patch: Partial<OrgPosition>) => {
    setActionError(null);
    try {
      await EnterpriseApiAdapter.updateOrgPosition(activeRole, positionId, patch);
      await refreshFromServer(activeRole);
      recordQueue('update_position');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar posição.';
      setActionError(msg);
      throw err;
    }
  };

  const handleCreateGovernance = async (input: {
    type: 'DEC' | 'CNS' | 'DELIB';
    title: string;
    summary: string;
    linkedProjectId?: string;
    linkedConversationId?: string;
  }) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.createGovernanceRecord(activeRole, input);
      setState((prev) => ({
        ...prev,
        governance: prev.governance.some((g) => g.id === res.record.id)
          ? prev.governance
          : [res.record, ...prev.governance],
      }));
      recordQueue('create_governance');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao protocolar registro.';
      setActionError(msg);
      throw err;
    }
  };

  const handleApproveGovernance = async (recordId: string) => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.approveGovernanceRecord(activeRole, recordId);
      setState((prev) => ({
        ...prev,
        governance: prev.governance.map((g) => (g.id === recordId ? res.record : g)),
      }));
      recordQueue('approve_governance');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao aprovar governança.');
    }
  };

  // Chat Mutations
  const handleCreateConversation = async (input: {
    kind: ChatConversation['kind'];
    title: string;
    subtitle?: string;
    participantIds: string[];
    projectId?: string;
    departmentId?: string;
    contextRef?: ChatConversation['contextRef'];
  }): Promise<ChatConversation> => {
    const res = await EnterpriseApiAdapter.createConversation(activeRole, input);
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.some((c) => c.id === res.conversation.id)
        ? prev.conversations
        : [res.conversation, ...prev.conversations],
    }));
    return res.conversation;
  };

  const handleSendMessage = async (input: {
    conversationId: string;
    content: string;
    targetInstanceId?: string;
    contextRef?: ChatMessage['contextRef'];
  }) => {
    const res = await EnterpriseApiAdapter.sendMessage(activeRole, input);
    setState((prev) => {
      const toAdd = [res.userMessage, ...(res.agentMessage ? [res.agentMessage] : [])];
      const existingIds = new Set(prev.messages.map((m) => m.id));
      const mergedMessages = [...prev.messages, ...toAdd.filter((m) => !existingIds.has(m.id))];
      const last = toAdd[toAdd.length - 1];
      return {
        ...prev,
        messages: mergedMessages,
        conversations: prev.conversations.map((c) =>
          c.id === input.conversationId && last
            ? {
                ...c,
                lastMessageAt: last.createdAt,
                lastMessagePreview: last.content.slice(0, 120),
                unreadCount: 0,
              }
            : c
        ),
      };
    });
  };

  const handleOrchestrateInterAgent = async (input: {
    sourceInstanceId: string;
    targetInstanceId: string;
    topic: string;
    projectId?: string;
  }): Promise<ChatConversation> => {
    const res = await EnterpriseApiAdapter.orchestrateInterAgent(activeRole, input);
    await refreshFromServer(activeRole);
    return res.conversation;
  };

  const handleConvertMessageToTask = async (
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
  ) => {
    const res = await EnterpriseApiAdapter.convertMessageToTask(activeRole, messageId, input);
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.some((t) => t.id === res.task.id) ? prev.tasks : [res.task, ...prev.tasks],
      messages: prev.messages.map((m) =>
        m.id === messageId ? { ...m, linkedTaskId: res.task.id } : m
      ),
    }));
  };

  const handleMarkAllRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  };

  const handleResetDemo = async () => {
    setActionError(null);
    try {
      const res = await EnterpriseApiAdapter.resetState(activeRole);
      setState(res.state);
      setSyncQueue([]);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Somente Administração ou Direção Executiva pode restaurar a base.'
      );
    }
  };

  const chatUnreadCount = useMemo(
    () => state.conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [state.conversations]
  );

  const renderModule = () => {
    switch (activeModule) {
      case 'executive':
        return (
          <ExecutiveDashboard
            state={state}
            activeRole={activeRole}
            onNavigate={(m) => navigateTo(m)}
            onApproveGovernance={handleApproveGovernance}
          />
        );
      case 'chat':
        return (
          <ChatModule
            state={state}
            activeRole={activeRole}
            initialConversationId={selectedChatConvId}
            onSelectConversationHandled={() => setSelectedChatConvId(undefined)}
            onCreateConversation={handleCreateConversation}
            onSendMessage={handleSendMessage}
            onOrchestrateInterAgent={handleOrchestrateInterAgent}
            onConvertMessageToTask={handleConvertMessageToTask}
            onCreateGovernance={handleCreateGovernance}
            onNavigate={(m, extra) => navigateTo(m, extra)}
          />
        );
      case 'finance':
        return (
          <FinanceModule
            state={state}
            activeRole={activeRole}
            onAddEntry={handleAddFinancialEntry}
            onNavigate={(m) => navigateTo(m)}
          />
        );
      case 'commercial':
        return <CommercialModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'customers':
        return <CustomersModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'marketing':
        return <MarketingModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'products':
        return <ProductsModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'projects':
        return (
          <ProjectsModule
            state={state}
            activeRole={activeRole}
            openWizardInitially={openProjectWizard}
            initialSelectedProjectId={composerProjectId}
            onWizardOpenedHandled={() => setOpenProjectWizard(false)}
            onCreateProject={handleCreateProject}
            onUpdateTask={handleUpdateTask}
            onToggleNexusGate={handleToggleNexusGate}
            onOpenChat={(target) => void handleOpenChat(target)}
            onNavigate={(m, extra) => navigateTo(m, extra)}
          />
        );
      case 'software-factory':
        return <SoftwareFactoryModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'intelligence-factory':
        return <IntelligenceFactoryModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'operations':
        return (
          <OperationsModule
            state={state}
            activeRole={activeRole}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onOpenChat={(target) => void handleOpenChat(target)}
            onNavigate={(m) => navigateTo(m)}
          />
        );
      case 'agency-library':
        return (
          <AgencyLibraryModule
            state={state}
            activeRole={activeRole}
            initialSearch={agentSearchSeed}
            onSetHomologation={handleSetHomologation}
            onOpenChat={(target) => void handleOpenChat(target)}
          />
        );
      case 'team-composer':
        return (
          <TeamComposerModule
            state={state}
            activeRole={activeRole}
            initialProjectId={composerProjectId}
            onSaveComposition={handleSaveComposition}
          />
        );
      case 'operational-agents':
        return (
          <OperationalAgentsModule
            state={state}
            activeRole={activeRole}
            onSetHomologation={handleSetHomologation}
            onCreateRuntimeInstance={handleCreateRuntimeInstance}
            onUpdateRuntimeInstance={handleUpdateRuntimeInstance}
            onTriggerHeartbeat={handleTriggerHeartbeat}
            onOpenChat={(target) => void handleOpenChat(target)}
            onNavigate={(m) => navigateTo(m)}
          />
        );
      case 'people':
        return (
          <PeopleModule
            state={state}
            activeRole={activeRole}
            onCreateDepartment={handleCreateDepartment}
            onCreatePosition={handleCreatePosition}
            onUpdatePosition={handleUpdatePosition}
            onOpenChat={(target) => void handleOpenChat(target)}
          />
        );
      case 'governance':
        return (
          <GovernanceModule
            state={state}
            activeRole={activeRole}
            onCreateRecord={handleCreateGovernance}
            onApproveRecord={handleApproveGovernance}
          />
        );
      case 'admin':
        return (
          <AdminModule
            state={state}
            activeRole={activeRole}
            isDark={isDark}
            accentTheme={accentTheme}
            isOnline={isOnline}
            syncQueue={syncQueue}
            lastSyncedAt={lastSyncedAt}
            onToggleTheme={() => setIsDark((d) => !d)}
            onChangeAccent={setAccentTheme}
            onSyncNow={handleSyncNow}
            onResetDemo={() => void handleResetDemo()}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <AppShell
        activeModule={activeModule}
        activeRole={activeRole}
        onSelectModule={(id) => navigateTo(id)}
        onChangeRole={handleChangeRole}
        onOpenCommandPalette={() => setCommandOpen(true)}
        onOpenChatbot={() => setChatbotOpen(true)}
        onPrimaryAction={() => navigateTo('projects', { openNewProject: true })}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        isOnline={isOnline}
        pendingSyncCount={syncQueue.filter((q) => !q.synced).length}
        isSyncing={isSyncing}
        onSyncNow={handleSyncNow}
        notifications={state.notifications}
        onMarkAllRead={handleMarkAllRead}
        chatUnreadCount={chatUnreadCount}
      >
        {actionError && (
          <div className="mb-4 px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="underline cursor-pointer shrink-0"
            >
              Dispensar
            </button>
          </div>
        )}

        <div key={activeModule} className="transition-opacity duration-150">
          {renderModule()}
        </div>
      </AppShell>

      <CommandPalette
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        destinations={NAV_ITEMS.map((n) => ({
          id: n.id,
          label: n.label,
          group: n.group,
          shortcut: n.shortcut,
        }))}
        projects={state.projects}
        activeRole={activeRole}
        onNavigate={(id, extra) => navigateTo(id, extra)}
        onOpenChat={(target) => void handleOpenChat(target)}
        onToggleTheme={() => setIsDark((d) => !d)}
      />

      <GeminiChatbotDrawer
        isOpen={chatbotOpen}
        onClose={() => setChatbotOpen(false)}
        activeRole={activeRole}
        activeModule={activeModule}
        activeModuleLabel={NAV_ITEMS.find((n) => n.id === activeModule)?.label ?? 'Visão Executiva'}
      />
    </>
  );
}
