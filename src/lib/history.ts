import type { ForgeOptions } from '@/lib/promptEngine';

export interface GenerationResult {
  id: string;
  createdAt: number;
  draft: string;
  notes?: string;
  title: string;
  prompt: string;
  thinking: string;
  /** Model that forged this prompt (user-selected). */
  crafterModel: string;
  crafterLabel: string;
  providerId: string;
  options: ForgeOptions;
  elapsedMs: number;
  totalTokens?: number;
}

export interface ApiErrorEntry {
  id: string;
  createdAt: number;
  draft: string;
  status: number | null;
  message: string;
  crafterModel: string;
}

const HISTORY_LIMIT = 25;

export const HISTORY_STORAGE_KEY = 'promptforge:history';
export const ERROR_STORAGE_KEY = 'promptforge:errors';

/**
 * Strip the ```lang … ``` fence the crafter is instructed to use, plus a
 * leaked `TITLE:` line.
 */
export function cleanPrompt(raw: string): string {
  let text = raw.trim();

  const fence = text.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
  if (fence) {
    text = fence[1].trim();
  } else if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '').trim();
  }

  return text.replace(/^\s*TITLE:.*\n?/i, '').trim();
}

/** Pull a short title from the crafter output, falling back to the draft. */
export function deriveTitle(raw: string, draft: string): string {
  const match = raw.match(/^\s*TITLE:\s*(.+)$/im);
  if (match) {
    const title = match[1].replace(/^["'`*]+|["'`*]+$/g, '').trim();
    if (title) return title.slice(0, 60);
  }
  const firstLine = draft.trim().split('\n')[0].trim();
  if (!firstLine) return 'Untitled prompt';
  const words = firstLine.split(/\s+/).slice(0, 6).join(' ');
  return (words.length < firstLine.length ? `${words}…` : words).slice(0, 60);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function pushLimited<T>(list: T[], item: T, limit = HISTORY_LIMIT): T[] {
  return [item, ...list].slice(0, limit);
}

/** Rough token estimate (4 chars ≈ 1 token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.trim().length / 4));
}

export function expansionRatio(original: string, refined: string): number {
  return estimateTokens(refined) / estimateTokens(original);
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
