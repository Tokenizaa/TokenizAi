/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CommandPalette } from './components/Common/CommandPalette';
import { AppShell, NAV_ITEMS } from './components/Layout/AppShell';
import { canAccessModule, getFirstAllowedModule, ROLE_DEFINITIONS } from './domain/permissions';
import { useOnlineStatus } from './hooks/useEnterpriseHooks';
import { AdminModule } from './modules/admin/AdminModule';
import { AgencyLibraryModule } from './modules/agency-library/AgencyLibraryModule';
import { OperationalAgentsModule } from './modules/agency-library/OperationalAgentsModule';
import { TeamComposerModule } from './modules/agency-library/TeamComposerModule';
import { CommercialModule } from './modules/commercial/CommercialModule';
import { CustomersModule } from './modules/customers/CustomersModule';
import { ExecutiveDashboard } from './modules/executive/ExecutiveDashboard';
import { FinanceModule } from './modules/finance/FinanceModule';
import { GovernanceModule } from './modules/governance/GovernanceModule';
import { IntelligenceFactoryModule } from './modules/intelligence-factory/IntelligenceFactoryModule';
import { MarketingModule } from './modules/marketing/MarketingModule';
import { OperationsModule } from './modules/operations/OperationsModule';
import { PeopleModule } from './modules/people/PeopleModule';
import { ProductsModule } from './modules/products/ProductsModule';
import { ProjectsModule } from './modules/projects/ProjectsModule';
import { SoftwareFactoryModule } from './modules/software-factory/SoftwareFactoryModule';
import { SystemSyncAdapter } from './services/adapters';
import {
  EnterpriseDomainActions,
  loadPersistedState,
  loadSyncQueue,
  resetDemoState,
  savePersistedState,
  saveSyncQueue,
} from './services/enterpriseService';
import type {
  AccentTheme,
  AgentBlueprint,
  EnterpriseProject,
  EnterpriseState,
  FinancialEntry,
  HomologationStatus,
  ModuleId,
  ProjectTask,
  SyncQueueItem,
  TeamCompositionRecord,
  UserRole,
} from './types/enterprise';

function readInitialModule(): ModuleId {
  const hash = window.location.hash.replace('#', '') as ModuleId;
  if (NAV_ITEMS.some((n) => n.id === hash)) {
    return hash;
  }
  return 'executive';
}

