import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mic, Upload, Library, Home } from "lucide-react";
import logo from "@/assets/song-analyzer-logo.png";

const nav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/identify", label: "Song Finder", icon: Mic },
  { to: "/analyze", label: "Analyze", icon: Upload },
  { to: "/library", label: "Library", icon: Library },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
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
        <p className="mt-auto text-[10px] tracking-[0.25em] text-muted-foreground">DISCOVER • IDENTIFY • ANALYZE • RECREATE</p>
      </aside>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card/95 backdrop-blur md:hidden">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
            className="flex flex-col items-center gap-1 py-3 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary" }}>
            <n.icon className="h-5 w-5" /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
