import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  AtSign,
  Bot,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  Hash,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Avatar } from '../../components/Common/Avatar';
import { AGENCY_AGENTS_283 } from '../../domain/agencyLibrary';
import { AUTHORITY_LABELS, ROLE_DEFINITIONS } from '../../domain/permissions';
import { formatDateTimeBR } from '../../services/enterpriseService';
import type {
  ChatConversation,
  ChatMessage,
  ConversationKind,
  EnterpriseState,
  MessageLifecycleStatus,
  ModuleId,
  UserRole,
} from '../../types/enterprise';

interface ChatModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  initialConversationId?: string;
  onSelectConversationHandled?: () => void;
  onCreateConversation: (input: {
    kind: ChatConversation['kind'];
    title: string;
    subtitle?: string;
    participantIds: string[];
    projectId?: string;
    departmentId?: string;
    contextRef?: ChatConversation['contextRef'];
  }) => Promise<ChatConversation>;
  onSendMessage: (input: {
    conversationId: string;
    content: string;
    targetInstanceId?: string;
    contextRef?: ChatMessage['contextRef'];
  }) => Promise<void>;
  onOrchestrateInterAgent: (input: {
    sourceInstanceId: string;
    targetInstanceId: string;
    topic: string;
    projectId?: string;
  }) => Promise<ChatConversation>;
  onConvertMessageToTask: (
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
  ) => Promise<void>;
  onCreateGovernance: (input: {
    type: 'DEC' | 'CNS' | 'DELIB';
    title: string;
    summary: string;
    linkedProjectId?: string;
    linkedConversationId?: string;
  }) => Promise<void>;
  onNavigate: (moduleId: ModuleId, extra?: { projectId?: string }) => void;
}

type InboxFilter = 'all' | 'unread' | 'mentions' | 'direct_agent' | 'channels' | 'inter_agent';

const LIFECYCLE_LABELS: Record<MessageLifecycleStatus, { label: string; tone: string }> = {
  created: { label: 'Criada', tone: 'text-ink-subtle' },
  delivered: { label: 'Entregue', tone: 'text-ink-subtle' },
  execution_requested: { label: 'Execução solicitada', tone: 'text-amber-700 dark:text-amber-400' },
  agent_processing: { label: 'Agente processando', tone: 'text-amber-700 dark:text-amber-400' },
  response_received: { label: 'Resposta recebida', tone: 'text-emerald-700 dark:text-emerald-400' },
  execution_completed: { label: 'Execução concluída', tone: 'text-emerald-700 dark:text-emerald-400' },
  execution_failed: { label: 'Falha na execução', tone: 'text-red-600 dark:text-red-400' },
  integration_pending: { label: 'Integração pendente', tone: 'text-amber-700 dark:text-amber-400' },
};

const KIND_LABELS: Record<ConversationKind, string> = {
  direct_agent: '1:1 Agente',
  inter_agent: 'Inter-Agentes',
  project: 'Projeto',
  department: 'Departamento',
  committee: 'Comitê',
};

