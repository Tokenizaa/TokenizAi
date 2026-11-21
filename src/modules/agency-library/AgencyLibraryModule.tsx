import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Columns2, MessageSquare, Search, ShieldAlert, X } from 'lucide-react';
import { AGENCY_AGENTS_283 } from '../../domain/agencyLibrary';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import type {
  AgentBlueprint,
  AgentDivision,
  EnterpriseState,
  HomologationStatus,
  UserRole,
} from '../../types/enterprise';

interface AgencyLibraryModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  initialSearch?: string;
  onSetHomologation: (agent: AgentBlueprint, status: HomologationStatus) => void;
  onOpenChat: (target: { targetInstanceId: string }) => void;
}

const PAGE_SIZE = 24;

export const AgencyLibraryModule: React.FC<AgencyLibraryModuleProps> = ({
  state,
  activeRole,
  initialSearch,
  onSetHomologation,
  onOpenChat,
}) => {
  const [search, setSearch] = useState(initialSearch ?? '');
  const [divisionFilter, setDivisionFilter] = useState<'todas' | AgentDivision>('todas');
  const [statusFilter, setStatusFilter] = useState<'todos' | HomologationStatus>('todos');
  const [page, setPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<AgentBlueprint | null>(AGENCY_AGENTS_283[0]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setPage(1);
    }
  }, [initialSearch]);

  const canHomologate = ROLE_DEFINITIONS[activeRole].canHomologateAgents;

  const getStatus = (agent: AgentBlueprint): HomologationStatus =>
    state.homologationOverrides[agent.id] ?? agent.homologationStatus;

  const divisions = useMemo(() => {
    const counts = new Map<AgentDivision, number>();
    for (const a of AGENCY_AGENTS_283) {
      counts.set(a.division, (counts.get(a.division) ?? 0) + 1);
    }
    return Array.from(counts.entries());
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AGENCY_AGENTS_283.filter((a) => {
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
  }, [search, divisionFilter, statusFilter, state.homologationOverrides]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const comparedAgents = AGENCY_AGENTS_283.filter((a) => compareIds.includes(a.id));

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]
    );
  };

  const activeInstancesForSelected = selectedAgent
    ? state.operationalInstances.filter((o) => o.blueprintId === selectedAgent.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl border border-line bg-surface flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            Biblioteca Profissional Agency Agents ({AGENCY_AGENTS_283.length} Perfis)
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Identidade individual completa (slug, arquétipo, personalidade, estilo de comunicação, skills, runbooks e proveniência) separada das instâncias operacionais
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle tabular-nums">
          <span>{divisions.length} divisões profissionais</span>
          <span>·</span>
          <span>{filtered.length} perfis exibidos</span>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
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
            <option value="todas">Todas as Divisões ({AGENCY_AGENTS_283.length})</option>
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
                    {ag.emoji} {ag.code} · {ag.slug}
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
                        onClick={() => setSelectedAgent(ag)}
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
                <span className="font-mono text-[11px]">{selectedAgent.originPath}</span>
              </div>
              <h3 className="font-display text-lg font-bold text-ink">{selectedAgent.name}</h3>
              <p className="text-xs font-medium text-ink-muted">
                Arquétipo: {selectedAgent.archetype} · &ldquo;{selectedAgent.vibe}&rdquo;
              </p>
              <p className="text-xs text-ink-muted">{selectedAgent.summary}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line text-xs">
              <div>
                <span className="text-ink-subtle">Status atual: </span>
                <strong className="text-ink capitalize">
                  {getStatus(selectedAgent).replace('_', ' ')}
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
              </div>
            </div>

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
          </aside>
        )}
      </div>
    </div>
  );
};
