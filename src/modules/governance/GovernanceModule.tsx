import React, { useMemo, useState } from 'react';
import { CheckCircle2, Plus, ShieldCheck } from 'lucide-react';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import { formatDateBR } from '../../services/enterpriseService';
import type { EnterpriseState, GovernanceType, UserRole } from '../../types/enterprise';

interface GovernanceModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  onCreateRecord: (input: {
    type: 'DEC' | 'CNS' | 'DELIB';
    title: string;
    summary: string;
    linkedProjectId?: string;
  }) => void;
  onApproveRecord: (recordId: string) => void;
}

export const GovernanceModule: React.FC<GovernanceModuleProps> = ({
  state,
  activeRole,
  onCreateRecord,
  onApproveRecord,
}) => {
  const [typeFilter, setTypeFilter] = useState<'todos' | GovernanceType>('todos');
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState<'DEC' | 'CNS' | 'DELIB'>('DEC');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [linkedProjectId, setLinkedProjectId] = useState('');

  const canApprove = ROLE_DEFINITIONS[activeRole].canApproveGovernance;

  const filtered = useMemo(
    () => state.governance.filter((g) => typeFilter === 'todos' || g.type === typeFilter),
    [state.governance, typeFilter]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) return;
    onCreateRecord({
      type: docType,
      title: title.trim(),
      summary: summary.trim(),
      linkedProjectId: linkedProjectId || undefined,
    });
    setTitle('');
    setSummary('');
    setShowForm(false);
  };

  return (
    <div className="space-y-8">
      <div className="p-6 rounded-2xl border border-line bg-surface flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              Portal de Governança Corporativa (DEC · CNS · DELIB · Auditoria)
            </h2>
            <p className="text-xs text-ink-muted">
              Rastreabilidade de decisões estratégicas, alçadas de aprovação e trilha auditável vinculada aos projetos
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Registro Deliberativo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-xl border border-line bg-surface space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as 'DEC' | 'CNS' | 'DELIB')}
              className="px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink"
            >
              <option value="DEC">DEC — Decisão Executiva</option>
              <option value="CNS">CNS — Deliberação de Conselho</option>
              <option value="DELIB">DELIB — Documento Deliberativo</option>
            </select>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da decisão ou deliberação"
              className="md:col-span-2 px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink"
            />
          </div>
          <textarea
            rows={2}
            required
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Fundamentação, impacto e escopo da decisão..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              value={linkedProjectId}
              onChange={(e) => setLinkedProjectId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
            >
              <option value="">Sem vínculo específico a projeto</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Vincular a {p.code} — {p.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
              >
                Protocolar Registro
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-subtle border border-line w-fit overflow-x-auto">
        {(['todos', 'DEC', 'CNS', 'DELIB', 'AUDIT'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTypeFilter(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              typeFilter === tab ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {tab === 'todos' ? 'Todos' : tab}
          </button>
        ))}
      </div>

      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {filtered.map((rec) => {
          const proj = state.projects.find((p) => p.id === rec.linkedProjectId);
          return (
            <div key={rec.id} className="p-5 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                  <span className="font-mono font-semibold text-accent">{rec.code}</span>
                  <span>·</span>
                  <span>{rec.authorityRole}</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">{formatDateBR(rec.createdAt)}</span>
                  <span>·</span>
                  <span className="font-mono">hash:{rec.auditHash}</span>
                  {proj && (
                    <>
                      <span>·</span>
                      <span className="text-ink font-medium">{proj.code}</span>
                    </>
                  )}
                </div>
                <h3 className="text-sm font-bold text-ink">{rec.title}</h3>
                <p className="text-xs text-ink-muted leading-relaxed">{rec.summary}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-xs font-semibold ${
                    rec.status === 'aprovado'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {rec.status === 'aprovado'
                    ? 'Aprovado'
                    : rec.status === 'em_deliberacao'
                    ? 'Em Deliberação'
                    : 'Pendente'}
                </span>

                {rec.status !== 'aprovado' && canApprove && (
                  <button
                    type="button"
                    onClick={() => onApproveRecord(rec.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-soft text-accent-ink text-xs font-semibold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aprovar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
