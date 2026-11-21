import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  GitBranch,
  MessageSquare,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { AGENCY_AGENTS_283, analyzeProjectNeedsDeterministically } from '../../domain/agencyLibrary';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import {
  AIAdapter,
  GitHubAdapter,
  type GitHubRepoInspection,
  type ProjectAIScopingResult,
} from '../../services/adapters';
import { formatBRL, formatDateBR } from '../../services/enterpriseService';
import type {
  EnterpriseProject,
  EnterpriseState,
  ModuleId,
  ProjectStatus,
  ProjectTask,
  TaskLifecycleStatus,
  UserRole,
} from '../../types/enterprise';

interface ProjectsModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  openWizardInitially?: boolean;
  initialSelectedProjectId?: string;
  onWizardOpenedHandled?: () => void;
  onCreateProject: (input: Omit<EnterpriseProject, 'id' | 'code' | 'updatedAt'>) => Promise<void>;
  onUpdateTask: (taskId: string, patch: Partial<ProjectTask>) => Promise<void>;
  onToggleNexusGate: (projectId: string, gateId: string, passed: boolean) => Promise<void>;
  onOpenChat: (target: { conversationId?: string; projectId?: string }) => void;
  onNavigate: (moduleId: ModuleId, extra?: { projectId?: string }) => void;
}

const TASK_STATUS_OPTIONS: Array<{ id: TaskLifecycleStatus; label: string }> = [
  { id: 'planejada', label: 'Planejada' },
  { id: 'atribuida', label: 'Atribuída' },
  { id: 'em_execucao', label: 'Em Execução' },
  { id: 'bloqueada', label: 'Bloqueada' },
  { id: 'em_revisao', label: 'Em Revisão' },
  { id: 'concluida', label: 'Concluída' },
  { id: 'cancelada', label: 'Cancelada' },
];

