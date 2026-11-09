import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useAuth } from "./useAuth";

export type Sub = { status: string; current_period_end: string | null; cancel_at_period_end: boolean | null };

export function isActive(s: Sub | null) {
  if (!s) return false;
  const future = !s.current_period_end || new Date(s.current_period_end) > new Date();
  if (["active", "trialing", "past_due"].includes(s.status)) return future;
  return s.status === "canceled" && !!s.current_period_end && new Date(s.current_period_end) > new Date();
}

export function useSubscription() {
  const { user, ready } = useAuth();
  const [sub, setSub] = useState<Sub | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    if (!user) { setSub(null); setLoaded(true); return; }
    const { data } = await supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id).eq("environment", getPaddleEnvironment())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    setSub(data); setLoaded(true);
  }, [user]);
  useEffect(() => { if (ready) void refresh(); }, [ready, refresh]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`subs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);
  return { user, sub, active: isActive(sub), loaded, refresh };
}