export default function App() {
  const [state, setState] = useState<EnterpriseState>(() => loadPersistedState());
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(() => loadSyncQueue());
  const [activeRole, setActiveRole] = useState<UserRole>('direcao_executiva');
  const [activeModule, setActiveModule] = useState<ModuleId>(() => readInitialModule());
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem('nc_theme') === 'dark');
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(
    () => (localStorage.getItem('nc_accent') as AccentTheme) || 'amber'
  );

  const [commandOpen, setCommandOpen] = useState(false);
  const [openProjectWizard, setOpenProjectWizard] = useState(false);
  const [agentSearchSeed, setAgentSearchSeed] = useState<string | undefined>(undefined);
  const [composerProjectId, setComposerProjectId] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const isOnline = useOnlineStatus();
  const pendingGKeyRef = useRef(false);

  // Sync light/dark and accent CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-accent', accentTheme);
    localStorage.setItem('nc_theme', isDark ? 'dark' : 'light');
    localStorage.setItem('nc_accent', accentTheme);
  }, [isDark, accentTheme]);

  // Persist enterprise state & queue
  useEffect(() => {
    savePersistedState(state);
  }, [state]);

  useEffect(() => {
    saveSyncQueue(syncQueue);
  }, [syncQueue]);

  // Sync URL hash navigation
  useEffect(() => {
    window.location.hash = activeModule;
  }, [activeModule]);

  useEffect(() => {
    const onHashChange = () => {
      const candidate = window.location.hash.replace('#', '') as ModuleId;
      if (NAV_ITEMS.some((n) => n.id === candidate) && canAccessModule(activeRole, candidate)) {
        setActiveModule(candidate);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [activeRole]);

  // Enforce RBAC if role changes and active module is no longer allowed
  const handleChangeRole = (nextRole: UserRole) => {
    setActiveRole(nextRole);
    setActionError(null);
    if (!canAccessModule(nextRole, activeModule)) {
      setActiveModule(getFirstAllowedModule(nextRole));
    }
  };

  const navigateTo = useCallback(
    (
      moduleId: ModuleId,
      extra?: { searchAgentQuery?: string; openNewProject?: boolean; projectId?: string }
    ) => {
      if (!canAccessModule(activeRole, moduleId)) {
        setActionError(`Perfil "${ROLE_DEFINITIONS[activeRole].label}" não possui acesso ao módulo solicitado.`);
        return;
      }
      setActionError(null);
      if (extra?.searchAgentQuery !== undefined) {
        setAgentSearchSeed(extra.searchAgentQuery);
      }
      if (extra?.openNewProject) {
        setOpenProjectWizard(true);
      }
      if (extra?.projectId) {
        setComposerProjectId(extra.projectId);
      }
      setActiveModule(moduleId);
    },
    [activeRole]
  );

  // Global keyboard shortcuts (Cmd/Ctrl+K and G + <letter>)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }

      if (inInput || commandOpen) return;

      const key = e.key.toLowerCase();
      if (pendingGKeyRef.current) {
        pendingGKeyRef.current = false;
        const map: Record<string, ModuleId> = {
          e: 'executive',
          f: 'finance',
          c: 'commercial',
          p: 'projects',
          a: 'agency-library',
          o: 'operations',
          g: 'governance',
        };
        if (map[key]) {
          e.preventDefault();
          navigateTo(map[key]);
        }
        return;
      }

      if (key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        pendingGKeyRef.current = true;
        setTimeout(() => {
          pendingGKeyRef.current = false;
        }, 900);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandOpen, navigateTo]);

  const handleSyncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await SystemSyncAdapter.pushState('web-browser', {
        projectsCount: state.projects.length,
        governanceCount: state.governance.length,
        financialCount: state.financialEntries.length,
        updatedAt: new Date().toISOString(),
      });
      setLastSyncedAt(res.updatedAt);
      setSyncQueue((q) => q.map((item) => ({ ...item, synced: true })));
    } catch {
      // Keep items queued if server temporarily unreachable
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, state.projects.length, state.governance.length, state.financialEntries.length]);

  // Auto-flush offline queue upon reconnection
  useEffect(() => {
    const unsynced = syncQueue.some((q) => !q.synced);
    if (isOnline && unsynced) {
      void handleSyncNow();
    }
  }, [isOnline, syncQueue, handleSyncNow]);

  const commitMutation = (actionLabel: string, updater: (prev: EnterpriseState) => EnterpriseState) => {
    setActionError(null);
    try {
      setState((prev) => updater(prev));
      setSyncQueue((q) => [
        ...q.slice(-19),
        { id: `sq-${Date.now()}`, action: actionLabel, timestamp: new Date().toISOString(), synced: false },
      ]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Operação não permitida.');
    }
  };

  const actorName = ROLE_DEFINITIONS[activeRole].label;

  const handleCreateProject = (input: Omit<EnterpriseProject, 'id' | 'code' | 'updatedAt'>) => {
    commitMutation('create_project', (prev) =>
      EnterpriseDomainActions.createProject(prev, activeRole, actorName, input)
    );
  };

  const handleAddFinancialEntry = (entry: Omit<FinancialEntry, 'id' | 'origin'>) => {
    commitMutation('add_financial_entry', (prev) =>
      EnterpriseDomainActions.addFinancialEntry(prev, activeRole, actorName, entry)
    );
  };

  const handleToggleTaskStatus = (taskId: string, nextStatus: ProjectTask['status']) => {
    commitMutation('toggle_task', (prev) =>
      EnterpriseDomainActions.toggleTaskStatus(prev, taskId, nextStatus)
    );
  };

  const handleSetHomologation = (agent: AgentBlueprint, status: HomologationStatus) => {
    commitMutation('set_homologation', (prev) =>
      EnterpriseDomainActions.setAgentHomologation(prev, activeRole, actorName, agent, status)
    );
  };

  const handleSaveComposition = (composition: Omit<TeamCompositionRecord, 'id' | 'createdAt'>) => {
    commitMutation('save_composition', (prev) =>
      EnterpriseDomainActions.saveTeamComposition(prev, activeRole, actorName, composition)
    );
  };

  const handleDeployInstance = (
    blueprint: AgentBlueprint,
    project: EnterpriseProject,
    guardrail: string
  ) => {
    commitMutation('deploy_paperclip_instance', (prev) =>
      EnterpriseDomainActions.deployOperationalInstance(
        prev,
        activeRole,
        actorName,
        blueprint,
        project,
        guardrail
      )
    );
  };

  const handleCreateGovernance = (input: {
    type: 'DEC' | 'CNS' | 'DELIB';
    title: string;
    summary: string;
    linkedProjectId?: string;
  }) => {
    commitMutation('create_governance', (prev) =>
      EnterpriseDomainActions.createGovernanceRecord(prev, activeRole, actorName, input)
    );
  };

  const handleApproveGovernance = (recordId: string) => {
    commitMutation('approve_governance', (prev) =>
      EnterpriseDomainActions.approveGovernanceRecord(prev, activeRole, actorName, recordId)
    );
  };

  const handleMarkAllRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  };

  const handleResetDemo = () => {
    const fresh = resetDemoState();
    setState(fresh);
    setSyncQueue([]);
    setActionError(null);
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'executive':
        return (
          <ExecutiveDashboard
            state={state}
            activeRole={activeRole}
            onNavigate={(m) => navigateTo(m)}
            onApproveGovernance={handleApproveGovernance}
          />
        );
      case 'finance':
        return (
          <FinanceModule
            state={state}
            activeRole={activeRole}
            onAddEntry={handleAddFinancialEntry}
            onNavigate={(m) => navigateTo(m)}
          />
        );
      case 'commercial':
        return <CommercialModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'customers':
        return <CustomersModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'marketing':
        return <MarketingModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'products':
        return <ProductsModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'projects':
        return (
          <ProjectsModule
            state={state}
            activeRole={activeRole}
            openWizardInitially={openProjectWizard}
            onWizardOpenedHandled={() => setOpenProjectWizard(false)}
            onCreateProject={handleCreateProject}
            onToggleTaskStatus={handleToggleTaskStatus}
            onNavigate={(m, extra) => navigateTo(m, extra)}
          />
        );
      case 'software-factory':
        return <SoftwareFactoryModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'intelligence-factory':
        return <IntelligenceFactoryModule state={state} onNavigate={(m) => navigateTo(m)} />;
      case 'operations':
        return (
          <OperationsModule
            state={state}
            onToggleTaskStatus={handleToggleTaskStatus}
            onNavigate={(m) => navigateTo(m)}
          />
        );
      case 'agency-library':
        return (
          <AgencyLibraryModule
            state={state}
            activeRole={activeRole}
            initialSearch={agentSearchSeed}
            onSetHomologation={handleSetHomologation}
          />
        );
      case 'team-composer':
        return (
          <TeamComposerModule
            state={state}
            activeRole={activeRole}
            initialProjectId={composerProjectId}
            onSaveComposition={handleSaveComposition}
          />
        );
      case 'operational-agents':
        return (
          <OperationalAgentsModule
            state={state}
            activeRole={activeRole}
            onSetHomologation={handleSetHomologation}
            onDeployInstance={handleDeployInstance}
            onNavigate={(m) => navigateTo(m)}
          />
        );
      case 'people':
        return <PeopleModule state={state} />;
      case 'governance':
        return (
          <GovernanceModule
            state={state}
            activeRole={activeRole}
            onCreateRecord={handleCreateGovernance}
            onApproveRecord={handleApproveGovernance}
          />
        );
      case 'admin':
        return (
          <AdminModule
            state={state}
            activeRole={activeRole}
            isDark={isDark}
            accentTheme={accentTheme}
            isOnline={isOnline}
            syncQueue={syncQueue}
            lastSyncedAt={lastSyncedAt}
            onToggleTheme={() => setIsDark((d) => !d)}
            onChangeAccent={setAccentTheme}
            onSyncNow={handleSyncNow}
            onResetDemo={handleResetDemo}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <AppShell
        activeModule={activeModule}
        activeRole={activeRole}
        onSelectModule={(id) => navigateTo(id)}
        onChangeRole={handleChangeRole}
        onOpenCommandPalette={() => setCommandOpen(true)}
        onPrimaryAction={() => navigateTo('projects', { openNewProject: true })}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        isOnline={isOnline}
        pendingSyncCount={syncQueue.filter((q) => !q.synced).length}
        isSyncing={isSyncing}
        onSyncNow={handleSyncNow}
        notifications={state.notifications}
        onMarkAllRead={handleMarkAllRead}
      >
        {actionError && (
          <div className="mb-4 px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="underline cursor-pointer shrink-0"
            >
              Dispensar
            </button>
          </div>
        )}

        <div key={activeModule} className="transition-opacity duration-150">
          {renderModule()}
        </div>
      </AppShell>

      <CommandPalette
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        destinations={NAV_ITEMS.map((n) => ({
          id: n.id,
          label: n.label,
          group: n.group,
          shortcut: n.shortcut,
        }))}
        projects={state.projects}
        activeRole={activeRole}
        onNavigate={(id, extra) => navigateTo(id, extra)}
        onToggleTheme={() => setIsDark((d) => !d)}
      />
    </>
  );
}
