import React, { useState } from 'react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { formatBRL, formatDateBR } from '../../services/enterpriseService';
import type { EnterpriseState, ModuleId } from '../../types/enterprise';

interface CustomersModuleProps {
  state: EnterpriseState;
  onNavigate: (moduleId: ModuleId) => void;
}

export const CustomersModule: React.FC<CustomersModuleProps> = ({ state, onNavigate }) => {
  const [search, setSearch] = useState('');

  const filtered = state.accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.segment.toLowerCase().includes(search.toLowerCase()) ||
      a.primaryContact.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <DataOriginNotice
        sourceLabel="Carteira de clientes, contatos e saúde operacional demonstrativa"
        pendingIntegration="CRM Corporativo & Base Contratual"
        onConfigureIntegration={onNavigate}
      />

      <div className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Empresas & Relacionamento</h2>
            <p className="text-xs text-ink-subtle">
              Visão integrada de receita recorrente, contratos e projetos entregues por cliente
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar empresa, segmento ou contato..."
            className="w-full sm:w-72 px-3 py-1.5 text-sm rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-subtle">
                <th className="py-2.5 pr-4 font-medium">Empresa / Segmento</th>
                <th className="py-2.5 px-3 font-medium">Contato Principal</th>
                <th className="py-2.5 px-3 font-medium">Status & Saúde</th>
                <th className="py-2.5 px-3 font-medium">Projetos Vinculados</th>
                <th className="py-2.5 pl-3 text-right font-medium">MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((acc) => {
                const linkedProjects = state.projects.filter((p) => p.linkedAccountId === acc.id);
                return (
                  <tr key={acc.id} className="hover:bg-surface-subtle/50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink">{acc.name}</p>
                      <p className="text-xs text-ink-subtle">
                        {acc.segment} · {acc.tier}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <p className="text-ink font-medium">{acc.primaryContact}</p>
                      <p className="text-ink-subtle">{acc.contactEmail}</p>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <span className="capitalize text-ink">{acc.status}</span>
                      <span className="mx-1.5 text-ink-subtle">·</span>
                      <span
                        className={
                          acc.healthScore === 'estável'
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-amber-700 dark:text-amber-400 font-medium'
                        }
                      >
                        Saúde {acc.healthScore}
                      </span>
                      <p className="text-ink-subtle mt-0.5 tabular-nums">
                        Último contato: {formatDateBR(acc.lastInteraction)}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {linkedProjects.length > 0 ? (
                        linkedProjects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onNavigate('projects')}
                            className="block text-accent hover:underline cursor-pointer"
                          >
                            {p.code} · {p.name}
                          </button>
                        ))
                      ) : (
                        <span className="text-ink-subtle">Prospecção inicial</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono tabular-nums font-semibold text-ink">
                      {acc.mrr > 0 ? formatBRL(acc.mrr) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
