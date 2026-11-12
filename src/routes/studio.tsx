import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Download, Guitar, Music2, Scissors, Square, Upload } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { UpgradeNotice } from '@/components/UpgradeNotice';
import { takeFreeUse } from '@/lib/usage';
import { decodeMusic, downloadMusic, encodeWav, noteName, type MelodyNote } from '@/lib/music-files';
import type { SeparationResult } from 'demucs-web';
import type { InstrumentGuess } from '@/lib/instruments';

export const Route = createFileRoute('/studio')({
  head: () => ({ meta: [
    { title: 'Stems & MIDI — Song Analyzer' },
    { name: 'description', content: 'Separate vocals, drums, bass and other instruments locally, or export melody notes as MIDI.' },
    { property: 'og:title', content: 'Stems & MIDI — Song Analyzer' },
    { property: 'og:description', content: 'Free browser-powered instrument separation and melody transcription.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: Studio,
});

type Stem = { name: string; url: string; blob: Blob };

function Studio() {
  const [mode, setMode] = useState<'stems' | 'midi' | 'instruments'>('stems');
  const [transcription, setTranscription] = useState<'melody' | 'polyphonic'>('melody');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(false);
  const [stems, setStems] = useState<Stem[]>([]);
  const [notes, setNotes] = useState<MelodyNote[] | null>(null);
  const [midi, setMidi] = useState<Blob | null>(null);
  const [guesses, setGuesses] = useState<InstrumentGuess[] | null>(null);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { worker.current?.terminate(); generation.current++; }, []);
  useEffect(() => () => { stems.forEach(stem => URL.revokeObjectURL(stem.url)); }, [stems]);

  const cancel = () => { generation.current++; worker.current?.terminate(); worker.current = null; setBusy(false); setPhase('Canceled'); };
  async function run() {
    if (!file || busy) return;
    const job = ++generation.current;
    setBusy(true); setError(''); setLimit(false); setProgress(0); setPhase('Reading audio'); setStems([]); setNotes(null); setMidi(null); setGuesses(null);
    try {
      const buffer = await decodeMusic(file, mode === 'stems' ? 44100 : mode === 'instruments' ? 16000 : 22050);
      if (job !== generation.current) return;
      const left = await takeFreeUse();
      if (job !== generation.current) return;
      if (left === null) { setLimit(true); setBusy(false); return; }
      if (mode === 'instruments') {
        const mono = new Float32Array(buffer.length);
        for (let c = 0; c < buffer.numberOfChannels; c++) { const ch = buffer.getChannelData(c); for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] ?? 0) + (ch[i] ?? 0) / buffer.numberOfChannels; }
        setPhase('Loading sound model');
        const w = new Worker(new URL('../lib/instrument.worker.ts', import.meta.url), { type: 'module' });
        worker.current = w;
        const fail = (message: string) => { if (job !== generation.current) return; setError(message); setBusy(false); w.terminate(); worker.current = null; };
        w.onerror = () => fail('The instrument model could not load. Please try again.');
        w.onmessage = (event: MessageEvent<{ type: string; progress: number; phase: string; guesses: InstrumentGuess[]; message: string }>) => {
          if (job !== generation.current) return;
          if (event.data.type === 'progress') { setProgress(event.data.progress); setPhase(event.data.phase); }
          if (event.data.type === 'error') fail(event.data.message);
          if (event.data.type === 'done') { setGuesses(event.data.guesses); setBusy(false); setProgress(1); setPhase('Complete'); w.terminate(); worker.current = null; }
        };
        w.postMessage({ samples: mono }, [mono.buffer]);
        return;
      }
      if (mode === 'midi') {
        setPhase(transcription === 'melody' ? 'Detecting melody notes' : 'Loading multi-note model');
        const { detectMelody, melodyMidi } = await import('@/lib/melody');
        const mono = new Float32Array(buffer.length);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const channel = buffer.getChannelData(c);
          for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] ?? 0) + (channel[i] ?? 0) / buffer.numberOfChannels;
        }
        if (transcription === 'polyphonic') {
          const w = new Worker(new URL('../lib/transcription.worker.ts', import.meta.url), { type: 'module' });
          worker.current = w;
          const fail = (message: string) => { if (job !== generation.current) return; setError(message); setBusy(false); w.terminate(); worker.current = null; };
          w.onerror = () => fail('The multi-note engine could not load. Please try again.');
          w.onmessage = (event: MessageEvent<{ type: string; progress: number; phase: string; notes: MelodyNote[]; message: string }>) => {
            if (job !== generation.current) return;
            if (event.data.type === 'progress') { setProgress(event.data.progress); setPhase(event.data.phase); }
            if (event.data.type === 'error') fail(event.data.message);
            if (event.data.type === 'done') {
              setNotes(event.data.notes); setMidi(new Blob([melodyMidi(event.data.notes)], { type: 'audio/midi' }));
              setBusy(false); setProgress(1); setPhase('Complete'); w.terminate(); worker.current = null;
            }
          };
          w.postMessage({ samples: mono }, [mono.buffer]);
          return;
        }
        const result = await detectMelody(mono, buffer.sampleRate, p => { if (job === generation.current) setProgress(p); });
        if (job !== generation.current) return;
        setNotes(result); setMidi(new Blob([melodyMidi(result)], { type: 'audio/midi' })); setBusy(false); setPhase('Complete');
      } else {
        setPhase('Loading separation model');
        const w = new Worker(new URL('../lib/separation.worker.ts', import.meta.url), { type: 'module' });
        worker.current = w;
        const fail = (message: string) => { if (job !== generation.current) return; setError(message); setBusy(false); w.terminate(); worker.current = null; };
        w.onerror = () => fail('The separation engine could not load. Try again in a desktop browser.');
        w.onmessage = (event: MessageEvent<{ type: string; progress: number; phase: string; stems: SeparationResult; message: string }>) => {
          if (job !== generation.current) return;
          if (event.data.type === 'progress') { setProgress(event.data.progress); setPhase(event.data.phase); }
          if (event.data.type === 'error') fail(event.data.message);
          if (event.data.type === 'done') {
            const result = Object.entries(event.data.stems).map(([name, channels]) => {
              const blob = new Blob([encodeWav([channels.left, channels.right], 44100)], { type: 'audio/wav' });
              return { name, blob, url: URL.createObjectURL(blob) };
            });
            setStems(result); setBusy(false); setProgress(1); setPhase('Complete'); w.terminate(); worker.current = null;
          }
        };
        w.postMessage({ left: buffer.getChannelData(0).slice(), right: buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1)).slice() });
      }
    } catch { if (job === generation.current) { setError('This audio could not be processed. Try a WAV or MP3 recording.'); setBusy(false); } }
  }
  const base = file?.name.replace(/\.[^.]+$/, '') ?? 'song';
  return <AppShell>
    <h1 className="font-display text-2xl font-bold text-chrome">STEMS & MIDI</h1>
    <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Audio task">
      <Button role="tab" aria-selected={mode === 'stems'} disabled={busy} variant={mode === 'stems' ? 'default' : 'outline'} onClick={() => { setMode('stems'); setError(''); }}><Scissors /> Separate instruments</Button>
      <Button role="tab" aria-selected={mode === 'midi'} disabled={busy} variant={mode === 'midi' ? 'default' : 'outline'} onClick={() => { setMode('midi'); setError(''); }}><Music2 /> Notes / MIDI</Button>
      <Button role="tab" aria-selected={mode === 'instruments'} disabled={busy} variant={mode === 'instruments' ? 'default' : 'outline'} onClick={() => { setMode('instruments'); setError(''); }}><Guitar /> Identify instruments</Button>
    </div>
    {mode === 'midi' && <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Transcription type">
      <Button variant={transcription === 'melody' ? 'secondary' : 'outline'} aria-pressed={transcription === 'melody'} disabled={busy} onClick={() => { setTranscription('melody'); setNotes(null); setMidi(null); }}>Single melody</Button>
      <Button variant={transcription === 'polyphonic' ? 'secondary' : 'outline'} aria-pressed={transcription === 'polyphonic'} disabled={busy} onClick={() => { setTranscription('polyphonic'); setNotes(null); setMidi(null); }}>Multiple notes</Button>
    </div>}
    <p className="mt-4 text-sm text-muted-foreground">{mode === 'instruments' ? 'Experimental estimate using Google’s free YAMNet sound model. Listens to up to 8 short excerpts. Mixed songs, effects and similar-sounding instruments can confuse it.' : mode === 'stems' ? 'Vocals · drums · bass · other instruments. First run downloads a 181 MB model. Processing can be slow and memory-intensive, especially on phones.' : transcription === 'melody' ? 'Single-note melody estimate. Best with a solo voice, bass or instrument.' : 'Overlapping-note estimates powered by Spotify Basic Pitch. Best on one isolated instrument; dense mixes and drums may produce incorrect notes.'}</p>
    <p className="mt-2 text-xs text-muted-foreground">Audio stays on your device. No paid service required.</p>
    <label className={`mt-6 flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center ${busy ? 'opacity-50' : 'cursor-pointer hover:border-primary'}`}>
      <Upload className="h-8 w-8 text-primary" />
      <span className="max-w-full break-all">{file?.name ?? 'Choose an audio recording'}</span>
      <input aria-label="Audio recording" type="file" accept="audio/*,.flac" disabled={busy} className="sr-only" onChange={e => { setFile(e.target.files?.[0] ?? null); setStems([]); setNotes(null); setMidi(null); setGuesses(null); setError(''); }} />
    </label>
    <div className="mt-4 flex items-center gap-3">
      <Button disabled={!file || busy} onClick={run}>{mode === 'stems' ? <Scissors /> : mode === 'instruments' ? <Guitar /> : <Music2 />}{mode === 'stems' ? 'Separate instruments' : mode === 'instruments' ? 'Identify instruments' : 'Detect notes'}</Button>
      {busy && <Button variant="outline" onClick={cancel}><Square /> Cancel</Button>}
    </div>
    {busy && <div className="mt-5 space-y-2" role="status"><p className="text-sm">{phase} · {Math.round(progress * 100)}%</p><progress aria-label="Audio processing progress" value={progress} max={1} className="h-2 w-full accent-primary" /></div>}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {limit && <UpgradeNotice />}
    {mode === 'stems' && stems.length > 0 && <section className="mt-8 border-t pt-6"><h2 className="font-display text-lg text-primary">SEPARATED TRACKS</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{stems.map(stem => <div key={stem.name} className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between"><h3 className="font-bold capitalize">{stem.name === 'other' ? 'Other instruments' : stem.name}</h3><Button size="icon" variant="ghost" aria-label={`Download ${stem.name}`} title={`Download ${stem.name} WAV`} onClick={() => downloadMusic(stem.blob, `${base}-${stem.name}.wav`)}><Download /></Button></div><audio aria-label={`${stem.name} playback`} src={stem.url} controls className="mt-3 w-full" /></div>)}</div></section>}
    {mode === 'midi' && notes && <section className="mt-8 border-t pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg text-primary">{notes.length} NOTES DETECTED</h2>{midi && notes.length > 0 && <Button variant="outline" onClick={() => downloadMusic(midi, `${base}-notes.mid`)}><Download /> MIDI</Button>}</div>
      {notes.length === 0 ? <p className="mt-4 text-muted-foreground">No clear melody found. Try a solo voice or instrument recording.</p> : <div className="mt-4 max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-background"><tr><th className="py-3">Note</th><th>Start</th><th>Duration</th></tr></thead><tbody>{notes.map((note, i) => <tr key={i} className="border-t"><td className="py-2 font-bold text-primary">{noteName(note.midi)}</td><td>{note.start.toFixed(2)}s</td><td>{note.duration.toFixed(2)}s</td></tr>)}</tbody></table></div>}
    </section>}
    {mode === 'instruments' && guesses && <section className="mt-8 border-t pt-6"><h2 className="font-display text-lg text-primary">LIKELY INSTRUMENTS</h2>
      {guesses.length === 0 ? <p className="mt-4 text-muted-foreground">No clear instrument match. Try a cleaner recording or a separated stem.</p> : <ul className="mt-4 space-y-3">{guesses.map(g => <li key={g.name}><div className="flex justify-between text-sm"><span className="font-bold">{g.name}</span><span className="text-muted-foreground">{Math.round(g.score * 100)}% model score</span></div><div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, g.score * 100)}%` }} /></div></li>)}</ul>}
      <p className="mt-4 text-xs text-muted-foreground">Scores show how strongly the model heard each sound — they are estimates, not confirmed identifications.</p>
    </section>}
  </AppShell>;
}