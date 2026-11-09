import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, Play, Pause, Square, Repeat } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { chordSummary, detectChords, detectSections, frameChroma, type ChordSeg, type Section } from "@/lib/chords";
import { computeChroma, detectKey, detectTempo, loudness, NOTE_NAMES, toMono, waveformPeaks } from "@/lib/audio-analysis";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Analyze a Song — Song Analyzer" },
      { name: "description", content: "Upload a recording to detect its key, scale, tempo and loudness." },
      { property: "og:title", content: "Analyze a Song — Song Analyzer" },
      { property: "og:description", content: "Real key and BPM detection from your audio files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analyze,
});

type Result = {
  name: string; format: string; duration: number; sampleRate: number; channels: number;
  peaks: number[]; chroma: number[]; key: ReturnType<typeof detectKey>; tempo: ReturnType<typeof detectTempo>;
  loud: ReturnType<typeof loudness>;
  chords: ChordSeg[]; sections: Section[]; offset: number;
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Analyze() {
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function handle(file: File) {
    setErr(""); setBusy(true); setRes(null);
    try {
      const ctx = new AudioContext();
      const buf = await ctx.decodeAudioData(await file.arrayBuffer());
      ctx.close();
      await new Promise((r) => setTimeout(r, 30));
      const mono = toMono(buf);
      // limit heavy analysis to 3 minutes centred on the track
      const max = buf.sampleRate * 180;
      const seg = mono.length > max ? mono.subarray((mono.length - max) / 2, (mono.length + max) / 2) : mono;
      const chroma = computeChroma(seg, buf.sampleRate);
      // chord/section timeline over the first 6 minutes
      const tl = mono.subarray(0, Math.min(mono.length, buf.sampleRate * 360));
      const fc = frameChroma(tl, buf.sampleRate);
      const chords = detectChords(fc.frames, fc.energy, fc.secPerFrame);
      const sections = detectSections(fc.frames, fc.energy, fc.secPerFrame);
      setRes({
        name: file.name, format: file.name.split(".").pop()?.toUpperCase() ?? file.type,
        duration: buf.duration, sampleRate: buf.sampleRate, channels: buf.numberOfChannels,
        peaks: waveformPeaks(mono, 400), chroma, key: detectKey(chroma), tempo: detectTempo(seg, buf.sampleRate), loud: loudness(mono),
        chords, sections, offset: 0,
      });
      setUrl(URL.createObjectURL(file));
    } catch {
      setErr("This file couldn't be decoded. Try MP3, WAV, FLAC, M4A, AAC or OGG.");
    } finally { setBusy(false); }
  }

  const a = audio.current;
  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">ANALYZE A SONG</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your file is analyzed on your device — it is never uploaded.</p>

      <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
        className={`panel mt-6 flex cursor-pointer flex-col items-center gap-3 border-dashed p-10 text-center transition ${drag ? "shadow-neon" : ""}`}>
        <Upload className="h-10 w-10 text-primary" />
        <span className="font-display tracking-wider">{busy ? "ANALYZING AUDIO…" : "DROP OR CHOOSE A SONG"}</span>
        <span className="text-xs text-muted-foreground">MP3 · WAV · FLAC · M4A · AAC · OGG · AIFF</span>
        <input type="file" accept="audio/*,.flac,.aiff,.aif" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
      </label>
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

      {res && (
        <div className="mt-8 space-y-6">
          <div className="panel p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="truncate text-lg font-bold">{res.name}</h2>
              <span className="text-xs text-muted-foreground">{res.format} · {(res.sampleRate / 1000).toFixed(1)} kHz · {res.channels === 1 ? "mono" : "stereo"} · {fmt(res.duration)}</span>
            </div>
            <div className="relative mt-4 flex h-24 cursor-pointer items-center gap-px"
              onClick={(e) => { if (!a) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = ((e.clientX - r.left) / r.width) * res.duration; }}>
              {res.peaks.map((p, i) => (
                <div key={i} className={`flex-1 rounded-full ${i / res.peaks.length < t / res.duration ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ height: `${Math.max(3, p * 100)}%` }} />
              ))}
            </div>
            <audio ref={audio} src={url} loop={loop} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button aria-label={playing ? "Pause" : "Play"} onClick={() => (playing ? a?.pause() : a?.play())} className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground">
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button aria-label="Stop" onClick={() => { if (a) { a.pause(); a.currentTime = 0; } }} className="grid h-11 w-11 place-items-center rounded-full border"><Square className="h-4 w-4" /></button>
              <button aria-label="Rewind 10 seconds" onClick={() => a && (a.currentTime -= 10)} className="h-11 rounded-full border px-3 text-sm">-10s</button>
              <button aria-label="Forward 10 seconds" onClick={() => a && (a.currentTime += 10)} className="h-11 rounded-full border px-3 text-sm">+10s</button>
              <button aria-label="Loop" onClick={() => setLoop(!loop)} className={`grid h-11 w-11 place-items-center rounded-full border ${loop ? "border-primary text-primary" : ""}`}><Repeat className="h-4 w-4" /></button>
              <select aria-label="Playback speed" value={rate} onChange={(e) => { const v = +e.target.value; setRate(v); if (a) { a.playbackRate = v; a.preservesPitch = true; } }} className="h-11 rounded-full border bg-card px-3 text-sm">
                {[0.5, 0.75, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{r}×</option>)}
              </select>
              <input aria-label="Volume" type="range" min={0} max={1} step={0.01} defaultValue={1} onChange={(e) => a && (a.volume = +e.target.value)} className="w-24 accent-primary" />
              <span className="ml-auto font-mono text-xs text-muted-foreground">{fmt(t)} / {fmt(res.duration)}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="KEY" value={`${res.key.key} ${res.key.mode}`} conf={res.key.confidence}
              sub={`Also possible: ${res.key.alternates.map((k) => `${k.key} ${k.mode}`).join(", ")}`} />
            <Stat label="TEMPO" value={`${res.tempo.bpm} BPM`} conf={res.tempo.confidence} sub="Half/double time is possible" />
            <Stat label="LOUDNESS" value={`${res.loud.rmsDb.toFixed(1)} dB RMS`} sub={`Peak ${res.loud.peakDb.toFixed(1)} dBFS`} />
          </div>

          <div className="panel p-5">
            <h3 className="font-display text-sm tracking-wider text-primary">PITCH CLASS PROFILE</h3>
            <p className="text-xs text-muted-foreground">How much each note is present across the song — used to find the key.</p>
            <div className="mt-4 flex h-40 items-end gap-2">
              {res.chroma.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-spectrum" style={{ height: `${v * 100}%` }} />
                  <span className="text-[10px] text-muted-foreground">{NOTE_NAMES[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <Timeline res={res} t={t} seek={(x) => { if (a) a.currentTime = x; }} />

          <p className="text-xs text-muted-foreground">Instruments, stems, notes/MIDI and lyrics are coming in the next build stages. The vocoder lives in its own tab.</p>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, sub, conf }: { label: string; value: string; sub?: string; conf?: number }) {
  return (
    <div className="panel p-5">
      <div className="font-display text-xs tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-chrome">{value}</div>
      {conf !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(conf * 100)}%` }} /></div>
          <div className="mt-1 text-[11px] text-muted-foreground">Confidence {Math.round(conf * 100)}%</div>
        </div>
      )}
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

const SECTION_COLORS = ["bg-primary/30", "bg-accent/40", "bg-secondary", "bg-muted", "bg-primary/15", "bg-accent/20"];

function Timeline({ res, t, seek }: { res: Result; t: number; seek: (s: number) => void }) {
  const total = Math.max(res.chords.at(-1)?.end ?? 0, res.sections.at(-1)?.end ?? 0) || res.duration;
  const now = res.chords.find((c) => t >= c.start && t < c.end);
  const next = res.chords.find((c) => c.start > t && c.chord !== "N");
  const sec = res.sections.find((x) => t >= x.start && t < x.end);
  const common = chordSummary(res.chords);
  const pct = (x: number) => `${(x / total) * 100}%`;
  return (
    <div className="panel p-5">
      <h3 className="font-display text-sm tracking-wider text-primary">CHORDS & SONG SECTIONS</h3>
      <p className="text-xs text-muted-foreground">Estimated from the notes heard over time. Press play to follow along, or tap a block to jump there.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div><div className="text-[11px] tracking-widest text-muted-foreground">NOW</div><div className="text-3xl font-bold text-chrome">{now && now.chord !== "N" ? now.chord : "—"}</div></div>
        <div><div className="text-[11px] tracking-widest text-muted-foreground">NEXT</div><div className="text-3xl font-bold text-muted-foreground">{next?.chord ?? "—"}</div></div>
        <div><div className="text-[11px] tracking-widest text-muted-foreground">SECTION</div><div className="text-3xl font-bold text-chrome">{sec ? `Part ${sec.label}` : "—"}</div></div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="relative min-w-[640px]" style={{ width: `${Math.max(100, total * 4)}%` }}>
          <div className="relative h-8">
            {res.sections.map((s, i) => (
              <button key={i} onClick={() => seek(s.start)} className={`absolute top-0 h-full rounded border border-border text-xs font-bold ${SECTION_COLORS[(s.label.charCodeAt(0) - 65) % SECTION_COLORS.length]}`} style={{ left: pct(s.start), width: pct(s.end - s.start) }}>{s.label}</button>
            ))}
          </div>
          <div className="relative mt-1 h-10">
            {res.chords.map((c, i) => (
              <button key={i} onClick={() => seek(c.start)} title={`${c.chord} at ${fmt(c.start)}`} className={`absolute top-0 h-full truncate rounded border px-1 text-[11px] ${c === now ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`} style={{ left: pct(c.start), width: pct(c.end - c.start) }}>{c.chord === "N" ? "" : c.chord}</button>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow-neon" style={{ left: pct(Math.min(t, total)) }} />
        </div>
      </div>
      {common.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Most-used chords: <span className="font-bold text-foreground">{common.join(" · ")}</span></p>}
      <p className="mt-1 text-[11px] text-muted-foreground">Major and minor chords only for now; sevenths and other colours show as their closest triad. Section letters group parts that sound alike (e.g. verse = A, chorus = B).</p>
    </div>
  );
}
