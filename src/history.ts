// Pure premium math + localStorage history. No DOM here, easy to reason about.

import type { Metal } from "./coins";

export interface PremiumCalc {
  meltEur: number; // fine-metal (spot) value of the coin
  premiumEur: number; // dealer price - melt
  premiumPct: number; // premium as % of melt
}

/** melt = fine troy oz × spot(EUR/oz); premium = ask − melt. */
export function computePremium(
  fineOz: number,
  spotEurPerOz: number,
  askEur: number,
): PremiumCalc {
  const meltEur = fineOz * spotEurPerOz;
  const premiumEur = askEur - meltEur;
  const premiumPct = meltEur > 0 ? (premiumEur / meltEur) * 100 : 0;
  return { meltEur, premiumEur, premiumPct };
}

// ——— History (localStorage) ———

export interface HistoryEntry {
  id: string; // unique entry id
  ts: number; // when logged (epoch ms)
  coinId: string;
  coinName: string;
  metal: Metal;
  fineOz: number;
  askEur: number; // the dealer/website price you typed
  spotAtLog: number; // spot EUR/oz at the moment you logged it
  // Snapshot of the math at log time (so you see the original verdict):
  meltAtLog: number;
  premiumEurAtLog: number;
  premiumPctAtLog: number;
}

const STORAGE_KEY = "coin-premium.history.v1";

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()];
  saveHistory(next);
  return next;
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  saveHistory(next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  saveHistory([]);
  return [];
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
