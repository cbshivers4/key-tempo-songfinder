import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Crown, LogIn, LogOut, Mic, Upload, Library, Home, AudioWaveform, ShieldCheck, Scissors, FileText, Tags } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import logo from "@/assets/song-analyzer-logo.png";

const nav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/identify", label: "Song Finder", icon: Mic },
  { to: "/analyze", label: "Analyze", icon: Upload },
  { to: "/vocoder", label: "Vocoder", icon: AudioWaveform },
  { to: "/studio", label: "Stems & MIDI", icon: Scissors },
  { to: "/lyrics", label: "Lyrics", icon: FileText },
  { to: "/style-tags", label: "Style Tags", icon: Tags },
  { to: "/library", label: "Library", icon: Library },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card/60 p-4 backdrop-blur md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <img src={logo} alt="Song Analyzer" width={44} height={44} className="h-11 w-11 object-cover mix-blend-screen" />
          <span className="font-display text-sm font-bold tracking-widest text-chrome">SONG ANALYZER</span>
        </Link>
        <nav className="space-y-1">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-primary" }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto mb-4">
          <Link to="/pricing" className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-primary hover:bg-secondary" activeProps={{ className: "bg-secondary" }}><Crown className="h-4 w-4" /> Go Pro</Link>
          {isAdmin && (
            <Link to="/admin" className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary" activeProps={{ className: "bg-secondary text-primary" }}><ShieldCheck className="h-4 w-4" /> Admin</Link>
          )}
          {user ? (
            <>
            <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary">
              <LogOut className="h-4 w-4" /> <span className="truncate">Sign out · {user.email}</span>
            </button>
            <Link to="/account" className="block px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Account settings</Link>
            </>
          ) : (
            <Link to="/auth" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary"><LogIn className="h-4 w-4" /> Sign in</Link>
          )}
        </div>
        <p className=" text-[10px] tracking-[0.25em] text-muted-foreground">DISCOVER • IDENTIFY • ANALYZE • RECREATE</p>
      </aside>
      <PaymentTestModeBanner />
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-4 flex justify-end gap-4 md:hidden">
          <Link to="/pricing" className="flex items-center gap-1 text-xs text-primary"><Crown className="h-4 w-4" /> Pro</Link>
          {user
            ? <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-1 text-xs text-muted-foreground"><LogOut className="h-4 w-4" /> Sign out</button>
            : <Link to="/auth" className="flex items-center gap-1 text-xs text-primary"><LogIn className="h-4 w-4" /> Sign in</Link>}
        </div>{children}
        <footer className="mt-12 mb-20 flex flex-wrap justify-center gap-4 border-t pt-4 text-xs text-muted-foreground md:mb-0">
          <Link to="/terms" className="hover:text-primary">Terms</Link>
          <Link to="/refunds" className="hover:text-primary">Refund Policy</Link>
          <Link to="/privacy" className="hover:text-primary">Privacy</Link>
          <a href="mailto:cbshivers@gmail.com" className="hover:text-primary">Contact</a>
        </footer></main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-8 border-t bg-card/95 backdrop-blur md:hidden">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
            className="flex min-w-0 flex-col items-center gap-1 py-3 text-center text-[9px] text-muted-foreground"
            activeProps={{ className: "text-primary" }}>
            <n.icon className="h-5 w-5" /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
