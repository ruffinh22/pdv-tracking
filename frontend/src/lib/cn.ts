import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Assemble des classes Tailwind sans conflit (la dernière l'emporte). */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
