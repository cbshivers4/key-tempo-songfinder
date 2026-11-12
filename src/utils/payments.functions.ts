import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildPaymentsEnv, checkoutPriceFor } from "@/lib/payments-env";

/** Picks the right price for this account (trial only once) and resolves it to the provider's id. */
export const getCheckoutPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const env = buildPaymentsEnv();
    const { count } = await context.supabase.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("user_id", context.userId).eq("environment", env);
    const priceId = checkoutPriceFor(count ?? 0);
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const response = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(priceId)}`);
    const result = (await response.json()) as { data?: { id: string }[] };
    if (!result.data?.length) throw new Error("Price not found");
    return { paddlePriceId: result.data[0]!.id, hasTrial: priceId === "pro_monthly" };
  });

/** Uses one of today's free uses. remaining: -1 = unlimited (subscribed), null = out of free uses. */
export const consumeUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: remaining, error } = await supabaseAdmin.rpc("consume_use_for", { _user: context.userId, check_env: buildPaymentsEnv() });
    if (error) throw new Error(error.message);
    return { remaining: remaining as number | null };
  });

export const openCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const env = buildPaymentsEnv();
    const { data: sub } = await context.supabase.from("subscriptions").select("paddle_customer_id, paddle_subscription_id")
      .eq("user_id", context.userId).eq("environment", env)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!sub) throw new Error("No subscription found");
    const { getPaddleClient } = await import("@/lib/paddle.server");
    const s = await getPaddleClient(env).customerPortalSessions.create(sub.paddle_customer_id, [sub.paddle_subscription_id]);
    return { url: s.urls.general.overview };
  });

/** Cancels any running subscription right away, erases the user's data and deletes the account. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPaddleClient } = await import("@/lib/paddle.server");
    const { data: subs } = await supabaseAdmin.from("subscriptions").select("paddle_subscription_id, environment, status").eq("user_id", uid);
    for (const s of subs ?? []) {
      if (s.status === "canceled") continue;
      try { await getPaddleClient(s.environment as "sandbox" | "live").subscriptions.cancel(s.paddle_subscription_id, { effectiveFrom: "immediately" }); }
      catch (e) { console.error("Cancel failed", s.paddle_subscription_id, e); throw new Error("Couldn't cancel your subscription. Please try again."); }
    }
    for (const t of ["library_songs", "daily_usage", "subscriptions", "user_roles", "pro_grants"] as const) {
      const { error } = await supabaseAdmin.from(t).delete().eq("user_id", uid);
      if (error) throw new Error("Couldn't erase your data. Please try again.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error("Couldn't delete your account. Please try again.");
    return { ok: true };
  });
