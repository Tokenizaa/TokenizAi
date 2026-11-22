/**
 * app.ts — Fabrica da aplicacao baseada em modulos (Fase 5).
 *
 * Substitui, aos poucos, o server.ts monolítico (1.741 linhas).
 * Estrategia: Strangler Fig — server.ts segue rodando enquanto modulos
 * são migrados um a um; o createApp monta apenas os modulos ja extraidos.
 */

import express from 'express';
import {
  ModuleLoader,
  DiContainer,
  SimpleEventBus,
  type Module,
} from '@nettoscorp/kernel';

export interface CreateAppOptions {
  modules: Module[];
  container?: DiContainer;
  eventBus?: SimpleEventBus;
  db?: unknown; // instancia de banco (Drizzle/Postgres) injetada nos modulos
}

export async function createApp({
  modules,
  container,
  eventBus,
  db,
}: CreateAppOptions): Promise<any> {
  const app: any = express();
  const di: DiContainer = container ?? new DiContainer();
  const bus: SimpleEventBus = eventBus ?? new SimpleEventBus();

  // Middleware global (transporte — fica no adapter/kernel, nunca nos modulos)
  app.use(express.json({ limit: '2mb' }));
  // app.use(cors()); app.use(helmet()); app.use(requestId()); // pendentes

  // Barramento e container expostos nos modulos via req quando necessario
  app.use((_req: any, _res: any, next: any) => {
    _req.di = di;
    _req.bus = bus;
    _req.db = db;
    next();
  });

  // Registro de servicos de cada modulo no container DI
  for (const m of modules) {
    for (const svc of (await (m.services?.() ?? []))) {
      di.register(svc.name, () => svc.factory(di), svc.deps);
    }
  }

  // Inicializacao de modulos ja ordenada por dependencias pelo loader
  for (const m of modules) {
    if (m.config.enabled !== false) {
      await m.init?.(di);
    }
  }

  // Montagem de rotas de cada modulo sob seu prefixo
  for (const m of modules) {
    if (m.config.enabled === false) continue;
    const prefix: string = m.config.routePrefix ?? `/api/${m.id}`;
    for (const route of await (m.routes?.() ?? [])) {
      const handler = (req: any, res: any, next: any) =>
        Promise.resolve(route.handler(req, res, next)).catch(next);
      const args = [prefix + route.path];
      if (route.middleware && route.middleware.length) args.push(...route.middleware);
      args.push(handler);
      switch (route.method) {
        case 'get':
          app.get(...args);
          break;
        case 'post':
          app.post(...args);
          break;
        case 'put':
          app.put(...args);
          break;
        case 'patch':
          app.patch(...args);
          break;
        case 'delete':
          app.delete(...args);
          break;
        case 'use':
          app.use(...args);
          break;
      }
    }
  }

  // Health agregado de todos os modulos
  app.get('/api/health', async (_req: any, res: any) => {
    const checks = await Promise.all(
      modules.map(async (m) => {
        const h = await m.health?.();
        return { [m.id]: h ?? { ok: true } };
      })
    );
    res.json({ status: 'ok', modules: Object.assign({}, ...checks) });
  });

  return app;
}

export { ModuleLoader, DiContainer, SimpleEventBus };
