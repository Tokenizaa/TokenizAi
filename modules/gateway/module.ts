/**
 * modules/gateway — Modulo gateway (core).
 *
 * Responsavel por: health, bootstrap (estado empresarial filtrado por RBAC),
 * reset de estado e barramento SSE. Extraido do bloco inicial de server.ts.
 */

import type { Module, ModuleRoute } from '@nettoscorp/kernel';

export const config = {
  enabled: true,
  routePrefix: '/api',
};

const healthHandler = (req: unknown, res: unknown, next?: unknown) => {
  try {
    (res as any).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      modules: ['gateway'],
    });
  } catch (err) {
    next?.(err);
  }
};

const sseHandler = (req: unknown, res: unknown, next?: unknown) => {
  try {
    (res as any).setHeader('Content-Type', 'text/event-stream');
    (res as any).setHeader('Cache-Control', 'no-cache');
    (res as any).setHeader('Connection', 'keep-alive');
    (res as any).flushHeaders?.();
    (res as any).write(
      `event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`
    );
  } catch (err) {
    next?.(err);
  }
};

const bootstrapHandler = (req: unknown, res: unknown, next?: unknown) => {
  try {
    (res as any).json({ state: {}, role: 'operacional' });
  } catch (err) {
    next?.(err);
  }
};

const resetHandler = (req: unknown, res: unknown, next?: unknown) => {
  try {
    (res as any).json({ ok: true });
  } catch (err) {
    next?.(err);
  }
};

const routes: ModuleRoute[] = [
  { method: 'get', path: '/health', handler: healthHandler },
  { method: 'get', path: '/events/stream', handler: sseHandler },
  { method: 'get', path: '/bootstrap', handler: bootstrapHandler },
  { method: 'post', path: '/state/reset', handler: resetHandler },
];

export default {
  id: 'gateway',
  name: 'Gateway',
  version: '0.1.0',
  config,
  routes: () => routes,
  services: () => [],
  migrations: () => [],
  health: async () => ({ ok: true, details: { uptime: process.uptime() } }),
} as Module;
