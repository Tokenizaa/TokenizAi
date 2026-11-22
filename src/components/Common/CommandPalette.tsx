import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Command, Keyboard, Mic, MicOff, Search, Sparkles, X } from 'lucide-react';
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
  onNavigate: (
    moduleId: ModuleId,
    extra?: { searchAgentQuery?: string; openNewProject?: boolean; projectId?: string }
  ) => void;
  onOpenChat?: (target: { projectId?: string }) => void;
  onToggleTheme: () => void;
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const QUICK_VOICE_EXAMPLES = [
  'Abrir projeto Meridian',
  'Ir para Financeiro',
  'Buscar agentes AppSec',
  'Compor equipe Vértice',
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  destinations,
  projects,
  activeRole,
  onNavigate,
  onOpenChat,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [processingVoice, setProcessingVoice] = useState(false);

  const findMatchingProject = useCallback(
    (text: string): EnterpriseProject | undefined => {
      const normalized = normalizeText(text);
      return projects.find((proj) => {
        const code = normalizeText(proj.code);
        const name = normalizeText(proj.name);
        if (normalized.includes(code) || normalized.includes(name)) return true;
        const significantWords = name.split(/\s+/).filter((w) => w.length >= 4);
        return significantWords.some((word) => normalized.includes(word));
      });
    },
    [projects]
  );

  const findMatchingDestination = useCallback(
    (text: string): NavDestination | undefined => {
      const normalized = normalizeText(text);
      return destinations.find((d) => {
        if (!canAccessModule(activeRole, d.id)) return false;
        const label = normalizeText(d.label);
        const firstToken = label.split(/\s+/)[0];
        return (
          normalized.includes(label) ||
          (firstToken.length >= 4 && normalized.includes(firstToken))
        );
      });
    },
    [destinations, activeRole]
  );

  const executeNaturalCommand = useCallback(
    async (transcript: string) => {
      const clean = transcript.trim();
      if (!clean) return;

      setQuery(clean);
      setProcessingVoice(true);
      setVoiceFeedback(`Comando capturado: "${clean}"`);

      const lower = normalizeText(clean);
      const matchedProject = findMatchingProject(clean);
      const directNav = findMatchingDestination(clean);

      // Fast deterministic intents before remote NLP
      if (
        lower.includes('novo projeto') ||
        lower.includes('criar projeto') ||
        lower.includes('iniciar projeto')
      ) {
        setProcessingVoice(false);
        onNavigate('projects', { openNewProject: true });
        onClose();
        return;
      }

      if (
        lower.includes('alternar tema') ||
        lower.includes('modo escuro') ||
        lower.includes('modo claro') ||
        lower.includes('mudar tema')
      ) {
        setProcessingVoice(false);
        onToggleTheme();
        onClose();
        return;
      }

      if (
        (lower.includes('compor equipe') ||
          lower.includes('montar equipe') ||
          lower.includes('team composer')) &&
        canAccessModule(activeRole, 'team-composer')
      ) {
        setProcessingVoice(false);
        onNavigate('team-composer', matchedProject ? { projectId: matchedProject.id } : undefined);
        onClose();
        return;
      }

      if (
        (lower.includes('abrir chat') ||
          lower.includes('canal do projeto') ||
          lower.includes('ir para chat')) &&
        canAccessModule(activeRole, 'chat')
      ) {
        setProcessingVoice(false);
        if (matchedProject && onOpenChat) {
          onOpenChat({ projectId: matchedProject.id });
        } else {
          onNavigate('chat');
        }
        onClose();
        return;
      }

      if (
        matchedProject &&
        (lower.includes('abrir projeto') ||
          lower.includes('ver projeto') ||
          lower.includes('ir para projeto') ||
          lower.includes('projeto '))
      ) {
        if (!canAccessModule(activeRole, 'projects')) {
          setProcessingVoice(false);
          setVoiceFeedback('Seu perfil atual não possui permissão para acessar Portfólio & Projetos.');
          return;
        }
        setProcessingVoice(false);
        onNavigate('projects', { projectId: matchedProject.id });
        onClose();
        return;
      }

      try {
        const intent = await AIAdapter.parseVoiceIntent(clean);
        setVoiceFeedback(intent.explanation);

        if (intent.action === 'new_project') {
          if (!canAccessModule(activeRole, 'projects')) {
            setVoiceFeedback('Seu perfil atual não possui acesso ao módulo de Projetos.');
            return;
          }
          onNavigate('projects', { openNewProject: true });
          onClose();
          return;
        }

        if (intent.action === 'toggle_theme') {
          onToggleTheme();
          onClose();
          return;
        }

        if (intent.action === 'open_project') {
          const targetProjectId = intent.projectId || matchedProject?.id;
          if (!canAccessModule(activeRole, 'projects')) {
            setVoiceFeedback('Seu perfil atual não possui acesso ao módulo de Projetos.');
            return;
          }
          onNavigate('projects', targetProjectId ? { projectId: targetProjectId } : undefined);
          onClose();
          return;
        }

        if (intent.action === 'team_composer') {
          if (!canAccessModule(activeRole, 'team-composer')) {
            setVoiceFeedback('Seu perfil atual não possui acesso ao Team Composer.');
            return;
          }
          const targetProjectId = intent.projectId || matchedProject?.id;
          onNavigate('team-composer', targetProjectId ? { projectId: targetProjectId } : undefined);
          onClose();
          return;
        }

        if (intent.action === 'open_chat') {
          if (!canAccessModule(activeRole, 'chat')) {
            setVoiceFeedback('Seu perfil atual não possui acesso ao módulo de Chat.');
            return;
          }
          const targetProjectId = intent.projectId || matchedProject?.id;
          if (targetProjectId && onOpenChat) {
            onOpenChat({ projectId: targetProjectId });
          } else {
            onNavigate('chat');
          }
          onClose();
          return;
        }

        if (intent.action === 'search_agents') {
          if (!canAccessModule(activeRole, 'agency-library')) {
            setVoiceFeedback('Seu perfil atual não possui acesso à Biblioteca de Agentes.');
            return;
          }
          onNavigate('agency-library', { searchAgentQuery: intent.query || clean });
          onClose();
          return;
        }

        if (intent.moduleId) {
          const targetModule = intent.moduleId as ModuleId;
          if (!canAccessModule(activeRole, targetModule)) {
            setVoiceFeedback('Seu perfil atual não possui permissão para o módulo solicitado.');
            return;
          }
          onNavigate(targetModule, {
            searchAgentQuery: intent.query,
            projectId: intent.projectId || matchedProject?.id,
          });
          onClose();
          return;
        }

        if (directNav) {
          onNavigate(directNav.id);
          onClose();
        }
      } catch {
        if (matchedProject && canAccessModule(activeRole, 'projects')) {
          onNavigate('projects', { projectId: matchedProject.id });
          onClose();
        } else if (directNav) {
          onNavigate(directNav.id);
          onClose();
        } else {
          setVoiceFeedback(
            'Não foi possível resolver automaticamente — selecione um resultado na lista ou refine o comando.'
          );
        }
      } finally {
        setProcessingVoice(false);
      }
    },
    [
      activeRole,
      findMatchingDestination,
      findMatchingProject,
      onClose,
      onNavigate,
      onOpenChat,
      onToggleTheme,
    ]
  );

  const {
    isSupported,
    isListening,
    interimTranscript,
    permissionState,
    voiceError,
    startListening,
    stopListening,
  } = useVoiceCommand((transcript) => {
    void executeNaturalCommand(transcript);
  });

  useEffect(() => {
    if (!isOpen) {
      if (isListening) stopListening();
      setQuery('');
      setShowShortcuts(false);
      setVoiceFeedback(null);
    }
  }, [isOpen, isListening, stopListening]);

  const filteredModules = useMemo(() => {
    const q = normalizeText(query.trim());
    return destinations
      .filter((d) => canAccessModule(activeRole, d.id))
      .filter(
        (d) => !q || normalizeText(d.label).includes(q) || normalizeText(d.group).includes(q)
      );
  }, [destinations, activeRole, query]);

  const filteredProjects = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) return projects.slice(0, 3);
    return projects
      .filter(
        (p) =>
          normalizeText(p.name).includes(q) ||
          normalizeText(p.code).includes(q) ||
          normalizeText(p.area).includes(q)
      )
      .slice(0, 4);
  }, [projects, query]);

  const filteredAgents = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q || q.length < 2) return [];
    return AGENCY_AGENTS_283.filter(
      (a) =>
        normalizeText(a.name).includes(q) ||
        normalizeText(a.code).includes(q) ||
        normalizeText(a.division).includes(q) ||
        a.competencies.some((c) => normalizeText(c).includes(q))
    ).slice(0, 5);
  }, [query]);

  if (!isOpen) return null;

  const permissionLabel =
    !isSupported
      ? 'Navegador sem SpeechRecognition'
      : permissionState === 'granted'
      ? 'Microfone autorizado'
      : permissionState === 'denied'
      ? 'Microfone bloqueado no navegador'
      : 'Pronto para comando de voz (pt-BR)';

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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                void executeNaturalCommand(query);
              }
            }}
            placeholder="Digite ou fale um comando (ex: 'Abrir projeto Meridian', 'Ir para Financeiro')..."
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => void executeNaturalCommand(query)}
              disabled={processingVoice}
              title="Interpretar comando com linguagem natural (Enter)"
              className="px-2.5 py-1.5 rounded-lg border border-line text-xs font-medium text-ink hover:bg-surface-subtle transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              Executar
            </button>
          )}
          <button
            type="button"
            onClick={() => (isListening ? stopListening() : void startListening())}
            title={isListening ? 'Parar captura de voz' : 'Ativar comando de voz (Português)'}
            aria-pressed={isListening}
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

        <div className="px-4 py-2 text-xs border-b border-line bg-surface-subtle/70 text-ink-muted flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <Mic className={`w-3.5 h-3.5 shrink-0 ${isListening ? 'text-red-600 dark:text-red-400' : 'text-accent'}`} />
              {isListening ? (
                <span className="text-ink font-medium">
                  Ouvindo comando em Português (pt-BR)...
                  {interimTranscript && (
                    <span className="ml-1.5 font-normal text-ink-muted italic">
                      &ldquo;{interimTranscript}&rdquo;
                    </span>
                  )}
                </span>
              ) : processingVoice ? (
                <span>Interpretando intenção do comando...</span>
              ) : voiceError ? (
                <span className="text-red-600 dark:text-red-400">{voiceError}</span>
              ) : voiceFeedback ? (
                <span className="text-ink">{voiceFeedback}</span>
              ) : (
                <span>{permissionLabel}</span>
              )}
            </span>
            <span className="text-[11px] text-ink-subtle font-mono">Enter para NLP · Esc para fechar</span>
          </div>

          {!isListening && !processingVoice && !query.trim() && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] text-ink-subtle mr-1">Exemplos rápidos:</span>
              {QUICK_VOICE_EXAMPLES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => void executeNaturalCommand(sample)}
                  className="px-2 py-0.5 rounded border border-line bg-surface text-[11px] text-ink-muted hover:text-ink hover:border-accent/50 transition-colors cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          )}
        </div>

        {showShortcuts ? (
          <div className="p-5 space-y-4">
            <h3 className="text-xs font-semibold text-ink-subtle">Atalhos de Teclado Rápidos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                { keys: '⌘K / Ctrl+K', label: 'Abrir paleta de comando e busca' },
                { keys: 'G depois E', label: 'Visão Executiva' },
                { keys: 'G depois M', label: 'Comunicação & Chat Nativo' },
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
                        onNavigate('projects', { projectId: proj.id });
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

