import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Bot,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  DollarSign,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  Package,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  WifiOff,
  Workflow,
  X,
} from 'lucide-react';
import { canAccessModule, ROLE_DEFINITIONS } from '../../domain/permissions';
import type { AppNotification, ModuleId, UserRole } from '../../types/enterprise';

export interface SidebarNavItem {
  id: ModuleId;
  label: string;
  group: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: SidebarNavItem[] = [
  { id: 'executive', label: 'Visão Executiva', group: 'Visão Geral', shortcut: 'G E', icon: LayoutDashboard },
  { id: 'chat', label: 'Comunicação & Chat', group: 'Visão Geral', shortcut: 'G M', icon: MessageSquare },

  { id: 'finance', label: 'Financeiro', group: 'Gestão Empresarial', shortcut: 'G F', icon: DollarSign },
  { id: 'commercial', label: 'Comercial & CRM', group: 'Gestão Empresarial', shortcut: 'G C', icon: Briefcase },
  { id: 'customers', label: 'Clientes', group: 'Gestão Empresarial', icon: Building2 },
  { id: 'marketing', label: 'Marketing & Growth', group: 'Gestão Empresarial', icon: Megaphone },
  { id: 'products', label: 'Produtos & Serviços', group: 'Gestão Empresarial', icon: Package },

  { id: 'projects', label: 'Portfólio & Projetos', group: 'Projetos & Produção', shortcut: 'G P', icon: FolderKanban },
  { id: 'software-factory', label: 'Fábrica de Software', group: 'Projetos & Produção', icon: Code2 },
  { id: 'intelligence-factory', label: 'Fábrica de IA', group: 'Projetos & Produção', icon: Cpu },
  { id: 'operations', label: 'Operações & Entregas', group: 'Projetos & Produção', shortcut: 'G O', icon: Activity },

  { id: 'agency-library', label: 'Biblioteca (283 Perfis)', group: 'Inteligência Artificial', shortcut: 'G A', icon: Bot },
  { id: 'team-composer', label: 'Composição de Equipes', group: 'Inteligência Artificial', icon: Workflow },
  { id: 'operational-agents', label: 'Homologação & Paperclip', group: 'Inteligência Artificial', icon: Cpu },

  { id: 'people', label: 'Pessoas & Estrutura', group: 'Organização', icon: Users },
  { id: 'governance', label: 'Portal & DEC/CNS', group: 'Governança', shortcut: 'G G', icon: ShieldCheck },
  { id: 'admin', label: 'Admin & Integrações', group: 'Administração', icon: Settings },
];

const NAV_GROUPS = [
  'Visão Geral',
  'Gestão Empresarial',
  'Projetos & Produção',
  'Inteligência Artificial',
  'Organização',
  'Governança',
  'Administração',
];

interface AppShellProps {
  activeModule: ModuleId;
  activeRole: UserRole;
  onSelectModule: (id: ModuleId) => void;
  onChangeRole: (role: UserRole) => void;
  onOpenCommandPalette: () => void;
  onPrimaryAction: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  chatUnreadCount?: number;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeModule,
  activeRole,
  onSelectModule,
  onChangeRole,
  onOpenCommandPalette,
  onPrimaryAction,
  isDark,
  onToggleTheme,
  isOnline,
  pendingSyncCount,
  isSyncing,
  onSyncNow,
  notifications,
  onMarkAllRead,
  chatUnreadCount = 0,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const activeNav = NAV_ITEMS.find((n) => n.id === activeModule) ?? NAV_ITEMS[0];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-surface border-r border-line">
      <div className="px-4 py-4 border-b border-line flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onSelectModule('executive');
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-2.5 text-left cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-800 flex items-center justify-center border border-amber-500/40 shrink-0">
            <span className="font-display font-bold text-xs text-white">N</span>
          </div>
          <span className="font-display font-bold text-sm tracking-tight text-ink whitespace-nowrap">
            NettosCorp · TokenizAi
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-ink-muted hover:text-ink cursor-pointer"
          aria-label="Fechar menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter(
            (item) => item.group === group && canAccessModule(activeRole, item.id)
          );
          if (items.length === 0) return null;
          const isCollapsed = Boolean(collapsedGroups[group]) && !items.some((i) => i.id === activeModule);

