import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { formatBRL, formatDateBR } from '../../services/enterpriseService';
import type { CommercialOpportunity, EnterpriseState, ModuleId } from '../../types/enterprise';

interface CommercialModuleProps {
  state: EnterpriseState;
  onNavigate: (moduleId: ModuleId) => void;
}

const STAGES: Array<{ id: CommercialOpportunity['stage']; label: string }> = [
  { id: 'prospeccao', label: 'Prospecção' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'fechado', label: 'Fechado' },
];

export const CommercialModule: React.FC<CommercialModuleProps> = ({ state, onNavigate }) => {
  const [viewMode, setViewMode] = useState<'pipeline' | 'contracts'>('pipeline');

  const totalOpen = state.opportunities
    .filter((o) => o.stage !== 'fechado')
    .reduce((acc, o) => acc + o.value, 0);
  const weighted = state.opportunities
    .filter((o) => o.stage !== 'fechado')
    .reduce((acc, o) => acc + (o.value * o.probability) / 100, 0);
  const closedWon = state.opportunities
    .filter((o) => o.stage === 'fechado')
    .reduce((acc, o) => acc + o.value, 0);

  return (
    <div className="space-y-8">
      <DataOriginNotice
        sourceLabel="Pipeline comercial, propostas e contratos em base demonstrativa"
        pendingIntegration="CRM Externo & Assinatura Digital"
        onConfigureIntegration={onNavigate}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Pipeline Bruto em Negociação</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">{formatBRL(totalOpen)}</p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Previsão Ponderada (Forecast)</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">{formatBRL(weighted)}</p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Contratos Fechados no Ciclo</p>
          <p className="mt-1.5 font-display text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatBRL(closedWon)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-subtle border border-line w-fit">
        <button
          type="button"
          onClick={() => setViewMode('pipeline')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            viewMode === 'pipeline' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
          }`}
        >
          Pipeline de Oportunidades
        </button>
        <button
          type="button"
          onClick={() => setViewMode('contracts')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            viewMode === 'contracts' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
          }`}
        >
          Contratos & Vínculo de Entrega
        </button>
      </div>

      {viewMode === 'pipeline' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {STAGES.map((stage) => {
            const opps = state.opportunities.filter((o) => o.stage === stage.id);
            return (
              <div key={stage.id} className="p-3.5 rounded-xl border border-line bg-surface space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-line">
                  <span className="font-semibold text-ink">{stage.label}</span>
                  <span className="font-mono text-ink-subtle tabular-nums">{opps.length}</span>
                </div>
                {opps.length === 0 ? (
                  <p className="text-xs text-ink-subtle py-4 text-center">Sem oportunidades</p>
                ) : (
                  <div className="space-y-2.5">
                    {opps.map((o) => (
                      <div key={o.id} className="p-3 rounded-lg border border-line bg-canvas space-y-1.5">
                        <p className="text-xs text-ink-subtle truncate">{o.accountName}</p>
                        <p className="text-sm font-medium text-ink leading-snug">{o.title}</p>
                        <div className="flex items-center justify-between text-xs pt-1 tabular-nums">
                          <span className="font-mono font-semibold text-ink">{formatBRL(o.value)}</span>
                          <span className="text-ink-subtle">{o.probability}%</span>
                        </div>
                        {o.linkedProjectId && (
                          <button
                            type="button"
                            onClick={() => onNavigate('projects')}
                            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer pt-1"
                          >
                            Projeto vinculado <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-5 rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-subtle">
                <th className="py-2.5 pr-4 font-medium">Contrato</th>
                <th className="py-2.5 px-3 font-medium">Cliente</th>
                <th className="py-2.5 px-3 font-medium">Vigência</th>
                <th className="py-2.5 px-3 font-medium">Projeto / Receita</th>
                <th className="py-2.5 pl-3 text-right font-medium">Valor Anual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {state.contracts.map((c) => {
                const proj = state.projects.find((p) => p.id === c.linkedProjectId);
                return (
                  <tr key={c.id} className="hover:bg-surface-subtle/50">
                    <td className="py-3 pr-4">
                      <p className="font-mono text-xs text-ink-subtle">{c.code}</p>
                      <p className="font-medium text-ink">{c.title}</p>
                    </td>
                    <td className="py-3 px-3 text-xs text-ink-muted">{c.accountName}</td>
                    <td className="py-3 px-3 text-xs font-mono tabular-nums text-ink-muted">
                      {formatDateBR(c.startDate)} — {formatDateBR(c.endDate)}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {proj ? (
                        <button
                          type="button"
                          onClick={() => onNavigate('projects')}
                          className="text-accent hover:underline font-medium cursor-pointer"
                        >
                          {proj.code} · {proj.name}
                        </button>
                      ) : (
                        <span className="text-ink-subtle">Sem projeto vinculado</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono tabular-nums font-semibold text-ink">
                      {formatBRL(c.annualValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
