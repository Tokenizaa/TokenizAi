/**
 * @nettoscorp/kernel — Barramento de Eventos
 *
 * Barramento simples em memoria. Pontos de integracao:
 *  - eventos internos entre modulos (ex: 'chat:message:created')
 *  - ponte para SSE (clientes assinam e recebem broadcast)
 * Erros de ouvinte nunca quebram o barramento.
 */

import type { EventBus } from './module';

export class SimpleEventBus implements EventBus {
  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  emit(event: string, payload: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch {
        // ouvinte com falha nao derruba o barramento
      }
    }
  }

  on(event: string, listener: (payload: unknown) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  off(event: string, listener: (payload: unknown) => void): void {
    this.listeners.get(event)?.delete(listener);
  }
}
