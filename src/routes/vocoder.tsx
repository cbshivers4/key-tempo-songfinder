import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform, Mic, Pause, Play, Square, Upload, Circle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  BAND_STEPS, DEFAULT_SETTINGS, VocoderEngine, bandCenters, bandLevels,
  rms, spectralCentroid, zeroCrossingRate,
  type CarrierType, type VocoderSettings,
} from "@/lib/vocoder";

export const Route = createFileRoute("/vocoder")({
  head: () => ({
    meta: [
      { title: "Vocoder Analyzer — Song Analyzer" },
      { name: "description", content: "Shape a voice or a recording through a live band filter bank and watch each band breathe." },
      { property: "og:title", content: "Vocoder Analyzer — Song Analyzer" },
      { property: "og:description", content: "A 32-band vocoder in your browser, with a live band-by-band picture of what it hears." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Vocoder,
});

type Source = "file" | "mic";
type RGB = [number, number, number];

const PRESETS: { name: string; s: Partial<VocoderSettings> }[] = [
  { name: "ROBOT", s: { bands: 16, q: 6, responseMs: 30, sharpness: 1.8, carrier: "saw", baseHz: 60, depth: 0.9 } },
  { name: "WHISPER", s: { bands: 24, q: 9, responseMs: 60, sharpness: 2.6, carrier: "noise", baseHz: 60, depth: 1 } },
  { name: "CHOIR", s: { bands: 32, q: 4, responseMs: 90, sharpness: 1.2, carrier: "saw", baseHz: 48, depth: 0.85 } },
  { name: "SPUTNIK", s: { bands: 12, q: 5, responseMs: 18, sharpness: 1.6, carrier: "square", baseHz: 140, depth: 0.95 } },
];

const CARRIERS: { value: CarrierType; label: string }[] = [
  { value: "saw", label: "Saw" },
  { value: "square", label: "Square" },
  { value: "sine", label: "Sine" },
  { value: "noise", label: "Noise" },
];

const fmtHz = (h: number) => (h >= 1000 ? `${(h / 1000).toFixed(1)}k` : `${Math.round(h)}`);

/** Resolve a theme token (oklch and friends) to sRGB pixels so canvas can use it. */
function readColor(token: string, fallback: RGB): RGB {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!raw) return fallback;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d");
  if (!g) return fallback;
  g.fillStyle = raw;
  g.fillRect(0, 0, 1, 1);
  const px = g.getImageData(0, 0, 1, 1).data;
  const r = px[0] ?? 0, gg = px[1] ?? 0, b = px[2] ?? 0;
  return r || gg || b ? [r, gg, b] : fallback;
}

function Vocoder() {
  const [settings, setSettings] = useState<VocoderSettings>(DEFAULT_SETTINGS);
  const [source, setSource] = useState<Source>("file");
  const [running, setRunning] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const [stats, setStats] = useState({ centroid: 0, zcr: 0, level: 0, active: 0, top: 0 });

  const centers = useMemo(() => bandCenters(settings.bands), [settings.bands]);

  const ctxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<VocoderEngine | null>(null);
  const mediaSrcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const micSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);
  const tickRef = useRef(0);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const colorsRef = useRef<{ low: RGB; high: RGB; line: RGB }>({ low: [40, 40, 60], high: [110, 231, 249], line: [110, 231, 249] });

  useEffect(() => {
    colorsRef.current = {
      low: readColor("--violet", [109, 40, 217]),
      high: readColor("--glow", [110, 231, 249]),
      line: readColor("--primary", [110, 231, 249]),
    };
  }, []);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const draw = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const { low, high, line } = colorsRef.current;

    const freq = new Uint8Array(eng.modAnalyser.frequencyBinCount);
    eng.modAnalyser.getByteFrequencyData(freq);
    const lv = bandLevels(freq, eng.ctx.sampleRate, eng.centers);

    for (let i = 0; i < eng.centers.length; i++) {
      const el = barsRef.current[i];
      const v = lv[i] ?? 0;
      if (el) el.style.height = `${Math.max(2, v * 100)}%`;
    }

    const grid = gridRef.current;
    const gg = grid?.getContext("2d");
    if (grid && gg) {
      const w = grid.width, h = grid.height;
      gg.drawImage(grid, -1, 0);
      gg.clearRect(w - 1, 0, 1, h);
      const rowH = h / lv.length;
      for (let i = 0; i < lv.length; i++) {
        const v = lv[i] ?? 0;
        const r = Math.round(low[0] + (high[0] - low[0]) * v);
        const g = Math.round(low[1] + (high[1] - low[1]) * v);
        const b = Math.round(low[2] + (high[2] - low[2]) * v);
        gg.fillStyle = `rgba(${r},${g},${b},${0.08 + v * 0.92})`;
        gg.fillRect(w - 1, h - (i + 1) * rowH, 1, Math.ceil(rowH));
      }
    }

    const wave = waveRef.current;
    const wg = wave?.getContext("2d");
    if (wave && wg) {
      const w = wave.width, h = wave.height;
      wg.clearRect(0, 0, w, h);
      const n = eng.analyser.fftSize;
      const t = new Uint8Array(n);
      eng.analyser.getByteTimeDomainData(t);
      wg.lineWidth = 2;
      wg.strokeStyle = `rgb(${line[0]},${line[1]},${line[2]})`;
      wg.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = h / 2 + (((t[i] ?? 128) - 128) / 128) * (h / 2 - 2);
        if (i) wg.lineTo(x, y); else wg.moveTo(x, y);
      }
      wg.stroke();
    }

    if (tickRef.current++ % 6 === 0) {
      const td = new Uint8Array(eng.analyser.fftSize);
      eng.analyser.getByteTimeDomainData(td);
      const signal = new Float32Array(td.length);
      for (let i = 0; i < td.length; i++) signal[i] = ((td[i] ?? 128) - 128) / 128;
      const top = lv.indexOf(Math.max(...lv));
      const topLevel = top >= 0 ? (lv[top] ?? 0) : 0;
      setStats({
        centroid: spectralCentroid(freq, eng.ctx.sampleRate),
        zcr: zeroCrossingRate(signal, eng.ctx.sampleRate),
        level: rms(signal),
        active: lv.filter((v) => v > 0.15).length,
        top: topLevel > 0.02 ? (eng.centers[top] ?? 0) : 0,
      });
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  async function ensureEngine(): Promise<VocoderEngine> {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = ctxRef.current ?? new Ctor();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    if (!engineRef.current) engineRef.current = new VocoderEngine(ctx, settings);
    else engineRef.current.setSettings(settings);
    return engineRef.current;
  }

  async function wireModulator(eng: VocoderEngine) {
    if (source === "file") {
      const el = audioRef.current;
      if (!el) throw new Error("audio element is missing");
      if (!mediaSrcRef.current) mediaSrcRef.current = eng.ctx.createMediaElementSource(el);
      else mediaSrcRef.current.disconnect();
      mediaSrcRef.current.connect(eng.modIn);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't reach the microphone.");
    const stream = micStreamRef.current ?? await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    micStreamRef.current = stream;
    if (!micSrcRef.current) micSrcRef.current = eng.ctx.createMediaStreamSource(stream);
    else micSrcRef.current.disconnect();
    micSrcRef.current.connect(eng.modIn);
  }

  async function toggle() {
    setErr("");
    if (running) {
      cancelAnimationFrame(rafRef.current);
      mediaSrcRef.current?.disconnect();
      micSrcRef.current?.disconnect();
      audioRef.current?.pause();
      setRunning(false);
      setPlaying(false);
      return;
    }
    try {
      const eng = await ensureEngine();
      await wireModulator(eng);
      setRunning(true);
      rafRef.current = requestAnimationFrame(draw);
    } catch (e) {
      setErr(e instanceof Error && e.message.includes("Permission")
        ? "The microphone was blocked. Allow it in your browser, then try again."
        : "Couldn't start the vocoder. Check your browser's audio permissions and try again.");
    }
  }

  function apply(next: Partial<VocoderSettings>) {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      engineRef.current?.setSettings(merged);
      return merged;
    });
  }

  async function toggleRecord() {
    const eng = engineRef.current;
    if (!eng) { setErr("Start the vocoder before recording."); return; }
    setErr("");
    if (recording) {
      const blob = await eng.stopRecording();
      setRecording(false);
      if (!blob) return;
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vocoder-${Date.now()}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } else {
      try { eng.startRecording(); setRecording(true); }
      catch { setErr("This browser can't record the vocoder output."); }
    }
  }

  function pickFile(file: File) {
    setErr("");
    setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    setFileName(file.name);
    setSource("file");
  }

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    engineRef.current?.dispose();
    engineRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
  }, []);

  const a = audioRef.current;

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">VOCODER ANALYZER</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A band filter bank runs live on your device: it watches the level of every band and uses it to shape a carrier tone.
      </p>

      <div className="panel mt-6 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={toggle} className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground" aria-label={running ? "Stop vocoder" : "Start vocoder"}>
            {running ? <Square className="h-4 w-4" /> : <Play className="h-5 w-5" />}
          </button>
          <button onClick={toggleRecord} className={`grid h-11 w-11 place-items-center rounded-full border ${recording ? "border-destructive text-destructive" : ""}`} aria-label={recording ? "Save recording" : "Record output"}>
            <Circle className={`h-4 w-4 ${recording ? "fill-current" : ""}`} />
          </button>
          <div className="ml-2 flex overflow-hidden rounded-full border">
            {(["file", "mic"] as Source[]).map((s) => (
              <button key={s} onClick={() => { if (s !== source) setSource(s); }}
                className={`px-4 py-2 text-sm ${source === s ? "bg-secondary text-primary" : "text-muted-foreground"}`}>
                {s === "file" ? "From a file" : "From the microphone"}
              </button>
            ))}
          </div>
          {source === "file" && (
            <label className="ml-auto flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              <Upload className="h-4 w-4" />
              {fileName ? <span className="max-w-48 truncate">{fileName}</span> : "Choose audio"}
              <input type="file" accept="audio/*,.flac,.aiff,.aif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
            </label>
          )}
          {source === "file" && (
            <button aria-label={playing ? "Pause source" : "Play source"} disabled={!url}
              onClick={() => { if (!a) return; if (playing) a.pause(); else void a.play(); }}
              className="grid h-11 w-11 place-items-center rounded-full border disabled:opacity-40">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          )}
        </div>
        <audio ref={audioRef} src={url || undefined} loop className="hidden"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        {!running && <p className="mt-3 text-xs text-muted-foreground">Press play to route the source through the band bank.</p>}
      </div>

      <div className="panel mt-5 p-5">
        <h3 className="font-display text-sm tracking-wider text-primary">BAND ACTIVITY</h3>
        <p className="text-xs text-muted-foreground">Each row is one band; newer time arrives at the right edge. Bright means that band is open.</p>
        <canvas ref={gridRef} width={900} height={220} className="mt-4 h-56 w-full rounded-lg border bg-background/60" />
        <div className="mt-4 flex h-32 items-end gap-1">
          {centers.map((c, i) => (
            <div key={i} ref={(el) => { barsRef.current[i] = el; }} className="flex-1 rounded-t bg-spectrum" style={{ height: "2%" }} />
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {centers.map((c, i) => (
            <span key={i} className="flex-1 truncate text-center text-[9px] text-muted-foreground">{i % 2 === 0 ? fmtHz(c) : ""}</span>
          ))}
        </div>
        <canvas ref={waveRef} width={900} height={80} className="mt-4 h-20 w-full rounded-lg border bg-background/60" />
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Readout label="OPEN BANDS" value={`${stats.active} / ${settings.bands}`} />
          <Readout label="LOUDEST BAND" value={stats.top ? `${fmtHz(stats.top)} Hz` : "—"} />
          <Readout label="BRIGHTNESS" value={stats.centroid ? `${fmtHz(stats.centroid)} Hz` : "—"} />
          <Readout label="ROUGHNESS" value={stats.zcr ? `${Math.round(stats.zcr)} /s` : "—"} />
        </div>
      </div>

      <div className="panel mt-5 p-5">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => apply(p.s)} className="rounded-full border px-4 py-2 text-xs tracking-widest text-muted-foreground transition hover:border-primary hover:text-primary">
              {p.name}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="BANDS" value={`${settings.bands}`}>
            <div className="flex overflow-hidden rounded-full border">
              {BAND_STEPS.map((b) => (
                <button key={b} onClick={() => apply({ bands: b })}
                  className={`flex-1 py-2 text-sm ${settings.bands === b ? "bg-secondary text-primary" : "text-muted-foreground"}`}>
                  {b}
                </button>
              ))}
            </div>
          </Field>

          <Field label="CARRIER" value={settings.carrier.toUpperCase()}>
            <div className="flex overflow-hidden rounded-full border">
              {CARRIERS.map((c) => (
                <button key={c.value} onClick={() => apply({ carrier: c.value })}
                  className={`flex-1 py-2 text-sm ${settings.carrier === c.value ? "bg-secondary text-primary" : "text-muted-foreground"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </Field>

          <Slider label="CARRIER PITCH" value={settings.baseHz} min={30} max={160} step={1} unit="Hz" onChange={(v) => apply({ baseHz: v })} />
          <Slider label="BAND RESONANCE" value={settings.q} min={1} max={20} step={0.5} onChange={(v) => apply({ q: v })} />
          <Slider label="RESPONSE" value={settings.responseMs} min={5} max={200} step={1} unit="ms" onChange={(v) => apply({ responseMs: v })} />
          <Slider label="HARDNESS" value={settings.sharpness} min={1} max={4} step={0.1} onChange={(v) => apply({ sharpness: v })} />
          <Slider label="DEPTH" value={settings.depth} min={0} max={1} step={0.01} percent onChange={(v) => apply({ depth: v })} />
          <Slider label="MIX" value={settings.mix} min={0} max={1} step={0.01} percent onChange={(v) => apply({ mix: v })} />
          <Slider label="VOLUME" value={settings.volume} min={0} max={1} step={0.01} percent onChange={(v) => apply({ volume: v })} />
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <AudioWaveform className="h-4 w-4 text-primary" />
          Nothing leaves your device — the bank, the envelope and the recording all run in this tab.
        </p>
      </div>
    </AppShell>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-secondary/40 p-3">
      <div className="font-display text-[10px] tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold text-chrome">{value}</div>
    </div>
  );
}

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-[10px] tracking-widest text-muted-foreground">{label}</span>
        <span className="font-mono text-xs text-primary">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, percent, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  unit?: string; percent?: boolean; onChange: (v: number) => void;
}) {
  return (
    <Field label={label} value={percent ? `${Math.round(value * 100)}%` : `${value}${unit ? ` ${unit}` : ""}`}>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} className="w-full accent-primary" />
    </Field>
  );
}
