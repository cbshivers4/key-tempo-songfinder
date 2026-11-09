import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import "@lovable.dev/cloud-auth-js/styles.css";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Song Analyzer" },
      { name: "description", content: "Sign in to keep your music library on every device." },
      { property: "og:title", content: "Sign in — Song Analyzer" },
      { property: "og:description", content: "Your Song Analyzer account and library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav({ to: "/library" }); }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/library` } });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (mode === "up" && !data.session) setMsg("Check your email to confirm your account, then sign in.");
  }

  async function social(p: "google" | "lovable") {
    setMsg("");
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin });
    if (r.error) setMsg(r.error.message ?? "Sign-in failed. Please try again.");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-sm">
        <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">{mode === "in" ? "SIGN IN" : "CREATE ACCOUNT"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep your identified songs and favorites on every device. Songs already saved here move into your account.</p>
        <div className="panel mt-6 space-y-3 p-5">
          <button type="button" onClick={() => social("google")}
            className="flex h-11 w-full items-center justify-center gap-[10px] rounded-full border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F]">
            <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.820z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.780-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
            Continue with Google
          </button>
          <button type="button" className="lovable-auth-button w-full" onClick={() => social("lovable")}>Continue with Lovable</button>
          <div className="py-1 text-center text-[11px] tracking-widest text-muted-foreground">OR WITH EMAIL</div>
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" className="h-11 w-full rounded-lg border bg-card px-3 text-sm" />
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" className="h-11 w-full rounded-lg border bg-card px-3 text-sm" />
            <button disabled={busy} className="h-11 w-full rounded-full bg-primary font-display text-sm tracking-wider text-primary-foreground disabled:opacity-60">
              {busy ? "…" : mode === "in" ? "SIGN IN" : "CREATE ACCOUNT"}
            </button>
          </form>
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }} className="w-full text-center text-xs text-primary">
            {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
