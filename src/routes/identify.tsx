import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { recognizeSong, type RecognizedSong } from "@/lib/recognize.functions";
import { addToHistory } from "@/lib/history";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useAuth } from "@/hooks/useAuth";
import { UpgradeNotice } from "@/components/UpgradeNotice";

export const Route = createFileRoute("/identify")({
  head: () => ({
    meta: [
      { title: "Song Finder — Song Analyzer" },
      { name: "description", content: "Tap the mic to identify the song playing around you." },
      { property: "og:title", content: "Song Finder — Song Analyzer" },
      { property: "og:description", content: "Identify songs from a TV, radio, speaker or another device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Identify,
});

type Phase = "idle" | "listening" | "searching" | "match" | "no_match" | "not_configured" | "limit" | "error";
const SECONDS = 10;

function Identify() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [song, setSong] = useState<RecognizedSong | null>(null);
  const [msg, setMsg] = useState("");
  const [left, setLeft] = useState(SECONDS);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const cancelled = useRef(false);
  const { user, ready } = useAuth();

  useEffect(() => () => stopRef.current(), []);

  async function start() {
    setSong(null); setMsg(""); cancelled.current = false;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } }); }
    catch { setPhase("error"); setMsg("Microphone access was blocked. Allow it in your browser settings to identify songs."); return; }
    setPhase("listening"); setLeft(SECONDS);
    const ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const data = new Uint8Array(an.fftSize);
    let raf = 0;
    const draw = () => {
      const c = canvas.current; if (c) {
        const g = c.getContext("2d")!; an.getByteTimeDomainData(data);
        g.clearRect(0, 0, c.width, c.height);
        g.strokeStyle = getComputedStyle(c).color; g.lineWidth = 3; g.beginPath();
        data.forEach((v, i) => { const x = (i / data.length) * c.width, y = (v / 255) * c.height; i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const timer = setInterval(() => setLeft((l) => l - 1), 1000);
    const cleanup = () => { clearInterval(timer); cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close(); };
    stopRef.current = () => { cancelled.current = true; if (rec.state !== "inactive") rec.stop(); cleanup(); };
    rec.onstop = async () => {
      cleanup();
      if (cancelled.current) { setPhase("idle"); return; }
      setPhase("searching");
      const blob = new Blob(chunks, { type: rec.mimeType });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const r = await recognizeSong({ data: { audioBase64: btoa(bin), mime: rec.mimeType, environment: getPaddleEnvironment() } }).catch(() => ({ status: "error" as const, message: "Network error" }));
      if (r.status === "match") { setSong(r.song); void addToHistory(r.song); }
      if (r.status === "error") setMsg(r.message);
      setPhase(r.status);
    };
    rec.start();
    setTimeout(() => rec.state === "recording" && rec.stop(), SECONDS * 1000);
  }

  const label: Record<Phase, string> = {
    idle: "Tap to identify", listening: `Listening… ${Math.max(left, 0)}s`, searching: "Searching music database…",
    match: "Song identified!", no_match: "No match found. Try again closer to the speaker.",
    not_configured: "Song recognition needs a provider key before it can run.", limit: "You've used today's 3 free uses.", error: msg || "Something went wrong. Try again.",
  };
  const busy = phase === "listening" || phase === "searching";

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">SONG FINDER</h1>
      <p className="mt-1 text-sm text-muted-foreground">We use your microphone for 10 seconds to hear the music and match it. Nothing is stored.</p>
      <div className="mt-10 flex flex-col items-center">
        <div className="relative">
          {phase === "listening" && <span className="absolute inset-0 rounded-full bg-primary animate-pulse-ring" />}
          <button onClick={busy ? () => stopRef.current() : start} disabled={phase === "searching" || (ready && !user)}
            aria-label={busy ? "Stop listening" : "Start listening"}
            className="relative grid h-40 w-40 place-items-center rounded-full bg-primary text-primary-foreground shadow-neon transition active:scale-95 disabled:opacity-70">
            {busy ? <Square className="h-12 w-12" /> : <Mic className="h-16 w-16" />}
          </button>
        </div>
        <canvas ref={canvas} width={600} height={100} className={`mt-6 h-20 w-full max-w-md text-primary ${phase === "listening" ? "" : "opacity-20"}`} />
        <p className="mt-2 text-center font-display text-sm tracking-wider">{ready && !user ? "Sign in to identify songs — 3 free a day" : label[phase]}</p>
        {ready && !user && <Link to="/auth" className="mt-3 rounded-full bg-primary px-5 py-2 font-display text-xs tracking-wider text-primary-foreground">SIGN IN FREE</Link>}
        {phase === "limit" && <UpgradeNotice />}
      </div>

      {song && (
        <div className="panel mx-auto mt-8 flex max-w-lg flex-col gap-4 p-5 sm:flex-row">
          {song.artwork && <img src={song.artwork} alt={`${song.album ?? song.title} cover`} className="h-36 w-36 rounded-lg object-cover" />}
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{song.title}</h2>
            <p className="text-primary">{song.artist}</p>
            <dl className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              {song.album && <div>Album: {song.album}</div>}
              {song.releaseDate && <div>Released: {song.releaseDate}</div>}
              {song.genres?.length ? <div>Genre: {song.genres.join(", ")}</div> : null}
              {song.durationMs && <div>Length: {Math.floor(song.durationMs / 60000)}:{String(Math.round(song.durationMs / 1000) % 60).padStart(2, "0")}</div>}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {song.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:border-primary">
                  {l.label} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
            <Link to="/analyze" className="mt-4 inline-block rounded-md bg-spectrum px-4 py-2 text-sm font-bold text-accent-foreground">ANALYZE THIS SONG</Link>
            <p className="mt-1 text-xs text-muted-foreground">Upload a copy you own to analyze it.</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