export const ChatModule: React.FC<ChatModuleProps> = ({
  state,
  activeRole,
  initialConversationId,
  onSelectConversationHandled,
  onCreateConversation,
  onSendMessage,
  onOrchestrateInterAgent,
  onConvertMessageToTask,
  onCreateGovernance,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string>(
    initialConversationId || state.conversations[0]?.id || ''
  );
  const [readOverrides, setReadOverrides] = useState<Record<string, boolean>>({});

  // Composer state
  const [draft, setDraft] = useState('');
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Modals: New Conversation / Inter-Agent Orchestration / Task Conversion / Governance
  const [showNewConv, setShowNewConv] = useState(false);
  const [newKind, setNewKind] = useState<ConversationKind>('direct_agent');
  const [newTitle, setNewTitle] = useState('');
  const [newAgentId, setNewAgentId] = useState(state.operationalInstances[0]?.id ?? '');
  const [newProjectId, setNewProjectId] = useState(state.projects[0]?.id ?? '');
  const [newDepartmentId, setNewDepartmentId] = useState(state.departments[0]?.id ?? '');

  const [showInterAgent, setShowInterAgent] = useState(false);
  const [srcAgentId, setSrcAgentId] = useState(state.operationalInstances[0]?.id ?? '');
  const [tgtAgentId, setTgtAgentId] = useState(
    state.operationalInstances[1]?.id ?? state.operationalInstances[0]?.id ?? ''
  );
  const [interTopic, setInterTopic] = useState('');
  const [interProjectId, setInterProjectId] = useState(state.projects[0]?.id ?? '');
  const [orchestrating, setOrchestrating] = useState(false);

  const [taskModalMsg, setTaskModalMsg] = useState<ChatMessage | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigneeKey, setTaskAssigneeKey] = useState('');
  const [taskCriteria, setTaskCriteria] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  );

  const [govModalMsg, setGovModalMsg] = useState<ChatMessage | null>(null);
  const [govType, setGovType] = useState<'DEC' | 'CNS' | 'DELIB'>('DEC');
  const [govTitle, setGovTitle] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const roleDef = ROLE_DEFINITIONS[activeRole];

  useEffect(() => {
    if (initialConversationId) {
      setSelectedConvId(initialConversationId);
      setReadOverrides((prev) => ({ ...prev, [initialConversationId]: true }));
      onSelectConversationHandled?.();
    }
  }, [initialConversationId, onSelectConversationHandled]);

  const sortedConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...state.conversations]
      .filter((c) => {
        const effectiveUnread = readOverrides[c.id] ? 0 : c.unreadCount;
        if (filter === 'unread' && effectiveUnread === 0) return false;
        if (filter === 'mentions' && c.mentionsCount === 0) return false;
        if (filter === 'direct_agent' && c.kind !== 'direct_agent') return false;
        if (filter === 'inter_agent' && c.kind !== 'inter_agent') return false;
        if (
          filter === 'channels' &&
          c.kind !== 'project' &&
          c.kind !== 'department' &&
          c.kind !== 'committee'
        ) {
          return false;
        }
        if (!q) return true;
        return (
          c.title.toLowerCase().includes(q) ||
          c.subtitle.toLowerCase().includes(q) ||
          c.lastMessagePreview.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
  }, [state.conversations, filter, search, readOverrides]);

  const activeConv =
    state.conversations.find((c) => c.id === selectedConvId) ??
    sortedConversations[0] ??
    state.conversations[0];

  const threadMessages = useMemo(() => {
    if (!activeConv) return [];
    return state.messages
      .filter((m) => m.conversationId === activeConv.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [state.messages, activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [threadMessages.length, activeConv?.id]);

  // Agents present in current conversation (for direct response or @mention targeting)
  const channelAgents = useMemo(() => {
    if (!activeConv) return [];
    return state.operationalInstances.filter((inst) => activeConv.participantIds.includes(inst.id));
  }, [activeConv, state.operationalInstances]);

  useEffect(() => {
    if (!activeConv) {
      setTargetAgentId('');
      return;
    }
    if (activeConv.kind === 'direct_agent') {
      const ag = channelAgents[0];
      setTargetAgentId(ag?.id ?? '');
    } else {
      setTargetAgentId('');
    }
  }, [activeConv?.id]);

  const primaryAgent = useMemo(() => {
    if (!activeConv) return undefined;
    const id = targetAgentId || channelAgents[0]?.id;
    return state.operationalInstances.find((o) => o.id === id);
  }, [activeConv, targetAgentId, channelAgents, state.operationalInstances]);

  const primaryPosition = primaryAgent?.positionId
    ? state.orgPositions.find((p) => p.id === primaryAgent.positionId)
    : undefined;
  const primaryDepartment = primaryPosition
    ? state.departments.find((d) => d.id === primaryPosition.departmentId)
    : primaryAgent?.departmentId
    ? state.departments.find((d) => d.id === primaryAgent.departmentId)
    : undefined;
  const primaryBlueprint = primaryAgent
    ? AGENCY_AGENTS_283.find((b) => b.id === primaryAgent.blueprintId)
    : undefined;

  const handleSelectConv = (convId: string) => {
    setSelectedConvId(convId);
    setReadOverrides((prev) => ({ ...prev, [convId]: true }));
    setFeedback(null);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeConv || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    setFeedback(null);
    try {
      await onSendMessage({
        conversationId: activeConv.id,
        content: text,
        targetInstanceId: targetAgentId || undefined,
        contextRef: activeConv.contextRef,
      });
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleCreateNewConv = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      let title = newTitle.trim();
      let participantIds: string[] = ['per-1'];
      let projectId: string | undefined;
      let departmentId: string | undefined;
      let contextRef: ChatConversation['contextRef'] | undefined;

      if (newKind === 'direct_agent') {
        const inst = state.operationalInstances.find((o) => o.id === newAgentId);
        if (!inst) return;
        title = title || inst.instanceName;
        participantIds = ['per-2', inst.id];
        projectId = inst.projectId;
        departmentId = inst.departmentId;
        contextRef = { kind: 'project', id: inst.projectId, label: inst.projectName };
      } else if (newKind === 'project') {
        const proj = state.projects.find((p) => p.id === newProjectId);
        if (!proj) return;
        title = title || `Canal · ${proj.code} ${proj.name}`;
        participantIds = [...proj.humanTeamIds, ...proj.operationalInstanceIds];
        projectId = proj.id;
        contextRef = { kind: 'project', id: proj.id, label: `${proj.code} · ${proj.name}` };
      } else if (newKind === 'department') {
        const dept = state.departments.find((d) => d.id === newDepartmentId);
        if (!dept) return;
        title = title || `Departamento · ${dept.name}`;
        const deptPositions = state.orgPositions.filter((p) => p.departmentId === dept.id && p.holderId);
        participantIds = deptPositions.map((p) => p.holderId!).filter(Boolean);
        departmentId = dept.id;
        contextRef = { kind: 'department', id: dept.id, label: dept.name };
      }

      const conv = await onCreateConversation({
        kind: newKind,
        title: title || 'Novo Canal Operacional',
        participantIds,
        projectId,
        departmentId,
        contextRef,
      });
      setSelectedConvId(conv.id);
      setShowNewConv(false);
      setNewTitle('');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Falha ao abrir conversa.');
    }
  };

  const handleOrchestrate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srcAgentId || !tgtAgentId || srcAgentId === tgtAgentId || !interTopic.trim()) {
      setFeedback('Selecione dois agentes distintos e informe o tópico operacional.');
      return;
    }
    setOrchestrating(true);
    setFeedback(null);
    try {
      const conv = await onOrchestrateInterAgent({
        sourceInstanceId: srcAgentId,
        targetInstanceId: tgtAgentId,
        topic: interTopic.trim(),
        projectId: interProjectId || undefined,
      });
      setSelectedConvId(conv.id);
      setShowInterAgent(false);
      setInterTopic('');
      setFeedback('Diálogo inter-agentes executado no servidor e registrado na Auditoria.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Falha na orquestração inter-agentes.');
    } finally {
      setOrchestrating(false);
    }
  };

  const openConvertTask = (msg: ChatMessage) => {
    setTaskModalMsg(msg);
    setTaskTitle(msg.content.slice(0, 80));
    setTaskCriteria('Entrega validada com evidência objetiva pelo solicitante.');
    const defaultHuman = state.people[1] ?? state.people[0];
    setTaskAssigneeKey(defaultHuman ? `humano:${defaultHuman.id}` : '');
  };

  const handleConfirmTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskModalMsg) return;
    const [kind, id] = taskAssigneeKey.split(':');
    const assigneeName =
      kind === 'agente_operacional'
        ? state.operationalInstances.find((o) => o.id === id)?.instanceName ?? 'Agente'
        : state.people.find((p) => p.id === id)?.name ?? 'Responsável';

    try {
      await onConvertMessageToTask(taskModalMsg.id, {
        projectId: activeConv?.projectId || state.projects[0]?.id,
        title: taskTitle.trim(),
        assigneeId: id,
        assigneeKind: (kind as 'humano' | 'agente_operacional') || 'humano',
        assigneeName,
        dueDate: taskDueDate,
        completionCriteria: taskCriteria.trim(),
      });
      setTaskModalMsg(null);
      setFeedback(`Mensagem convertida em tarefa delegada para ${assigneeName}.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao converter mensagem em tarefa.');
    }
  };

  const openGovernanceModal = (msg: ChatMessage) => {
    setGovModalMsg(msg);
    setGovTitle(`Deliberação originada de "${activeConv?.title ?? 'Chat'}"`);
  };

  const handleConfirmGovernance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!govModalMsg || !govTitle.trim()) return;
    try {
      await onCreateGovernance({
        type: govType,
        title: govTitle.trim(),
        summary: `Originado no chat (${govModalMsg.senderName}): ${govModalMsg.content}`,
        linkedProjectId: activeConv?.projectId,
        linkedConversationId: activeConv?.id,
      });
      setGovModalMsg(null);
      setFeedback(`Registro ${govType} protocolado no Portal de Governança.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao protocolar governança.');
    }
  };

  const insertMention = (agentName: string, agentId: string) => {
    setTargetAgentId(agentId);
    setDraft((prev) => (prev.includes(`@${agentName}`) ? prev : `${prev ? `${prev} ` : ''}@${agentName} `));
  };

  const openContextModule = () => {
    if (!activeConv?.contextRef) return;
    switch (activeConv.contextRef.kind) {
      case 'project':
        onNavigate('projects', { projectId: activeConv.contextRef.id });
        break;
      case 'department':
        onNavigate('people');
        break;
      case 'governance':
        onNavigate('governance');
        break;
      case 'task':
        onNavigate('operations');
        break;
      default:
        onNavigate('operational-agents');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Strip */}
      <div className="p-4 rounded-xl border border-line bg-surface flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            Comunicação Operacional Nativa & Orquestração
          </h2>
          <p className="text-xs text-ink-subtle">
            Chat persistente em tempo real com agentes operacionais, departamentos, projetos e comitês (execução real via Gemini Server-Side)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {roleDef.canOrchestrateInterAgent && (
            <button
              type="button"
              onClick={() => {
                setShowInterAgent((s) => !s);
                setShowNewConv(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-canvas hover:border-accent text-xs font-semibold text-ink cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              Orquestrar Inter-Agentes
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setShowNewConv((s) => !s);
              setShowInterAgent(false);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Nova Conversa
          </button>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg border border-accent/40 bg-accent-soft/60 text-xs text-ink flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-ink-muted hover:text-ink cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* New Conversation Drawer */}
      {showNewConv && (
        <form onSubmit={handleCreateNewConv} className="p-4 rounded-xl border border-line bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-ink">Abrir Nova Conversa ou Canal</h3>
            <button type="button" onClick={() => setShowNewConv(false)} className="text-ink-muted hover:text-ink cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[11px] text-ink-subtle mb-1">Tipo de Canal</label>
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as ConversationKind)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              >
                <option value="direct_agent">1:1 com Agente Operacional</option>
                <option value="project">Canal de Projeto</option>
                <option value="department">Canal de Departamento</option>
              </select>
            </div>

            {newKind === 'direct_agent' && (
              <div>
                <label className="block text-[11px] text-ink-subtle mb-1">Instância Operacional</label>
                <select
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
                >
                  {state.operationalInstances.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.instanceName} ({o.blueprintCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newKind === 'project' && (
              <div>
                <label className="block text-[11px] text-ink-subtle mb-1">Projeto</label>
                <select
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
                >
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newKind === 'department' && (
              <div>
                <label className="block text-[11px] text-ink-subtle mb-1">Departamento</label>
                <select
                  value={newDepartmentId}
                  onChange={(e) => setNewDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
                >
                  {state.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] text-ink-subtle mb-1">Título (opcional)</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Preenchido automaticamente se vazio"
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
            >
              Criar Conversa
            </button>
          </div>
        </form>
      )}

      {/* Inter-Agent Orchestration Drawer */}
      {showInterAgent && (
        <form onSubmit={handleOrchestrate} className="p-4 rounded-xl border border-accent/40 bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-ink">
                Orquestração Operacional Inter-Agentes (2 Turnos Auditados)
              </h3>
              <p className="text-[11px] text-ink-subtle">
                Os dois agentes dialogam respeitando suas posições organizacionais, limitações e escopo do projeto.
              </p>
            </div>
            <button type="button" onClick={() => setShowInterAgent(false)} className="text-ink-muted hover:text-ink cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="block text-[11px] text-ink-subtle mb-1">Agente Solicitante</label>
              <select
                value={srcAgentId}
                onChange={(e) => setSrcAgentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              >
                {state.operationalInstances.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.instanceName}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] text-ink-subtle mb-1">Agente Destinatário</label>
              <select
                value={tgtAgentId}
                onChange={(e) => setTgtAgentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              >
                {state.operationalInstances.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.instanceName}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] text-ink-subtle mb-1">Projeto</label>
              <select
                value={interProjectId}
                onChange={(e) => setInterProjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              >
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4 flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-[11px] text-ink-subtle mb-1">Tópico da Interação</label>
                <input
                  type="text"
                  required
                  value={interTopic}
                  onChange={(e) => setInterTopic(e.target.value)}
                  placeholder="Ex.: Validar cobertura E2E do contrato de conciliação"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
                />
              </div>
              <button
                type="submit"
                disabled={orchestrating}
                className="px-3.5 py-2 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {orchestrating ? 'Executando...' : 'Iniciar'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Main Split Inbox + Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-[620px]">
        {/* Left Inbox */}
        <aside className="lg:col-span-4 rounded-xl border border-line bg-surface flex flex-col overflow-hidden">
          <div className="p-3 border-b border-line space-y-2.5">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversas, agentes ou projetos..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
            />
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
              {(
                [
                  { id: 'all', label: 'Todas' },
                  { id: 'unread', label: 'Não lidas' },
                  { id: 'mentions', label: 'Menções' },
                  { id: 'direct_agent', label: '1:1 Agentes' },
                  { id: 'channels', label: 'Canais' },
                  { id: 'inter_agent', label: 'Inter-Agentes' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md whitespace-nowrap cursor-pointer ${
                    filter === tab.id
                      ? 'bg-accent-soft text-accent-ink font-semibold'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-subtle'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {sortedConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-subtle">
                Nenhuma conversa corresponde aos filtros atuais.
              </div>
            ) : (
              sortedConversations.map((conv) => {
                const active = activeConv?.id === conv.id;
                const effectiveUnread = readOverrides[conv.id] ? 0 : conv.unreadCount;
                const agentPart = conv.participants.find((p) => p.kind === 'agente_operacional');

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConv(conv.id)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                      active ? 'bg-accent-soft/50' : 'hover:bg-surface-subtle/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-ink-subtle">
                      <span className="font-mono text-accent font-medium">
                        {KIND_LABELS[conv.kind]}
                      </span>
                      <div className="flex items-center gap-2 tabular-nums">
                        {conv.mentionsCount > 0 && (
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">@ {conv.mentionsCount}</span>
                        )}
                        {effectiveUnread > 0 && (
                          <span className="min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-mono font-semibold inline-flex items-center justify-center">
                            {effectiveUnread}
                          </span>
                        )}
                        <span>{formatDateTimeBR(conv.lastMessageAt)}</span>
                      </div>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      {agentPart?.emoji && <span className="text-sm">{agentPart.emoji}</span>}
                      <p className="text-sm font-semibold text-ink truncate">{conv.title}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">{conv.lastMessagePreview}</p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Thread */}
        <section className="lg:col-span-8 rounded-xl border border-line bg-surface flex flex-col overflow-hidden">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-ink-subtle">
              Selecione ou crie uma conversa para iniciar a comunicação operacional.
            </div>
          ) : (
            <>
              {/* Identity & Hierarchy Header */}
              <div className="p-4 border-b border-line bg-surface-subtle/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {primaryAgent ? (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg border border-line bg-surface shrink-0"
                      style={{ borderColor: primaryBlueprint?.color || undefined }}
                    >
                      {primaryBlueprint?.emoji || '🤖'}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-line bg-surface shrink-0">
                      {activeConv.kind === 'project' ? (
                        <FolderKanban className="w-4 h-4 text-accent" />
                      ) : activeConv.kind === 'department' ? (
                        <Users className="w-4 h-4 text-accent" />
                      ) : (
                        <Hash className="w-4 h-4 text-accent" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-bold text-ink truncate">
                        {activeConv.title}
                      </h3>
                      {primaryAgent && (
                        <span className="font-mono text-[11px] text-accent">
                          {primaryAgent.blueprintCode} · {primaryAgent.model}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted truncate">
                      {primaryPosition
                        ? `${primaryPosition.title} · ${primaryDepartment?.name ?? ''} · ${AUTHORITY_LABELS[primaryPosition.authorityLevel]}`
                        : activeConv.subtitle}
                    </p>
                    {primaryAgent && (
                      <p className="text-[11px] text-ink-subtle tabular-nums mt-0.5">
                        Estado: <strong className="text-ink">{primaryAgent.executionState.replace(/_/g, ' ')}</strong>
                        {' · '}Adaptador: <span className="font-mono">{primaryAgent.adapter}</span>
                        {' · '}Orçamento: R$ {primaryAgent.spentBudgetBRL.toFixed(2)} / R$ {primaryAgent.monthlyBudgetBRL}
                      </p>
                    )}
                  </div>
                </div>

                {activeConv.contextRef && (
                  <button
                    type="button"
                    onClick={openContextModule}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface hover:border-accent text-xs font-medium text-ink shrink-0 cursor-pointer"
                  >
                    <span>{activeConv.contextRef.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-accent" />
                  </button>
                )}
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[430px]">
                {threadMessages.length === 0 ? (
                  <p className="text-xs text-ink-subtle text-center py-10">
                    Nenhuma mensagem registrada nesta conversa ainda. Envie a primeira instrução abaixo.
                  </p>
                ) : (
                  threadMessages.map((msg) => {
                    const isAgent = msg.senderKind === 'agente_operacional';
                    const person = !isAgent ? state.people.find((p) => p.id === msg.senderId) : undefined;
                    const lifecycle = LIFECYCLE_LABELS[msg.lifecycleStatus];
                    const linkedTask = msg.linkedTaskId
                      ? state.tasks.find((t) => t.id === msg.linkedTaskId)
                      : undefined;
                    const linkedGov = msg.linkedGovernanceId
                      ? state.governance.find((g) => g.id === msg.linkedGovernanceId)
                      : undefined;

                    return (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-xl border space-y-2 ${
                          isAgent
                            ? 'border-line bg-canvas'
                            : 'border-line bg-surface-subtle/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {isAgent ? (
                              <Bot className="w-4 h-4 text-accent shrink-0" />
                            ) : (
                              <Avatar name={msg.senderName} src={person?.avatarUrl} size="sm" />
                            )}
                            <span className="font-semibold text-ink">{msg.senderName}</span>
                            <span className="text-ink-subtle">· {msg.senderRole}</span>
                            {msg.recipientName && (
                              <span className="text-ink-subtle">→ {msg.recipientName}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] tabular-nums">
                            <span className={`font-medium ${lifecycle.tone}`}>
                              {lifecycle.label}
                            </span>
                            {msg.modelUsed && (
                              <span className="font-mono text-ink-subtle">· {msg.modelUsed}</span>
                            )}
                            <span className="font-mono text-ink-subtle">
                              {formatDateTimeBR(msg.createdAt)}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>

                        {/* Provenance & Action Conversion Bar */}
                        <div className="pt-2 border-t border-line/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex flex-wrap items-center gap-3 text-ink-subtle">
                            {msg.sessionId && (
                              <span className="font-mono">sessão:{msg.sessionId}</span>
                            )}
                            {linkedTask && (
                              <button
                                type="button"
                                onClick={() => onNavigate('operations')}
                                className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Tarefa vinculada: {linkedTask.title.slice(0, 40)}
                              </button>
                            )}
                            {linkedGov && (
                              <button
                                type="button"
                                onClick={() => onNavigate('governance')}
                                className="inline-flex items-center gap-1 text-accent font-medium hover:underline cursor-pointer"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                {linkedGov.code}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {roleDef.canEditProjects && !msg.linkedTaskId && (
                              <button
                                type="button"
                                onClick={() => openConvertTask(msg)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line bg-surface hover:border-accent text-ink-muted hover:text-ink cursor-pointer"
                              >
                                <ClipboardList className="w-3 h-3" />
                                Delegar como Tarefa
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openGovernanceModal(msg)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line bg-surface hover:border-accent text-ink-muted hover:text-ink cursor-pointer"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              Enviar para DEC/CNS
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <form onSubmit={handleSend} className="p-3.5 border-t border-line bg-surface-subtle/30 space-y-2.5">
                {activeConv.kind !== 'direct_agent' && channelAgents.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-ink-subtle flex items-center gap-1">
                      <AtSign className="w-3 h-3" />
                      Acionar agente no canal:
                    </span>
                    <button
                      type="button"
                      onClick={() => setTargetAgentId('')}
                      className={`px-2 py-0.5 rounded border cursor-pointer ${
                        !targetAgentId
                          ? 'border-accent bg-accent-soft text-accent-ink font-semibold'
                          : 'border-line text-ink-muted'
                      }`}
                    >
                      Apenas registrar no canal
                    </button>
                    {channelAgents.map((ag) => (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => insertMention(ag.instanceName, ag.id)}
                        className={`px-2 py-0.5 rounded border cursor-pointer ${
                          targetAgentId === ag.id
                            ? 'border-accent bg-accent-soft text-accent-ink font-semibold'
                            : 'border-line text-ink-muted hover:text-ink'
                        }`}
                      >
                        @{ag.instanceName}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={
                      primaryAgent && (activeConv.kind === 'direct_agent' || targetAgentId)
                        ? `Enviar solicitação operacional para ${primaryAgent.instanceName} (Enter envia)...`
                        : 'Escrever atualização, instrução ou menção @Agente no canal...'
                    }
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink focus:outline-none focus:border-accent resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sending ? 'Processando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Modal: Convert Message to Task */}
      {taskModalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40" onClick={() => setTaskModalMsg(null)}>
          <form
            onSubmit={handleConfirmTask}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg p-5 rounded-2xl nc-glass-window space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Converter Mensagem em Tarefa Delegada</h3>
              <button type="button" onClick={() => setTaskModalMsg(null)} className="text-ink-muted hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-subtle mb-1">Título da Tarefa</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-subtle mb-1">Responsável (Humano ou Agente)</label>
                  <select
                    value={taskAssigneeKey}
                    onChange={(e) => setTaskAssigneeKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                  >
                    <optgroup label="Colaboradores Humanos">
                      {state.people.map((p) => (
                        <option key={p.id} value={`humano:${p.id}`}>
                          {p.name} ({p.roleTitle})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Agentes Operacionais (Paperclip)">
                      {state.operationalInstances.map((o) => (
                        <option key={o.id} value={`agente_operacional:${o.id}`}>
                          {o.instanceName} ({o.blueprintCode})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-subtle mb-1">Prazo</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Critério Objetivo de Conclusão</label>
                <input
                  type="text"
                  required
                  value={taskCriteria}
                  onChange={(e) => setTaskCriteria(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTaskModalMsg(null)} className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer">
                Delegar Tarefa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Send Message to Governance */}
      {govModalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40" onClick={() => setGovModalMsg(null)}>
          <form
            onSubmit={handleConfirmGovernance}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg p-5 rounded-2xl nc-glass-window space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Protocolar no Portal de Governança</h3>
              <button type="button" onClick={() => setGovModalMsg(null)} className="text-ink-muted hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-subtle mb-1">Tipo de Documento</label>
                <select
                  value={govType}
                  onChange={(e) => setGovType(e.target.value as 'DEC' | 'CNS' | 'DELIB')}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                >
                  <option value="DEC">DEC — Decisão Executiva</option>
                  <option value="CNS">CNS — Deliberação de Conselho</option>
                  <option value="DELIB">DELIB — Documento Deliberativo</option>
                </select>
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={govTitle}
                  onChange={(e) => setGovTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
              <p className="p-2.5 rounded-lg border border-line bg-canvas text-ink-muted">
                Trecho vinculado: &ldquo;{govModalMsg.content.slice(0, 180)}&rdquo;
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setGovModalMsg(null)} className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer">
                Protocolar Registro
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
