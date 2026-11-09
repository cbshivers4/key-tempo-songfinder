import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaddleEnv } from "@/lib/paddle.server";

const envOf = (e: unknown): PaddleEnv => (e === "sandbox" ? "sandbox" : "live");

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const response = await gatewayFetch(envOf(data.environment), `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    const result = (await response.json()) as { data?: { id: string }[] };
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0]!.id;
  });

/** Uses one of today's free uses. remaining: -1 = unlimited (subscribed), null = out of free uses. */
export const consumeUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: PaddleEnv }) => d)
  .handler(async ({ data, context }) => {
    const { data: remaining, error } = await context.supabase.rpc("consume_use", { check_env: envOf(data.environment), free_limit: 3 });
    if (error) throw new Error(error.message);
    return { remaining: remaining as number | null };
  });

export const openCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: PaddleEnv }) => d)
  .handler(async ({ data, context }) => {
    const { data: sub } = await context.supabase.from("subscriptions").select("paddle_customer_id, paddle_subscription_id")
      .eq("user_id", context.userId).eq("environment", envOf(data.environment))
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!sub) throw new Error("No subscription found");
    const { getPaddleClient } = await import("@/lib/paddle.server");
    const s = await getPaddleClient(envOf(data.environment)).customerPortalSessions.create(sub.paddle_customer_id, [sub.paddle_subscription_id]);
    return { url: s.urls.general.overview };
  });
