import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | null): string {
  if (score === null) return "--";
  return Math.round(score).toString();
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
