/**
 * @nettoscorp/kernel — Container de Injecao de Dependencia (DI)
 *
 * Container minimo, sincrono/assincrono, com deteccao de dependencia circular.
 * Modulos registram seus servicos aqui; o kernel nao cria instancias de servicos
 * fora deste container.
 */

import type { DIContainer, ModuleServiceFactory } from './module';

export class DiContainer implements DIContainer {
  private factories = new Map<string, () => unknown | Promise<unknown>>();
  private cache = new Map<string, unknown>();
  private resolving = new Set<string>();

  register<T>(name: string, factory: () => T | Promise<T>, deps?: string[]): void {
    this.factories.set(name, factory);
  }

  resolve<T>(name: string): T | undefined {
    if (this.cache.has(name)) return this.cache.get(name) as T;
    const factory = this.factories.get(name);
    if (!factory) return undefined;
    if (this.resolving.has(name)) {
      throw new Error(`Dependencia circular ao resolver '${name}'`);
    }
    this.resolving.add(name);
    const instance = factory();
    this.resolving.delete(name);
    if (instance && typeof (instance as Promise<unknown>).then === 'function') {
      return undefined as unknown as T; // fabrica assincrona: usar resolveAsync
    }
    this.cache.set(name, instance);
    return instance as T;
  }

  async resolveAsync<T>(name: string): Promise<T | undefined> {
    if (this.cache.has(name)) return this.cache.get(name) as T;
    const factory = this.factories.get(name);
    if (!factory) return undefined;
    if (this.resolving.has(name)) {
      throw new Error(`Dependencia circular ao resolver '${name}'`);
    }
    this.resolving.add(name);
    const instance = await factory();
    this.resolving.delete(name);
    this.cache.set(name, instance);
    return instance as T;
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }
}
