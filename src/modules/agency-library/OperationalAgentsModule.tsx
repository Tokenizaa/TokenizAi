import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
import { DataOriginNotice } from '../../components/Common/DataOriginNotice';
import { AGENCY_AGENTS_283 } from '../../domain/agencyLibrary';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import { formatBRL, formatDateTimeBR } from '../../services/enterpriseService';
import type {
  AgentBlueprint,
  EnterpriseState,
  HomologationStatus,
  ModuleId,
  OperationalAgentInstance,
  UserRole,
} from '../../types/enterprise';

interface OperationalAgentsModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  onSetHomologation: (agent: AgentBlueprint, status: HomologationStatus) => void;
  onCreateRuntimeInstance: (input: {
    blueprintId: string;
    projectId: string;
    positionId?: string;
    guardrailPolicy?: string;
    provider?: OperationalAgentInstance['provider'];
    model?: string;
    adapter?: OperationalAgentInstance['adapter'];
    monthlyBudgetBRL?: number;
  }) => Promise<void>;
  onUpdateRuntimeInstance: (
    instanceId: string,
    patch: Partial<OperationalAgentInstance>
  ) => Promise<void>;
  onTriggerHeartbeat: (instanceId: string) => Promise<void>;
  onOpenChat: (target: { targetInstanceId: string }) => void;
  onNavigate: (moduleId: ModuleId) => void;
}

