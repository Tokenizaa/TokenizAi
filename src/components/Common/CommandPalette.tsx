import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Command, Keyboard, Mic, MicOff, Search, X } from 'lucide-react';
import { AGENCY_AGENTS_283 } from '../../domain/agencyLibrary';
import { canAccessModule } from '../../domain/permissions';
import { useVoiceCommand } from '../../hooks/useEnterpriseHooks';
import { AIAdapter } from '../../services/adapters';
import type { EnterpriseProject, ModuleId, UserRole } from '../../types/enterprise';

interface NavDestination {
  id: ModuleId;
  label: string;
  group: string;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  destinations: NavDestination[];
  projects: EnterpriseProject[];
  activeRole: UserRole;
  onNavigate: (moduleId: ModuleId, extra?: { searchAgentQuery?: string; openNewProject?: boolean }) => void;
  onToggleTheme: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  destinations,
  projects,
  activeRole,
  onNavigate,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [processingVoice, setProcessingVoice] = useState(false);

  const handleVoiceTranscript = async (transcript: string) => {
    setQuery(transcript);
    setProcessingVoice(true);
    setVoiceFeedback(`Comando capturado: "${transcript}"`);

    const lower = transcript.toLowerCase();
    // Deterministic fast match first
    const directNav = destinations.find(
      (d) => canAccessModule(activeRole, d.id) && lower.includes(d.label.toLowerCase().split(' ')[0])
    );
    if (lower.includes('novo projeto') || lower.includes('abrir projeto')) {
      setProcessingVoice(false);
      onNavigate('projects', { openNewProject: true });
      onClose();
      return;
    }
    if (lower.includes('tema') || lower.includes('escuro') || lower.includes('claro')) {
      setProcessingVoice(false);
      onToggleTheme();
      onClose();
      return;
    }

    try {
      const intent = await AIAdapter.parseVoiceIntent(transcript);
      setVoiceFeedback(intent.explanation);
      if (intent.action === 'new_project') {
        onNavigate('projects', { openNewProject: true });
        onClose();
      } else if (intent.action === 'toggle_theme') {
        onToggleTheme();
        onClose();
      } else if (intent.moduleId && canAccessModule(activeRole, intent.moduleId as ModuleId)) {
        onNavigate(intent.moduleId as ModuleId, { searchAgentQuery: intent.query });
        onClose();
      }
    } catch {
      if (directNav) {
        onNavigate(directNav.id);
        onClose();
      } else {
        setVoiceFeedback('Comando exibido na busca acima — selecione um resultado ou pressione Enter.');
      }
    } finally {
      setProcessingVoice(false);
    }
  };

  const { isListening, voiceError, startListening, stopListening } = useVoiceCommand(handleVoiceTranscript);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setShowShortcuts(false);
      setVoiceFeedback(null);
    }
  }, [isOpen]);

  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return destinations
      .filter((d) => canAccessModule(activeRole, d.id))
      .filter((d) => !q || d.label.toLowerCase().includes(q) || d.group.toLowerCase().includes(q));
  }, [destinations, activeRole, query]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects.slice(0, 3);
    return projects
      .filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.area.toLowerCase().includes(q))
      .slice(0, 4);
  }, [projects, query]);

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return AGENCY_AGENTS_283.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.division.toLowerCase().includes(q) ||
        a.competencies.some((c) => c.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-slate-950/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos e busca rápida"
    >
      <div
        className="w-full max-w-2xl rounded-2xl nc-glass-window overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <Search className="w-4 h-4 text-ink-subtle shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ir para módulo, buscar projeto ou pesquisar nos 283 agentes..."
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            title="Comando de voz (Português)"
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              isListening
                ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                : 'border-line text-ink-muted hover:text-ink hover:bg-surface-subtle'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowShortcuts((s) => !s)}
            title="Atalhos de teclado"
            className="p-2 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-surface-subtle cursor-pointer"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar paleta"
            className="p-2 rounded-lg text-ink-muted hover:text-ink cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(voiceFeedback || voiceError || isListening || processingVoice) && (
          <div className="px-4 py-2 text-xs border-b border-line bg-surface-subtle/70 text-ink-muted">
            {isListening && 'Ouvindo comando de voz em Português... fale o módulo ou ação desejada.'}
            {processingVoice && 'Interpretando intenção do comando...'}
            {voiceError && <span className="text-red-600 dark:text-red-400">{voiceError}</span>}
            {!isListening && !processingVoice && !voiceError && voiceFeedback}
          </div>
        )}

        {showShortcuts ? (
          <div className="p-5 space-y-4">
            <h3 className="text-xs font-semibold text-ink-subtle">Atalhos de Teclado Rápidos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                { keys: '⌘K / Ctrl+K', label: 'Abrir paleta de comando e busca' },
                { keys: 'G depois E', label: 'Visão Executiva' },
                { keys: 'G depois F', label: 'Módulo Financeiro' },
                { keys: 'G depois C', label: 'Comercial & CRM' },
                { keys: 'G depois P', label: 'Portfólio & Projetos' },
                { keys: 'G depois A', label: 'Biblioteca 283 Agentes' },
                { keys: 'G depois O', label: 'Operações & Execução' },
                { keys: 'G depois G', label: 'Portal de Governança' },
              ].map((item) => (
                <div key={item.keys} className="flex items-center justify-between px-3 py-2 rounded-lg border border-line bg-surface">
                  <span className="text-ink-muted">{item.label}</span>
                  <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-subtle border border-line text-ink">
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
            <div>
              <p className="px-2 pb-1.5 text-[11px] font-medium text-ink-subtle">Navegação Corporativa</p>
              <div className="space-y-0.5">
                {filteredModules.slice(0, 7).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm hover:bg-surface-subtle transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Command className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="font-medium text-ink truncate">{item.label}</span>
                      <span className="text-xs text-ink-subtle">· {item.group}</span>
                    </div>
                    {item.shortcut && (
                      <kbd className="font-mono text-[11px] text-ink-subtle shrink-0">{item.shortcut}</kbd>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {filteredProjects.length > 0 && (
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-medium text-ink-subtle">Projetos no Portfólio</p>
                <div className="space-y-0.5">
                  {filteredProjects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        onNavigate('projects');
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm hover:bg-surface-subtle transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-xs text-accent mr-2">{proj.code}</span>
                        <span className="text-ink font-medium">{proj.name}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-subtle shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredAgents.length > 0 && (
              <div>
                <p className="px-2 pb-1.5 text-[11px] font-medium text-ink-subtle">
                  Acervo Agency Agents (283 Perfis)
                </p>
                <div className="space-y-0.5">
                  {filteredAgents.map((ag) => (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={() => {
                        onNavigate('agency-library', { searchAgentQuery: ag.code });
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm hover:bg-surface-subtle transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-mono text-xs text-ink-subtle mr-2">{ag.code}</span>
                        <span className="text-ink">{ag.name}</span>
                        <span className="text-xs text-ink-subtle ml-2">· {ag.division}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-subtle shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
