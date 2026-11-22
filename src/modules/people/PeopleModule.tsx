import React, { useMemo, useState } from 'react';
import {
  Bot,
  Building2,
  Edit3,
  MessageSquare,
  Plus,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Avatar } from '../../components/Common/Avatar';
import { AUTHORITY_LABELS, ROLE_DEFINITIONS } from '../../domain/permissions';
import { formatBRL } from '../../services/enterpriseService';
import type {
  AuthorityLevel,
  DepartmentRecord,
  EnterpriseState,
  OrgPosition,
  UserRole,
} from '../../types/enterprise';

interface PeopleModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  onCreateDepartment: (input: {
    code: string;
    name: string;
    description: string;
    budgetAllocatedBRL: number;
  }) => Promise<void>;
  onCreatePosition: (input: Partial<OrgPosition>) => Promise<void>;
  onUpdatePosition: (positionId: string, patch: Partial<OrgPosition>) => Promise<void>;
  onOpenChat: (target: {
    conversationId?: string;
    targetInstanceId?: string;
    departmentId?: string;
  }) => void;
}

export const PeopleModule: React.FC<PeopleModuleProps> = ({
  state,
  activeRole,
  onCreateDepartment,
  onCreatePosition,
  onUpdatePosition,
  onOpenChat,
}) => {
  const [view, setView] = useState<'orgchart' | 'directory'>('orgchart');
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [showPosForm, setShowPosForm] = useState(false);
  const [editingPos, setEditingPos] = useState<OrgPosition | null>(null);

  // Department draft
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptBudget, setDeptBudget] = useState(60000);

  // Position draft
  const [posTitle, setPosTitle] = useState('');
  const [posDeptId, setPosDeptId] = useState(state.departments[0]?.id ?? '');
  const [posReportsTo, setPosReportsTo] = useState(state.orgPositions[0]?.id ?? '');
  const [posAuthority, setPosAuthority] = useState<AuthorityLevel>('operacional');
  const [posHolderType, setPosHolderType] = useState<OrgPosition['holderType']>('vago');
  const [posHolderId, setPosHolderId] = useState('');
  const [posBudgetLimit, setPosBudgetLimit] = useState(5000);

  // Edit position draft
  const [editReportsTo, setEditReportsTo] = useState('');
  const [editHolderType, setEditHolderType] = useState<OrgPosition['holderType']>('vago');
  const [editHolderId, setEditHolderId] = useState('');
  const [editBudget, setEditBudget] = useState(5000);

  const [feedback, setFeedback] = useState<string | null>(null);
  const canManageOrg = ROLE_DEFINITIONS[activeRole].canManageOrg;

  const vacantPositionsCount = state.orgPositions.filter((p) => p.holderType === 'vago').length;
  const agentPositionsCount = state.orgPositions.filter((p) => p.holderType === 'agente_operacional').length;

  const childrenByParent = useMemo(() => {
    const map = new Map<string, OrgPosition[]>();
    for (const pos of state.orgPositions) {
      const key = pos.reportsToPositionId || '__root__';
      const list = map.get(key) ?? [];
      list.push(pos);
      map.set(key, list);
    }
    return map;
  }, [state.orgPositions]);

  const resolveHolder = (pos: OrgPosition) => {
    if (pos.holderType === 'humano' && pos.holderId) {
      const person = state.people.find((p) => p.id === pos.holderId);
      return {
        name: person?.name ?? 'Colaborador',
        subtitle: person?.email ?? '',
        avatarUrl: person?.avatarUrl,
      };
    }
    if (pos.holderType === 'agente_operacional' && pos.holderId) {
      const inst = state.operationalInstances.find((o) => o.id === pos.holderId);
      return {
        name: inst?.instanceName ?? 'Agente Operacional',
        subtitle: inst ? `${inst.blueprintCode} · ${inst.model}` : '',
        instanceId: inst?.id,
      };
    }
    return {
      name: 'Posição Vaga (Aguardando Alocação)',
      subtitle: 'Sem humano ou agente operacional vinculado',
    };
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptCode.trim() || !deptName.trim()) return;
    try {
      await onCreateDepartment({
        code: deptCode.trim(),
        name: deptName.trim(),
        description: deptDesc.trim(),
        budgetAllocatedBRL: Number(deptBudget) || 50000,
      });
      setDeptCode('');
      setDeptName('');
      setDeptDesc('');
      setShowDeptForm(false);
      setFeedback('Departamento criado e auditado no servidor.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar departamento.');
    }
  };

  const handleCreatePos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posTitle.trim() || !posDeptId) return;
    try {
      await onCreatePosition({
        title: posTitle.trim(),
        departmentId: posDeptId,
        reportsToPositionId: posReportsTo || undefined,
        authorityLevel: posAuthority,
        holderType: posHolderType,
        holderId: posHolderType === 'vago' ? undefined : posHolderId || undefined,
        budgetLimitBRL: Number(posBudgetLimit) || 5000,
      });
      setPosTitle('');
      setPosHolderId('');
      setShowPosForm(false);
      setFeedback('Posição organizacional criada na hierarquia.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar posição.');
    }
  };

  const startEditPosition = (pos: OrgPosition) => {
    setEditingPos(pos);
    setEditReportsTo(pos.reportsToPositionId ?? '');
    setEditHolderType(pos.holderType);
    setEditHolderId(pos.holderId ?? '');
    setEditBudget(pos.budgetLimitBRL);
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPos) return;
    try {
      await onUpdatePosition(editingPos.id, {
        reportsToPositionId: editReportsTo || undefined,
        holderType: editHolderType,
        holderId: editHolderType === 'vago' ? undefined : editHolderId || undefined,
        budgetLimitBRL: Number(editBudget) || editingPos.budgetLimitBRL,
      });
      setEditingPos(null);
      setFeedback('Hierarquia e ocupante da posição atualizados.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao atualizar posição.');
    }
  };

  const renderPositionNode = (pos: OrgPosition, depth = 0): React.ReactNode => {
    const holder = resolveHolder(pos);
    const dept = state.departments.find((d) => d.id === pos.departmentId);
    const children = childrenByParent.get(pos.id) ?? [];
    const isVacant = pos.holderType === 'vago';
    const isAgent = pos.holderType === 'agente_operacional';

    return (
      <div key={pos.id} className={depth > 0 ? 'pl-4 md:pl-7 border-l border-line space-y-3' : 'space-y-3'}>
        <div
          className={`p-4 rounded-xl border bg-canvas flex flex-wrap items-start justify-between gap-4 ${
            isVacant
              ? 'border-amber-500/40'
              : isAgent
              ? 'border-accent/40'
              : 'border-line'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            {isAgent ? (
              <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            ) : isVacant ? (
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
            ) : (
              <Avatar name={holder.name} src={holder.avatarUrl} size="sm" />
            )}

            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
                <span className="font-mono font-semibold text-accent">{dept?.code ?? 'ORG'}</span>
                <span>·</span>
                <span>{AUTHORITY_LABELS[pos.authorityLevel]}</span>
                <span>·</span>
                <span className={isVacant ? 'text-amber-700 dark:text-amber-400 font-semibold' : ''}>
                  {pos.holderType === 'humano'
                    ? 'Autoridade Humana'
                    : pos.holderType === 'agente_operacional'
                    ? 'Agente Operacional (Paperclip)'
                    : 'Cargo Vago'}
                </span>
              </div>
              <h4 className="font-display text-sm font-bold text-ink">{pos.title}</h4>
              <p className="text-xs text-ink-muted">
                {holder.name}
                {holder.subtitle ? ` · ${holder.subtitle}` : ''}
              </p>
              <p className="text-[11px] text-ink-subtle tabular-nums">
                Alçada orçamentária: {formatBRL(pos.budgetLimitBRL)} · {pos.responsibilities[0]}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAgent && holder.instanceId && (
              <button
                type="button"
                onClick={() => onOpenChat({ targetInstanceId: holder.instanceId })}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line bg-surface hover:border-accent text-xs font-medium text-ink cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-accent" />
                Chat 1:1
              </button>
            )}
            {pos.holderType === 'humano' && dept?.linkedChannelId && (
              <button
                type="button"
                onClick={() => onOpenChat({ conversationId: dept.linkedChannelId })}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line bg-surface hover:border-accent text-xs font-medium text-ink cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-accent" />
                Canal
              </button>
            )}
            {canManageOrg && (
              <button
                type="button"
                onClick={() => startEditPosition(pos)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line bg-surface hover:border-line-strong text-xs text-ink-muted hover:text-ink cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar / Reports To
              </button>
            )}
          </div>
        </div>

        {children.length > 0 && (
          <div className="space-y-3">{children.map((child) => renderPositionNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const rootPositions = childrenByParent.get('__root__') ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">
            Pessoas, Departamentos & Organograma Dinâmico
          </h2>
          <p className="text-xs text-ink-subtle">
            Estrutura hierárquica unificando liderança humana, cargos operacionais de agentes (reports_to) e alçadas orçamentárias
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageOrg && (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowDeptForm((s) => !s);
                  setShowPosForm(false);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-surface hover:border-accent text-xs font-semibold text-ink cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 text-accent" />
                Novo Depto
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPosForm((s) => !s);
                  setShowDeptForm(false);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Posição
              </button>
            </>
          )}

          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-subtle border border-line">
            <button
              type="button"
              onClick={() => setView('orgchart')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                view === 'orgchart' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Organograma & Cargos
            </button>
            <button
              type="button"
              onClick={() => setView('directory')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                view === 'directory' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Colaboradores ({state.people.length})
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg border border-accent/40 bg-accent-soft/60 text-xs text-ink flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-ink-muted hover:text-ink cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Departamentos Ativos</p>
          <p className="mt-1 font-display text-xl font-bold text-ink tabular-nums">
            {state.departments.length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Posições no Organograma</p>
          <p className="mt-1 font-display text-xl font-bold text-ink tabular-nums">
            {state.orgPositions.length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Agentes na Hierarquia</p>
          <p className="mt-1 font-display text-xl font-bold text-ink tabular-nums">
            {agentPositionsCount}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-line bg-surface">
          <p className="text-xs text-ink-subtle">Posições Vagas</p>
          <p className="mt-1 font-display text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
            {vacantPositionsCount}
          </p>
        </div>
      </div>

      {/* Create Department Form */}
      {showDeptForm && (
        <form onSubmit={handleCreateDept} className="p-5 rounded-xl border border-line bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Criar Novo Departamento</h3>
            <button type="button" onClick={() => setShowDeptForm(false)} className="text-ink-muted cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-ink-subtle mb-1">Código</label>
              <input
                type="text"
                required
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                placeholder="EX: REV-OPS"
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Nome do Departamento</label>
              <input
                type="text"
                required
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="Comercial & Revenue Ops"
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Orçamento Mensal (R$)</label>
              <input
                type="number"
                value={deptBudget}
                onChange={(e) => setDeptBudget(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Escopo</label>
              <input
                type="text"
                value={deptDesc}
                onChange={(e) => setDeptDesc(e.target.value)}
                placeholder="Responsabilidade principal..."
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer">
              Salvar Departamento
            </button>
          </div>
        </form>
      )}

      {/* Create Position Form */}
      {showPosForm && (
        <form onSubmit={handleCreatePos} className="p-5 rounded-xl border border-line bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Criar Nova Posição / Cargo no Organograma</h3>
            <button type="button" onClick={() => setShowPosForm(false)} className="text-ink-muted cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-ink-subtle mb-1">Título do Cargo</label>
              <input
                type="text"
                required
                value={posTitle}
                onChange={(e) => setPosTitle(e.target.value)}
                placeholder="Ex.: Especialista Digital AppSec"
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Departamento</label>
              <select
                value={posDeptId}
                onChange={(e) => setPosDeptId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              >
                {state.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Reporta-se a (reports_to)</label>
              <select
                value={posReportsTo}
                onChange={(e) => setPosReportsTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              >
                <option value="">Topo (Direção Executiva)</option>
                {state.orgPositions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Nível de Autoridade</label>
              <select
                value={posAuthority}
                onChange={(e) => setPosAuthority(e.target.value as AuthorityLevel)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              >
                {Object.entries(AUTHORITY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-subtle mb-1">Tipo de Ocupante</label>
              <select
                value={posHolderType}
                onChange={(e) => {
                  setPosHolderType(e.target.value as OrgPosition['holderType']);
                  setPosHolderId('');
                }}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
              >
                <option value="vago">Posição Vaga</option>
                <option value="humano">Colaborador Humano</option>
                <option value="agente_operacional">Agente Operacional (Paperclip)</option>
              </select>
            </div>
            {posHolderType !== 'vago' ? (
              <div>
                <label className="block text-ink-subtle mb-1">Ocupante Vinculado</label>
                <select
                  value={posHolderId}
                  onChange={(e) => setPosHolderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink"
                >
                  <option value="">Selecionar...</option>
                  {posHolderType === 'humano'
                    ? state.people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    : state.operationalInstances.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.instanceName} ({o.blueprintCode})
                        </option>
                      ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-ink-subtle mb-1">Limite Orçamentário (R$)</label>
                <input
                  type="number"
                  value={posBudgetLimit}
                  onChange={(e) => setPosBudgetLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-ink font-mono"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer">
              Adicionar ao Organograma
            </button>
          </div>
        </form>
      )}

      {view === 'orgchart' ? (
        <div className="space-y-6">
          {/* Departments Strip */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {state.departments.map((dept) => {
              const count = state.orgPositions.filter((p) => p.departmentId === dept.id).length;
              return (
                <div key={dept.id} className="p-4 rounded-xl border border-line bg-surface space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-accent">{dept.code}</span>
                    <span className="text-ink-subtle tabular-nums">{count} posições</span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-ink">{dept.name}</h3>
                  <p className="text-xs text-ink-muted line-clamp-2">{dept.description}</p>
                  <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                    <span className="font-mono tabular-nums text-ink-subtle">
                      Orçamento: {formatBRL(dept.budgetAllocatedBRL)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenChat({
                          conversationId: dept.linkedChannelId,
                          departmentId: dept.id,
                        })
                      }
                      className="text-accent hover:underline font-medium cursor-pointer"
                    >
                      Abrir canal
                    </button>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Hierarchical Org Tree */}
          <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-ink">
                  Árvore Hierárquica Corporativa (Humanos + Agentes Operacionais)
                </h3>
              </div>
              <span className="text-xs text-ink-subtle">Cadeia de reporte e alçadas</span>
            </div>

            <div className="space-y-4">{rootPositions.map((root) => renderPositionNode(root, 0))}</div>
          </section>
        </div>
      ) : (
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
      )}

      {/* Modal: Edit Position / Reassign reports_to */}
      {editingPos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40"
          onClick={() => setEditingPos(null)}
        >
          <form
            onSubmit={handleSavePosition}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md p-5 rounded-2xl nc-glass-window space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-accent" />
                <h3 className="font-display text-sm font-bold text-ink">
                  Editar Posição · {editingPos.title}
                </h3>
              </div>
              <button type="button" onClick={() => setEditingPos(null)} className="text-ink-muted cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-subtle mb-1">Reporta-se a (reports_to)</label>
                <select
                  value={editReportsTo}
                  onChange={(e) => setEditReportsTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                >
                  <option value="">Topo (Direção Executiva)</option>
                  {state.orgPositions
                    .filter((p) => p.id !== editingPos.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-ink-subtle mb-1">Tipo de Ocupante</label>
                <select
                  value={editHolderType}
                  onChange={(e) => {
                    setEditHolderType(e.target.value as OrgPosition['holderType']);
                    setEditHolderId('');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                >
                  <option value="vago">Vago</option>
                  <option value="humano">Humano</option>
                  <option value="agente_operacional">Agente Operacional (Paperclip)</option>
                </select>
              </div>

              {editHolderType !== 'vago' && (
                <div>
                  <label className="block text-ink-subtle mb-1">Vincular Ocupante</label>
                  <select
                    value={editHolderId}
                    onChange={(e) => setEditHolderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                  >
                    <option value="">Selecionar...</option>
                    {editHolderType === 'humano'
                      ? state.people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))
                      : state.operationalInstances.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.instanceName} ({o.blueprintCode})
                          </option>
                        ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-ink-subtle mb-1">Limite Orçamentário (R$)</label>
                <input
                  type="number"
                  value={editBudget}
                  onChange={(e) => setEditBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPos(null)}
                className="px-3 py-1.5 rounded-lg border border-line text-xs text-ink-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Hierarquia
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
