/**
 * @nettoscorp/kernel — Carregador de Modulos (Fase 5)
 *
 * Carrega modulos dinamicamente via import(), valida o contrato Module e
 * ordena por dependencias (topologico) para inicializacao e migracoes.
 * Em desenvolvimento com tsx, `import('./modules/<id>/module.ts')` funciona
 * direto. Em producao, os modulos sao empacotados e o loader resolve o .js.
 */

import type { Module, ModuleLoader as IModuleLoader } from './module';

export class ModuleLoader implements IModuleLoader {
  constructor(private baseDir = 'modules') {}

  async load(moduleId: string): Promise<Module> {
    let mod: unknown;
    try {
      mod = await import(`${this.baseDir}/${moduleId}/module.ts`);
    } catch {
      mod = await import(`${this.baseDir}/${moduleId}/module.js`);
    }
    const m = ((mod as { default?: Module }).default ?? mod) as Module;
    this.validate(m);
    return m;
  }

  async loadAll(moduleIds: string[]): Promise<Module[]> {
    const loaded = await Promise.all(moduleIds.map((id) => this.load(id)));
    return this.sorted(loaded);
  }

  sorted(modules: Module[]): Module[] {
    const byId = new Map(modules.map((m) => [m.id, m]));
    const visited = new Set<string>();
    const order: Module[] = [];
    const visit = (id: string, stack: string[]) => {
      if (visited.has(id)) return;
      if (stack.includes(id)) {
        throw new Error(
          `Dependencia circular entre modulos: ${[...stack, id].join(' -> ')}`
        );
      }
      const m = byId.get(id);
      if (!m) return;
      for (const dep of m.dependencies ?? []) visit(dep, [...stack, id]);
      visited.add(id);
      order.push(m);
    };
    for (const m of modules) visit(m.id, []);
    return order;
  }

  private validate(m: Module): void {
    if (!m.id || !m.name || !m.version) {
      throw new Error(`Modulo invalido: faltam id/name/version`);
    }
    if (!m.config) m.config = { enabled: true };
  }
}
