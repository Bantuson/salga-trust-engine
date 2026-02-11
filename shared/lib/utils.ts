/**
 * SALGA Trust Engine — Utility Functions
 * Shared helper functions for both dashboards
 */

import { clsx, type ClassValue } from 'clsx';

/**
 * Merge class names using clsx
 * Note: Tailwind merge not used since neither app uses Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
