import React, { useState } from 'react';
import { ArrowUpRight, Calendar, Download, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { WeeklyProgressChart } from '../../components/Common/WeeklyProgressChart';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import { AIAdapter, CalendarAdapter, type ExecutiveAIBrief } from '../../services/adapters';
import { formatBRL, formatDateBR } from '../../services/enterpriseService';
import type { EnterpriseState, ModuleId, UserRole } from '../../types/enterprise';

interface ExecutiveDashboardProps {
  state: EnterpriseState;
  activeRole: UserRole;
  onNavigate: (moduleId: ModuleId) => void;
  onApproveGovernance: (recordId: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  state,
  activeRole,
  onNavigate,
  onApproveGovernance,
}) => {
  const [aiBrief, setAiBrief] = useState<ExecutiveAIBrief | null>(null);
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const totalRevenue = state.financialEntries
    .filter((f) => f.type === 'receita')
    .reduce((acc, cur) => acc + cur.amount, 0);
  const totalExpenses = state.financialEntries
    .filter((f) => f.type === 'despesa')
    .reduce((acc, cur) => acc + cur.amount, 0);
  const netResult = totalRevenue - totalExpenses;

  const weightedPipeline = state.opportunities
    .filter((o) => o.stage !== 'fechado')
    .reduce((acc, o) => acc + (o.value * o.probability) / 100, 0);

  const activeProjects = state.projects.filter((p) => p.status !== 'concluido');
  const attentionProjects = state.projects.filter((p) => p.status === 'atencao');

  const avgCapacity = Math.round(
    state.people.reduce((acc, p) => acc + p.capacityPercent, 0) / Math.max(state.people.length, 1)
  );

  const pendingDecisions = state.governance.filter((g) => g.status !== 'aprovado');
  const overdueEntries = state.financialEntries.filter((f) => f.status === 'atrasado');
  const openIncidents = state.incidents.filter((i) => i.status === 'aberto');
  const canApprove = ROLE_DEFINITIONS[activeRole].canApproveGovernance;

  const handleGenerateBrief = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await AIAdapter.generateExecutiveBrief({
        dataNature: 'Dados demonstrativos locais aguardando integração ERP/Supabase',
        revenueTotalBRL: totalRevenue,
        expenseTotalBRL: totalExpenses,
        weightedPipelineBRL: weightedPipeline,
        activeProjectsCount: activeProjects.length,
        attentionProjects: attentionProjects.map((p) => ({ code: p.code, name: p.name, progress: p.progress })),
        avgTeamCapacityPercent: avgCapacity,
        pendingDecisionsCount: pendingDecisions.length,
        openIncidentsCount: openIncidents.length,
      });
      setAiBrief(result.brief);
      setAiModelUsed(result.model);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Falha ao consultar síntese executiva.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <DataOriginNotice
        sourceLabel="Indicadores consolidados em modo demonstrativo"
        pendingIntegration="Supabase, Open Finance & Paperclip Runtime"
        onConfigureIntegration={onNavigate}
      />

      {/* 4-KPI Executive Strip */}
      <section aria-label="Indicadores Principais" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="text-left p-6 rounded-2xl border border-line bg-surface transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-ink-subtle">
            <span>Resultado do Período</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-ink tabular-nums">
            {formatBRL(netResult)}
          </p>
          <p className="mt-2.5 text-xs text-ink-muted tabular-nums">
            Receita {formatBRL(totalRevenue)} · Despesa {formatBRL(totalExpenses)}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('commercial')}
          className="text-left p-6 rounded-2xl border border-line bg-surface transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-ink-subtle">
            <span>Pipeline Ponderado</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-ink tabular-nums">
            {formatBRL(weightedPipeline)}
          </p>
          <p className="mt-2.5 text-xs text-ink-muted tabular-nums">
            {state.opportunities.filter((o) => o.stage !== 'fechado').length} oportunidades ativas · {state.contracts.length} contratos
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('projects')}
          className="text-left p-6 rounded-2xl border border-line bg-surface transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-ink-subtle">
            <span>Portfólio & Entregas</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-ink tabular-nums">
            {activeProjects.length} projetos
          </p>
          <p className="mt-2.5 text-xs text-ink-muted tabular-nums">
            {attentionProjects.length} em atenção · {state.operationalInstances.length} agentes preparados
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('people')}
          className="text-left p-6 rounded-2xl border border-line bg-surface transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-ink-subtle">
            <span>Capacidade & Risco</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-ink tabular-nums">
            {avgCapacity}% alocada
          </p>
          <p className="mt-2.5 text-xs text-ink-muted tabular-nums">
            {pendingDecisions.length} decisões pendentes · {openIncidents.length} incidente aberto
          </p>
        </button>
      </section>

      {/* Main Executive Two-Column Hierarchy */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left: Weekly Progress + Predictive AI Brief */}
        <div className="lg:col-span-7 space-y-7">
          <div className="p-6 rounded-2xl border border-line bg-surface">
            <WeeklyProgressChart data={state.weeklyProgress} />
          </div>

          <div className="p-6 rounded-2xl nc-glow-panel space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">Síntese Estratégica & Análise Preditiva</h3>
                <p className="text-sm text-ink-subtle mt-0.5">
                  Leitura assistida por modelo Gemini sobre o estado atual da organização
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateBrief}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line bg-surface-subtle hover:border-accent text-xs font-semibold text-ink transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                {aiLoading ? 'Analisando...' : 'Gerar Síntese Executiva'}
              </button>
            </div>

            {aiError && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200">
                {aiError}
              </div>
            )}

            {aiBrief ? (
              <div className="space-y-3 text-sm">
                <p className="text-ink leading-relaxed">{aiBrief.executiveSummary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-line">
                  <div>
                    <p className="text-xs font-semibold text-ink-subtle mb-1.5">Riscos e Gargalos</p>
                    <ul className="space-y-1 text-xs text-ink-muted list-disc pl-4">
                      {aiBrief.risksAndBottlenecks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-subtle mb-1.5">Decisões Recomendadas</p>
                    <ul className="space-y-1 text-xs text-ink-muted list-disc pl-4">
                      {aiBrief.priorityActions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="text-[11px] text-ink-subtle">
                  Gerado via {aiModelUsed} · Recomendação assistida sujeita à decisão executiva.
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">
                Clique em "Gerar Síntese Executiva" para cruzar indicadores financeiros, gargalos de projeto e capacidade da equipe em um resumo acionável.
              </p>
            )}
          </div>
        </div>

        {/* Right: Attention Required + Governance Queue + Commitments */}
        <div className="lg:col-span-5 space-y-7">
          <div className="p-6 rounded-2xl border border-line bg-surface space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">Atenção Imediata & Decisões</h3>
              <button
                type="button"
                onClick={() => onNavigate('governance')}
                className="text-xs font-medium text-accent hover:underline cursor-pointer"
              >
                Ver governança
              </button>
            </div>

            <div className="divide-y divide-line">
              {attentionProjects.map((p) => (
                <div key={p.id} className="py-3 first:pt-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{p.code} · Projeto em atenção</span>
                    </div>
                    <p className="text-sm font-medium text-ink mt-0.5 truncate">{p.name}</p>
                    <p className="text-xs text-ink-subtle mt-0.5 tabular-nums">
                      Prazo {formatDateBR(p.deadline)} · Progresso {p.progress}%
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('projects')}
                    className="text-xs font-medium text-ink-muted hover:text-ink underline shrink-0 cursor-pointer"
                  >
                    Abrir
                  </button>
                </div>
              ))}

              {overdueEntries.map((fin) => (
                <div key={fin.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      Vencimento em atraso · Financeiro
                    </p>
                    <p className="text-sm font-medium text-ink mt-0.5 truncate">{fin.title}</p>
                    <p className="text-xs text-ink-subtle mt-0.5 tabular-nums">
                      {formatBRL(fin.amount)} · Venc. {formatDateBR(fin.dueDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('finance')}
                    className="text-xs font-medium text-ink-muted hover:text-ink underline shrink-0 cursor-pointer"
                  >
                    Verificar
                  </button>
                </div>
              ))}

              {pendingDecisions.map((gov) => (
                <div key={gov.id} className="py-3 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-ink-subtle">
                      {gov.code} · {gov.authorityRole}
                    </p>
                    <p className="text-sm font-medium text-ink mt-0.5">{gov.title}</p>
                  </div>
                  {canApprove ? (
                    <button
                      type="button"
                      onClick={() => onApproveGovernance(gov.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent-soft text-accent-ink text-xs font-semibold hover:opacity-90 shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aprovar
                    </button>
                  ) : (
                    <span className="text-xs text-ink-subtle shrink-0">Aguardando alçada</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-line bg-surface space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                <h3 className="text-base font-semibold text-ink">Agenda Executiva & Compromissos</h3>
              </div>
              <span className="text-xs text-ink-subtle">Exportação .ics</span>
            </div>

            <div className="divide-y divide-line">
              {state.commitments.map((c) => (
                <div key={c.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{c.title}</p>
                    <p className="text-xs text-ink-subtle tabular-nums truncate">
                      {formatDateBR(c.dateISO)} · {c.dateISO.slice(11, 16)} · {c.category}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => CalendarAdapter.downloadICS(c)}
                    title="Exportar para Google Calendar / Outlook (.ics)"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line text-xs text-ink-muted hover:text-ink hover:bg-surface-subtle shrink-0 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    .ics
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
