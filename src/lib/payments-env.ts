/** The payments environment this build runs in (decided by the build, never by the browser). */
export function buildPaymentsEnv(): "sandbox" | "live" {
  const t = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;
  return t?.startsWith("test_") ? "sandbox" : "live";
}

/** One free trial per account: anyone who has subscribed before pays from day one. */
export function checkoutPriceFor(previousSubscriptions: number) {
  return previousSubscriptions > 0 ? "pro_monthly_no_trial" : "pro_monthly";
}
