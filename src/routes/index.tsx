import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import logo from "@/assets/song-analyzer-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Song Analyzer — Identify & analyze any song" },
      { name: "description", content: "Identify songs playing around you and break down key, tempo and structure of your recordings." },
      { property: "og:title", content: "Song Analyzer — Identify & analyze any song" },
      { property: "og:description", content: "Discover, identify, analyze and recreate music." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <div className="text-center">
        <img src={logo} alt="Song Analyzer logo" width={1024} height={1024} className="mx-auto w-56 mix-blend-screen md:w-72" />
        <p className="mt-2 text-xs tracking-[0.3em] text-primary">DISCOVER • IDENTIFY • ANALYZE • RECREATE</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Link to="/identify" className="panel group flex flex-col items-center gap-4 p-8 transition hover:shadow-neon">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-neon">
            <Mic className="h-10 w-10" />
          </span>
          <span className="font-display text-xl font-bold tracking-wider text-chrome">IDENTIFY A SONG</span>
          <span className="text-center text-sm text-muted-foreground">Listen to music around you and find the title and artist.</span>
        </Link>
        <Link to="/analyze" className="panel group flex flex-col items-center gap-4 p-8 transition hover:shadow-neon">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-spectrum text-accent-foreground shadow-neon">
            <Upload className="h-10 w-10" />
          </span>
          <span className="font-display text-xl font-bold tracking-wider text-chrome">ANALYZE A SONG</span>
          <span className="text-center text-sm text-muted-foreground">Upload a recording to detect key, tempo and loudness.</span>
        </Link>
      </div>
    </AppShell>
  );
}
