import type { EnterpriseState, FinancialEntry, CostCenterBudget, ProjectTask, EnterpriseProject } from './types';
import { formatBRL as constantsFormatBRL, formatDateBR as constantsFormatDateBR, formatDateTimeBR as constantsFormatDateTimeBR } from './constants';

/**
 * Currency formatting
 */
export function formatBRL(value: number): string {
  return constantsFormatBRL(value);
}

/**
 * Date formatting (pt-BR)
 */
export function formatDateBR(dateStr: string): string {
  return constantsFormatDateBR(dateStr);
}

/**
 * DateTime formatting (pt-BR)
 */
export function formatDateTimeBR(dateStr: string): string {
  return constantsFormatDateTimeBR(dateStr);
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate short ID for internal references
 */
export function generateShortId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${prefix ? '-' : ''}${timestamp}-${random}`;
}

/**
 * Calculate percentage with safe division
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

/**
 * Calculate budget utilization percentage
 */
export function calculateBudgetUtilization(spent: number, allocated: number): number {
  return calculatePercentage(spent, allocated);
}

/**
 * Format number with Brazilian locale
 */
export function formatNumberBR(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

/**
 * Format compact number (1.2K, 3.4M, etc.)
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Safe get nested property
 */
export function safeGet<T>(obj: Record<string, unknown>, path: string, defaultValue: T): T {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return (current as T) ?? defaultValue;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generate audit hash
 */
export function makeAuditHash(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Slugify string for IDs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Parse BRL string to number
 */
export function parseBRL(brlString: string): number {
  const cleaned = brlString.replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate days between dates
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if date is overdue
 */
export function isOverdue(dueDate: string, status?: string): boolean {
  if (status === 'concluida' || status === 'cancelada' || status === 'pago') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

/**
 * Calculate project progress from tasks
 */
export function calculateProjectProgress(tasks: ProjectTask[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((t) => t.status === 'concluida').length;
  return Math.round((completed / tasks.length) * 100);
}

/**
 * Calculate project spent budget
 */
export function calculateProjectSpent(projects: EnterpriseProject[]): number {
  return projects.reduce((acc, p) => acc + (p.spentBRL ?? 0), 0);
}

/**
 * Calculate total revenue from financial entries
 */
export function calculateTotalRevenue(entries: FinancialEntry[]): number {
  return entries
    .filter((e) => e.type === 'receita')
    .reduce((acc, e) => acc + e.amount, 0);
}

/**
 * Calculate total expenses from financial entries
 */
export function calculateTotalExpenses(entries: FinancialEntry[]): number {
  return entries
    .filter((e) => e.type === 'despesa')
    .reduce((acc, e) => acc + e.amount, 0);
}

/**
 * Calculate net cash flow
 */
export function calculateNetCashFlow(entries: FinancialEntry[]): number {
  return calculateTotalRevenue(entries) - calculateTotalExpenses(entries);
}

/**
 * Get cost center spending
 */
export function getCostCenterSpending(costCenters: CostCenterBudget[]): Record<string, number> {
  const spending: Record<string, number> = {};
  for (const cc of costCenters) {
    spending[cc.id] = cc.spent;
  }
  return spending;
}

/**
 * Filter tasks by status
 */
export function filterTasksByStatus(tasks: ProjectTask[], status: ProjectTask['status']): ProjectTask[] {
  return tasks.filter((t) => t.status === status);
}

/**
 * Get tasks assigned to user/agent
 */
export function getAssignedTasks(tasks: ProjectTask[], assigneeId: string): ProjectTask[] {
  return tasks.filter((t) => t.assigneeId === assigneeId);
}

/**
 * Get overdue tasks
 */
export function getOverdueTasks(tasks: ProjectTask[]): ProjectTask[] {
  const today = new Date().toISOString().split('T')[0];
  return tasks.filter(
    (t) => t.status !== 'concluida' && t.status !== 'cancelada' && t.dueDate < today
  );
}

/**
 * Get blocked tasks
 */
export function getBlockedTasks(tasks: ProjectTask[]): ProjectTask[] {
  return tasks.filter((t) => t.status === 'bloqueada');
}

/**
 * Sort tasks by priority and due date
 */
export function sortTasksByPriority(tasks: ProjectTask[]): ProjectTask[] {
  const priorityOrder = { crítica: 4, alta: 3, média: 2, baixa: 1 };
  return [...tasks].sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

/**
 * Generate governance code
 */
export function generateGovernanceCode(
  type: 'DEC' | 'CNS' | 'DELIB' | 'AUDIT',
  sequence: number
): string {
  return `${type}-2026-${String(sequence).padStart(3, '0')}`;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate BRL amount (positive, up to 2 decimals)
 */
export function isValidBRLAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value === Math.round(value * 100) / 100;
}

/**
 * Normalize string for comparison (remove accents, lowercase, trim)
 */
export function normalizeString(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Check if string contains any of the search terms
 */
export function containsAny(text: string, terms: string[]): boolean {
  const normalized = normalizeString(text);
  return terms.some((term) => normalized.includes(normalizeString(term)));
}

/**
 * Pick random item from array
 */
export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Unique array by key
 */
export function uniqueBy<T>(array: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    (groups[key] = groups[key] || []).push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) break;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  throw lastError!;
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'agora mesmo';
  if (diffMin < 60) return `${diffMin} min atrás`;
  if (diffHour < 24) return `${diffHour}h atrás`;
  if (diffDay < 7) return `${diffDay}d atrás`;
  return date.toLocaleDateString('pt-BR');
}

/**
 * Mask sensitive string (e.g., API keys)
 */
export function maskSensitive(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length);
  }
  return value.slice(0, visibleChars) + '*'.repeat(value.length - visibleChars * 2) + value.slice(-visibleChars);
}