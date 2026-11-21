import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import { formatBRL, formatDateBR } from '../../services/enterpriseService';
import type { EnterpriseState, FinancialEntry, ModuleId, UserRole } from '../../types/enterprise';

interface FinanceModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  onAddEntry: (entry: Omit<FinancialEntry, 'id' | 'origin'>) => void;
  onNavigate: (moduleId: ModuleId) => void;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  state,
  activeRole,
  onAddEntry,
  onNavigate,
}) => {
  const [filterType, setFilterType] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'receita' | 'despesa'>('receita');
  const [category, setCategory] = useState('Receita Recorrente SaaS');
  const [costCenter, setCostCenter] = useState('Engenharia & Produto');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('2026-11-30');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canManage = ROLE_DEFINITIONS[activeRole].canManageFinance;

  const totals = useMemo(() => {
    const receitas = state.financialEntries.filter((f) => f.type === 'receita');
    const despesas = state.financialEntries.filter((f) => f.type === 'despesa');
    const sum = (list: FinancialEntry[]) => list.reduce((a, b) => a + b.amount, 0);
    const totalRec = sum(receitas);
    const totalDesp = sum(despesas);
    const aReceber = sum(receitas.filter((r) => r.status !== 'pago'));
    const aPagar = sum(despesas.filter((d) => d.status !== 'pago'));
    const conciliatedCount = state.financialEntries.filter((f) => f.reconciled).length;
    return { totalRec, totalDesp, resultado: totalRec - totalDesp, aReceber, aPagar, conciliatedCount };
  }, [state.financialEntries]);

  const filtered = useMemo(
    () => state.financialEntries.filter((e) => filterType === 'todos' || e.type === filterType),
    [state.financialEntries, filterType]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const numeric = Number(amount);
    if (!title.trim() || Number.isNaN(numeric) || numeric <= 0) {
      setErrorMsg('Informe descrição válida e valor maior que zero.');
      return;
    }
    try {
      onAddEntry({
        title: title.trim(),
        type,
        category,
        costCenter,
        amount: numeric,
        dueDate,
        status: 'previsto',
        reconciled: false,
      });
      setTitle('');
      setAmount('');
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao registrar.');
    }
  };

  return (
    <div className="space-y-6">
      <DataOriginNotice
        sourceLabel="Lançamentos e orçamentos demonstrativos — nenhuma transação bancária real foi executada"
        pendingIntegration="Open Finance, Gateway de Cobrança e Emissor Fiscal"
        onConfigureIntegration={onNavigate}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Receitas (Realizado + Previsto)</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">{formatBRL(totals.totalRec)}</p>
          <p className="mt-1 text-xs text-ink-muted tabular-nums">A receber: {formatBRL(totals.aReceber)}</p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Despesas (Realizado + Previsto)</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">{formatBRL(totals.totalDesp)}</p>
          <p className="mt-1 text-xs text-ink-muted tabular-nums">A pagar: {formatBRL(totals.aPagar)}</p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Resultado Operacional</p>
          <p className={`mt-1.5 font-display text-xl font-bold tabular-nums ${totals.resultado >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
            {formatBRL(totals.resultado)}
          </p>
          <p className="mt-1 text-xs text-ink-muted tabular-nums">Margem líquida demonstrativa</p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Conciliação Bancária</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">
            {totals.conciliatedCount}/{state.financialEntries.length}
          </p>
          <p className="mt-1 text-xs text-ink-muted">Aguardando conector Open Finance</p>
        </div>
      </div>

      {/* Ledger & Controls */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-subtle border border-line">
            {(['todos', 'receita', 'despesa'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterType(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  filterType === tab ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tab === 'todos' ? 'Todos' : tab === 'receita' ? 'Contas a Receber' : 'Contas a Pagar'}
              </button>
            ))}
          </div>

          {canManage ? (
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar Previsão
            </button>
          ) : (
            <span className="text-xs text-ink-subtle">Somente perfil Financeiro ou Direção pode lançar</span>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-line bg-canvas space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Descrição do lançamento"
                className="px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink focus:outline-none focus:border-accent"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'receita' | 'despesa')}
                className="px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink"
              >
                <option value="receita">Receita (A Receber)</option>
                <option value="despesa">Despesa (A Pagar)</option>
              </select>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Valor (BRL)"
                className="px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink font-mono"
              />
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Categoria"
                className="px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink"
              />
              <select
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink"
              >
                {state.costCenters.map((cc) => (
                  <option key={cc.id} value={cc.name}>
                    {cc.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink font-mono"
              />
            </div>
            {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted hover:text-ink cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Lançamento
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-subtle">
                <th className="py-2.5 pr-4 font-medium">Descrição</th>
                <th className="py-2.5 px-3 font-medium">Centro de Custo</th>
                <th className="py-2.5 px-3 font-medium">Vencimento</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 pl-3 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-surface-subtle/50 transition-colors">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink">{entry.title}</p>
                    <p className="text-xs text-ink-subtle">
                      {entry.category} · {entry.reconciled ? 'Conciliado' : 'Pendente conciliação'}
                    </p>
                  </td>
                  <td className="py-3 px-3 text-xs text-ink-muted">{entry.costCenter}</td>
                  <td className="py-3 px-3 text-xs font-mono tabular-nums text-ink-muted">
                    {formatDateBR(entry.dueDate)}
                  </td>
                  <td className="py-3 px-3 text-xs font-medium">
                    <span
                      className={
                        entry.status === 'pago'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : entry.status === 'atrasado'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }
                    >
                      {entry.status === 'pago' ? 'Liquidado' : entry.status === 'atrasado' ? 'Em atraso' : 'Previsto'}
                    </span>
                  </td>
                  <td
                    className={`py-3 pl-3 text-right font-mono tabular-nums font-medium ${
                      entry.type === 'receita' ? 'text-ink' : 'text-ink-muted'
                    }`}
                  >
                    {entry.type === 'despesa' ? '- ' : '+ '}
                    {formatBRL(entry.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cost Centers & Budgets */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <h3 className="text-sm font-semibold text-ink">Orçamento por Centro de Custo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.costCenters.map((cc) => {
            const pct = Math.min(100, Math.round((cc.spent / cc.allocated) * 100));
            return (
              <div key={cc.id} className="p-4 rounded-lg border border-line bg-canvas space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{cc.name}</span>
                  <span className="font-mono text-xs tabular-nums text-ink-muted">{pct}% utilizado</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-ink-subtle tabular-nums">
                  <span>Realizado: {formatBRL(cc.spent)}</span>
                  <span>Orçado: {formatBRL(cc.allocated)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
