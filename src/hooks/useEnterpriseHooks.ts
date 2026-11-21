import { useEffect, useRef, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    install,
  };
}

interface SpeechRecognitionResultItem {
  isFinal?: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: { resultIndex?: number; results: ArrayLike<SpeechRecognitionResultItem> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export type MicPermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

const MIC_ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permissão de microfone negada. Libere o acesso ao microfone no navegador.',
  'service-not-allowed': 'Serviço de reconhecimento de voz bloqueado pelas permissões do navegador.',
  'no-speech': 'Nenhuma fala detectada. Tente falar mais próximo ao microfone.',
  'audio-capture': 'Nenhum microfone ativo foi encontrado neste dispositivo.',
  network: 'Falha de rede no reconhecimento de voz do navegador.',
  aborted: 'Captura de voz cancelada.',
};

export function useVoiceCommand(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<MicPermissionState>('unknown');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    );

  useEffect(() => {
    let active = true;
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          if (!active) return;
          setPermissionState(status.state as MicPermissionState);
          status.onchange = () => {
            if (active) setPermissionState(status.state as MicPermissionState);
          };
        })
        .catch(() => {
          if (active) setPermissionState('unknown');
        });
    }
    return () => {
      active = false;
      recognitionRef.current?.abort?.();
    };
  }, []);

  const startListening = async () => {
    setVoiceError(null);
    setInterimTranscript('');

    if (!isSupported) {
      setVoiceError('Reconhecimento de voz não suportado neste navegador. Digite o comando na barra rápida.');
      return;
    }

    // Explicitly verify/request microphone permission when MediaDevices API is available
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setPermissionState('granted');
      } catch {
        setPermissionState('denied');
        setVoiceError(MIC_ERROR_MESSAGES['not-allowed']);
        return;
      }
    }

    const SpeechCtor =
      (window as unknown as Record<string, new () => SpeechRecognitionInstance>).SpeechRecognition ||
      (window as unknown as Record<string, new () => SpeechRecognitionInstance>).webkitSpeechRecognition;

    try {
      recognitionRef.current?.abort?.();
      const recognition = new SpeechCtor();
      recognition.lang = 'pt-BR';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let interim = '';
        let finalText = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res?.[0]?.transcript ?? '';
          if (res.isFinal) {
            finalText += `${text} `;
          } else {
            interim += `${text} `;
          }
        }
        setInterimTranscript(interim.trim() || finalText.trim());
        if (finalText.trim()) {
          setInterimTranscript('');
          onTranscriptRef.current(finalText.trim());
        }
      };

      recognition.onerror = (ev) => {
        setVoiceError(
          MIC_ERROR_MESSAGES[ev.error] ?? `Captura de voz interrompida (${ev.error}).`
        );
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setVoiceError('Não foi possível iniciar o microfone.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  };

  return {
    isSupported,
    isListening,
    interimTranscript,
    permissionState,
    voiceError,
    startListening,
    stopListening,
  };
}

