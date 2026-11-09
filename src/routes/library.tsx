import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Trash2, Search, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { loadHistory, saveHistory, type HistoryEntry } from "@/lib/history";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "My Music Library — Song Analyzer" },
      { name: "description", content: "Your identified songs, favorites and listening history." },
      { property: "og:title", content: "My Music Library — Song Analyzer" },
      { property: "og:description", content: "Songs you've identified with Song Analyzer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [q, setQ] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  useEffect(() => setItems(loadHistory()), []);
  const update = (next: HistoryEntry[]) => { setItems(next); saveHistory(next); };
  const shown = items.filter((i) => (!favOnly || i.favorite) && `${i.title} ${i.artist}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">MY MUSIC LIBRARY</h1>
      <div className="mt-5 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs or artists" className="h-11 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <button onClick={() => setFavOnly(!favOnly)} className={`rounded-lg border px-3 text-sm ${favOnly ? "border-primary text-primary" : ""}`}>Favorites</button>
      </div>
      {shown.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">No songs yet. Identify a song and it will appear here.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {shown.map((s) => (
            <li key={s.id} className="panel flex items-center gap-3 p-3">
              {s.artwork ? <img src={s.artwork} alt="" className="h-14 w-14 rounded object-cover" loading="lazy" /> : <div className="h-14 w-14 rounded bg-muted" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{s.title}</div>
                <div className="truncate text-sm text-primary">{s.artist}</div>
                <div className="text-[11px] text-muted-foreground">{new Date(s.identifiedAt).toLocaleString()}</div>
              </div>
              {s.links[0] && <a href={s.links[0].url} target="_blank" rel="noreferrer" aria-label="Open in streaming" className="p-2"><ExternalLink className="h-4 w-4" /></a>}
              <button aria-label="Favorite" onClick={() => update(items.map((i) => (i.id === s.id ? { ...i, favorite: !i.favorite } : i)))} className="p-2">
                <Heart className={`h-4 w-4 ${s.favorite ? "fill-primary text-primary" : ""}`} />
              </button>
              <button aria-label="Remove" onClick={() => update(items.filter((i) => i.id !== s.id))} className="p-2 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
