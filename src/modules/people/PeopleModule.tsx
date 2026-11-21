import React, { useState } from 'react';
import { Avatar } from '../../components/Common/Avatar';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import type { EnterpriseState } from '../../types/enterprise';

interface PeopleModuleProps {
  state: EnterpriseState;
}

export const PeopleModule: React.FC<PeopleModuleProps> = ({ state }) => {
  const [view, setView] = useState<'directory' | 'orgchart'>('directory');

  const executives = state.people.filter((p) => !p.managerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Pessoas, Lideranças & Estrutura Híbrida</h2>
          <p className="text-xs text-ink-subtle">
            Representação clara de colaboradores humanos (autoridade e responsabilidade) separados dos agentes operacionais de IA
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-subtle border border-line">
          <button
            type="button"
            onClick={() => setView('directory')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              view === 'directory' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Colaboradores & Capacidade
          </button>
          <button
            type="button"
            onClick={() => setView('orgchart')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              view === 'orgchart' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Organograma Híbrido
          </button>
        </div>
      </div>

      {view === 'directory' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.people.map((person) => {
            const projects = state.projects.filter((pr) => person.assignedProjectIds.includes(pr.id));
            return (
              <div key={person.id} className="p-5 rounded-xl border border-line bg-surface space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name={person.name} src={person.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold text-ink truncate">{person.name}</h3>
                    <p className="text-xs text-ink-muted truncate">{person.roleTitle}</p>
                    <p className="text-[11px] text-ink-subtle truncate">
                      {person.department} · {ROLE_DEFINITIONS[person.accessRole].label}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-subtle">Capacidade Alocada</span>
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        person.capacityPercent >= 90 ? 'text-amber-700 dark:text-amber-400' : 'text-ink'
                      }`}
                    >
                      {person.capacityPercent}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                    <div
                      className={`h-full rounded-full ${person.capacityPercent >= 90 ? 'bg-amber-600' : 'bg-accent'}`}
                      style={{ width: `${person.capacityPercent}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-line text-xs space-y-1">
                  <p className="text-ink-subtle">Competências: {person.competencies.join(' · ')}</p>
                  <p className="text-ink-muted">
                    Projetos: {projects.map((p) => p.code).join(', ') || 'Disponível'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-line bg-surface space-y-6">
          {executives.map((ceo) => {
            const reports = state.people.filter((p) => p.managerId === ceo.id);
            return (
              <div key={ceo.id} className="space-y-4">
                <div className="p-4 rounded-xl border border-accent/40 bg-canvas flex items-center gap-3 max-w-md">
                  <Avatar name={ceo.name} src={ceo.avatarUrl} />
                  <div>
                    <p className="text-xs font-mono text-accent">Autoridade Humana · Direção</p>
                    <p className="text-sm font-bold text-ink">{ceo.name}</p>
                    <p className="text-xs text-ink-muted">{ceo.roleTitle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-6">
                  {reports.map((rep) => {
                    const subReports = state.people.filter((s) => s.managerId === rep.id);
                    const supervisedInstances = state.operationalInstances.filter((inst) => {
                      const pr = state.projects.find((p) => p.id === inst.projectId);
                      return pr?.leadId === rep.id;
                    });
                    return (
                      <div key={rep.id} className="p-4 rounded-xl border border-line bg-canvas space-y-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={rep.name} src={rep.avatarUrl} size="sm" />
                          <div>
                            <p className="text-sm font-semibold text-ink">{rep.name}</p>
                            <p className="text-xs text-ink-muted">{rep.roleTitle}</p>
                          </div>
                        </div>

                        {subReports.length > 0 && (
                          <div className="pt-2 border-t border-line space-y-1.5">
                            <p className="text-[11px] font-medium text-ink-subtle">Equipe Humana Subordinada</p>
                            {subReports.map((sr) => (
                              <div key={sr.id} className="text-xs text-ink">
                                {sr.name} <span className="text-ink-subtle">· {sr.roleTitle}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {supervisedInstances.length > 0 && (
                          <div className="pt-2 border-t border-line space-y-1">
                            <p className="text-[11px] font-medium text-ink-subtle">
                              Agentes Operacionais Supervisionados (Runtime IA)
                            </p>
                            {supervisedInstances.map((ai) => (
                              <div key={ai.id} className="text-xs font-mono text-ink-muted">
                                {ai.instanceName} <span className="font-sans text-ink-subtle">({ai.projectName})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
