import React, { useState } from 'react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { formatBRL } from '../../services/enterpriseService';
import type { EnterpriseState, ModuleId } from '../../types/enterprise';

interface ProductsModuleProps {
  state: EnterpriseState;
  onNavigate: (moduleId: ModuleId) => void;
}

export const ProductsModule: React.FC<ProductsModuleProps> = ({ state, onNavigate }) => {
  const [kindFilter, setKindFilter] = useState<'todos' | 'Produto' | 'Serviço'>('todos');

  const items = state.products.filter((p) => kindFilter === 'todos' || p.kind === kindFilter);

  return (
    <div className="space-y-8">
      <DataOriginNotice
        sourceLabel="Catálogo de produtos e serviços separado dos projetos de execução"
        pendingIntegration="Telemetria de Uso & Centro de Custos ERP"
        onConfigureIntegration={onNavigate}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-subtle border border-line">
          {(['todos', 'Produto', 'Serviço'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setKindFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                kindFilter === tab ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab === 'todos' ? 'Todos' : tab === 'Produto' ? 'Produtos' : 'Serviços'}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-subtle">
          Um produto contínuo pode originar múltiplos projetos e versões de entrega
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {items.map((item) => {
          const owner = state.people.find((p) => p.id === item.ownerId);
          const margin = item.monthlyRevenue - item.operationalCost;
          const linkedProjects = state.projects.filter((pr) => item.linkedProjectIds.includes(pr.id));

          return (
            <div key={item.id} className="p-5 rounded-xl border border-line bg-surface flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-ink-subtle">
                  <span>{item.kind}</span>
                  <span className="capitalize font-medium text-ink">
                    {item.lifecycle.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="font-display text-base font-bold text-ink">{item.name}</h3>
                <p className="text-xs text-ink-muted">{item.roadmapPhase}</p>
              </div>

              <div className="pt-3 border-t border-line space-y-2 text-xs">
                <div className="flex items-center justify-between tabular-nums">
                  <span className="text-ink-subtle">Receita Mensal</span>
                  <span className="font-mono font-semibold text-ink">{formatBRL(item.monthlyRevenue)}</span>
                </div>
                <div className="flex items-center justify-between tabular-nums">
                  <span className="text-ink-subtle">Custo Operacional</span>
                  <span className="font-mono text-ink-muted">{formatBRL(item.operationalCost)}</span>
                </div>
                <div className="flex items-center justify-between tabular-nums">
                  <span className="text-ink-subtle">Margem Direta</span>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatBRL(margin)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-subtle">Responsável</span>
                  <span className="text-ink">{owner?.name ?? '—'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-line space-y-1.5">
                <p className="text-[11px] font-medium text-ink-subtle">
                  Projetos relacionados ({linkedProjects.length})
                </p>
                {linkedProjects.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => onNavigate('projects')}
                    className="block text-xs text-accent hover:underline cursor-pointer text-left"
                  >
                    {pr.code} · {pr.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
