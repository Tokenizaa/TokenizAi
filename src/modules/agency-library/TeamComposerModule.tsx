import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Info, Sparkles } from 'lucide-react';
import {
  AGENCY_AGENTS_283,
  analyzeProjectNeedsDeterministically,
  computeTeamCoverageAndGaps,
} from '../../domain/agencyLibrary';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import { AIAdapter } from '../../services/adapters';
import type { EnterpriseState, TeamCompositionRecord, UserRole } from '../../types/enterprise';

interface TeamComposerModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  initialProjectId?: string;
  onSaveComposition: (composition: Omit<TeamCompositionRecord, 'id' | 'createdAt'>) => void;
}

export const TeamComposerModule: React.FC<TeamComposerModuleProps> = ({
  state,
  activeRole,
  initialProjectId,
  onSaveComposition,
}) => {
  const [projectId, setProjectId] = useState(initialProjectId || state.projects[0]?.id || '');
  const selectedProject = state.projects.find((p) => p.id === projectId) ?? state.projects[0];

  const [selectedIds, setSelectedIds] = useState<string[]>(
    selectedProject?.selectedAgentIds ?? []
  );
  const [aiAdvisory, setAiAdvisory] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (selectedProject) {
      setSelectedIds(selectedProject.selectedAgentIds);
      setSavedNotice(null);
    }
  }, [selectedProject?.id]);

  const canEdit = ROLE_DEFINITIONS[activeRole].canEditProjects;

  // 1. Deterministic matching (explicitly labeled as deterministic rules)
  const deterministicRecs = useMemo(() => {
    if (!selectedProject) return [];
    return analyzeProjectNeedsDeterministically(selectedProject, AGENCY_AGENTS_283, 10);
  }, [selectedProject]);

  // 2. Coverage & Gap calculation
  const coverage = useMemo(() => {
    if (!selectedProject) return null;
    return computeTeamCoverageAndGaps(selectedProject, selectedIds, AGENCY_AGENTS_283);
  }, [selectedProject, selectedIds]);

  const toggleAgent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAskGeminiAdvisory = async () => {
    if (!selectedProject) return;
    setAiLoading(true);
    setAiAdvisory(null);
    try {
      const res = await AIAdapter.scopeProject(
        `Avaliar composição de equipe para o projeto "${selectedProject.name}": ${selectedProject.objective}. Requisitos: ${selectedProject.requirements.join('; ')}.`
      );
      setAiAdvisory(
        `Sugestão (${res.model}): Competências recomendadas [${res.analysis.recommendedCompetencies.join(', ')}]. Riscos: ${res.analysis.risks[0] ?? 'Sem riscos críticos apontados'}.`
      );
    } catch (err) {
      setAiAdvisory(
        err instanceof Error ? err.message : 'Gemini API indisponível — utilize a análise determinística.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveHumanDecision = () => {
    if (!selectedProject || !coverage) return;
    onSaveComposition({
      projectId: selectedProject.id,
      authorName: ROLE_DEFINITIONS[activeRole].label,
      selectedBlueprintIds: selectedIds,
      coveragePercent: coverage.coveragePercent,
      identifiedGaps: coverage.gaps,
      deterministicSummary: coverage.complementarityNote,
      aiNote: aiAdvisory ?? undefined,
      humanApprovalStatus: 'aprovada',
    });
    setSavedNotice(
      `Decisão humana registrada: ${selectedIds.length} perfis vinculados a ${selectedProject.code} e auditados na Governança.`
    );
  };

  if (!selectedProject || !coverage) {
    return (
      <div className="p-8 rounded-xl border border-line bg-surface text-center text-sm text-ink-muted">
        Crie um projeto no Portfólio antes de compor equipes de agentes.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contextual Project Selector */}
      <div className="p-5 rounded-xl border border-line bg-surface flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-[240px]">
          <label className="block text-xs font-medium text-ink-subtle">
            Contexto do Projeto Real
          </label>
          <select
            value={selectedProject.id}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full max-w-xl px-3 py-2 text-sm font-medium rounded-lg border border-line bg-canvas text-ink"
          >
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name} ({p.area})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleAskGeminiAdvisory}
          disabled={aiLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line bg-surface-subtle hover:border-accent text-xs font-semibold text-ink cursor-pointer disabled:opacity-60"
        >
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          {aiLoading ? 'Consultando IA...' : 'Complementar com Recomendação IA'}
        </button>
      </div>

      {/* Transparency Banner: Deterministic vs AI vs Human */}
      <div className="px-4 py-2.5 rounded-lg border border-line bg-surface-subtle/60 flex items-center gap-2 text-xs text-ink-muted">
        <Info className="w-4 h-4 text-accent shrink-0" />
        <span>
          Transparência metodológica: a pontuação abaixo é calculada por <strong>motor determinístico de competências</strong>; análises de IA são opcionais e a aprovação final exige <strong>decisão humana</strong>.
        </span>
      </div>

      {aiAdvisory && (
        <div className="p-4 rounded-xl border border-accent/40 bg-surface text-xs text-ink leading-relaxed">
          {aiAdvisory}
        </div>
      )}

      {savedNotice && (
        <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Deterministic Recommendations */}
        <section className="lg:col-span-7 p-5 rounded-xl border border-line bg-surface space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Recomendações por Análise Automatizada (Acervo 283)
            </h3>
            <p className="text-xs text-ink-subtle">
              Baseado no objetivo, arquitetura ({selectedProject.architectureSummary || 'não informada'}) e requisitos do projeto
            </p>
          </div>

          <div className="divide-y divide-line">
            {deterministicRecs.map((rec) => {
              const checked = selectedIds.includes(rec.agent.id);
              const homStatus = state.homologationOverrides[rec.agent.id] ?? rec.agent.homologationStatus;

              return (
                <div key={rec.agent.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                      <span className="font-mono font-semibold text-ink">{rec.agent.code}</span>
                      <span>·</span>
                      <span>{rec.agent.division}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums text-accent font-semibold">
                        Aderência determinística: {rec.score} pts
                      </span>
                      <span>·</span>
                      <span className="capitalize">{homStatus.replace('_', ' ')}</span>
                    </div>
                    <p className="text-sm font-semibold text-ink">{rec.agent.name}</p>
                    <p className="text-xs text-ink-muted">{rec.rationale}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleAgent(rec.agent.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold shrink-0 cursor-pointer inline-flex items-center gap-1 ${
                      checked
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-canvas text-ink-muted hover:text-ink'
                    }`}
                  >
                    {checked && <Check className="w-3.5 h-3.5" />}
                    {checked ? 'Selecionado' : 'Selecionar'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: Gap Analysis + Human Decision */}
        <aside className="lg:col-span-5 p-5 rounded-xl border border-line bg-surface space-y-5 sticky top-20">
          <div className="space-y-1">
            <p className="text-xs text-ink-subtle">Cobertura Calculada da Equipe</p>
            <div className="flex items-baseline justify-between">
              <p className="font-display text-2xl font-bold text-ink tabular-nums">
                {coverage.coveragePercent}%
              </p>
              <span className="text-xs text-ink-muted tabular-nums">
                {selectedIds.length} perfis selecionados
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-subtle overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${coverage.coveragePercent}%` }}
              />
            </div>
            <p className="text-xs text-ink-muted pt-1">{coverage.complementarityNote}</p>
          </div>

          <div className="pt-3 border-t border-line space-y-2 text-xs">
            <p className="font-semibold text-ink">Lacunas & Riscos Identificados</p>
            {coverage.gaps.length === 0 ? (
              <p className="text-emerald-700 dark:text-emerald-400">
                Nenhuma lacuna crítica detectada para os requisitos atuais.
              </p>
            ) : (
              <ul className="list-disc pl-4 text-ink-muted space-y-1">
                {coverage.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-3 border-t border-line space-y-3">
            <p className="text-xs font-semibold text-ink">Decisão Humana & Rastreabilidade</p>
            <button
              type="button"
              disabled={!canEdit}
              onClick={handleSaveHumanDecision}
              className="w-full py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {canEdit ? 'Confirmar Composição no Projeto & Auditar' : 'Sem permissão para alterar projeto'}
            </button>

            {state.compositions.filter((c) => c.projectId === selectedProject.id).length > 0 && (
              <div className="space-y-1.5 pt-2">
                <p className="text-[11px] font-medium text-ink-subtle">Histórico de Seleções</p>
                {state.compositions
                  .filter((c) => c.projectId === selectedProject.id)
                  .slice(0, 3)
                  .map((c) => (
                    <div key={c.id} className="p-2.5 rounded-lg border border-line bg-canvas text-[11px] text-ink-muted">
                      <span className="font-mono text-ink">{c.createdAt}</span> · {c.selectedBlueprintIds.length} perfis · Cobertura {c.coveragePercent}% ({c.authorName})
                    </div>
                  ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
