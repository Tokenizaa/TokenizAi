import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, MessageSquare, Plus, Send, X } from 'lucide-react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import { formatDateBR, formatDateTimeBR } from '../../services/enterpriseService';
import type {
  EnterpriseState,
  GovernanceRecord,
  ModuleId,
  OperationalAgentInstance,
  ProjectPriority,
  ProjectTask,
  TaskLifecycleStatus,
  UserRole,
} from '../../types/enterprise';

interface OperationsModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  onCreateTask: (input: Partial<ProjectTask>) => Promise<void>;
  onUpdateTask: (taskId: string, patch: Partial<ProjectTask>) => Promise<void>;
  onAddTaskComment: (taskId: string, text: string) => Promise<void>;
  onEscalateTask: (
    taskId: string,
    reason: string
  ) => Promise<{ task: ProjectTask; governanceRecord: GovernanceRecord; escalatedTo: string }>;
  onOpenChat: (target: { conversationId?: string }) => void;
  onNavigate: (moduleId: ModuleId) => void;
}

const TASK_STATUS_LIST: Array<{ id: TaskLifecycleStatus; label: string }> = [
  { id: 'planejada', label: 'Planejada' },
  { id: 'atribuida', label: 'Atribuída' },
  { id: 'em_execucao', label: 'Em Execução' },
  { id: 'bloqueada', label: 'Bloqueada' },
  { id: 'em_revisao', label: 'Em Revisão' },
  { id: 'concluida', label: 'Concluída' },
  { id: 'cancelada', label: 'Cancelada' },
];

