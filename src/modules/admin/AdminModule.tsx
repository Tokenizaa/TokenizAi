import React, { useEffect, useState } from 'react';
import { BellRing, Download, RefreshCw, RotateCcw, Shield } from 'lucide-react';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import { usePWAInstall } from '../../hooks/useEnterpriseHooks';
import { SystemSyncAdapter, type ServerHealthStatus } from '../../services/adapters';
import type { AccentTheme, EnterpriseState, SyncQueueItem, UserRole } from '../../types/enterprise';

interface AdminModuleProps {
  state: EnterpriseState;
  activeRole: UserRole;
  isDark: boolean;
  accentTheme: AccentTheme;
  isOnline: boolean;
  syncQueue: SyncQueueItem[];
  lastSyncedAt: string | null;
  onToggleTheme: () => void;
  onChangeAccent: (accent: AccentTheme) => void;
  onSyncNow: () => void;
  onResetDemo: () => void;
}

export const AdminModule: React.FC<AdminModuleProps> = ({
  state,
  activeRole,
  isDark,
  accentTheme,
  isOnline,
  syncQueue,
  lastSyncedAt,
  onToggleTheme,
  onChangeAccent,
  onSyncNow,
  onResetDemo,
}) => {
  const [health, setHealth] = useState<ServerHealthStatus | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  useEffect(() => {
    SystemSyncAdapter.fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const handleEnablePush = async () => {
    if (typeof Notification === 'undefined') {
      setPushFeedback('Notificações do navegador não suportadas neste ambiente.');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      new Notification('NettosCorp Enterprise', {
        body: 'Alertas executivos e de prazos críticos ativados neste dispositivo.',
      });
      setPushFeedback('Notificações push locais habilitadas.');
    } else {
      setPushFeedback('Permissão de notificação negada pelo navegador.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Integrations Status */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Integrações & Fontes de Verdade</h2>
          <p className="text-xs text-ink-subtle">
            Nenhuma integração ausente é simulada como ativa. Variáveis de ambiente permanecem isoladas no servidor.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.integrations.map((intItem) => {
            const liveActive =
              (intItem.id === 'int-gemini' && health?.integrations.gemini) ||
              (intItem.id === 'int-supabase' && health?.integrations.supabase) ||
              (intItem.id === 'int-paperclip' && health?.integrations.paperclip);

            const statusLabel = liveActive ? 'Conectado no servidor' : intItem.status;

            return (
              <div key={intItem.id} className="p-4 rounded-xl border border-line bg-canvas space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-subtle">{intItem.category}</span>
                  <span
                    className={
                      liveActive
                        ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                        : intItem.status === 'parcial'
                        ? 'text-amber-700 dark:text-amber-400 font-semibold'
                        : 'text-ink-subtle font-medium'
                    }
                  >
                    {statusLabel}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-ink">{intItem.name}</h3>
                <p className="text-xs text-ink-muted leading-relaxed">{intItem.description}</p>
                <p className="font-mono text-[11px] text-ink-subtle pt-1">{intItem.endpointLabel}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Preferences, Theme, Offline Sync & Push */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
          <h3 className="text-sm font-semibold text-ink">Aparência, Temas & Acessibilidade</h3>
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">Modo de Exibição</p>
                <p className="text-ink-subtle">Tema claro padrão ou modo escuro inteligente</p>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                className="px-3.5 py-2 rounded-lg border border-line bg-canvas text-ink font-medium cursor-pointer"
              >
                {isDark ? 'Alternar para Claro' : 'Alternar para Escuro'}
              </button>
            </div>

            <div>
              <p className="font-medium text-ink mb-2">Cor de Destaque Corporativa</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'amber', label: 'Âmbar NettosCorp (Padrão)' },
                    { id: 'cobalt', label: 'Cobalto Executivo' },
                    { id: 'emerald', label: 'Esmeralda Operacional' },
                    { id: 'slate', label: 'Grafite Minimalista' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChangeAccent(t.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                      accentTheme === t.id
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-canvas text-ink-muted hover:text-ink'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-ink">Notificações Push Personalizadas</p>
                <p className="text-ink-subtle">Status atual: {notifPermission}</p>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink font-medium cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5 text-accent" />
                Ativar / Testar Push
              </button>
            </div>
            {pushFeedback && <p className="text-ink-muted">{pushFeedback}</p>}
          </div>
        </section>

        <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
          <h3 className="text-sm font-semibold text-ink">Modo Offline, Sincronização & PWA</h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Conectividade do dispositivo</span>
              <span className={isOnline ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-600 font-semibold'}>
                {isOnline ? 'Online' : 'Offline (Persistência Local Ativa)'}
              </span>
            </div>
            <div className="flex items-center justify-between tabular-nums">
              <span className="text-ink-muted">Itens pendentes na fila offline</span>
              <span className="font-mono text-ink">{syncQueue.filter((q) => !q.synced).length}</span>
            </div>
            <div className="flex items-center justify-between tabular-nums">
              <span className="text-ink-muted">Última sincronização com servidor</span>
              <span className="font-mono text-ink">{lastSyncedAt ? lastSyncedAt.slice(11, 19) : 'Ainda não sincronizado'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onSyncNow}
                disabled={!isOnline}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white font-semibold cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sincronizar Agora
              </button>

              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  onClick={install}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line bg-canvas text-ink font-medium cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Instalar Aplicativo (PWA)
                </button>
              )}

              <button
                type="button"
                onClick={onResetDemo}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line text-ink-muted hover:text-ink cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar Base Demonstrativa
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* RBAC Matrix */}
      <section className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-ink">
            Matriz de Segurança & Permissões (10 Perfis RBAC)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-ink-subtle">
                <th className="py-2 pr-4 font-medium">Perfil</th>
                <th className="py-2 px-3 font-medium">Módulos Liberados</th>
                <th className="py-2 px-3 font-medium">Aprova DEC/CNS</th>
                <th className="py-2 px-3 font-medium">Financeiro</th>
                <th className="py-2 pl-3 font-medium">Homologa Agentes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {Object.values(ROLE_DEFINITIONS).map((r) => (
                <tr key={r.id} className={r.id === activeRole ? 'bg-accent-soft/40' : ''}>
                  <td className="py-2.5 pr-4 font-medium text-ink">{r.label}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-ink-muted">
                    {r.allowedModules.length} módulos
                  </td>
                  <td className="py-2.5 px-3 text-ink-muted">{r.canApproveGovernance ? 'Sim' : 'Não'}</td>
                  <td className="py-2.5 px-3 text-ink-muted">{r.canManageFinance ? 'Sim' : 'Não'}</td>
                  <td className="py-2.5 pl-3 text-ink-muted">{r.canHomologateAgents ? 'Sim' : 'Não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
