import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, Copy, ExternalLink, FileAudio, Library, LoaderCircle, Search, Sparkles, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { UpgradeNotice } from "@/components/UpgradeNotice";
import { useAuth } from "@/hooks/useAuth";
import { analyzeStyleClip, type StyleTagsResult } from "@/lib/style-tags.functions";
import { prepareStyleClip, STYLE_CLIP_SECONDS } from "@/lib/style-clip";
import { matchSavedSongs, type LibraryMatch, type StyleTags } from "@/lib/style-tags";
import { loadHistory } from "@/lib/history";

export const Route = createFileRoute("/style-tags")({
  head: () => ({
    meta: [
      { title: "AI Style Tags — Song Analyzer" },
      { name: "description", content: "Turn a short audio clip into AI-powered style, mood and instrument tags for music discovery." },
      { property: "og:title", content: "AI Style Tags — Song Analyzer" },
      { property: "og:description", content: "Upload a clip, generate searchable music tags and find matching songs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StyleTagsPage,
});

function TagGroup({ title, tags }: { title: string; tags: string[] }) {
  return <section>
    <h3 className="font-display text-xs tracking-widest text-muted-foreground">{title}</h3>
    <div className="mt-2 flex flex-wrap gap-2">
      {tags.length ? tags.map((tag) => <span key={tag} className="rounded-full border border-primary/40 bg-secondary px-3 py-1.5 text-sm text-primary">{tag}</span>)
        : <span className="text-sm text-muted-foreground">No clear tags from this clip.</span>}
    </div>
  </section>;
}

function StyleTagsPage() {
  const { user, ready } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(false);
  const [result, setResult] = useState<StyleTags | null>(null);
  const [matches, setMatches] = useState<LibraryMatch[]>([]);
  const [searchText, setSearchText] = useState("");
  const [copied, setCopied] = useState(false);
  const analyze = useServerFn(analyzeStyleClip);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null); setMatches([]); setError(""); setLimit(false); setCopied(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    if (!user) { setError("Sign in to analyze a clip."); return; }
    setBusy(true); setError(""); setLimit(false); setResult(null); setMatches([]); setCopied(false);
    try {
      setPhase("Preparing your clip…");
      const audioBase64 = await prepareStyleClip(file);
      setPhase("Listening for styles and instruments…");
      const response: StyleTagsResult = await analyze({ data: { audioBase64, format: "wav" } });
      if (response.status === "limit") { setLimit(true); return; }
      if (response.status === "error") { setError(response.message); return; }
      setResult(response.tags);
      setSearchText(response.tags.searchPhrase);
      const songs = await loadHistory();
      setMatches(matchSavedSongs(response.tags, songs));
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "The clip could not be analyzed. Please try another file.");
    } finally {
      setBusy(false); setPhase("");
    }
  }

  async function copySearch() {
    if (!searchText.trim()) return;
    try {
      await navigator.clipboard.writeText(searchText.trim());
      setCopied(true);
    } catch { setError("Couldn't copy the search phrase. Select the text and copy it manually."); }
  }

  const query = encodeURIComponent(searchText.trim());

  return <AppShell>
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Sparkles className="h-5 w-5" /></span>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">AI STYLE TAGS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Turn a short clip into searchable style, mood and instrument tags.</p>
      </div>
    </div>

    <form onSubmit={(event) => void submit(event)} className="panel mt-6 p-5 md:p-6">
      <label htmlFor="style-clip" className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-primary/50 bg-background/30 px-5 py-8 text-center transition hover:bg-secondary/40">
        {file ? <FileAudio className="h-9 w-9 text-primary" /> : <Upload className="h-9 w-9 text-primary" />}
        <span className="mt-3 font-bold">{file ? file.name : "Choose an audio clip"}</span>
        <span className="mt-1 text-xs text-muted-foreground">WAV, MP3, M4A, OGG, AAC, FLAC or WebM · first {STYLE_CLIP_SECONDS} seconds · up to 25 MB</span>
      </label>
      <input id="style-clip" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.aac,.flac,.webm" onChange={chooseFile} className="sr-only" />
      {previewUrl && <audio controls preload="metadata" src={previewUrl} className="mt-4 w-full">Your browser cannot play this audio.</audio>}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={!file || busy || !ready || !user} className="font-display tracking-wider">
          {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {busy ? phase : "GENERATE TAGS"}
        </Button>
        {ready && !user && <p className="text-sm text-muted-foreground"><Link to="/auth" className="text-primary underline">Sign in</Link> to use AI tagging — 3 free uses a day across all tools.</p>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Your clip is sent for AI analysis but isn't saved by Song Analyzer. Tags are estimates, so listen before relying on them.</p>
    </form>

    {limit && <UpgradeNotice />}
    {error && <p role="alert" className="panel mt-4 border-destructive p-4 text-sm text-destructive">{error}</p>}

    {result && <div className="mt-8 space-y-6">
      <section className="panel p-5 md:p-6">
        <p className="text-sm leading-6 text-muted-foreground">{result.summary}</p>
        <div className="mt-5 space-y-5">
          <TagGroup title="STYLE & PRODUCTION" tags={result.styles} />
          <TagGroup title="INSTRUMENTS & VOCALS" tags={result.instruments} />
          <TagGroup title="MOOD & ENERGY" tags={result.moods} />
        </div>
      </section>

      <section className="panel p-5 md:p-6">
        <div className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /><h2 className="font-display text-sm tracking-wider text-chrome">DISCOVER NEW SONGS</h2></div>
        <label htmlFor="tag-search" className="mt-4 block text-xs text-muted-foreground">Edit this search phrase before copying or searching</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="tag-search" value={searchText} onChange={(event) => { setSearchText(event.target.value); setCopied(false); }} maxLength={180} className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <Button type="button" variant="outline" onClick={() => void copySearch()} disabled={!searchText.trim()}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <a href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 text-sm text-primary ${query ? "" : "pointer-events-none opacity-50"}`}>Search YouTube <ExternalLink className="h-3.5 w-3.5" /></a>
          <a href={`https://open.spotify.com/search/${query}`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 text-sm text-primary ${query ? "" : "pointer-events-none opacity-50"}`}>Search Spotify <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2"><Library className="h-4 w-4 text-primary" /><h2 className="font-display text-sm tracking-wider text-chrome">MATCHES IN YOUR LIBRARY</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">Based on the titles, artists and genres saved with your songs.</p>
        {matches.length ? <ul className="mt-4 space-y-3">{matches.map(({ song, matchedTags }) => <li key={song.id} className="panel flex items-center gap-3 p-3">
          {song.artwork ? <img src={song.artwork} alt="" className="h-14 w-14 rounded object-cover" loading="lazy" /> : <div className="grid h-14 w-14 place-items-center rounded bg-muted"><FileAudio className="h-5 w-5 text-muted-foreground" /></div>}
          <div className="min-w-0 flex-1"><div className="truncate font-bold">{song.title}</div><div className="truncate text-sm text-primary">{song.artist}</div><div className="mt-1 truncate text-xs text-muted-foreground">Matched: {matchedTags.join(", ")}</div></div>
          {song.links[0] && <a href={song.links[0].url} target="_blank" rel="noreferrer" aria-label={`Open ${song.title}`} className="p-2 text-primary"><ExternalLink className="h-4 w-4" /></a>}
        </li>)}</ul> : <p className="panel mt-4 p-4 text-sm text-muted-foreground">No saved-song details match these tags yet. Use the search phrase above to discover new songs.</p>}
      </section>
    </div>}
  </AppShell>;
}