          return (
            <div key={group}>
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-ink-subtle hover:text-ink cursor-pointer"
              >
                <span className="truncate">{group}</span>
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === activeModule;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectModule(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
                          active
                            ? 'bg-accent-soft text-accent-ink font-semibold'
                            : 'text-ink-muted hover:text-ink hover:bg-surface-subtle font-medium'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-ink-subtle'}`} />
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {item.id === 'chat' && chatUnreadCount > 0 && (
                          <span className="min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                            {chatUnreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-line space-y-2">
        <label className="block text-[11px] font-medium text-ink-subtle">
          Perfil de Acesso (RBAC)
        </label>
        <select
          value={activeRole}
          onChange={(e) => onChangeRole(e.target.value as UserRole)}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-accent"
          aria-label="Perfil de acesso ativo"
        >
          {Object.values(ROLE_DEFINITIONS).map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-canvas text-ink">
      {/* Desktop compact sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-[268px] max-w-[85vw] h-full shadow-xl">
            {renderSidebarContent()}
          </div>
          <div className="flex-1 bg-slate-950/40" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean 3-zone Top Header */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-line px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          {/* Zone 1: Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-line text-ink-muted hover:text-ink cursor-pointer"
              aria-label="Abrir navegação"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-ink-subtle truncate">{activeNav.group}</span>
              <span className="hidden sm:inline text-ink-subtle">/</span>
              <h1 className="font-display font-semibold text-ink truncate">{activeNav.label}</h1>
            </div>
          </div>

          {/* Zone 2: Utility Controls (Search ⌘K, Sync, Theme, Alerts) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-canvas text-xs text-ink-muted hover:text-ink hover:border-line-strong transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline whitespace-nowrap">Buscar ou comando de voz</span>
              <kbd className="hidden sm:inline font-mono text-[10px] px-1 py-0.5 rounded bg-surface-subtle border border-line">
                ⌘K
              </kbd>
            </button>

            {(!isOnline || pendingSyncCount > 0) && (
              <button
                type="button"
                onClick={onSyncNow}
                disabled={!isOnline || isSyncing}
                title={isOnline ? 'Sincronizar fila offline' : 'Modo offline ativo'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-xs text-ink-muted hover:text-ink cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {!isOnline ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className={`w-3.5 h-3.5 text-accent ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline tabular-nums">Sincronizar ({pendingSyncCount})</span>
                  </>
                )}
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Notificações corporativas"
                className="relative p-2 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl nc-glass-window p-3 z-50 space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <span className="text-xs font-semibold text-ink">Alertas e Prioridades</span>
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="text-[11px] text-accent hover:underline cursor-pointer"
                    >
                      Marcar como lidas
                    </button>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (canAccessModule(activeRole, n.targetModule)) {
                            onSelectModule(n.targetModule);
                          }
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          n.read ? 'border-line bg-surface/60 opacity-75' : 'border-line-strong bg-surface'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-ink-subtle">
                          <span className={n.severity === 'critico' ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                            {n.severity === 'critico' ? 'Crítico' : n.severity === 'alerta' ? 'Atenção' : 'Info'}
                          </span>
                          <span>{n.createdAt}</span>
                        </div>
                        <p className="text-xs font-medium text-ink mt-1">{n.title}</p>
                        <p className="text-[11px] text-ink-muted mt-0.5 line-clamp-2">{n.detail}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Ativar tema claro' : 'Ativar modo escuro inteligente'}
              className="p-2 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Zone 3: 1 Primary Action */}
            <button
              type="button"
              onClick={onPrimaryAction}
              className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Novo Projeto
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
