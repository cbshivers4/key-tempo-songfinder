import { consumeUse } from "@/utils/payments.functions";
import { getPaddleEnvironment } from "./paddle";
import { supabase } from "@/integrations/supabase/client";

export const FREE_USES_PER_DAY = 3;
const KEY = "song-analyzer-uses";

/** Pure counter for signed-out visitors (this device only). */
export function nextLocalCount(stored: { day: string; uses: number } | null, today: string) {
  const uses = stored && stored.day === today ? stored.uses : 0;
  if (uses >= FREE_USES_PER_DAY) return { allowed: false, uses };
  return { allowed: true, uses: uses + 1 };
}

/** Uses one free use (all tools combined). Returns remaining (-1 unlimited) or null when out. */
export async function useOne(): Promise<number | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return (await consumeUse({ data: { environment: getPaddleEnvironment() } })).remaining;
  const today = new Date().toISOString().slice(0, 10);
  let stored: { day: string; uses: number } | null = null;
  try { stored = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { /* ignore */ }
  const r = nextLocalCount(stored, today);
  if (!r.allowed) return null;
  localStorage.setItem(KEY, JSON.stringify({ day: today, uses: r.uses }));
  return FREE_USES_PER_DAY - r.uses;
}
