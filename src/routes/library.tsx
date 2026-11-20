import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FileAudio,
  Heart,
  LoaderCircle,
  Pause,
  Play,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { loadHistory, removeFromHistory, setFavorite, type HistoryEntry } from "@/lib/history";
import {
  deleteUploadedSong,
  favoriteUploadedSong,
  loadUploadedSongs,
  MUSIC_ACCEPT,
  uploadedSongUrl,
  uploadMusic,
  type UploadedSong,
} from "@/lib/my-music";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "My Music Library — Song Analyzer" },
      {
        name: "description",
        content: "Upload and play your own music, and revisit identified songs and favorites.",
      },
      { property: "og:title", content: "My Music Library — Song Analyzer" },
      {
        property: "og:description",
        content: "Your private music uploads, identified songs and favorites.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

const formatTime = (seconds: number) =>
  Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
    : "0:00";

function LibraryPage() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [uploads, setUploads] = useState<UploadedSong[]>([]);
  const [q, setQ] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [drag, setDrag] = useState(false);
  const [openingId, setOpeningId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [activeId, setActiveId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const { user, ready } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!ready) return;
    loadHistory()
      .then(setItems)
      .catch(() => setItems([]));
    if (userId)
      loadUploadedSongs()
        .then(setUploads)
        .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your music."));
    else setUploads([]);
  }, [ready, userId]);

  useEffect(() => () => audio.current?.pause(), []);

  const activeSong = uploads.find((song) => song.id === activeId);
  const matches = (title: string, artist: string, favorite: boolean) =>
    (!favOnly || favorite) && `${title} ${artist}`.toLowerCase().includes(q.toLowerCase());
  const shownUploads = uploads.filter((song) => matches(song.title, song.artist, song.favorite));
  const shownItems = items.filter((song) => matches(song.title, song.artist, !!song.favorite));

  async function addFiles(files: File[]) {
    if (!user) {
      setError("Sign in to upload music and keep it in your library.");
      return;
    }
    if (!files.length) return;
    setError("");
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      setUploadProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
      try {
        const song = await uploadMusic(file);
        setUploads((current) => [song, ...current]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't upload this song. Please try again.");
      }
    }
    setUploadProgress("");
  }

  async function togglePlayback(song: UploadedSong) {
    const player = audio.current;
    if (!player) return;
    setError("");
    if (activeId === song.id) {
      if (player.paused)
        await player.play().catch(() => setError("Your browser couldn't play this file."));
      else player.pause();
      return;
    }
    setOpeningId(song.id);
    try {
      const url = await uploadedSongUrl(song);
      player.src = url;
      setActiveId(song.id);
      setCurrentTime(0);
      await player.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open this song. Please try again.");
    } finally {
      setOpeningId("");
    }
  }

  async function toggleUploadFavorite(song: UploadedSong) {
    const favorite = !song.favorite;
    setUploads((current) =>
      current.map((item) => (item.id === song.id ? { ...item, favorite } : item)),
    );
    try {
      await favoriteUploadedSong(song.id, favorite);
    } catch (e) {
      setUploads((current) => current.map((item) => (item.id === song.id ? song : item)));
      setError(e instanceof Error ? e.message : "Couldn't update this favorite.");
    }
  }

  async function removeUpload(song: UploadedSong) {
    setDeletingId(song.id);
    setError("");
    try {
      await deleteUploadedSong(song);
      if (activeId === song.id) {
        audio.current?.pause();
        audio.current?.removeAttribute("src");
        setActiveId("");
        setCurrentTime(0);
        setDuration(0);
      }
      setUploads((current) => current.filter((item) => item.id !== song.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this song.");
    } finally {
      setDeletingId("");
    }
  }

  const toggleFav = (song: HistoryEntry) => {
    setItems(
      items.map((item) => (item.id === song.id ? { ...item, favorite: !item.favorite } : item)),
    );
    void setFavorite(song.id, !song.favorite);
  };
  const remove = (song: HistoryEntry) => {
    setItems(items.filter((item) => item.id !== song.id));
    void removeFromHistory(song.id);
  };

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold tracking-wider text-chrome">
        MY MUSIC LIBRARY
      </h1>
      {ready &&
        (user ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Your music and identified songs are saved to your account ({user.email}).
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Identified songs are saved on this device.{" "}
            <Link to="/auth" className="text-primary">
              Sign in
            </Link>{" "}
            to upload and keep your own music everywhere.
          </p>
        ))}

      <section className="mt-6" aria-labelledby="my-music-heading">
        <h2 id="my-music-heading" className="font-display text-sm tracking-wider text-primary">
          MY MUSIC
        </h2>
        {user ? (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void addFiles(Array.from(e.dataTransfer.files));
            }}
            className={`panel mt-3 flex cursor-pointer flex-col items-center gap-3 border-dashed p-8 text-center transition ${drag ? "shadow-neon" : ""} ${uploadProgress ? "pointer-events-none opacity-70" : ""}`}
          >
            {uploadProgress ? (
              <LoaderCircle className="h-9 w-9 animate-spin text-primary" />
            ) : (
              <Upload className="h-9 w-9 text-primary" />
            )}
            <span className="font-display tracking-wider">
              {uploadProgress || "DROP OR CHOOSE YOUR MUSIC"}
            </span>
            <span className="text-xs text-muted-foreground">
              MP3 · WAV · M4A · AAC · OGG · FLAC · WebM — up to 50 MB each
            </span>
            <span className="text-[11px] text-muted-foreground">
              Private to your account. Uploading and listening don't use your daily analyses.
            </span>
            <input
              type="file"
              accept={MUSIC_ACCEPT}
              multiple
              className="hidden"
              disabled={!!uploadProgress}
              onChange={(e) => {
                void addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <Link
            to="/auth"
            className="panel mt-3 flex items-center justify-center gap-3 border-dashed p-8 text-center font-display text-sm tracking-wider text-primary"
          >
            <Upload className="h-5 w-5" /> SIGN IN TO UPLOAD YOUR MUSIC
          </Link>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <audio
          ref={audio}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={() => {
            if (activeId) setError("Your browser couldn't play this file. Try an MP3 or WAV file.");
          }}
        />
        {activeSong && (
          <div className="panel mt-4 p-4">
            <div className="flex items-center gap-3">
              <button
                aria-label={playing ? `Pause ${activeSong.title}` : `Play ${activeSong.title}`}
                onClick={() => void togglePlayback(activeSong)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <div className="truncate font-bold">{activeSong.title}</div>
                <div className="text-xs text-muted-foreground">Now playing from your library</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="w-10 font-mono text-[11px] text-muted-foreground">
                {formatTime(currentTime)}
              </span>
              <input
                aria-label="Song position"
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(e) => {
                  if (audio.current) audio.current.currentTime = +e.target.value;
                }}
                className="flex-1 accent-primary"
              />
              <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        )}

        {shownUploads.length > 0 && (
          <ul className="mt-4 space-y-3">
            {shownUploads.map((song) => (
              <li key={song.id} className="panel flex items-center gap-3 p-3">
                <button
                  aria-label={
                    activeId === song.id && playing ? `Pause ${song.title}` : `Play ${song.title}`
                  }
                  onClick={() => void togglePlayback(song)}
                  disabled={openingId === song.id}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-primary"
                >
                  {openingId === song.id ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : activeId === song.id && playing ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{song.title}</div>
                  <div className="truncate text-sm text-primary">{song.artist}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {(song.size_bytes / 1024 / 1024).toFixed(1)} MB · Uploaded{" "}
                    {new Date(song.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  aria-label={`Favorite ${song.title}`}
                  onClick={() => void toggleUploadFavorite(song)}
                  className="p-2"
                >
                  <Heart
                    className={`h-4 w-4 ${song.favorite ? "fill-primary text-primary" : ""}`}
                  />
                </button>
                <button
                  aria-label={`Delete ${song.title}`}
                  onClick={() => void removeUpload(song)}
                  disabled={deletingId === song.id}
                  className="p-2 text-muted-foreground"
                >
                  {deletingId === song.id ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {user && !uploadProgress && uploads.length === 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Your uploaded songs will appear here, ready to play whenever you return.
          </p>
        )}
      </section>

      <div className="mt-8 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your music"
            aria-label="Search your music"
            className="h-11 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button
          onClick={() => setFavOnly(!favOnly)}
          className={`rounded-lg border px-3 text-sm ${favOnly ? "border-primary text-primary" : ""}`}
        >
          Favorites
        </button>
      </div>

      <section className="mt-8" aria-labelledby="identified-heading">
        <h2 id="identified-heading" className="font-display text-sm tracking-wider text-primary">
          IDENTIFIED SONGS
        </h2>
        {shownItems.length === 0 ? (
          <div className="panel mt-3 flex flex-col items-center gap-2 p-8 text-center">
            <FileAudio className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No identified songs to show. Use Song Finder to add one.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {shownItems.map((song) => (
              <li key={song.id} className="panel flex items-center gap-3 p-3">
                {song.artwork ? (
                  <img
                    src={song.artwork}
                    alt=""
                    className="h-14 w-14 rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-14 w-14 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{song.title}</div>
                  <div className="truncate text-sm text-primary">{song.artist}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(song.identifiedAt).toLocaleString()}
                  </div>
                </div>
                {song.links[0] && (
                  <a
                    href={song.links[0].url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open in streaming"
                    className="p-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button aria-label="Favorite" onClick={() => toggleFav(song)} className="p-2">
                  <Heart
                    className={`h-4 w-4 ${song.favorite ? "fill-primary text-primary" : ""}`}
                  />
                </button>
                <button
                  aria-label="Remove"
                  onClick={() => remove(song)}
                  className="p-2 text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
