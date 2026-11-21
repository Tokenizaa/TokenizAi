import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useVoiceCommand } from '../../hooks/useEnterpriseHooks';
import { AIAdapter } from '../../services/adapters';
import type { ModuleId, UserRole } from '../../types/enterprise';

export type ChatbotPersonaId =
  | 'executive_advisor'
  | 'finance_controller'
  | 'tech_architect'
  | 'operations_lead'
  | 'custom';

export type ChatbotSpeedMode = 'balanced' | 'fast';

interface ChatbotPersona {
  id: ChatbotPersonaId;
  label: string;
  subtitle: string;
  defaultInstruction: string;
  starters: string[];
}

interface ChatbotMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
  modelUsed?: string;
  personaId: ChatbotPersonaId;
}

const PERSONAS: ChatbotPersona[] = [
  {
    id: 'executive_advisor',
    label: 'Conselheiro Executivo',
    subtitle: 'Estratégia, riscos de portfólio e decisões DEC/CNS',
    defaultInstruction:
      'Você é o Conselheiro Executivo da NettosCorp Enterprise. Sintetize riscos de portfólio, priorize entregas estratégicas e estruture recomendações objetivas para decisão da diretoria.',
    starters: [
      'Resuma os principais riscos e gargalos atuais do portfólio.',
      'Quais decisões ou aprovações pendentes exigem atenção imediata?',
      'Sugira prioridades executivas para esta semana.',
    ],
  },
  {
    id: 'finance_controller',
    label: 'Controller & FP&A',
    subtitle: 'Caixa, centros de custo, margem e orçamento de IA',
    defaultInstruction:
      'Você é o Controller e Especialista FP&A da NettosCorp Enterprise. Analise receitas, despesas, margens e orçamento de agentes com foco em eficiência financeira em BRL.',
    starters: [
      'Avalie o equilíbrio atual entre receitas e despesas.',
      'Como otimizar o orçamento dos agentes operacionais sem perder entregas?',
      'Monte um checklist rápido de fechamento financeiro semanal.',
    ],
  },
  {
    id: 'tech_architect',
    label: 'Arquiteto de IA & Software',
    subtitle: 'Arquitetura, AppSec, RAG e composição de agentes',
    defaultInstruction:
      'Você é o Arquiteto Principal de Software & IA da NettosCorp Enterprise. Proponha arquiteturas seguras, composições com a biblioteca de 283 Agency Agents e práticas de engenharia confiáveis.',
    starters: [
      'Quais perfis de agentes devo combinar para auditar segurança e QA?',
      'Como estruturar gates de qualidade antes de colocar um modelo em produção?',
      'Sugira melhorias técnicas para o módulo atual.',
    ],
  },
  {
    id: 'operations_lead',
    label: 'Líder de Operações',
    subtitle: 'Desbloqueio de tarefas, SLAs e alocação de equipes',
    defaultInstruction:
      'Você é o Líder de Operações & Entregas da NettosCorp Enterprise. Ajude a desbloquear tarefas atrasadas, alinhar responsáveis humanos e digitais e definir critérios claros de conclusão.',
    starters: [
      'Como destravar as tarefas atrasadas com menor impacto no prazo?',
      'Defina critérios objetivos de evidência para revisão de entregas.',
      'Ajude a planejar a cadência diária entre equipes humanas e agentes.',
    ],
  },
  {
    id: 'custom',
    label: 'Papel Personalizado',
    subtitle: 'Defina sua própria instrução de sistema',
    defaultInstruction:
      'Você é um especialista corporativo da NettosCorp Enterprise. Responda de forma estruturada, prática e alinhada à instrução de sistema definida pelo usuário.',
    starters: [
      'Apresente-se conforme a instrução de sistema configurada.',
      'Analise o contexto atual do módulo aberto.',
    ],
  },
];

const STORAGE_KEY = 'nettoscorp_gemini_chatbot_threads_v1';

interface PersistedChatbotState {
  personaId: ChatbotPersonaId;
  speedMode: ChatbotSpeedMode;
  customInstructions: Partial<Record<ChatbotPersonaId, string>>;
  threads: Partial<Record<ChatbotPersonaId, ChatbotMessage[]>>;
}

const loadPersistedState = (): PersistedChatbotState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as PersistedChatbotState;
    }
  } catch {
    // Ignore storage errors
  }
  return {
    personaId: 'executive_advisor',
    speedMode: 'balanced',
    customInstructions: {},
    threads: {},
  };
};

interface GeminiChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeRole: UserRole;
  activeModule: ModuleId;
  activeModuleLabel: string;
}

