import type { RecognizedSong } from "./recognize.functions";
import { supabase } from "@/integrations/supabase/client";

export type HistoryEntry = RecognizedSong & { id: string; identifiedAt: string; favorite?: boolean };
const KEY = "song-analyzer-history";

// Signed out: songs live on this device. Signed in: songs live in the account.
function loadLocal(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function saveLocal(h: HistoryEntry[]) { localStorage.setItem(KEY, JSON.stringify(h)); }

async function signedIn() {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

type Row = { id: string; song: unknown; favorite: boolean; identified_at: string };
const fromRow = (r: Row): HistoryEntry => ({ ...(r.song as RecognizedSong), id: r.id, favorite: r.favorite, identifiedAt: r.identified_at });

export async function loadHistory(): Promise<HistoryEntry[]> {
  if (!(await signedIn())) return loadLocal();
  const { data, error } = await supabase.from("library_songs").select("id, song, favorite, identified_at").order("identified_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function addToHistory(s: RecognizedSong) {
  if (!(await signedIn())) {
    const e: HistoryEntry = { ...s, id: crypto.randomUUID(), identifiedAt: new Date().toISOString() };
    saveLocal([e, ...loadLocal()]);
    return;
  }
  await supabase.from("library_songs").insert({ song: s as never });
}

export async function setFavorite(id: string, favorite: boolean) {
  if (!(await signedIn())) return saveLocal(loadLocal().map((i) => (i.id === id ? { ...i, favorite } : i)));
  await supabase.from("library_songs").update({ favorite }).eq("id", id);
}

export async function removeFromHistory(id: string) {
  if (!(await signedIn())) return saveLocal(loadLocal().filter((i) => i.id !== id));
  await supabase.from("library_songs").delete().eq("id", id);
}

/** After sign-in, move songs saved on this device into the account. */
export async function moveLocalToAccount() {
  const local = loadLocal();
  if (!local.length || !(await signedIn())) return;
  const rows = local.map(({ id: _id, identifiedAt, favorite, ...song }) => ({ song: song as never, favorite: !!favorite, identified_at: identifiedAt }));
  const { error } = await supabase.from("library_songs").insert(rows);
  if (!error) localStorage.removeItem(KEY);
}
