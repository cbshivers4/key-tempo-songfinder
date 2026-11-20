import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FileAudio,
  Library,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  Square,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { recognizeSong, type RecognizedSong } from "@/lib/recognize.functions";
import { addToHistory } from "@/lib/history";
import { useAuth } from "@/hooks/useAuth";
import { UpgradeNotice } from "@/components/UpgradeNotice";
import { MUSIC_ACCEPT, loadUploadedSongs, uploadedSongUrl, type UploadedSong } from "@/lib/my-music";
import {
  IDENTIFY_CLIP_SECONDS,
  clipStart,
  decodeAudioBuffer,
  encodeClipBase64,
} from "@/lib/identify-clip";

export const Route = createFileRoute("/identify")({
  head: () => ({
    meta: [
      { title: "Song Finder — Song Analyzer" },
      {
        name: "description",
        content: "Identify a song from your microphone or from music you uploaded to your library.",
      },
      { property: "og:title", content: "Song Finder — Song Analyzer" },
      {
        property: "og:description",
        content: "Match music playing around you, or load one of your own songs and identify it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Identify,
});

type Phase =
  | "idle"
  | "listening"
  | "searching"
  | "match"
  | "no_match"
  | "not_configured"
  | "limit"
  | "error";
const SECONDS = 10;

const formatTime = (seconds: number) =>
  Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
    : "0:00";

function Identify() {
  const [mode, setMode] = useState<"mic" | "clip">("mic");
  const [phase, setPhase] = useState<Phase>("idle");
  const [song, setSong] = useState<RecognizedSong | null>(null);
  const [msg, setMsg] = useState("");
  const [left, setLeft] = useState(SECONDS);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const cancelled = useRef(false);
  const { user, ready } = useAuth();

  const [clipTitle, setClipTitle] = useState("");
  const [clipUrl, setClipUrl] = useState("");
  const [clipDuration, setClipDuration] = useState(0);
  const [clipTime, setClipTime] = useState(0);
  const [clipPlaying, setClipPlaying] = useState(false);
  const [clipBusy, setClipBusy] = useState<"" | "loading" | "reading">("");
  const [clipError, setClipError] = useState("");
  const [uploads, setUploads] = useState<UploadedSong[]>([]);
  const decoded = useRef<AudioBuffer | null>(null);
  const urlRef = useRef("");
  const player = useRef<HTMLAudioElement>(null);

  useEffect(
    () => () => {
      stopRef.current();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!user) {
      setUploads([]);
      return;
    }
    loadUploadedSongs()
      .then(setUploads)
      .catch(() => setUploads([]));
  }, [user]);

  async function start() {
    setSong(null);
    setMsg("");
    cancelled.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false },
      });
    } catch {
      setPhase("error");
      setMsg("Microphone access was blocked. Allow it in your browser settings to identify songs.");
      return;
    }
    setPhase("listening");
    setLeft(SECONDS);
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const data = new Uint8Array(an.fftSize);
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      if (c) {
        const g = c.getContext("2d")!;
        an.getByteTimeDomainData(data);
        g.clearRect(0, 0, c.width, c.height);
        g.strokeStyle = getComputedStyle(c).color;
        g.lineWidth = 3;
        g.beginPath();
        data.forEach((v, i) => {
          const x = (i / data.length) * c.width;
          const y = (v / 255) * c.height;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        });
        g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const timer = setInterval(() => setLeft((l) => l - 1), 1000);
    const cleanup = () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
    };
    stopRef.current = () => {
      cancelled.current = true;
      if (rec.state !== "inactive") rec.stop();
      cleanup();
    };
    rec.onstop = async () => {
      cleanup();
      if (cancelled.current) {
        setPhase("idle");
        return;
      }
      setPhase("searching");
      const blob = new Blob(chunks, { type: rec.mimeType });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000)
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const r = await recognizeSong({
        data: { audioBase64: btoa(bin), mime: rec.mimeType },
      }).catch(() => ({ status: "error" as const, message: "Network error" }));
      if (r.status === "match") {
        setSong(r.song);
        void addToHistory(r.song);
      }
      if (r.status === "error") setMsg(r.message);
      setPhase(r.status);
    };
    rec.start();
    setTimeout(() => rec.state === "recording" && rec.stop(), SECONDS * 1000);
  }

  function clearClip() {
    player.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    decoded.current = null;
    setClipUrl("");
    setClipTitle("");
    setClipDuration(0);
    setClipTime(0);
    setClipPlaying(false);
  }

  async function openBlob(blob: Blob, title: string) {
    setClipError("");
    setSong(null);
    setPhase("idle");
    setClipBusy("reading");
    try {
      const buffer = await blob.arrayBuffer();
      const audio = await decodeAudioBuffer(buffer);
      clearClip();
      decoded.current = audio;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setClipUrl(url);
      setClipTitle(title);
      setClipDuration(audio.duration);
      setClipTime(0);
    } catch (e) {
      setClipError(e instanceof Error ? e.message : "This audio file could not be read.");
    } finally {
      setClipBusy("");
    }
  }

  async function openFile(file: File) {
    await openBlob(file, file.name.replace(/\.[^.]+$/, "") || "Your song");
  }

  async function openUploaded(uploaded: UploadedSong) {
    setClipError("");
    setClipBusy("loading");
    try {
      const url = await uploadedSongUrl(uploaded);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Couldn't open this song. Please try again.");
      await openBlob(await response.blob(), uploaded.title);
    } catch (e) {
      setClipError(e instanceof Error ? e.message : "Couldn't open this song. Please try again.");
    } finally {
      setClipBusy("");
    }
  }

  async function togglePreview() {
    const element = player.current;
    if (!element) return;
    if (element.paused) await element.play().catch(() => setClipError("Your browser couldn't play this file."));
    else element.pause();
  }

  async function identifyClip() {
    const audio = decoded.current;
    if (!audio) return;
    const start = clipStart(audio.duration, player.current?.currentTime ?? clipTime);
    setSong(null);
    setMsg("");
    setPhase("searching");
    const r = await recognizeSong({
      data: { audioBase64: encodeClipBase64(audio, start), mime: "audio/wav" },
    }).catch(() => ({ status: "error" as const, message: "Network error" }));
    if (r.status === "match") {
      setSong(r.song);
      void addToHistory(r.song);
    }
    if (r.status === "error") setMsg(r.message);
    setPhase(r.status);
  }

  const label: Record<Phase, string> = {
    idle: "Tap to identify",
    listening: `Listening… ${Math.max(left, 0)}s`,
    searching: "Searching music database…",
    match: "Song identified!",
    no_match: "No match found. Try again closer to the speaker.",
    not_configured: "Song recognition needs a provider key before it can run.",
    limit: "You've used today's 3 free uses.",
    error: msg || "Something went wrong. Try again.",
  };
  const busy = phase === "listening" || phase === "searching";
  const signedOut = ready && !user;
  const listenFrom = clipStart(clipDuration, clipTime);
  const clipHint =
    phase === "no_match"
      ? "No match found for that part. Try a busier section, like the chorus."
      : label[phase];

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">SONG FINDER</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Identify music playing around you, or load one of your own songs and identify it from any
        part of it.
      </p>

      <div className="mt-6 flex justify-center">
        <div className="inline-flex w-full max-w-md rounded-full border p-1">
          <button
            onClick={() => setMode("mic")}
            aria-pressed={mode === "mic"}
            className={`flex-1 rounded-full px-4 py-2 font-display text-xs tracking-wider transition ${mode === "mic" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            MICROPHONE
          </button>
          <button
            onClick={() => setMode("clip")}
            aria-pressed={mode === "clip"}
            className={`flex-1 rounded-full px-4 py-2 font-display text-xs tracking-wider transition ${mode === "clip" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            FROM YOUR MUSIC
          </button>
        </div>
      </div>

      {mode === "mic" ? (
        <div className="mt-10 flex flex-col items-center">
          <div className="relative">
            {phase === "listening" && (
              <span className="absolute inset-0 rounded-full bg-primary animate-pulse-ring" />
            )}
            <button
              onClick={busy ? () => stopRef.current() : start}
              disabled={phase === "searching" || signedOut}
              aria-label={busy ? "Stop listening" : "Start listening"}
              className="relative grid h-40 w-40 place-items-center rounded-full bg-primary text-primary-foreground shadow-neon transition active:scale-95 disabled:opacity-70"
            >
              {busy ? <Square className="h-12 w-12" /> : <Mic className="h-16 w-16" />}
            </button>
          </div>
          <canvas
            ref={canvas}
            width={600}
            height={100}
            className={`mt-6 h-20 w-full max-w-md text-primary ${phase === "listening" ? "" : "opacity-20"}`}
          />
          <p className="mt-2 text-center font-display text-sm tracking-wider">
            {signedOut ? "Sign in to identify songs — 3 free a day" : label[phase]}
          </p>
          {signedOut && (
            <Link
              to="/auth"
              className="mt-3 rounded-full bg-primary px-5 py-2 font-display text-xs tracking-wider text-primary-foreground"
            >
              SIGN IN FREE
            </Link>
          )}
          {phase === "limit" && <UpgradeNotice />}
        </div>
      ) : (
        <div className="mt-8">
          {signedOut ? (
            <div className="panel flex flex-col items-center gap-3 p-8 text-center">
              <Library className="h-8 w-8 text-primary" />
              <p className="font-display text-sm tracking-wider">
                SIGN IN TO IDENTIFY YOUR OWN MUSIC
              </p>
              <p className="text-xs text-muted-foreground">
                Your uploads are private to your account, so identification needs you signed in.
              </p>
              <Link
                to="/auth"
                className="rounded-full bg-primary px-5 py-2 font-display text-xs tracking-wider text-primary-foreground"
              >
                SIGN IN FREE
              </Link>
            </div>
          ) : clipUrl ? (
            <div className="panel p-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void togglePreview()}
                  aria-label={clipPlaying ? `Pause ${clipTitle}` : `Play ${clipTitle}`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                >
                  {clipPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <div className="min-w-0">
                  <div className="truncate font-bold">{clipTitle}</div>
                  <div className="text-xs text-muted-foreground">
                    Playing your song — pause where you want the listen to start
                  </div>
                </div>
                <button
                  onClick={clearClip}
                  className="ml-auto shrink-0 rounded-md border px-3 py-1.5 text-xs hover:border-primary"
                >
                  Choose another
                </button>
              </div>

              <audio
                ref={player}
                src={clipUrl}
                onPlay={() => setClipPlaying(true)}
                onPause={() => setClipPlaying(false)}
                onEnded={() => setClipPlaying(false)}
                onTimeUpdate={(e) => setClipTime(e.currentTarget.currentTime)}
                onError={() =>
                  setClipError("Your browser couldn't play this file. Try an MP3 or WAV file.")
                }
              />

              <div className="mt-3 flex items-center gap-3">
                <span className="w-10 font-mono text-[11px] text-muted-foreground">
                  {formatTime(clipTime)}
                </span>
                <input
                  aria-label="Song position"
                  type="range"
                  min={0}
                  max={clipDuration || 0}
                  step={0.1}
                  value={Math.min(clipTime, clipDuration || 0)}
                  onChange={(e) => {
                    if (player.current) player.current.currentTime = +e.target.value;
                    setClipTime(+e.target.value);
                  }}
                  className="flex-1 accent-primary"
                />
                <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
                  {formatTime(clipDuration)}
                </span>
              </div>

              <button
                onClick={() => void identifyClip()}
                disabled={phase === "searching"}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-display text-xs tracking-wider text-primary-foreground disabled:opacity-70"
              >
                {phase === "searching" ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" /> SEARCHING…
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" /> IDENTIFY THE {IDENTIFY_CLIP_SECONDS} SECONDS FROM{" "}
                    {formatTime(listenFrom)}
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Uses one of your 3 free daily uses. Nothing is stored.
              </p>
            </div>
          ) : (
            <div className="panel p-5">
              <label
                className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center transition ${clipBusy ? "pointer-events-none opacity-70" : ""}`}
              >
                {clipBusy ? (
                  <LoaderCircle className="h-9 w-9 animate-spin text-primary" />
                ) : (
                  <Upload className="h-9 w-9 text-primary" />
                )}
                <span className="font-display tracking-wider">
                  {clipBusy === "loading"
                    ? "OPENING YOUR SONG…"
                    : clipBusy === "reading"
                      ? "READING YOUR SONG…"
                      : "CHOOSE A SONG FROM YOUR DEVICE"}
                </span>
                <span className="text-xs text-muted-foreground">
                  MP3 · WAV · M4A · AAC · OGG · FLAC · WebM
                </span>
                <input
                  type="file"
                  accept={MUSIC_ACCEPT}
                  className="hidden"
                  disabled={!!clipBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void openFile(file);
                  }}
                />
              </label>

              {uploads.length > 0 && (
                <div className="mt-5">
                  <h2 className="font-display text-xs tracking-wider text-primary">
                    OR PICK FROM MY MUSIC
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {uploads.map((uploaded) => (
                      <li key={uploaded.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <FileAudio className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">{uploaded.title}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {(uploaded.size_bytes / 1024 / 1024).toFixed(1)} MB
                          </div>
                        </div>
                        <button
                          onClick={() => void openUploaded(uploaded)}
                          disabled={!!clipBusy}
                          className="shrink-0 rounded-full border px-3 py-1.5 text-xs hover:border-primary disabled:opacity-60"
                        >
                          {clipBusy === "loading" ? "Opening…" : "Identify"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {uploads.length === 0 && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Songs you upload in{" "}
                  <Link to="/library" className="text-primary">
                    My Music Library
                  </Link>{" "}
                  show up here too.
                </p>
              )}
            </div>
          )}

          {clipError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {clipError}
            </p>
          )}
          {(phase === "not_configured" || phase === "error" || phase === "no_match") && (
            <p className="mt-3 text-center text-sm text-muted-foreground">{clipHint}</p>
          )}
          {phase === "limit" && <UpgradeNotice />}
        </div>
      )}

      {song && (
        <div className="panel mx-auto mt-8 flex max-w-lg flex-col gap-4 p-5 sm:flex-row">
          {song.artwork && (
            <img
              src={song.artwork}
              alt={`${song.album ?? song.title} cover`}
              className="h-36 w-36 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{song.title}</h2>
            <p className="text-primary">{song.artist}</p>
            <dl className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              {song.album && <div>Album: {song.album}</div>}
              {song.releaseDate && <div>Released: {song.releaseDate}</div>}
              {song.genres?.length ? <div>Genre: {song.genres.join(", ")}</div> : null}
              {song.durationMs && (
                <div>
                  Length: {Math.floor(song.durationMs / 60000)}:
                  {String(Math.round(song.durationMs / 1000) % 60).padStart(2, "0")}
                </div>
              )}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {song.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:border-primary"
                >
                  {l.label} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
            <Link
              to="/analyze"
              className="mt-4 inline-block rounded-md bg-spectrum px-4 py-2 text-sm font-bold text-accent-foreground"
            >
              ANALYZE THIS SONG
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">Upload a copy you own to analyze it.</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
