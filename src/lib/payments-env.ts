/** The payments environment this build runs in (decided by the build, never by the browser). */
export function buildPaymentsEnv(): "sandbox" | "live" {
  const t = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;
  return t?.startsWith("test_") ? "sandbox" : "live";
}

/** One free trial per account: anyone who has subscribed before pays from day one. */
export function checkoutPriceFor(previousSubscriptions: number) {
  return previousSubscriptions > 0 ? "pro_monthly_no_trial" : "pro_monthly";
}

export type SubRow = { status: string; current_period_end: string | null; cancel_at_period_end: boolean | null };

export type Plan = "free_grant" | "pro" | "trial" | "ending" | "past_due" | "returning" | "free";

/**
 * What a signed-in account gets right now.
 * A free-access grant wins over any subscription record, paid or expired.
 */
export function planFor(sub: SubRow | null, freeGrant: boolean): Plan {
  if (freeGrant) return "free_grant";
  if (!sub) return "free";
  const future = !sub.current_period_end || new Date(sub.current_period_end) > new Date();
  if (!future) return "returning";
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "trialing") return "trial";
  if (sub.status === "active") return sub.cancel_at_period_end ? "ending" : "pro";
  if (sub.status === "canceled") return "ending";
  return "returning";
}

/** Unlimited use covers every paid state plus free access; the daily limit still applies to the rest. */
export function hasUnlimitedUse(plan: Plan) {
  return plan !== "free" && plan !== "returning";
}
