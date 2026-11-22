/**
 * modules/chat — Modulo de conversa e orquestracao de agentes.
 *
 * Exemplo de modulo de negocio da Fase 5. Expõe rotas, servicos (DI),
 * migracoes e UI lazy. A lógica de dominio fica em services/ e domain/,
 * fora de server.ts.
 */

import type {
  Module,
  ModuleRoute,
  ModuleServiceFactory,
} from '@nettoscorp/kernel';

export const config = {
  enabled: true,
  routePrefix: '/api/chat',
};

const routes: ModuleRoute[] = [
  { method: 'post', path: '/conversations', handler: createConversation },
  { method: 'post', path: '/messages', handler: sendMessage },
  { method: 'post', path: '/inter-agent', handler: interAgentDialogue },
];

const services: ModuleServiceFactory[] = [
  {
    name: 'chat.conversationService',
    deps: [],
    factory: (container) => ({
      container,
      create: () => ({ ok: true }),
    }),
  },
];

// Placeholders de handler (corpo extraido de server.ts durante a refatoracao)
const createConversation = (req: unknown, res: unknown) => {
  (res as any).json({ ok: true });
};
const sendMessage = (req: unknown, res: unknown) => {
  (res as any).json({ ok: true });
};
const interAgentDialogue = (req: unknown, res: unknown) => {
  (res as any).json({ ok: true });
};

export default {
  id: 'chat',
  name: 'Chat & Orchestration',
  version: '0.1.0',
  config,
  dependencies: ['gateway'],
  routes: () => routes,
  services,
  migrations: () => [],
  ui: {
    lazy: () =>
      import('../ui/ChatModule.tsx').then((m) => ({ default: m.default })),
    route: '/chat',
    navigation: { label: 'Chat', icon: 'message-circle', order: 1, moduleId: 'chat' },
  },
  health: async () => ({ ok: true, details: { routes: routes.length } }),
} as Module;