export const GeminiChatbotDrawer: React.FC<GeminiChatbotDrawerProps> = ({
  isOpen,
  onClose,
  activeRole,
  activeModule,
  activeModuleLabel,
}) => {
  const initial = useMemo(() => loadPersistedState(), []);
  const [personaId, setPersonaId] = useState<ChatbotPersonaId>(initial.personaId);
  const [speedMode, setSpeedMode] = useState<ChatbotSpeedMode>(initial.speedMode);
  const [customInstructions, setCustomInstructions] = useState<
    Partial<Record<ChatbotPersonaId, string>>
  >(initial.customInstructions);
  const [threads, setThreads] = useState<Partial<Record<ChatbotPersonaId, ChatbotMessage[]>>>(
    initial.threads
  );

  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSystemEditor, setShowSystemEditor] = useState(false);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const activePersona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];
  const currentInstruction =
    customInstructions[personaId] ?? activePersona.defaultInstruction;
  const messages = threads[personaId] ?? [];

  useEffect(() => {
    try {
      const payload: PersistedChatbotState = {
        personaId,
        speedMode,
        customInstructions,
        threads,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [personaId, speedMode, customInstructions, threads]);

  useEffect(() => {
    if (isOpen) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [isOpen, messages.length, messages[messages.length - 1]?.text]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const sendMessage = async (textOverride?: string) => {
    const content = (textOverride ?? draft).trim();
    if (!content || streaming) return;

    if (!textOverride) setDraft('');
    setErrorMsg(null);
    setStreaming(true);

    const priorHistory = messages.map((m) => ({ role: m.role, text: m.text }));
    const userMsg: ChatbotMessage = {
      id: `cb-u-${Date.now()}`,
      role: 'user',
      text: content,
      createdAt: new Date().toISOString(),
      personaId,
    };
    const modelMsgId = `cb-m-${Date.now() + 1}`;
    const placeholderModelMsg: ChatbotMessage = {
      id: modelMsgId,
      role: 'model',
      text: '',
      createdAt: new Date().toISOString(),
      modelUsed: speedMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen',
      personaId,
    };

    setThreads((prev) => ({
      ...prev,
      [personaId]: [...(prev[personaId] ?? []), userMsg, placeholderModelMsg],
    }));

    const hasCustomOverride =
      customInstructions[personaId] !== undefined &&
      customInstructions[personaId]!.trim() !== activePersona.defaultInstruction.trim();

    try {
      const result = await AIAdapter.streamChatbotTurn(activeRole, {
        message: content,
        history: priorHistory,
        personaId,
        customSystemInstruction:
          personaId === 'custom' || hasCustomOverride ? currentInstruction : undefined,
        speedMode,
        activeModule: `${activeModuleLabel} (${activeModule})`,
        onChunk: (delta) => {
          setThreads((prev) => ({
            ...prev,
            [personaId]: (prev[personaId] ?? []).map((msg) =>
              msg.id === modelMsgId ? { ...msg, text: msg.text + delta } : msg
            ),
          }));
        },
      });

      setThreads((prev) => ({
        ...prev,
        [personaId]: (prev[personaId] ?? []).map((msg) =>
          msg.id === modelMsgId
            ? {
                ...msg,
                text: msg.text || result.text || 'Sem conteúdo retornado pelo modelo.',
                modelUsed: result.model,
              }
            : msg
        ),
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao obter resposta do chatbot Gemini.';
      setErrorMsg(message);
      setThreads((prev) => ({
        ...prev,
        [personaId]: (prev[personaId] ?? []).filter(
          (msg) => !(msg.id === modelMsgId && !msg.text.trim())
        ),
      }));
    } finally {
      setStreaming(false);
    }
  };

  const {
    isListening,
    interimTranscript,
    voiceError,
    startListening,
    stopListening,
  } = useVoiceCommand((transcript) => {
    setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript));
  });

  const handleClearThread = () => {
    if (streaming) return;
    setThreads((prev) => ({ ...prev, [personaId]: [] }));
    setErrorMsg(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Assistente Multi-Turn Gemini"
    >
      <aside
        className="w-full max-w-[470px] h-full bg-surface border-l border-line shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-line flex items-center justify-between gap-3 bg-surface">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold text-ink truncate">
                Assistente Gemini
              </h2>
              <p className="text-[11px] text-ink-subtle truncate">
                Contexto ativo: {activeModuleLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleClearThread}
              disabled={streaming || messages.length === 0}
              title="Iniciar nova conversa para este papel"
              className="p-2 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer disabled:opacity-40"
              aria-label="Nova conversa"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar assistente"
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Role & Model Configuration */}
        <div className="px-4 py-3 border-b border-line bg-surface-subtle/40 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="chatbot-role-select"
                className="block text-[11px] font-medium text-ink-subtle mb-1"
              >
                Papel do Chatbot
              </label>
              <select
                id="chatbot-role-select"
                value={personaId}
                onChange={(e) => {
                  setPersonaId(e.target.value as ChatbotPersonaId);
                  setErrorMsg(null);
                }}
                disabled={streaming}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink focus:outline-none focus:border-accent"
              >
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-ink-subtle mb-1">
                Modo do Modelo
              </span>
              <div className="grid grid-cols-2 p-0.5 rounded-lg border border-line bg-canvas text-[11px]">
                <button
                  type="button"
                  onClick={() => setSpeedMode('balanced')}
                  disabled={streaming}
                  className={`py-1 px-2 rounded-md font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    speedMode === 'balanced'
                      ? 'bg-surface text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Bot className="w-3 h-3 text-accent" />
                  Geral
                </button>
                <button
                  type="button"
                  onClick={() => setSpeedMode('fast')}
                  disabled={streaming}
                  className={`py-1 px-2 rounded-md font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    speedMode === 'fast'
                      ? 'bg-surface text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Zap className="w-3 h-3 text-accent" />
                  Rápido
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-ink-subtle">
            <span className="truncate">
              {activePersona.subtitle} ·{' '}
              <span className="font-mono">
                {speedMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowSystemEditor((s) => !s)}
              className="inline-flex items-center gap-1 text-accent hover:underline shrink-0 cursor-pointer font-medium"
            >
              <SlidersHorizontal className="w-3 h-3" />
              Instrução
              {showSystemEditor ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {showSystemEditor && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <label htmlFor="chatbot-system-instruction" className="text-ink-muted font-medium">
                  Instrução de Sistema (System Instruction)
                </label>
                {customInstructions[personaId] && (
                  <button
                    type="button"
                    onClick={() =>
                      setCustomInstructions((prev) => {
                        const next = { ...prev };
                        delete next[personaId];
                        return next;
                      })
                    }
                    className="text-ink-subtle hover:text-ink underline cursor-pointer"
                  >
                    Restaurar padrão
                  </button>
                )}
              </div>
              <textarea
                id="chatbot-system-instruction"
                rows={3}
                value={currentInstruction}
                onChange={(e) =>
                  setCustomInstructions((prev) => ({
                    ...prev,
                    [personaId]: e.target.value,
                  }))
                }
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-line bg-surface text-ink focus:outline-none focus:border-accent resize-y"
              />
            </div>
          )}
        </div>

        {/* Scrollable Conversation Thread */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-canvas/50">
          {messages.length === 0 ? (
            <div className="space-y-4 py-4">
              <div className="p-3.5 rounded-xl border border-line bg-surface space-y-1.5">
                <p className="text-xs font-semibold text-ink">{activePersona.label}</p>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Conversa multi-turno com histórico preservado. Faça perguntas sequenciais para
                  analisar indicadores, revisar decisões ou explorar recomendações para{' '}
                  <span className="font-medium text-ink">{activeModuleLabel}</span>.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-ink-subtle">Sugestões para iniciar</p>
                <div className="space-y-1.5">
                  {activePersona.starters.map((promptText) => (
                    <button
                      key={promptText}
                      type="button"
                      onClick={() => void sendMessage(promptText)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-line bg-surface hover:border-accent text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-subtle px-1">
                    {isUser ? (
                      <>
                        <span>Você</span>
                        <User className="w-3 h-3" />
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3 text-accent" />
                        <span className="font-medium text-ink">{activePersona.label}</span>
                        {msg.modelUsed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{msg.modelUsed}</span>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-accent text-white'
                        : 'border border-line bg-surface text-ink'
                    }`}
                  >
                    {msg.text || (streaming ? 'Gerando resposta...' : '')}
                  </div>
                </div>
              );
            })
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Error & Voice Status */}
        {(errorMsg || voiceError || isListening) && (
          <div className="px-4 py-2 border-t border-line bg-surface-subtle text-xs">
            {errorMsg && <p className="text-red-600 dark:text-red-400">{errorMsg}</p>}
            {voiceError && <p className="text-red-600 dark:text-red-400">{voiceError}</p>}
            {isListening && (
              <p className="text-ink-muted">
                Ouvindo em Português...
                {interimTranscript && (
                  <span className="ml-1.5 italic text-ink">&ldquo;{interimTranscript}&rdquo;</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="p-3.5 border-t border-line bg-surface space-y-2"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={`Pergunte ao ${activePersona.label} (Enter envia)...`}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink placeholder:text-ink-subtle focus:outline-none focus:border-accent resize-none"
            />
            <button
              type="button"
              onClick={() => (isListening ? stopListening() : void startListening())}
              title={isListening ? 'Parar microfone' : 'Ditar mensagem por voz'}
              aria-label={isListening ? 'Parar microfone' : 'Ditar mensagem por voz'}
              className={`p-2.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                isListening
                  ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'border-line text-ink-muted hover:text-ink hover:bg-surface-subtle'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="submit"
              disabled={streaming || !draft.trim()}
              aria-label="Enviar mensagem"
              className="px-3.5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              {streaming ? 'Gerando' : 'Enviar'}
            </button>
          </div>
          <p className="text-[11px] text-ink-subtle flex items-center justify-between">
            <span>Histórico salvo localmente neste navegador</span>
            <span className="font-mono">{messages.length} msgs</span>
          </p>
        </form>
      </aside>
    </div>
  );
};
