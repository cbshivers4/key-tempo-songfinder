import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Search, ArrowLeft, ExternalLink } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { UpgradeNotice } from '@/components/UpgradeNotice';
import { takeFreeUse } from '@/lib/usage';
import { searchLyrics, type LyricResult } from '@/lib/lyrics.functions';

export const Route = createFileRoute('/lyrics')({
  head: () => ({ meta: [
    { title: 'Lyrics Search — Song Analyzer' },
    { name: 'description', content: 'Find song lyrics by title and artist in the free LRCLIB community catalog.' },
    { property: 'og:title', content: 'Lyrics Search — Song Analyzer' },
    { property: 'og:description', content: 'Search song lyrics and choose the right recording.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: Lyrics,
});

function Lyrics() {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [results, setResults] = useState<LyricResult[] | null>(null);
  const [selected, setSelected] = useState<LyricResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(false);
  const search = useServerFn(searchLyrics);
  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true); setError(''); setLimit(false); setSelected(null); setResults(null);
    try {
      if (await takeFreeUse() === null) { setLimit(true); return; }
      const response = await search({ data: { title: title.trim(), artist: artist.trim() } });
      setResults(response.results); setError(response.error ?? '');
    } catch { setError('Lyrics search could not finish. Please try again.'); }
    finally { setBusy(false); }
  }
  return <AppShell>
    <h1 className="font-display text-2xl font-bold text-chrome">LYRICS</h1>
    <form className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label className="space-y-2 text-sm">Song title<input required maxLength={150} value={title} onChange={e => setTitle(e.target.value)} placeholder="Song title" className="block h-10 w-full rounded-md border bg-card px-3" /></label>
      <label className="space-y-2 text-sm">Artist (optional)<input maxLength={150} value={artist} onChange={e => setArtist(e.target.value)} placeholder="Artist name" className="block h-10 w-full rounded-md border bg-card px-3" /></label>
      <Button type="submit" disabled={busy || !title.trim()} className="h-10"><Search />{busy ? 'Searching…' : 'Search'}</Button>
    </form>
    <p className="mt-3 text-xs text-muted-foreground">Community lyrics from LRCLIB; availability and accuracy vary. Lyrics belong to their respective rights holders.</p>
    {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
    {limit && <UpgradeNotice />}
    {selected ? <section className="mt-8 border-t pt-6">
      <Button variant="ghost" onClick={() => setSelected(null)}><ArrowLeft /> Results</Button>
      <h2 className="mt-4 break-words text-xl font-bold">{selected.trackName}</h2><p className="text-muted-foreground">{selected.artistName} · {selected.albumName}</p>
      <pre className="mt-6 whitespace-pre-wrap break-words font-sans text-base leading-8">{selected.instrumental ? 'Instrumental — no lyrics.' : selected.plainLyrics ?? selected.syncedLyrics ?? 'Lyrics are not available for this recording.'}</pre>
      <a href={`https://lrclib.net/lyrics/${selected.id}`} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm text-primary">LRCLIB source <ExternalLink className="h-4 w-4" /></a>
    </section> : results && <section className="mt-8 border-t pt-6"><h2 className="text-sm text-muted-foreground">{results.length ? `${results.length} recordings` : 'No matching lyrics found. Try another title or artist.'}</h2><div className="mt-4 divide-y">{results.map(result => <Button key={result.id} variant="ghost" onClick={() => setSelected(result)} className="h-auto w-full justify-start whitespace-normal py-4 text-left"><span className="min-w-0"><span className="block break-words font-bold">{result.trackName}</span><span className="block break-words text-xs text-muted-foreground">{result.artistName} · {result.albumName} · {Math.floor(result.duration / 60)}:{String(Math.floor(result.duration % 60)).padStart(2, '0')}</span></span></Button>)}</div></section>}
  </AppShell>;
}