import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** "11 Nov 2026": the month is spelled out so 03/04 can never be read as March or April. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "1 export", "2 exports": the label follows the number. */
export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
