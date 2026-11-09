import type { RecognizedSong } from "./recognize.functions";

export type HistoryEntry = RecognizedSong & { id: string; identifiedAt: string; favorite?: boolean };
const KEY = "song-analyzer-history";

export function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
export function saveHistory(h: HistoryEntry[]) { localStorage.setItem(KEY, JSON.stringify(h)); }
export function addToHistory(s: RecognizedSong) {
  const e: HistoryEntry = { ...s, id: crypto.randomUUID(), identifiedAt: new Date().toISOString() };
  saveHistory([e, ...loadHistory()]);
  return e;
}
