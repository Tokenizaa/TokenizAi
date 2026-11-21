import React from 'react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { formatDateBR } from '../../services/enterpriseService';
import type { EnterpriseState, ModuleId, ProjectTask } from '../../types/enterprise';

interface OperationsModuleProps {
  state: EnterpriseState;
  onToggleTaskStatus: (taskId: string, nextStatus: ProjectTask['status']) => void;
  onNavigate: (moduleId: ModuleId) => void;
}

export const OperationsModule: React.FC<OperationsModuleProps> = ({
  state,
  onToggleTaskStatus,
  onNavigate,
}) => {
  const openTasks = state.tasks.filter((t) => t.status !== 'concluida');
  const openIncidents = state.incidents.filter((i) => i.status === 'aberto');

  return (
    <div className="space-y-6">
      <DataOriginNotice
        sourceLabel="Acompanhamento unificado de execução, tarefas humanas/agentes e incidentes"
        pendingIntegration="Paperclip Runtime (execução remota de agentes)"
        onConfigureIntegration={onNavigate}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Tarefas Ativas em Execução</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">{openTasks.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Incidentes Abertos</p>
          <p className="mt-1.5 font-display text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
            {openIncidents.length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Instâncias Paperclip Preparadas</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink tabular-nums">
            {state.operationalInstances.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 p-5 rounded-xl border border-line bg-surface space-y-4">
          <h2 className="text-base font-semibold text-ink">Fila Operacional de Tarefas & Entregas</h2>
          <div className="divide-y divide-line">
            {state.tasks.map((tsk) => {
              const proj = state.projects.find((p) => p.id === tsk.projectId);
              return (
                <div key={tsk.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-ink-subtle">
                      <span className="font-mono text-ink">{proj?.code ?? '—'}</span>
                      <span>·</span>
                      <span>{tsk.assigneeKind === 'humano' ? 'Colaborador' : 'Agente Paperclip'}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{formatDateBR(tsk.dueDate)}</span>
                    </div>
                    <p className="text-sm font-medium text-ink mt-0.5">{tsk.title}</p>
                    <p className="text-xs text-ink-muted">{tsk.assigneeName}</p>
                  </div>
                  <select
                    value={tsk.status}
                    onChange={(e) => onToggleTaskStatus(tsk.id, e.target.value as ProjectTask['status'])}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-line bg-canvas text-ink"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em_progresso">Em Progresso</option>
                    <option value="revisao">Revisão</option>
                    <option value="concluida">Concluída</option>
                  </select>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-5 p-5 rounded-xl border border-line bg-surface space-y-4">
          <h2 className="text-base font-semibold text-ink">Incidentes & Impedimentos</h2>
          <div className="space-y-3">
            {state.incidents.map((inc) => {
              const proj = state.projects.find((p) => p.id === inc.projectId);
              return (
                <div key={inc.id} className="p-3.5 rounded-lg border border-line bg-canvas space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono uppercase font-semibold text-red-600 dark:text-red-400">
                      {inc.severity}
                    </span>
                    <span className="capitalize text-ink-muted">{inc.status}</span>
                  </div>
                  <p className="text-sm font-medium text-ink">{inc.title}</p>
                  <p className="text-xs text-ink-subtle">
                    {proj?.code ?? '—'} · Responsável: {inc.ownerName} · {inc.openedAt}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