export const ProjectsModule: React.FC<ProjectsModuleProps> = ({
  state,
  activeRole,
  openWizardInitially,
  initialSelectedProjectId,
  onWizardOpenedHandled,
  onCreateProject,
  onUpdateTask,
  onToggleNexusGate,
  onOpenChat,
  onNavigate,
}) => {
  const [statusFilter, setStatusFilter] = useState<'todos' | ProjectStatus>('todos');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialSelectedProjectId || state.projects[0]?.id || ''
  );
  const [detailTab, setDetailTab] = useState<
    'overview' | 'tasks' | 'nexus' | 'team' | 'governance'
  >('overview');

  // Evidence modal when completing task
  const [closingTask, setClosingTask] = useState<ProjectTask | null>(null);
  const [evidenceInput, setEvidenceInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Smart Project Creation Wizard state
  const [wizardOpen, setWizardOpen] = useState(Boolean(openWizardInitially));
  const [briefInput, setBriefInput] = useState('');
  const [repoInput, setRepoInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [repoInspection, setRepoInspection] = useState<GitHubRepoInspection | null>(null);
  const [aiResult, setAiResult] = useState<ProjectAIScopingResult | null>(null);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftObjective, setDraftObjective] = useState('');
  const [draftArea, setDraftArea] = useState('Engenharia de Software');
  const [draftDeadline, setDraftDeadline] = useState('2027-01-30');
  const [draftBudget, setDraftBudget] = useState(120000);
  const [draftRequirements, setDraftRequirements] = useState<string[]>([]);
  const [draftAgentIds, setDraftAgentIds] = useState<string[]>([]);
  const [stepReady, setStepReady] = useState(false);

  React.useEffect(() => {
    if (openWizardInitially) {
      setWizardOpen(true);
      onWizardOpenedHandled?.();
    }
  }, [openWizardInitially, onWizardOpenedHandled]);

  React.useEffect(() => {
    if (initialSelectedProjectId) {
      setSelectedProjectId(initialSelectedProjectId);
    }
  }, [initialSelectedProjectId]);

  const canEdit = ROLE_DEFINITIONS[activeRole].canEditProjects;

  const filteredProjects = useMemo(
    () => state.projects.filter((p) => statusFilter === 'todos' || p.status === statusFilter),
    [state.projects, statusFilter]
  );

  const selectedProject =
    state.projects.find((p) => p.id === selectedProjectId) ?? filteredProjects[0] ?? state.projects[0];

  const handleAnalyzeContext = async () => {
    if (!briefInput.trim() && !repoInput.trim()) {
      setAnalysisNote('Descreva o que deseja construir ou informe um repositório GitHub.');
      return;
    }

    setAnalyzing(true);
    setAnalysisNote(null);
    let inspected: GitHubRepoInspection | null = null;

    if (repoInput.trim()) {
      try {
        inspected = await GitHubAdapter.inspectRepo(repoInput.trim());
        setRepoInspection(inspected);
      } catch (err) {
        setAnalysisNote(err instanceof Error ? err.message : 'Falha ao inspecionar GitHub.');
        setAnalyzing(false);
        return;
      }
    } else {
      setRepoInspection(null);
    }

    let scoped: ProjectAIScopingResult | null = null;
    try {
      const res = await AIAdapter.scopeProject(briefInput.trim(), inspected);
      scoped = res.analysis;
      setAiResult(scoped);
      setAnalysisNote(
        `Contexto analisado via ${res.model}${inspected ? ' + GitHub API real' : ''}. Confirme apenas os campos abaixo.`
      );
    } catch {
      const titleFallback = inspected
        ? inspected.fullName.split('/')[1]
        : briefInput.trim().slice(0, 48);
      const areaFallback = /ia|agente|llm|modelo/i.test(briefInput + (inspected?.description ?? ''))
        ? 'Inteligência Artificial & ML'
        : /financ|fatura|caixa/i.test(briefInput)
        ? 'Finanças & Controladoria'
        : 'Engenharia de Software';

      scoped = {
        suggestedTitle: titleFallback || 'Nova Iniciativa NettosCorp',
        objective:
          briefInput.trim() ||
          inspected?.description ||
          'Estruturar entrega corporativa a partir do repositório.',
        area: areaFallback,
        detectedArchitecture: inspected
          ? `${inspected.primaryLanguage} (${inspected.languages.join(', ') || 'Stack detectada'})`
          : 'A definir durante confirmação de escopo',
        keyRequirements: [
          briefInput.trim()
            ? `Entregar: ${briefInput.trim().slice(0, 90)}`
            : 'Mapear backlog inicial a partir do repositório',
          'Validar segurança RBAC e critérios de qualidade antes de produção',
        ],
        recommendedCompetencies: inspected?.languages ?? ['TypeScript', 'Arquitetura', 'QA'],
        risks: [
          'Gemini API não configurada no servidor — classificação executada pelo motor determinístico local.',
        ],
        questionsToConfirm: ['Confirmar prazo alvo de entrega e responsável principal.'],
      };
      setAiResult(scoped);
      setAnalysisNote(
        `Análise automatizada determinística${inspected ? ' + inspeção real do GitHub' : ''}. Revise e confirme os pontos abaixo.`
      );
    }

    setDraftName(scoped.suggestedTitle);
    setDraftObjective(scoped.objective);
    setDraftArea(scoped.area);
    setDraftRequirements(scoped.keyRequirements);

    const tempProject: EnterpriseProject = {
      id: 'draft',
      code: 'NEW',
      name: scoped.suggestedTitle,
      objective: scoped.objective,
      description: briefInput,
      area: scoped.area,
      leadId: 'per-2',
      leadName: 'Clara Azevedo',
      humanTeamIds: ['per-2'],
      selectedAgentIds: [],
      operationalInstanceIds: [],
      status: 'planejamento',
      priority: 'alta',
      deadline: draftDeadline,
      progress: 0,
      repoSlug: inspected?.fullName || repoInput.trim() || undefined,
      architectureSummary: scoped.detectedArchitecture,
      requirements: scoped.keyRequirements,
      origin: 'demonstrativo',
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const recs = analyzeProjectNeedsDeterministically(tempProject, AGENCY_AGENTS_283, 4);
    setDraftAgentIds(recs.map((r) => r.agent.id));
    setStepReady(true);
    setAnalyzing(false);
  };

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim() || !draftObjective.trim()) return;
    await onCreateProject({
      name: draftName.trim(),
      objective: draftObjective.trim(),
      description: briefInput.trim() || draftObjective.trim(),
      area: draftArea,
      leadId: state.people[1]?.id ?? 'per-2',
      leadName: state.people[1]?.name ?? 'Clara Azevedo',
      budgetBRL: Number(draftBudget) || 100000,
      spentBRL: 0,
      humanTeamIds: [state.people[1]?.id ?? 'per-2'],
      selectedAgentIds: draftAgentIds,
      operationalInstanceIds: [],
      status: 'planejamento',
      priority: 'alta',
      deadline: draftDeadline,
      progress: 5,
      repoSlug: repoInspection?.fullName || (repoInput.trim() ? repoInput.trim() : undefined),
      architectureSummary: aiResult?.detectedArchitecture,
      requirements: draftRequirements,
      origin: 'real_local',
    });
    setWizardOpen(false);
    setStepReady(false);
    setBriefInput('');
    setRepoInput('');
    setRepoInspection(null);
    setAiResult(null);
  };

  const handleTaskStatusSelect = async (task: ProjectTask, nextStatus: TaskLifecycleStatus) => {
    setActionError(null);
    if (nextStatus === 'concluida' && !task.completionEvidence?.trim()) {
      setClosingTask(task);
      setEvidenceInput('');
      return;
    }
    try {
      await onUpdateTask(task.id, { status: nextStatus });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao atualizar tarefa.');
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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao concluir tarefa.');
    }
  };

  const projectTasks = selectedProject
    ? state.tasks.filter((t) => t.projectId === selectedProject.id)
    : [];
  const projectAgents = selectedProject
    ? AGENCY_AGENTS_283.filter((a) => selectedProject.selectedAgentIds.includes(a.id))
    : [];
  const projectGovernance = selectedProject
    ? state.governance.filter((g) => g.linkedProjectId === selectedProject.id)
    : [];
  const projectInstances = selectedProject
    ? state.operationalInstances.filter((o) => o.projectId === selectedProject.id)
    : [];

  return (
    <div className="space-y-6">
      <DataOriginNotice
        sourceLabel="Portfólio unificado de projetos empresariais, quality gates NEXUS, orçamento e canais de execução"
        pendingIntegration="GitHub Webhooks & Paperclip Runtime"
        onConfigureIntegration={(m) => onNavigate(m)}
      />

      {actionError && (
        <div className="px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="underline cursor-pointer">
            Dispensar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-subtle border border-line overflow-x-auto">
          {(
            [
              { id: 'todos', label: 'Todos' },
              { id: 'em_execucao', label: 'Em Execução' },
              { id: 'atencao', label: 'Em Atenção' },
              { id: 'planejamento', label: 'Planejamento' },
              { id: 'concluido', label: 'Concluídos' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Abrir Projeto Inteligente
          </button>
        )}
      </div>

      {/* Smart Project Creation Wizard */}
      {wizardOpen && (
        <div className="p-6 rounded-2xl nc-glass-window space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-ink">
                Abertura Inteligente de Projeto
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Descreva o objetivo ou conecte um repositório GitHub. A plataforma identifica o contexto e solicita apenas o que falta.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWizardOpen(false)}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink cursor-pointer"
              aria-label="Fechar assistente"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                O que você pretende construir ou entregar?
              </label>
              <textarea
                rows={3}
                value={briefInput}
                onChange={(e) => setBriefInput(e.target.value)}
                placeholder="Ex.: Plataforma de conciliação financeira automatizada com alertas para diretoria e integração bancária."
                className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">
                  Repositório GitHub (opcional — inspeção real via API)
                </label>
                <input
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="Ex.: vercel/next.js ou https://github.com/owner/repo"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink font-mono focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="button"
                onClick={handleAnalyzeContext}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {analyzing ? 'Analisando contexto...' : 'Analisar Contexto & Sugerir Equipe'}
              </button>
            </div>
          </div>

          {analysisNote && (
            <div className="px-3.5 py-2 rounded-lg border border-line bg-surface-subtle text-xs text-ink-muted">
              {analysisNote}
            </div>
          )}

          {repoInspection && (
            <div className="p-3.5 rounded-xl border border-line bg-surface text-xs space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-semibold text-ink">{repoInspection.fullName}</span>
                <span className="text-ink-subtle tabular-nums">
                  {repoInspection.primaryLanguage} · {repoInspection.stars} stars · branch {repoInspection.defaultBranch}
                </span>
              </div>
              <p className="text-ink-muted">{repoInspection.description}</p>
            </div>
          )}

          {stepReady && aiResult && (
            <form onSubmit={handleConfirmCreate} className="pt-4 border-t border-line space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-ink-muted mb-1">Nome do Projeto</label>
                  <input
                    type="text"
                    required
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Prazo Alvo</label>
                  <input
                    type="date"
                    value={draftDeadline}
                    onChange={(e) => setDraftDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Orçamento (R$)</label>
                  <input
                    type="number"
                    value={draftBudget}
                    onChange={(e) => setDraftBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Objetivo Consolidado</label>
                  <textarea
                    rows={2}
                    required
                    value={draftObjective}
                    onChange={(e) => setDraftObjective(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Área Responsável</label>
                  <input
                    type="text"
                    value={draftArea}
                    onChange={(e) => setDraftArea(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-lg border border-line bg-surface space-y-1.5">
                  <p className="font-semibold text-ink">Pontos para Confirmação Humana</p>
                  <ul className="list-disc pl-4 text-ink-muted space-y-1">
                    {aiResult.questionsToConfirm.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-3.5 rounded-lg border border-line bg-surface space-y-1.5">
                  <p className="font-semibold text-ink">
                    Perfis Sugeridos (Motor Determinístico — {draftAgentIds.length} selecionados)
                  </p>
                  <div className="space-y-1">
                    {AGENCY_AGENTS_283.filter((a) => draftAgentIds.includes(a.id)).map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-ink-muted">
                        <span className="truncate">
                          <span className="font-mono text-ink mr-1.5">{a.code}</span>
                          {a.name}
                        </span>
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWizardOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-line text-xs text-ink-muted hover:text-ink cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer"
                >
                  Confirmar Abertura do Projeto
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Portfolio Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-2.5">
          {filteredProjects.map((proj) => {
            const active = selectedProject?.id === proj.id;
            return (
              <button
                key={proj.id}
                type="button"
                onClick={() => setSelectedProjectId(proj.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  active
                    ? 'border-accent bg-surface'
                    : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-ink-subtle">
                  <span className="font-mono font-semibold text-ink">{proj.code}</span>
                  <span
                    className={
                      proj.status === 'atencao'
                        ? 'text-amber-700 dark:text-amber-400 font-medium'
                        : 'text-ink-muted capitalize'
                    }
                  >
                    {proj.status.replace('_', ' ')} · {proj.priority}
                  </span>
                </div>
                <h3 className="mt-1 font-display text-sm font-bold text-ink">{proj.name}</h3>
                <p className="mt-1 text-xs text-ink-muted line-clamp-2">{proj.objective}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-subtle tabular-nums">
                  <span>{proj.area}</span>
                  <span className="font-mono">
                    {proj.progress}% · {formatDateBR(proj.deadline)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {selectedProject && (
          <div className="lg:col-span-7 p-6 rounded-xl border border-line bg-surface space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-ink-subtle">
                  <span className="font-mono font-semibold text-accent">{selectedProject.code}</span>
                  <span>·</span>
                  <span>{selectedProject.area}</span>
                  <span>·</span>
                  <span>Líder: {selectedProject.leadName}</span>
                </div>
                <h2 className="mt-1 font-display text-lg font-bold text-ink">{selectedProject.name}</h2>
                {selectedProject.budgetBRL !== undefined && (
                  <p className="text-xs text-ink-muted tabular-nums mt-1">
                    Orçamento: {formatBRL(selectedProject.spentBRL ?? 0)} executado de{' '}
                    {formatBRL(selectedProject.budgetBRL)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onOpenChat({
                      conversationId: selectedProject.linkedConversationId,
                      projectId: selectedProject.id,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-canvas hover:border-accent text-xs font-semibold text-ink cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-accent" />
                  Canal do Projeto
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('team-composer', { projectId: selectedProject.id })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface-subtle hover:border-accent text-xs font-semibold text-ink cursor-pointer"
                >
                  Compor Equipe IA
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 border-b border-line text-xs overflow-x-auto">
              {(
                [
                  { id: 'overview', label: 'Visão Geral & Arquitetura' },
                  { id: 'tasks', label: `Tarefas (${projectTasks.length})` },
                  { id: 'nexus', label: `Gates NEXUS (${selectedProject.nexusGates?.length ?? 0})` },
                  { id: 'team', label: `Equipe & Runtime (${projectAgents.length})` },
                  { id: 'governance', label: `Governança (${projectGovernance.length})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTab(t.id)}
                  className={`pb-2.5 font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    detailTab === t.id
                      ? 'border-accent text-ink'
                      : 'border-transparent text-ink-subtle hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {detailTab === 'overview' && (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-ink-subtle">Objetivo</p>
                  <p className="mt-1 text-ink">{selectedProject.objective}</p>
                </div>
                {selectedProject.architectureSummary && (
                  <div>
                    <p className="text-xs font-semibold text-ink-subtle">Arquitetura & Stack</p>
                    <p className="mt-1 text-xs font-mono text-ink-muted">
                      {selectedProject.architectureSummary}
                    </p>
                  </div>
                )}
                {selectedProject.repoSlug && (
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <GitBranch className="w-3.5 h-3.5 text-accent" />
                    <span className="font-mono">{selectedProject.repoSlug}</span>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-ink-subtle mb-1.5">Requisitos Chave</p>
                  <ul className="space-y-1 text-xs text-ink-muted list-disc pl-4">
                    {selectedProject.requirements.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {detailTab === 'tasks' && (
              <div className="space-y-2.5">
                {projectTasks.length === 0 ? (
                  <p className="text-xs text-ink-subtle py-4">
                    Nenhuma tarefa registrada para este projeto ainda.
                  </p>
                ) : (
                  projectTasks.map((tsk) => (
                    <div
                      key={tsk.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-line bg-canvas"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium text-ink">{tsk.title}</p>
                        <p className="text-xs text-ink-subtle">
                          {tsk.assigneeName} ·{' '}
                          {tsk.assigneeKind === 'humano' ? 'Humano' : 'Agente Operacional'} ·{' '}
                          <span className="font-mono tabular-nums">{formatDateBR(tsk.dueDate)}</span>
                        </p>
                        {tsk.completionEvidence && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            Evidência: {tsk.completionEvidence}
                          </p>
                        )}
                      </div>
                      <select
                        value={tsk.status}
                        onChange={(e) =>
                          void handleTaskStatusSelect(tsk, e.target.value as TaskLifecycleStatus)
                        }
                        className="px-2 py-1 text-xs rounded-md border border-line bg-surface text-ink"
                      >
                        {TASK_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'nexus' && (
              <div className="space-y-3">
                <p className="text-xs text-ink-muted">
                  Portões de qualidade NEXUS (Discovery → Architecture → Execution → Verification → Release) com verificação humana explícita.
                </p>
                {!selectedProject.nexusGates?.length ? (
                  <p className="text-xs text-ink-subtle py-4">
                    Nenhum gate NEXUS configurado para este projeto.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedProject.nexusGates.map((gate) => (
                      <div
                        key={gate.id}
                        className="p-3.5 rounded-lg border border-line bg-canvas flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <ShieldCheck
                              className={`w-3.5 h-3.5 ${
                                gate.passed ? 'text-emerald-600' : 'text-ink-subtle'
                              }`}
                            />
                            <span className="font-mono font-semibold text-ink">{gate.phase}</span>
                            {gate.verifiedBy && (
                              <span className="text-ink-subtle">· Validado por {gate.verifiedBy}</span>
                            )}
                          </div>
                          <p className="text-xs text-ink-muted mt-0.5">{gate.gateCriteria}</p>
                        </div>

                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() =>
                            void onToggleNexusGate(selectedProject.id, gate.id, !gate.passed)
                          }
                          className={`px-3 py-1 rounded-md border text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50 ${
                            gate.passed
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'border-line bg-surface text-ink-muted hover:text-ink'
                          }`}
                        >
                          {gate.passed ? 'Aprovado' : 'Aprovar Gate'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'team' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-ink-subtle mb-2">Equipe Humana Alocada</p>
                  <div className="flex flex-wrap gap-3">
                    {state.people
                      .filter((per) => selectedProject.humanTeamIds.includes(per.id))
                      .map((per) => (
                        <div key={per.id} className="px-3 py-2 rounded-lg border border-line bg-canvas text-xs">
                          <p className="font-semibold text-ink">{per.name}</p>
                          <p className="text-ink-subtle">{per.roleTitle}</p>
                        </div>
                      ))}
                  </div>
                </div>

                {projectInstances.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-subtle mb-2">
                      Instâncias Operacionais Ativas ({projectInstances.length})
                    </p>
                    <div className="space-y-2">
                      {projectInstances.map((inst) => (
                        <div
                          key={inst.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-line bg-canvas text-xs"
                        >
                          <div>
                            <span className="font-mono font-semibold text-ink">{inst.instanceName}</span>
                            <span className="text-ink-subtle ml-2">
                              ({inst.blueprintCode} · {inst.executionState.replace(/_/g, ' ')})
                            </span>
                          </div>
                          <span className="font-mono tabular-nums text-ink-muted">
                            {formatBRL(inst.spentBudgetBRL)} / {formatBRL(inst.monthlyBudgetBRL)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-ink-subtle mb-2">
                    Perfis da Biblioteca Selecionados ({projectAgents.length})
                  </p>
                  {projectAgents.length === 0 ? (
                    <p className="text-xs text-ink-muted">
                      Nenhum agente selecionado. Use &ldquo;Compor Equipe IA&rdquo; para análise determinística de competências.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {projectAgents.map((ag) => (
                        <div
                          key={ag.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-line bg-canvas text-xs"
                        >
                          <div className="min-w-0">
                            <span className="mr-1.5">{ag.emoji}</span>
                            <span className="font-mono text-accent mr-2">{ag.code}</span>
                            <span className="font-medium text-ink">{ag.name}</span>
                            <span className="text-ink-subtle ml-2">· {ag.division}</span>
                          </div>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'governance' && (
              <div className="space-y-2.5">
                {projectGovernance.length === 0 ? (
                  <p className="text-xs text-ink-subtle">Nenhuma deliberação vinculada a este projeto.</p>
                ) : (
                  projectGovernance.map((g) => (
                    <div key={g.id} className="p-3 rounded-lg border border-line bg-canvas text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-ink">{g.code}</span>
                        <span className="capitalize text-ink-muted">{g.status.replace('_', ' ')}</span>
                      </div>
                      <p className="font-medium text-ink">{g.title}</p>
                      <p className="text-ink-muted">{g.summary}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
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
                Evidência Obrigatória para Conclusão
              </h3>
              <button type="button" onClick={() => setClosingTask(null)} className="text-ink-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-ink">{closingTask.title}</p>
              <p className="text-ink-subtle">
                Critério definido: {closingTask.completionCriteria}
              </p>
              <textarea
                rows={3}
                required
                value={evidenceInput}
                onChange={(e) => setEvidenceInput(e.target.value)}
                placeholder="Informe link de PR/commit, hash, relatório de testes ou parecer que comprove a conclusão..."
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
                Registrar Evidência & Concluir
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
