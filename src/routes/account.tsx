import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useSubscription } from "@/hooks/useSubscription";
import { deleteAccount } from "@/utils/payments.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — Song Analyzer" },
      { name: "description", content: "Manage your Song Analyzer account, plan and data." },
      { property: "og:title", content: "Account — Song Analyzer" },
      { property: "og:description", content: "Manage your Song Analyzer account, plan and data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});

function Account() {
  const { user, sub, active, loaded } = useSubscription();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function remove() {
    setBusy(true); setErr("");
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">ACCOUNT</h1>
        {!loaded ? null : !user ? (
          <Link to="/auth" className="block rounded-full bg-primary py-3 text-center font-display text-sm tracking-wider text-primary-foreground">SIGN IN</Link>
        ) : (
          <>
            <div className="panel space-y-1 p-5 text-sm">
              <div className="text-muted-foreground">Signed in as</div>
              <div>{user.email}</div>
              <div className="pt-2 text-muted-foreground">Plan</div>
              <div>{active ? (sub?.status === "trialing" ? "Pro — free trial" : "Pro") : "Free — 3 uses a day"}</div>
              <Link to="/pricing" className="inline-block pt-2 text-primary underline">{active ? "Manage billing" : "Go Pro"}</Link>
            </div>
            <div className="panel space-y-3 border-destructive/50 p-5 text-sm">
              <h2 className="font-display tracking-wider text-destructive">DELETE ACCOUNT</h2>
              <p className="text-muted-foreground">This cancels any subscription right away (no further charges), erases your saved songs and usage, and deletes your account. It can't be undone.</p>
              <label className="block text-xs text-muted-foreground">Type DELETE to confirm</label>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" aria-label="Type DELETE to confirm" />
              <button onClick={remove} disabled={confirm !== "DELETE" || busy} className="w-full rounded-full bg-destructive py-3 font-display text-sm tracking-wider text-destructive-foreground disabled:opacity-50">
                {busy ? "DELETING…" : "DELETE MY ACCOUNT"}
              </button>
              {err && <p className="text-destructive">{err}</p>}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
