import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSubscription } from "@/hooks/useSubscription";
import { initializePaddle, getPaddlePriceId, getPaddleEnvironment } from "@/lib/paddle";
import { openCustomerPortal } from "@/utils/payments.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pro — Song Analyzer" },
      { name: "description", content: "Unlimited song finding, analysis and vocoder. Free for 7 days, then $9.95/month." },
      { property: "og:title", content: "Song Analyzer Pro" },
      { property: "og:description", content: "Try Pro free for 7 days, then $9.95/month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const { user, sub, active, loaded } = useSubscription();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function subscribe() {
    if (!user) return;
    setBusy(true); setErr("");
    try {
      await initializePaddle();
      const priceId = await getPaddlePriceId("pro_monthly");
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: user.email ? { email: user.email } : undefined,
        customData: { userId: user.id },
        settings: { displayMode: "overlay", successUrl: `${window.location.origin}/checkout/success`, allowLogout: false, variant: "one-page" },
      });
    } catch { setErr("Checkout couldn't open. Please try again."); }
    finally { setBusy(false); }
  }

  async function manage() {
    setBusy(true); setErr("");
    try { const { url } = await openCustomerPortal({ data: { environment: getPaddleEnvironment() } }); window.open(url, "_blank"); }
    catch { setErr("Couldn't open your billing page. Please try again."); }
    finally { setBusy(false); }
  }

  const end = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "";
  return (
    <AppShell>
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">SONG ANALYZER PRO</h1>
        <p className="mt-1 text-sm text-muted-foreground">Free accounts get 3 uses a day across all tools.</p>
        <div className="panel mt-6 p-6 text-left">
          <div className="text-center">
            <div className="font-display text-xs tracking-widest text-primary">7 DAYS FREE</div>
            <div className="mt-1 text-4xl font-bold text-chrome">$9.95<span className="text-base text-muted-foreground">/month</span></div>
            <div className="text-xs text-muted-foreground">after your free week · cancel anytime</div>
          </div>
          <ul className="mt-5 space-y-2 text-sm">
            {["Unlimited Song Finder", "Unlimited song analysis — key, tempo, chords, sections", "Unlimited vocoder sessions and recordings", "Library saved to your account"].map((f) => (
              <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> {f}</li>
            ))}
          </ul>
          <div className="mt-6">
            {!loaded ? null : !user ? (
              <Link to="/auth" className="block rounded-full bg-primary py-3 text-center font-display text-sm tracking-wider text-primary-foreground">SIGN IN TO START</Link>
            ) : active ? (
              <div className="space-y-2 text-center">
                <p className="text-sm">
                  {sub?.status === "trialing" ? `You're on your free trial until ${end}.` : sub?.status === "canceled" || sub?.cancel_at_period_end ? `Pro ends on ${end}.` : "You're on Pro. Enjoy unlimited use."}
                </p>
                {sub?.status === "past_due" && <p className="text-xs text-destructive">Your last payment didn't go through. Please update your card.</p>}
                <button onClick={manage} disabled={busy} className="w-full rounded-full border py-3 font-display text-sm tracking-wider">MANAGE BILLING</button>
              </div>
            ) : (
              <button onClick={subscribe} disabled={busy} className="w-full rounded-full bg-primary py-3 font-display text-sm tracking-wider text-primary-foreground disabled:opacity-60">
                {busy ? "OPENING…" : "START 7-DAY FREE TRIAL"}
              </button>
            )}
          </div>
          {err && <p className="mt-3 text-center text-sm text-destructive">{err}</p>}
          <p className="mt-4 text-center text-[11px] text-muted-foreground">A card is needed to start. You won't be charged until day 8, and you can cancel before then.</p>
        </div>
      </div>
    </AppShell>
  );
}