export const OperationsModule: React.FC<OperationsModuleProps> = ({
  state,
  activeRole,
  onCreateTask,
  onUpdateTask,
  onAddTaskComment,
  onEscalateTask,
  onOpenChat,
  onNavigate,
}) => {
  const [statusFilter, setStatusFilter] = useState<'todas' | TaskLifecycleStatus>('todas');
  const [showNewForm, setShowNewForm] = useState(false);

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '');
  const [assigneeKey, setAssigneeKey] = useState(
    state.operationalInstances[0] ? `agente_operacional:${state.operationalInstances[0].id}` : ''
  );
  const [priority, setPriority] = useState<ProjectPriority>('alta');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
  const [criteria, setCriteria] = useState('Entrega revisada com evidência objetiva.');

  const [closingTask, setClosingTask] = useState<ProjectTask | null>(null);
  const [evidenceInput, setEvidenceInput] = useState('');
  const [escalatingTask, setEscalatingTask] = useState<ProjectTask | null>(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const canEdit = ROLE_DEFINITIONS[activeRole].canEditProjects;

  const openTasks = state.tasks.filter(
    (t) => t.status !== 'concluida' && t.status !== 'cancelada'
  );
  const blockedTasks = state.tasks.filter((t) => t.status === 'bloqueada');
  const openIncidents = state.incidents.filter((i) => i.status === 'aberto');

  const filteredTasks = useMemo(
    () => state.tasks.filter((t) => statusFilter === 'todas' || t.status === statusFilter),
    [state.tasks, statusFilter]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    const [kind, id] = assigneeKey.split(':');
    const assigneeName =
      kind === 'agente_operacional'
        ? state.operationalInstances.find((o) => o.id === id)?.instanceName ?? 'Agente'
        : state.people.find((p) => p.id === id)?.name ?? 'A definir';

    try {
      await onCreateTask({
        title: title.trim(),
        projectId,
        assigneeId: id || undefined,
        assigneeKind: (kind as 'humano' | 'agente_operacional') || 'humano',
        assigneeName,
        priority,
        dueDate,
        completionCriteria: criteria.trim(),
      });
      setTitle('');
      setShowNewForm(false);
      setFeedback(`Tarefa criada e delegada para ${assigneeName}.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar tarefa.');
    }
  };

  const handleStatusChange = async (tsk: ProjectTask, nextStatus: TaskLifecycleStatus) => {
    setFeedback(null);
    if (nextStatus === 'concluida' && !tsk.completionEvidence?.trim()) {
      setClosingTask(tsk);
      setEvidenceInput('');
      return;
    }
    try {
      await onUpdateTask(tsk.id, { status: nextStatus });
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao atualizar tarefa.');
    }
  };

  const handleConfirmEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingTask || !evidenceInput.trim()) return;
    try {
      await onUpdateTask(closingTask.id, {
        status: 'concluida',
        completionEvidence: evidenceInput.trim(),
      });
      setClosingTask(null);
      setEvidenceInput('');
      setFeedback('Tarefa concluída com evidência registrada.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao concluir tarefa.');
    }
  };

  const handleConfirmEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalatingTask || !escalationReason.trim()) return;
    try {
      const res = await onEscalateTask(escalatingTask.id, escalationReason.trim());
      setEscalatingTask(null);
      setEscalationReason('');
      setFeedback(
        `Tarefa escalonada para ${res.escalatedTo} e protocolada em Governança (${res.governanceRecord.code}).`
      );
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao escalonar tarefa.');
    }
  };

  const handlePostComment = async (taskId: string) => {
    if (!commentDraft.trim()) return;
    try {
      await onAddTaskComment(taskId, commentDraft.trim());
      setCommentDraft('');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao publicar comentário.');
    }
  };

  return (
    <div className="space-y-8">
      <DataOriginNotice
        sourceLabel="Gestão nativa de tarefas, delegação humano/agente, critérios de conclusão e evidência obrigatória"
        pendingIntegration="Paperclip External Runtime (opcional)"
        onConfigureIntegration={onNavigate}
      />

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg border border-accent/40 bg-accent-soft/60 text-xs text-ink flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-ink-muted cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="p-6 rounded-2xl border border-line bg-surface">
          <p className="text-xs font-medium text-ink-subtle">Tarefas Ativas</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink tabular-nums">
            {openTasks.length}
          </p>
        </div>
        <div className="p-6 rounded-2xl border border-line bg-surface">
          <p className="text-xs font-medium text-ink-subtle">Bloqueadas</p>
          <p className="mt-2 font-display text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {blockedTasks.length}
          </p>
        </div>
        <div className="p-6 rounded-2xl border border-line bg-surface">
          <p className="text-xs font-medium text-ink-subtle">Incidentes Abertos</p>
          <p className="mt-2 font-display text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
            {openIncidents.length}
          </p>
        </div>
        <div className="p-6 rounded-2xl border border-line bg-surface">
          <p className="text-xs font-medium text-ink-subtle">Agentes em Operação</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink tabular-nums">
            {state.operationalInstances.length}
          </p>
        </div>
      </div>

      {/* Live Agent Heartbeat Cards */}
      <section className="p-6 rounded-2xl border border-line bg-surface space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-accent" />
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Agentes em Operação · Atividade de Heartbeat
              </h2>
              <p className="text-sm text-ink-subtle">
                Pulso codificado por cor indicando disponibilidade, espera de runtime ou pausa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('operational-agents')}
            className="px-3.5 py-2 rounded-xl border border-line bg-canvas text-xs font-semibold text-ink hover:border-accent cursor-pointer"
          >
            Gerenciar Heartbeats
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {state.operationalInstances.map((inst: OperationalAgentInstance) => {
            const isReady = inst.executionState === 'ativo_pronto';
            const isPaused = inst.executionState === 'pausado';
            const coreColor = isReady ? 'bg-emerald-500' : isPaused ? 'bg-rose-500' : 'bg-amber-500';
            const ringColor = isReady
              ? 'bg-emerald-400/65'
              : isPaused
              ? 'bg-rose-400/20'
              : 'bg-amber-400/55';
            const statusTextClass = isReady
              ? 'text-emerald-700 dark:text-emerald-300'
              : isPaused
              ? 'text-rose-700 dark:text-rose-300'
              : 'text-amber-700 dark:text-amber-300';
            const statusLabel = isReady
              ? 'Ativo · Heartbeat nominal'
              : isPaused
              ? 'Pausado'
              : 'Aguardando runtime';

            return (
              <div
                key={inst.id}
                className="p-4 rounded-xl border border-line bg-canvas flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-accent truncate">
                      {inst.blueprintCode} · {inst.projectName}
                    </p>
                    <p className="text-base font-semibold text-ink truncate mt-0.5">
                      {inst.instanceName}
                    </p>
                    <p className="text-xs text-ink-muted truncate">{inst.model}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 shrink-0 pt-0.5">
                    <span className="nc-heartbeat-indicator" aria-hidden="true">
                      {!isPaused && <span className={`nc-heartbeat-ring ${ringColor}`} />}
                      <span className={`nc-heartbeat-core ${coreColor}`} />
                    </span>
                    <span className={`text-xs font-semibold ${statusTextClass}`}>{statusLabel}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-line text-xs text-ink-subtle">
                  <span className="font-mono tabular-nums">
                    HB: {formatDateTimeBR(inst.lastHeartbeat)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('operational-agents')}
                    className="text-xs font-semibold text-accent hover:underline cursor-pointer"
                  >
                    Inspecionar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Create & Delegate Form */}
      {showNewForm && (
        <form onSubmit={handleCreate} className="p-5 rounded-xl border border-line bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Criar & Delegar Nova Tarefa</h3>
            <button type="button" onClick={() => setShowNewForm(false)} className="text-ink-muted cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="md:col-span-2">
              <label className="block text-ink-subtle mb-1">Título da Tarefa</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Validar logs de retry do adaptador financeiro"
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Projeto</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              >
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Delegar para</label>
              <select
                value={assigneeKey}
                onChange={(e) => setAssigneeKey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              >
                <optgroup label="Agentes Operacionais">
                  {state.operationalInstances.map((o) => (
                    <option key={o.id} value={`agente_operacional:${o.id}`}>
                      {o.instanceName} ({o.blueprintCode})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Colaboradores Humanos">
                  {state.people.map((p) => (
                    <option key={p.id} value={`humano:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              >
                <option value="crítica">Crítica</option>
                <option value="alta">Alta</option>
                <option value="média">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Prazo</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink font-mono"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-ink-subtle mb-1">Critério Objetivo de Conclusão</label>
              <input
                type="text"
                required
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer">
              Delegar Tarefa
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 p-5 rounded-xl border border-line bg-surface space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">
              Fila Operacional de Tarefas & Delegações ({filteredTasks.length})
            </h2>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowNewForm((s) => !s)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Tarefa
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-subtle border border-line overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('todas')}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap cursor-pointer ${
                statusFilter === 'todas' ? 'bg-surface text-ink font-semibold' : 'text-ink-muted'
              }`}
            >
              Todas
            </button>
            {TASK_STATUS_LIST.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap cursor-pointer ${
                  statusFilter === st.id ? 'bg-surface text-ink font-semibold' : 'text-ink-muted'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="divide-y divide-line">
            {filteredTasks.map((tsk) => {
              const proj = state.projects.find((p) => p.id === tsk.projectId);
              const isExpanded = expandedTaskId === tsk.id;
              return (
                <div key={tsk.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                        <span className="font-mono font-semibold text-accent">{proj?.code ?? '—'}</span>
                        <span>·</span>
                        <span>{tsk.assigneeKind === 'humano' ? 'Colaborador' : 'Agente Operacional'}</span>
                        <span>·</span>
                        <span className="capitalize">{tsk.priority}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{formatDateBR(tsk.dueDate)}</span>
                        {tsk.delegatedBy && <span>· Delegado por {tsk.delegatedBy}</span>}
                      </div>
                      <p className="text-sm font-semibold text-ink">{tsk.title}</p>
                      <p className="text-xs text-ink-muted">
                        Responsável: <strong>{tsk.assigneeName}</strong> · Critério: {tsk.completionCriteria}
                      </p>
                      {tsk.completionEvidence && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Evidência: {tsk.completionEvidence}
                        </p>
                      )}
                      {tsk.escalationNote && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Escalonada: {tsk.escalationNote}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {tsk.sourceConversationId && (
                          <button
                            type="button"
                            onClick={() => onOpenChat({ conversationId: tsk.sourceConversationId })}
                            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Ver conversa no Chat
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedTaskId(isExpanded ? null : tsk.id)}
                          className="text-[11px] text-ink-muted hover:text-ink cursor-pointer"
                        >
                          Comentários & Revisão ({tsk.comments?.length ?? tsk.commentsCount ?? 0})
                        </button>
                        {tsk.status !== 'concluida' && tsk.status !== 'cancelada' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEscalatingTask(tsk);
                              setEscalationReason('');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Escalonar
                          </button>
                        )}
                      </div>
                    </div>

                    <select
                      value={tsk.status}
                      disabled={!canEdit}
                      onChange={(e) =>
                        void handleStatusChange(tsk, e.target.value as TaskLifecycleStatus)
                      }
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-line bg-canvas text-ink shrink-0 disabled:opacity-60"
                    >
                      {TASK_STATUS_LIST.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isExpanded && (
                    <div className="p-3 rounded-lg border border-line bg-canvas space-y-2.5 text-xs">
                      {(tsk.comments ?? []).length === 0 ? (
                        <p className="text-ink-subtle">Nenhum registro de revisão nesta tarefa ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          {(tsk.comments ?? []).map((c) => (
                            <div key={c.id} className="border-b border-line/60 pb-1.5 last:border-b-0 last:pb-0">
                              <p className="text-[11px] text-ink-subtle">
                                <strong className="text-ink">{c.authorName}</strong> ({c.authorRole}) · {formatDateTimeBR(c.createdAt)}
                              </p>
                              <p className="text-ink mt-0.5">{c.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          placeholder="Adicionar nota de revisão, bloqueio ou checkpoint..."
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-line bg-surface text-ink text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => void handlePostComment(tsk.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          Registrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-4 p-5 rounded-xl border border-line bg-surface space-y-4">
          <h2 className="text-base font-semibold text-ink">Incidentes & Impedimentos</h2>
          <div className="space-y-3">
            {state.incidents.map((inc) => {
              const proj = state.projects.find((p) => p.id === inc.projectId);
              return (
                <div key={inc.id} className="p-3.5 rounded-lg border border-line bg-canvas space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono uppercase font-semibold text-red-600 dark:text-red-400">
                      {inc.severity}
                    </span>
                    <span className="capitalize text-ink-muted">{inc.status}</span>
                  </div>
                  <p className="text-sm font-medium text-ink">{inc.title}</p>
                  <p className="text-xs text-ink-subtle">
                    {proj?.code ?? '—'} · Responsável: {inc.ownerName} · {inc.openedAt}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Mandatory Completion Evidence Modal */}
      {closingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40"
          onClick={() => setClosingTask(null)}
        >
          <form
            onSubmit={handleConfirmEvidence}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md p-5 rounded-2xl nc-glass-window space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">
                Registrar Evidência para Conclusão
              </h3>
              <button type="button" onClick={() => setClosingTask(null)} className="text-ink-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-ink">{closingTask.title}</p>
              <p className="text-ink-subtle">Critério: {closingTask.completionCriteria}</p>
              <textarea
                rows={3}
                required
                value={evidenceInput}
                onChange={(e) => setEvidenceInput(e.target.value)}
                placeholder="Descreva a evidência objetiva de entrega (PR, log de avaliação, relatório)..."
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClosingTask(null)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
              >
                Concluir Tarefa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fluxo C: Task Escalation Modal */}
      {escalatingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40"
          onClick={() => setEscalatingTask(null)}
        >
          <form
            onSubmit={handleConfirmEscalation}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md p-5 rounded-2xl nc-glass-window space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">
                Escalonar Tarefa para Gestor & Governança
              </h3>
              <button type="button" onClick={() => setEscalatingTask(null)} className="text-ink-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-ink">{escalatingTask.title}</p>
              <p className="text-ink-subtle">
                O sistema marcará a tarefa como bloqueada, identificará o superior imediato no Organograma e protocolará um registro DELIB na Governança.
              </p>
              <textarea
                rows={3}
                required
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="Descreva o impedimento técnico, risco ou limite de alçada..."
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEscalatingTask(null)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
              >
                Confirmar Escalonamento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
