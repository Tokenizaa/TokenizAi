import React from 'react';
import { ArrowRight } from 'lucide-react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { AGENCY_AGENTS_283 } from '../../domain/agencyLibrary';
import type { EnterpriseState, ModuleId } from '../../types/enterprise';

interface IntelligenceFactoryModuleProps {
  state: EnterpriseState;
  onNavigate: (moduleId: ModuleId) => void;
}

export const IntelligenceFactoryModule: React.FC<IntelligenceFactoryModuleProps> = ({
  state,
  onNavigate,
}) => {
  const homologatedCount = AGENCY_AGENTS_283.filter(
    (a) => (state.homologationOverrides[a.id] ?? a.homologationStatus) === 'homologado'
  ).length;

  return (
    <div className="space-y-8">
      <DataOriginNotice
        sourceLabel="Operação de construção, avaliação (evals) e homologação de soluções de IA"
        pendingIntegration="Paperclip Runtime & Telemetria de Modelos"
        onConfigureIntegration={onNavigate}
      />

      {/* Explicit architectural separation: Library vs Runtime */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('agency-library')}
          className="text-left p-5 rounded-xl border border-line bg-surface hover:border-line-strong transition-colors cursor-pointer"
        >
          <p className="text-xs text-ink-subtle">Biblioteca de Inteligência (Blueprints)</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-ink tabular-nums">
            {AGENCY_AGENTS_283.length} perfis
          </p>
          <p className="mt-1 text-xs text-accent inline-flex items-center gap-1">
            Explorar acervo Agency Agents <ArrowRight className="w-3 h-3" />
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('operational-agents')}
          className="text-left p-5 rounded-xl border border-line bg-surface hover:border-line-strong transition-colors cursor-pointer"
        >
          <p className="text-xs text-ink-subtle">Perfis Homologados pela Diretoria</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-ink tabular-nums">
            {homologatedCount} ativos
          </p>
          <p className="mt-1 text-xs text-ink-muted">Prontos para implantação em projetos</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('operational-agents')}
          className="text-left p-5 rounded-xl border border-line bg-surface hover:border-line-strong transition-colors cursor-pointer"
        >
          <p className="text-xs text-ink-subtle">Agentes Operacionais (Paperclip)</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-ink tabular-nums">
            {state.operationalInstances.length} instâncias
          </p>
          <p className="mt-1 text-xs text-ink-muted">Entidade de execução separada do catálogo</p>
        </button>
      </div>

      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Soluções de IA, Modelos & Guardrails</h2>
            <p className="text-xs text-ink-subtle">
              Avaliação contínua de acurácia, segurança e critérios de homologação antes de produção
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('team-composer')}
            className="px-3 py-1.5 rounded-lg border border-line bg-surface-subtle hover:border-accent text-xs font-semibold text-ink cursor-pointer"
          >
            Compor Equipe Multiagente
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {state.aiSolutions.map((sol) => {
            const proj = state.projects.find((p) => p.id === sol.projectId);
            return (
              <div key={sol.id} className="p-4 rounded-xl border border-line bg-canvas space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-ink-subtle">
                    {sol.modelProvider} · {sol.modelName}
                  </span>
                  <span
                    className={
                      sol.evaluationStatus === 'homologada'
                        ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                        : 'text-amber-700 dark:text-amber-400 font-semibold'
                    }
                  >
                    {sol.evaluationStatus === 'homologada' ? 'Homologada' : 'Em Avaliação'}
                  </span>
                </div>
                <h3 className="font-display text-sm font-bold text-ink">{sol.name}</h3>
                {proj && (
                  <p className="text-xs text-ink-subtle">
                    Projeto: {proj.code} · {proj.name}
                  </p>
                )}
                <p className="text-xs text-ink-muted">{sol.accuracyNote}</p>
                <div className="pt-2 border-t border-line">
                  <p className="text-[11px] font-semibold text-ink-subtle mb-1">Guardrails Obrigatórios</p>
                  <ul className="list-disc pl-4 text-xs text-ink-muted space-y-0.5">
                    {sol.guardrails.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
