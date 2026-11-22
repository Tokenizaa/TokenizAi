import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Columns2,
  Cpu,
  Edit3,
  FileCode2,
  MessageSquare,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  AGENCY_AGENTS_283,
  resolveAgentBlueprint,
  toAgentMarkdown,
} from '../../domain/agencyLibrary';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import type {
  AgentBlueprint,
  AgentBlueprintOverride,
  AgentDivision,
  EnterpriseState,
  HomologationStatus,
  ModuleId,
  OperationalAgentInstance,
  UserRole,
} from '../../types/enterprise';

interface AgencyLibraryModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  initialSearch?: string;
  onSetHomologation: (agent: AgentBlueprint, status: HomologationStatus) => void;
  onUpdateBlueprint: (
    blueprintId: string,
    patch: Partial<AgentBlueprintOverride>
  ) => Promise<void>;
  onCreateRuntimeInstance: (input: {
    blueprintId: string;
    projectId: string;
    positionId?: string;
    guardrailPolicy?: string;
    provider?: OperationalAgentInstance['provider'];
    model?: string;
    adapter?: OperationalAgentInstance['adapter'];
    monthlyBudgetBRL?: number;
  }) => Promise<void>;
  onOpenChat: (target: { targetInstanceId: string }) => void;
  onNavigate: (moduleId: ModuleId) => void;
}

const PAGE_SIZE = 24;

