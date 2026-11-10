import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Users, Crown, Clock, XCircle, Zap, Music } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAdmin } from "@/hooks/useAdmin";
import { getAdminStats, getRecentSubscriptions, type AdminStats, type AdminSub } from "@/utils/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Song Analyzer" },
      { name: "description", content: "Song Analyzer admin overview." },
      { property: "og:title", content: "Song Analyzer Admin" },
      { property: "og:description", content: "Song Analyzer admin overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

function Admin() {
  const { user, ready, isAdmin, checked } = useAdmin();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [subs, setSubs] = useState<AdminSub[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([getAdminStats(), getRecentSubscriptions()])
      .then(([s, r]) => { setStats(s); setSubs(r); })
      .catch(() => setErr("Couldn't load the admin numbers. Please try again."));
  }, [isAdmin]);

  if (!ready || !checked) return <AppShell><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;
  if (!user) return (
    <AppShell>
      <div className="panel mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-bold tracking-wider text-chrome">ADMIN</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to continue.</p>
        <Link to="/auth" className="mt-4 inline-block rounded-full bg-primary px-6 py-2 font-display text-xs tracking-wider text-primary-foreground">SIGN IN</Link>
      </div>
    </AppShell>
  );
  if (!isAdmin) return (
    <AppShell>
      <div className="panel mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-bold tracking-wider text-chrome">ADMIN</h1>
        <p className="mt-2 text-sm text-muted-foreground">This account doesn't have admin access.</p>
      </div>
    </AppShell>
  );

  const cards = stats ? [
    { label: "TOTAL ACCOUNTS", value: stats.total_users, icon: Users },
    { label: "PRO MEMBERS", value: stats.subscribers, icon: Crown },
    { label: "ON FREE TRIAL", value: stats.trialing, icon: Clock },
    { label: "CANCELED", value: stats.canceled, icon: XCircle },
    { label: "USES TODAY", value: stats.uses_today, icon: Zap },
    { label: "SONGS SAVED", value: stats.songs_saved, icon: Music },
  ] : [];

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-wider text-chrome">
        <ShieldCheck className="h-6 w-6 text-primary" /> ADMIN
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Live numbers from your app.</p>
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="panel p-4">
            <c.icon className="h-4 w-4 text-primary" />
            <div className="mt-2 text-3xl font-bold text-chrome">{c.value}</div>
            <div className="mt-1 font-display text-[10px] tracking-widest text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-8 font-display text-sm tracking-widest text-chrome">RECENT SUBSCRIPTIONS</h2>
      <div className="panel mt-3 divide-y">
        {subs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No subscriptions yet.</p>}
        {subs.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{s.user_id.slice(0, 8)}…</span>
            <span className={s.status === "active" || s.status === "trialing" ? "text-primary" : "text-muted-foreground"}>{s.status}</span>
            <span className="text-xs text-muted-foreground">{s.environment}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {s.cancel_at_period_end ? "ends" : "renews"} {fmt(s.current_period_end)}
            </span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
