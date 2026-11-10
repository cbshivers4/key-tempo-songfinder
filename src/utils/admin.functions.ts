import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStats = {
  total_users: number;
  subscribers: number;
  trialing: number;
  canceled: number;
  uses_today: number;
  songs_saved: number;
};

export type AdminSub = {
  user_id: string;
  status: string;
  environment: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  created_at: string | null;
};

/** Admin-only overview. The admin_stats function itself rejects non-admins. */
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_stats");
    if (error) throw new Error(error.message);
    return data as unknown as AdminStats;
  });

export const getRecentSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.from("user_roles").select("role")
      .eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("not authorized");
    const { data, error } = await context.supabase.from("subscriptions")
      .select("user_id, status, environment, current_period_end, cancel_at_period_end, created_at")
      .order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as AdminSub[];
  });