export const AgencyLibraryModule: React.FC<AgencyLibraryModuleProps> = ({
  state,
  activeRole,
  initialSearch,
  onSetHomologation,
  onUpdateBlueprint,
  onCreateRuntimeInstance,
  onOpenChat,
  onNavigate,
}) => {
  const [search, setSearch] = useState(initialSearch ?? '');
  const [divisionFilter, setDivisionFilter] = useState<'todas' | AgentDivision>('todas');
  const [statusFilter, setStatusFilter] = useState<'todos' | HomologationStatus>('todos');
  const [page, setPage] = useState(1);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(AGENCY_AGENTS_283[0].id);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [inspectorMode, setInspectorMode] = useState<'structured' | 'markdown'>('structured');

  // Edit profile modal state
  const [editingAgent, setEditingAgent] = useState<AgentBlueprint | null>(null);
  const [editName, setEditName] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editPersonality, setEditPersonality] = useState('');
  const [editCommunication, setEditCommunication] = useState('');
  const [editMethodology, setEditMethodology] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editCompetencies, setEditCompetencies] = useState('');
  const [editLimitations, setEditLimitations] = useState('');

  // Fluxo A: Direct instantiation modal state
  const [deployingAgent, setDeployingAgent] = useState<AgentBlueprint | null>(null);
  const [deployProjectId, setDeployProjectId] = useState(state.projects[0]?.id ?? '');
  const [deployPositionId, setDeployPositionId] = useState('');
  const [deployBudget, setDeployBudget] = useState(3000);
  const [deployGuardrail, setDeployGuardrail] = useState(
    'Revisão humana obrigatória em decisões críticas ou fora da alçada'
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setPage(1);
    }
  }, [initialSearch]);

  const canHomologate = ROLE_DEFINITIONS[activeRole].canHomologateAgents;

  const resolvedCatalog = useMemo(
    () => AGENCY_AGENTS_283.map((ag) => resolveAgentBlueprint(ag, state.blueprintOverrides)),
    [state.blueprintOverrides]
  );

  const selectedAgent =
    resolvedCatalog.find((a) => a.id === selectedAgentId) ?? resolvedCatalog[0];

  const getStatus = (agent: AgentBlueprint): HomologationStatus =>
    state.homologationOverrides[agent.id] ?? agent.homologationStatus;

  const divisions = useMemo(() => {
    const counts = new Map<AgentDivision, number>();
    for (const a of resolvedCatalog) {
      counts.set(a.division, (counts.get(a.division) ?? 0) + 1);
    }
    return Array.from(counts.entries());
  }, [resolvedCatalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resolvedCatalog.filter((a) => {
      if (divisionFilter !== 'todas' && a.division !== divisionFilter) return false;
      if (statusFilter !== 'todos' && getStatus(a) !== statusFilter) return false;
      if (!q) return true;
      return (
        a.code.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.archetype.toLowerCase().includes(q) ||
        a.division.toLowerCase().includes(q) ||
        a.specialty.toLowerCase().includes(q) ||
        a.competencies.some((c) => c.toLowerCase().includes(q)) ||
        a.skills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [resolvedCatalog, search, divisionFilter, statusFilter, state.homologationOverrides]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const comparedAgents = resolvedCatalog.filter((a) => compareIds.includes(a.id));
  const vacantPositions = state.orgPositions.filter((p) => p.holderType === 'vago');

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]
    );
  };

  const activeInstancesForSelected = selectedAgent
    ? state.operationalInstances.filter((o) => o.blueprintId === selectedAgent.id)
    : [];

  const openEditModal = (ag: AgentBlueprint) => {
    setEditingAgent(ag);
    setEditName(ag.name);
    setEditSpecialty(ag.specialty);
    setEditPersonality(ag.personality);
    setEditCommunication(ag.communicationStyle);
    setEditMethodology(ag.methodology);
    setEditInstructions(ag.instructions);
    setEditCompetencies(ag.competencies.join(', '));
    setEditLimitations(ag.limitations.join('; '));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    setFeedback(null);
    try {
      await onUpdateBlueprint(editingAgent.id, {
        name: editName.trim() || editingAgent.name,
        specialty: editSpecialty.trim() || editingAgent.specialty,
        personality: editPersonality.trim() || editingAgent.personality,
        communicationStyle: editCommunication.trim() || editingAgent.communicationStyle,
        methodology: editMethodology.trim() || editingAgent.methodology,
        instructions: editInstructions.trim() || editingAgent.instructions,
        competencies: editCompetencies
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        limitations: editLimitations
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setEditingAgent(null);
      setFeedback(`Perfil ${editingAgent.code} atualizado e versionado com trilha de auditoria.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    }
  };

  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployingAgent || !deployProjectId) return;
    setFeedback(null);
    try {
      await onCreateRuntimeInstance({
        blueprintId: deployingAgent.id,
        projectId: deployProjectId,
        positionId: deployPositionId || undefined,
        guardrailPolicy: deployGuardrail.trim(),
        provider: 'Google Gemini',
        model: 'gemini-4-hydrogen',
        adapter: 'gemini-server-native',
        monthlyBudgetBRL: Number(deployBudget) || 3000,
      });
      setDeployingAgent(null);
      setFeedback(
        `Instância operacional criada para ${deployingAgent.code} e vinculada ao runtime.`
      );
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao instanciar agente.');
    }
  };

  const selectedOverride = state.blueprintOverrides[selectedAgent.id];
  const selectedStatus = getStatus(selectedAgent);

  return (
    <div className="space-y-8">
      <div className="p-6 rounded-2xl border border-line bg-surface flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            Biblioteca Profissional Agency Agents ({resolvedCatalog.length} Perfis)
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Identidade individual completa editável e versionada (slug, arquétipo, personalidade, skills, runbooks e frontmatter Markdown) conectada diretamente ao Runtime Paperclip
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle tabular-nums">
          <span>{divisions.length} divisões profissionais</span>
          <span>·</span>
          <span>{filtered.length} perfis exibidos</span>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg border border-accent/40 bg-accent-soft/60 text-xs text-ink flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-ink-muted cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por código (AG-001), slug, arquétipo, skill ou competência..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink focus:outline-none focus:border-accent"
          />
        </div>

        <div className="md:col-span-4">
          <select
            value={divisionFilter}
            onChange={(e) => {
              setDivisionFilter(e.target.value as 'todas' | AgentDivision);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink"
            aria-label="Filtrar por divisão profissional"
          >
            <option value="todas">Todas as Divisões ({resolvedCatalog.length})</option>
            {divisions.map(([div, count]) => (
              <option key={div} value={div}>
                {div} ({count})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'todos' | HomologationStatus);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink"
            aria-label="Filtrar por status de homologação"
          >
            <option value="todos">Todos os Status</option>
            <option value="homologado">Homologados</option>
            <option value="em_avaliacao">Em Avaliação</option>
            <option value="catalogo">Disponível no Catálogo</option>
          </select>
        </div>
      </div>

      {/* Comparison Strip */}
      {comparedAgents.length > 0 && (
        <section className="p-5 rounded-xl border border-accent/40 bg-surface space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Columns2 className="w-4 h-4 text-accent" />
              <span>Comparação de Perfis ({comparedAgents.length}/2)</span>
            </div>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-ink-muted hover:text-ink cursor-pointer"
            >
              Limpar comparação
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comparedAgents.map((ag) => (
              <div key={ag.id} className="p-4 rounded-lg border border-line bg-canvas space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-accent">
                    {ag.emoji} {ag.code} · {ag.slug} · v{ag.version}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCompare(ag.id)}
                    className="text-ink-subtle hover:text-ink cursor-pointer"
                    aria-label="Remover da comparação"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm font-bold text-ink">{ag.name}</p>
                <p className="text-ink-muted">{ag.archetype} · {ag.division}</p>
                <p className="text-ink-subtle">Comunicação: {ag.communicationStyle}</p>
                <p className="text-ink-muted">Competências: {ag.competencies.join(', ')}</p>
                <p className="text-ink-subtle">Limitação principal: {ag.limitations[0]}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Split List + Rich Profile Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-3">
          {paginated.length === 0 ? (
            <div className="p-8 rounded-xl border border-line bg-surface text-center space-y-2">
              <p className="text-sm font-medium text-ink">Nenhum perfil encontrado para os filtros atuais.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDivisionFilter('todas');
                  setStatusFilter('todos');
                }}
                className="text-xs text-accent hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="divide-y divide-line rounded-xl border border-line bg-surface overflow-hidden">
              {paginated.map((ag) => {
                const status = getStatus(ag);
                const isSelected = selectedAgent?.id === ag.id;
                const isCompared = compareIds.includes(ag.id);

                return (
                  <div
                    key={ag.id}
                    className={`p-4 transition-colors ${
                      isSelected ? 'bg-accent-soft/50' : 'hover:bg-surface-subtle/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedAgentId(ag.id)}
                        className="text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 text-xs text-ink-subtle">
                          <span>{ag.emoji}</span>
                          <span className="font-mono font-semibold text-ink">{ag.code}</span>
                          <span>·</span>
                          <span className="truncate">{ag.division}</span>
                          <span>·</span>
                          <span
                            className={
                              status === 'homologado'
                                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                : status === 'em_avaliacao'
                                ? 'text-amber-700 dark:text-amber-400 font-medium'
                                : 'text-ink-subtle'
                            }
                          >
                            {status === 'homologado'
                              ? 'Homologado'
                              : status === 'em_avaliacao'
                              ? 'Em avaliação'
                              : 'Catálogo'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-ink">{ag.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted line-clamp-1">
                          {ag.archetype} · {ag.specialty}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCompare(ag.id)}
                        className={`px-2 py-1 rounded-md border text-[11px] font-medium shrink-0 cursor-pointer ${
                          isCompared
                            ? 'border-accent bg-accent-soft text-accent-ink'
                            : 'border-line text-ink-subtle hover:text-ink'
                        }`}
                      >
                        {isCompared ? 'Comparando' : 'Comparar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-ink-muted">
              <span className="tabular-nums">
                Página {safePage} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-line bg-surface disabled:opacity-50 cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-line bg-surface disabled:opacity-50 cursor-pointer"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rich Agency Agents Blueprint Inspector */}
        {selectedAgent && (
          <aside className="lg:col-span-7 p-6 rounded-xl border border-line bg-surface sticky top-20 space-y-5">
            <div className="border-b border-line pb-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle">
                <span className="font-mono font-semibold text-accent flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: selectedAgent.color }}
                  />
                  {selectedAgent.emoji} {selectedAgent.code} · {selectedAgent.slug} · v{selectedAgent.version}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px]">{selectedAgent.originPath}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setInspectorMode((m) => (m === 'structured' ? 'markdown' : 'structured'))
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-line bg-canvas text-[11px] font-mono text-ink hover:border-accent cursor-pointer"
                  >
                    <FileCode2 className="w-3 h-3 text-accent" />
                    {inspectorMode === 'structured' ? 'Ver Markdown' : 'Visão Estruturada'}
                  </button>
                </div>
              </div>
              <h3 className="font-display text-lg font-bold text-ink">{selectedAgent.name}</h3>
              <p className="text-xs font-medium text-ink-muted">
                Arquétipo: {selectedAgent.archetype} · &ldquo;{selectedAgent.vibe}&rdquo;
              </p>
              <p className="text-xs text-ink-muted">{selectedAgent.summary}</p>
              {selectedOverride && (
                <p className="text-[11px] font-mono text-accent">
                  Perfil customizado em {selectedOverride.updatedAt} por {selectedOverride.updatedBy}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line text-xs">
              <div>
                <span className="text-ink-subtle">Status atual: </span>
                <strong className="text-ink capitalize">
                  {selectedStatus.replace('_', ' ')}
                </strong>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeInstancesForSelected[0] && (
                  <button
                    type="button"
                    onClick={() => onOpenChat({ targetInstanceId: activeInstancesForSelected[0].id })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-line bg-canvas hover:border-accent text-ink font-medium cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-accent" />
                    Conversar com Instância
                  </button>
                )}

                {canHomologate && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedAgent)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-line bg-canvas hover:border-accent text-ink font-medium cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-accent" />
                      Editar & Versionar
                    </button>

                    {selectedStatus === 'homologado' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDeployingAgent(selectedAgent);
                          setDeployProjectId(state.projects[0]?.id ?? '');
                          setDeployPositionId('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent text-white font-semibold cursor-pointer"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        Instanciar no Runtime
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onSetHomologation(selectedAgent, 'em_avaliacao')}
                          className="px-2.5 py-1 rounded-md border border-line hover:border-line-strong text-ink-muted hover:text-ink cursor-pointer"
                        >
                          Colocar em Avaliação
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetHomologation(selectedAgent, 'homologado')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent text-white font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Homologar Perfil
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {inspectorMode === 'markdown' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-ink-subtle">
                  <span>Proveniência YAML Frontmatter + Markdown (Agency Agents Standard)</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('operational-agents')}
                    className="text-accent hover:underline cursor-pointer"
                  >
                    Ver instâncias ativas ({activeInstancesForSelected.length})
                  </button>
                </div>
                <pre className="p-4 rounded-xl border border-line bg-canvas text-xs font-mono text-ink overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {toAgentMarkdown(selectedAgent)}
                </pre>
              </div>
            ) : (
              <>
                {/* Identity & Behavior Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-line bg-canvas space-y-1">
                    <p className="font-semibold text-ink-subtle">Personalidade</p>
                    <p className="text-ink">{selectedAgent.personality}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-line bg-canvas space-y-1">
                    <p className="font-semibold text-ink-subtle">Estilo de Comunicação</p>
                    <p className="text-ink">{selectedAgent.communicationStyle}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-line bg-canvas space-y-1">
                    <p className="font-semibold text-ink-subtle">Estilo de Trabalho</p>
                    <p className="text-ink">{selectedAgent.workStyle}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-line bg-canvas space-y-1">
                    <p className="font-semibold text-ink-subtle">Tomada de Decisão</p>
                    <p className="text-ink">{selectedAgent.decisionMakingStyle}</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-ink-subtle mb-1">Competências & Conhecimentos</p>
                      <p className="text-ink">{selectedAgent.competencies.join(' · ')}</p>
                      <p className="text-ink-muted mt-1">Áreas: {selectedAgent.knowledgeAreas.join(' · ')}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-ink-subtle mb-1">Skills & Quality Gates NEXUS</p>
                      <p className="font-mono text-ink">{selectedAgent.skills.join(' · ')}</p>
                      <p className="text-ink-muted mt-1">Gates: {selectedAgent.nexusGates.join(' → ')}</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-ink-subtle mb-1">Metodologia Aplicada</p>
                    <p className="text-ink">{selectedAgent.methodology}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-ink-subtle mb-1">Responsabilidades</p>
                      <ul className="list-disc pl-4 text-ink-muted space-y-0.5">
                        {selectedAgent.responsibilities.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-ink-subtle mb-1 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        Limitações Explícitas
                      </p>
                      <ul className="list-disc pl-4 text-ink-muted space-y-0.5">
                        {selectedAgent.limitations.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-ink-subtle mb-1">Instruções Operacionais do Perfil</p>
                    <p className="p-3 rounded-lg border border-line bg-canvas text-ink-muted leading-relaxed">
                      {selectedAgent.instructions}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-ink-subtle mb-1">Runbook Padrão</p>
                    <ol className="list-decimal pl-4 text-ink-muted space-y-1">
                      {selectedAgent.runbook.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      {/* Modal: Edit & Version Blueprint */}
      {editingAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50"
          onClick={() => setEditingAgent(null)}
        >
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl nc-glass-window space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">
                Editar & Versionar Perfil · {editingAgent.code} (v{editingAgent.version})
              </h3>
              <button type="button" onClick={() => setEditingAgent(null)} className="text-ink-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-ink-subtle mb-1">Nome do Perfil</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Especialidade</label>
                <input
                  type="text"
                  required
                  value={editSpecialty}
                  onChange={(e) => setEditSpecialty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Personalidade</label>
                <input
                  type="text"
                  value={editPersonality}
                  onChange={(e) => setEditPersonality(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Estilo de Comunicação</label>
                <input
                  type="text"
                  value={editCommunication}
                  onChange={(e) => setEditCommunication(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-ink-subtle mb-1">Competências (separadas por vírgula)</label>
                <input
                  type="text"
                  value={editCompetencies}
                  onChange={(e) => setEditCompetencies(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-ink-subtle mb-1">Metodologia Aplicada</label>
                <input
                  type="text"
                  value={editMethodology}
                  onChange={(e) => setEditMethodology(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-ink-subtle mb-1">Instruções Operacionais (System Prompt Base)</label>
                <textarea
                  rows={3}
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-ink-subtle mb-1">Limitações Explícitas (separadas por ponto e vírgula)</label>
                <input
                  type="text"
                  value={editLimitations}
                  onChange={(e) => setEditLimitations(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Nova Versão & Auditar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Fluxo A - Direct Runtime Instantiation */}
      {deployingAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50"
          onClick={() => setDeployingAgent(null)}
        >
          <form
            onSubmit={handleDeploySubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg p-6 rounded-2xl nc-glass-window space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">
                Contratar / Instanciar no Runtime · {deployingAgent.code}
              </h3>
              <button type="button" onClick={() => setDeployingAgent(null)} className="text-ink-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-ink-muted">
                Perfil selecionado: <strong className="text-ink">{deployingAgent.name}</strong> ({deployingAgent.division})
              </p>
              <div>
                <label className="block text-ink-subtle mb-1">Projeto Vinculado</label>
                <select
                  value={deployProjectId}
                  onChange={(e) => setDeployProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                >
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Cargo Vago no Organograma (Opcional)</label>
                <select
                  value={deployPositionId}
                  onChange={(e) => setDeployPositionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                >
                  <option value="">Sem cargo organizacional prévio</option>
                  {vacantPositions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Teto Orçamentário Mensal (R$)</label>
                <input
                  type="number"
                  value={deployBudget}
                  onChange={(e) => setDeployBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Política de Guardrail</label>
                <input
                  type="text"
                  value={deployGuardrail}
                  onChange={(e) => setDeployGuardrail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeployingAgent(null)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
              >
                Provisionar Instância Operacional
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

