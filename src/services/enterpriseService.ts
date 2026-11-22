import { INITIAL_ENTERPRISE_STATE } from '../domain/enterpriseSeed';
import type { EnterpriseState, SyncQueueItem } from '../types/enterprise';

const STATE_CACHE_KEY = 'nettoscorp_tokenizai_cache_v2';
const SYNC_QUEUE_KEY = 'nettoscorp_enterprise_sync_queue_v1';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: value > 0 && value < 100 ? 2 : 0,
  }).format(value);
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

export function formatDateTimeBR(dateStr: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function loadCachedState(): EnterpriseState {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY);
    if (!raw) return INITIAL_ENTERPRISE_STATE;
    const parsed = JSON.parse(raw) as Partial<EnterpriseState>;
    return {
      ...INITIAL_ENTERPRISE_STATE,
      ...parsed,
    };
  } catch {
    return INITIAL_ENTERPRISE_STATE;
  }
}

export function saveCachedState(state: EnterpriseState): void {
  try {
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota fallback
  }
}

export function loadSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveSyncQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage errors
  }
}
