import React from 'react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { formatBRL } from '../../services/enterpriseService';
import type { EnterpriseState, ModuleId } from '../../types/enterprise';

interface MarketingModuleProps {
  state: EnterpriseState;
  onNavigate: (moduleId: ModuleId) => void;
}

export const MarketingModule: React.FC<MarketingModuleProps> = ({ state, onNavigate }) => {
  const totalLeads = state.campaigns.reduce((a, c) => a + c.leadsGenerated, 0);
  const totalSql = state.campaigns.reduce((a, c) => a + c.qualifiedSql, 0);
  const totalSpent = state.campaigns.reduce((a, c) => a + c.spent, 0);
  const convRate = totalLeads > 0 ? Math.round((totalSql / totalLeads) * 100) : 0;

  return (
    <div className="space-y-8">
      <DataOriginNotice
        sourceLabel="Métricas de aquisição e campanhas demonstrativas"
        pendingIntegration="LinkedIn Ads, Google Analytics & HubSpot/CRM"
        onConfigureIntegration={onNavigate}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Leads Gerados (MQL)</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">{totalLeads}</p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Qualificados para Comercial (SQL)</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">{totalSql}</p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Conversão MQL → SQL</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">{convRate}%</p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Investimento Executado</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">{formatBRL(totalSpent)}</p>
        </div>
      </div>

      <div className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Campanhas & Canais de Aquisição</h2>
            <p className="text-xs text-ink-subtle">Integração direta de leads qualificados com o pipeline comercial</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('commercial')}
            className="text-xs font-medium text-accent hover:underline cursor-pointer"
          >
            Ver pipeline comercial
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-subtle">
                <th className="py-2.5 pr-4 font-medium">Campanha</th>
                <th className="py-2.5 px-3 font-medium">Canal</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 text-right font-medium">Leads / SQL</th>
                <th className="py-2.5 px-3 text-right font-medium">CAC Est.</th>
                <th className="py-2.5 pl-3 text-right font-medium">Orçamento / Gasto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {state.campaigns.map((cmp) => (
                <tr key={cmp.id} className="hover:bg-surface-subtle/50">
                  <td className="py-3 pr-4 font-medium text-ink">{cmp.name}</td>
                  <td className="py-3 px-3 text-xs text-ink-muted">{cmp.channel}</td>
                  <td className="py-3 px-3 text-xs capitalize text-emerald-700 dark:text-emerald-400 font-medium">
                    {cmp.status}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-ink">
                    {cmp.leadsGenerated} / {cmp.qualifiedSql}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-ink-muted">
                    {formatBRL(cmp.cacEstimate)}
                  </td>
                  <td className="py-3 pl-3 text-right font-mono tabular-nums text-xs text-ink">
                    {formatBRL(cmp.spent)} / {formatBRL(cmp.budget)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
