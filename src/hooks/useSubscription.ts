import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { hasUnlimitedUse, planFor, type Plan, type SubRow } from "@/lib/payments-env";
import { useAuth } from "./useAuth";

export type { SubRow } from "@/lib/payments-env";

export function useSubscription() {
  const { user, ready } = useAuth();
  const [sub, setSub] = useState<SubRow | null>(null);
  const [free, setFree] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    if (!user) { setSub(null); setFree(false); setLoaded(true); return; }
    const [s, g] = await Promise.all([
      supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end")
        .eq("user_id", user.id).eq("environment", getPaddleEnvironment())
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("pro_grants").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    setSub((s.data as SubRow | null) ?? null);
    setFree(!!g.data);
    setLoaded(true);
  }, [user]);
  useEffect(() => { if (ready) void refresh(); }, [ready, refresh]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`subs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);
  const plan: Plan = planFor(sub, free);
  return { user, sub, free, plan, active: hasUnlimitedUse(plan), loaded, refresh };
}
