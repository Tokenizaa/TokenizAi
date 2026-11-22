import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina classes do Tailwind com clsx e remove conflitos com tailwind-merge.
 * Útil para variantes de componentes (CVA) sem quebrar classes do consumidor.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
