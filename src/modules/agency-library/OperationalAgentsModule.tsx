import React, { useState } from 'react';
import { CheckCircle2, Cpu, Plus } from 'lucide-react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { AGENCY_AGENTS_283 } from '../../domain/agencyLibrary';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import type {
  AgentBlueprint,
  EnterpriseProject,
  EnterpriseState,
  HomologationStatus,
  ModuleId,
  UserRole,
} from '../../types/enterprise';

interface OperationalAgentsModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  onSetHomologation: (agent: AgentBlueprint, status: HomologationStatus) => void;
  onDeployInstance: (blueprint: AgentBlueprint, project: EnterpriseProject, guardrailPolicy: string) => void;
  onNavigate: (moduleId: ModuleId) => void;
}

export const OperationalAgentsModule: React.FC<OperationalAgentsModuleProps> = ({
  state,
  activeRole,
  onSetHomologation,
  onDeployInstance,
  onNavigate,
}) => {
  const canHomologate = ROLE_DEFINITIONS[activeRole].canHomologateAgents;

  const homologatedBlueprints = AGENCY_AGENTS_283.filter(
    (a) => (state.homologationOverrides[a.id] ?? a.homologationStatus) === 'homologado'
  );
  const evaluatingBlueprints = AGENCY_AGENTS_283.filter(
    (a) => (state.homologationOverrides[a.id] ?? a.homologationStatus) === 'em_avaliacao'
  );

  const [selectedBlueprintId, setSelectedBlueprintId] = useState(homologatedBlueprints[0]?.id ?? 'agent-7');
  const [selectedProjectId, setSelectedProjectId] = useState(state.projects[0]?.id ?? '');
  const [guardrail, setGuardrail] = useState('Revisão humana obrigatória antes de escrita em produção');

  const handlePrepare = (e: React.FormEvent) => {
    e.preventDefault();
    const bp = AGENCY_AGENTS_283.find((a) => a.id === selectedBlueprintId);
    const pr = state.projects.find((p) => p.id === selectedProjectId);
    if (!bp || !pr) return;
    onDeployInstance(bp, pr, guardrail);
  };

  return (
    <div className="space-y-6">
      <DataOriginNotice
        sourceLabel="Separação estrita entre Perfis da Biblioteca (Templates) e Instâncias Operacionais implantadas no runtime Paperclip"
        pendingIntegration="Paperclip Runtime Endpoint (PAPERCLIP_ENDPOINT)"
        onConfigureIntegration={onNavigate}
      />

      {/* Homologation Queue */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Fila de Homologação de Perfis ({evaluatingBlueprints.length} em avaliação)
            </h2>
            <p className="text-xs text-ink-subtle">
              Apenas perfis homologados pela Direção de IA ou Gestão podem ser instanciados no Paperclip
            </p>
          </div>
          <span className="font-mono text-xs text-ink-muted tabular-nums">
            {homologatedBlueprints.length} homologados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {evaluatingBlueprints.slice(0, 6).map((ag) => (
            <div key={ag.id} className="p-3.5 rounded-lg border border-line bg-canvas space-y-2 text-xs">
              <div className="flex items-center justify-between text-ink-subtle">
                <span className="font-mono font-semibold text-ink">{ag.code}</span>
                <span>{ag.division}</span>
              </div>
              <p className="text-sm font-semibold text-ink">{ag.name}</p>
              <p className="text-ink-muted line-clamp-2">{ag.methodology}</p>
              {canHomologate && (
                <button
                  type="button"
                  onClick={() => onSetHomologation(ag, 'homologado')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent text-white font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aprovar Homologação
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Prepare Paperclip Runtime Instance */}
      {canHomologate && (
        <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-ink">
              Preparar Nova Instância Operacional para Paperclip Runtime
            </h3>
          </div>
          <form onSubmit={handlePrepare} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs text-ink-subtle mb-1">Perfil Homologado</label>
              <select
                value={selectedBlueprintId}
                onChange={(e) => setSelectedBlueprintId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              >
                {homologatedBlueprints.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-subtle mb-1">Projeto Vinculado</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              >
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-subtle mb-1">Política de Guardrail</label>
              <input
                type="text"
                value={guardrail}
                onChange={(e) => setGuardrail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Instanciar para Paperclip
            </button>
          </form>
        </section>
      )}

      {/* Operational Instances Table */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <h3 className="text-sm font-semibold text-ink">
          Instâncias Operacionais Preparadas ({state.operationalInstances.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-subtle">
                <th className="py-2.5 pr-4 font-medium">Instância / Blueprint</th>
                <th className="py-2.5 px-3 font-medium">Projeto</th>
                <th className="py-2.5 px-3 font-medium">Guardrail</th>
                <th className="py-2.5 pl-3 text-right font-medium">Estado Paperclip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {state.operationalInstances.map((inst) => (
                <tr key={inst.id} className="hover:bg-surface-subtle/50">
                  <td className="py-3 pr-4">
                    <p className="font-mono text-xs font-semibold text-ink">{inst.instanceName}</p>
                    <p className="text-xs text-ink-subtle">
                      Base: {inst.blueprintCode} · {inst.division}
                    </p>
                  </td>
                  <td className="py-3 px-3 text-xs text-ink-muted">{inst.projectName}</td>
                  <td className="py-3 px-3 text-xs text-ink-muted">{inst.guardrailPolicy}</td>
                  <td className="py-3 pl-3 text-right text-xs">
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      Aguardando Paperclip
                    </span>
                    <p className="text-[11px] text-ink-subtle">{inst.lastHeartbeat}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