export const OperationalAgentsModule: React.FC<OperationalAgentsModuleProps> = ({
  state,
  activeRole,
  onSetHomologation,
  onCreateRuntimeInstance,
  onUpdateRuntimeInstance,
  onTriggerHeartbeat,
  onOpenChat,
  onNavigate,
}) => {
  const roleDef = ROLE_DEFINITIONS[activeRole];
  const canHomologate = roleDef.canHomologateAgents;
  const canManageRuntime = roleDef.canManageRuntime;

  const homologatedBlueprints = AGENCY_AGENTS_283.filter(
    (a) => (state.homologationOverrides[a.id] ?? a.homologationStatus) === 'homologado'
  );
  const evaluatingBlueprints = AGENCY_AGENTS_283.filter(
    (a) => (state.homologationOverrides[a.id] ?? a.homologationStatus) === 'em_avaliacao'
  );
  const vacantPositions = state.orgPositions.filter((p) => p.holderType === 'vago');

  const [selectedBlueprintId, setSelectedBlueprintId] = useState(homologatedBlueprints[0]?.id ?? 'agent-1');
  const [selectedProjectId, setSelectedProjectId] = useState(state.projects[0]?.id ?? '');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [adapter, setAdapter] = useState<OperationalAgentInstance['adapter']>('gemini-server-native');
  const [model, setModel] = useState('gemini-4-hydrogen');
  const [monthlyBudget, setMonthlyBudget] = useState(3500);
  const [guardrail, setGuardrail] = useState('Revisão humana obrigatória antes de escrita em produção');

  const [configInst, setConfigInst] = useState<OperationalAgentInstance | null>(null);
  const [editAdapter, setEditAdapter] = useState<OperationalAgentInstance['adapter']>('gemini-server-native');
  const [editModel, setEditModel] = useState('gemini-4-hydrogen');
  const [editBudget, setEditBudget] = useState(3000);
  const [editCredRef, setEditCredRef] = useState('ENV:GEMINI_API_KEY');
  const [editGuardrail, setEditGuardrail] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);

  const handlePrepare = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await onCreateRuntimeInstance({
        blueprintId: selectedBlueprintId,
        projectId: selectedProjectId,
        positionId: selectedPositionId || undefined,
        guardrailPolicy: guardrail,
        provider: adapter === 'paperclip-http-adapter' ? 'Paperclip External' : 'Google Gemini',
        model,
        adapter,
        monthlyBudgetBRL: Number(monthlyBudget) || 3000,
      });
      setFeedback('Instância operacional criada e vinculada ao runtime.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar instância operacional.');
    }
  };

  const openConfig = (inst: OperationalAgentInstance) => {
    setConfigInst(inst);
    setEditAdapter(inst.adapter);
    setEditModel(inst.model);
    setEditBudget(inst.monthlyBudgetBRL);
    setEditCredRef(inst.credentialRef);
    setEditGuardrail(inst.guardrailPolicy);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configInst) return;
    try {
      await onUpdateRuntimeInstance(configInst.id, {
        adapter: editAdapter,
        provider: editAdapter === 'paperclip-http-adapter' ? 'Paperclip External' : 'Google Gemini',
        runtimeEngine:
          editAdapter === 'paperclip-http-adapter'
            ? 'Paperclip Runtime'
            : 'TokenizAi Native Orchestrator',
        model: editModel.trim() || 'gemini-4-hydrogen',
        monthlyBudgetBRL: Number(editBudget) || configInst.monthlyBudgetBRL,
        credentialRef: editCredRef.trim() || 'ENV:GEMINI_API_KEY',
        guardrailPolicy: editGuardrail.trim(),
        executionState:
          editAdapter === 'paperclip-http-adapter' ? 'aguardando_paperclip' : 'ativo_pronto',
      });
      setConfigInst(null);
      setFeedback('Configuração de runtime atualizada.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao atualizar instância.');
    }
  };

  const handleTogglePause = async (inst: OperationalAgentInstance) => {
    try {
      const nextState =
        inst.executionState === 'pausado'
          ? inst.adapter === 'paperclip-http-adapter'
            ? 'aguardando_paperclip'
            : 'ativo_pronto'
          : 'pausado';
      await onUpdateRuntimeInstance(inst.id, { executionState: nextState });
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao alterar estado.');
    }
  };

  const handleHeartbeat = async (instId: string) => {
    setFeedback(null);
    try {
      await onTriggerHeartbeat(instId);
      setFeedback('Heartbeat executado e sessão registrada.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Falha ao executar heartbeat.');
    }
  };

  return (
    <div className="space-y-6">
      <DataOriginNotice
        sourceLabel="Separação entre Identidade (283 Perfis), Cargo Organizacional e Runtime Operacional — instâncias nativas Gemini já executam sessões reais; adaptador Paperclip externo permanece opcional"
        pendingIntegration="Paperclip External Endpoint (PAPERCLIP_ENDPOINT)"
        onConfigureIntegration={onNavigate}
      />

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg border border-accent/40 bg-accent-soft/60 text-xs text-ink flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-ink-muted cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Homologation Queue */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Fila de Homologação de Perfis ({evaluatingBlueprints.length} em avaliação)
            </h2>
            <p className="text-xs text-ink-subtle">
              Apenas perfis homologados pela Direção de IA ou Gestão podem ser instanciados para operação
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
                <span className="font-mono font-semibold text-ink">
                  {ag.emoji} {ag.code}
                </span>
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

      {/* Deploy New Operational Instance */}
      {canHomologate && (
        <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-ink">
              Instanciar Agente Operacional (Runtime & Posição)
            </h3>
          </div>
          <form onSubmit={handlePrepare} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
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
              <label className="block text-xs text-ink-subtle mb-1">Projeto</label>
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
              <label className="block text-xs text-ink-subtle mb-1">Adaptador</label>
              <select
                value={adapter}
                onChange={(e) => setAdapter(e.target.value as OperationalAgentInstance['adapter'])}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              >
                <option value="gemini-server-native">Gemini Nativo (Ativo)</option>
                <option value="paperclip-http-adapter">Paperclip HTTP (Externo)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-subtle mb-1">Cargo Vago (Opcional)</label>
              <select
                value={selectedPositionId}
                onChange={(e) => setSelectedPositionId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink"
              >
                <option value="">Sem cargo prévio</option>
                {vacantPositions.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-subtle mb-1">Teto Mensal (R$)</label>
              <input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-canvas text-ink font-mono"
              />
            </div>

            <div className="md:col-span-5">
              <label className="block text-xs text-ink-subtle mb-1">Política de Guardrail & Escopo</label>
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
              Instanciar
            </button>
          </form>
        </section>
      )}

      {/* Operational Instances Table */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Instâncias Operacionais & Orçamentos ({state.operationalInstances.length})
          </h3>
          <span className="text-xs text-ink-subtle">
            Referências simbólicas ENV:* — nenhum segredo exposto no navegador
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-subtle">
                <th className="py-2.5 pr-4 font-medium">Instância / Posição</th>
                <th className="py-2.5 px-3 font-medium">Adaptador & Modelo</th>
                <th className="py-2.5 px-3 font-medium">Orçamento Consumido</th>
                <th className="py-2.5 px-3 font-medium">Estado Operacional</th>
                <th className="py-2.5 pl-3 text-right font-medium">Controles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {state.operationalInstances.map((inst) => {
                const pos = state.orgPositions.find((p) => p.id === inst.positionId);
                const budgetPct = Math.min(
                  100,
                  Math.round((inst.spentBudgetBRL / Math.max(inst.monthlyBudgetBRL, 1)) * 100)
                );

                return (
                  <tr key={inst.id} className="hover:bg-surface-subtle/50">
                    <td className="py-3 pr-4">
                      <p className="font-mono text-xs font-semibold text-ink">{inst.instanceName}</p>
                      <p className="text-xs text-ink-muted">
                        {pos?.title ?? inst.division} · {inst.projectName}
                      </p>
                      <p className="text-[11px] text-ink-subtle mt-0.5">
                        Credencial: <span className="font-mono">{inst.credentialRef}</span>
                      </p>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <p className="font-mono text-ink">{inst.adapter}</p>
                      <p className="text-ink-subtle">{inst.provider} · {inst.model}</p>
                    </td>
                    <td className="py-3 px-3 text-xs tabular-nums">
                      <p className="font-mono text-ink">
                        {formatBRL(inst.spentBudgetBRL)} / {formatBRL(inst.monthlyBudgetBRL)}
                      </p>
                      <div className="mt-1 h-1.5 w-28 rounded-full bg-surface-subtle overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${budgetPct}%` }} />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <span
                        className={`font-medium capitalize ${
                          inst.executionState === 'ativo_pronto'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : inst.executionState === 'pausado'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {inst.executionState.replace(/_/g, ' ')}
                      </span>
                      <p className="text-[11px] text-ink-subtle font-mono">
                        HB: {formatDateTimeBR(inst.lastHeartbeat)}
                      </p>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenChat({ targetInstanceId: inst.id })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-line bg-canvas hover:border-accent text-xs font-medium text-ink cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-accent" />
                          Chat
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHeartbeat(inst.id)}
                          title="Executar Heartbeat agora"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-line bg-canvas hover:border-line-strong text-xs text-ink-muted hover:text-ink cursor-pointer"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          HB
                        </button>
                        {canManageRuntime && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTogglePause(inst)}
                              title={inst.executionState === 'pausado' ? 'Retomar instância' : 'Pausar instância'}
                              className="p-1.5 rounded-md border border-line bg-canvas text-ink-muted hover:text-ink cursor-pointer"
                            >
                              {inst.executionState === 'pausado' ? (
                                <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => openConfig(inst)}
                              title="Configurar runtime, modelo e orçamento"
                              className="p-1.5 rounded-md border border-line bg-canvas text-ink-muted hover:text-ink cursor-pointer"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Execution Sessions & Logs */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Sessões de Execução, Heartbeats & Custos ({state.executionSessions.length})
          </h3>
          <span className="text-xs text-ink-subtle">Custos contabilizados no Centro de Custo Fábrica de IA</span>
        </div>

        <div className="divide-y divide-line">
          {state.executionSessions.slice(0, 10).map((sess) => {
            const inst = state.operationalInstances.find((o) => o.id === sess.instanceId);
            return (
              <div key={sess.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-ink-subtle">
                    <span className="font-mono font-semibold text-ink">
                      {inst?.instanceName ?? sess.instanceId}
                    </span>
                    <span>·</span>
                    <span className="font-mono">{sess.adapterUsed}</span>
                    <span>·</span>
                    <span className="font-mono">{sess.modelUsed}</span>
                    <span>·</span>
                    <span>Por: {sess.triggeredBy}</span>
                  </div>
                  <p className="text-ink-muted">{sess.summary}</p>
                </div>

                <div className="text-right tabular-nums shrink-0">
                  <span
                    className={`font-medium ${
                      sess.status === 'concluida'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {sess.status.replace('_', ' ')}
                  </span>
                  <p className="text-[11px] text-ink-subtle font-mono">
                    {sess.tokensEstimated} tok · {formatBRL(sess.costBRL)} · {formatDateTimeBR(sess.finishedAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Config Modal */}
      {configInst && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40"
          onClick={() => setConfigInst(null)}
        >
          <form
            onSubmit={handleSaveConfig}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg p-5 rounded-2xl nc-glass-window space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">
                Configurar Runtime · {configInst.instanceName}
              </h3>
              <button type="button" onClick={() => setConfigInst(null)} className="text-ink-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-ink-subtle mb-1">Adaptador</label>
                <select
                  value={editAdapter}
                  onChange={(e) => setEditAdapter(e.target.value as OperationalAgentInstance['adapter'])}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                >
                  <option value="gemini-server-native">gemini-server-native</option>
                  <option value="paperclip-http-adapter">paperclip-http-adapter</option>
                </select>
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Modelo</label>
                <input
                  type="text"
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Orçamento Mensal (R$)</label>
                <input
                  type="number"
                  value={editBudget}
                  onChange={(e) => setEditBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-ink-subtle mb-1">Referência de Credencial (ENV:*)</label>
                <input
                  type="text"
                  value={editCredRef}
                  onChange={(e) => setEditCredRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-ink-subtle mb-1">Política de Guardrail</label>
                <input
                  type="text"
                  value={editGuardrail}
                  onChange={(e) => setEditGuardrail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfigInst(null)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Configuração
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
