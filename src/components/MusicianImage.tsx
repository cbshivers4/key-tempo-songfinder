import { useState, type FormEvent } from "react";
import { Image as ImageIcon, LoaderCircle, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { UpgradeNotice } from "@/components/UpgradeNotice";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { streamImage } from "@/lib/stream-image";

export function MusicianImage() {
  const { user, ready } = useAuth();
  const [instrument, setInstrument] = useState("Electric guitar");
  const [shownInstrument, setShownInstrument] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFinal, setImageFinal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(false);

  async function generate(event: FormEvent) {
    event.preventDefault();
    const selected = instrument.trim();
    if (!selected || busy) return;
    if (!user) { setError("Sign in to generate a musician image."); return; }
    setBusy(true); setError(""); setLimit(false); setImageUrl(""); setImageFinal(false); setShownInstrument(selected);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setError("Your session expired. Sign in again."); return; }
      await streamImage("/api/musician-image", { instrument: selected }, (url, isFinal) => {
        setImageUrl(url); setImageFinal(isFinal);
      }, undefined, { Authorization: `Bearer ${data.session.access_token}` });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The musician image could not be generated.";
      if (message.includes("free_limit")) setLimit(true);
      else setError(message.replace(/^Image generation failed: \d+\s*/, "").trim());
    } finally { setBusy(false); }
  }

  return <section className="panel mt-6 p-5 md:p-6" aria-labelledby="musician-heading">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><ImageIcon className="h-5 w-5" /></span>
      <div>
        <h2 id="musician-heading" className="font-display text-sm tracking-wider text-chrome">INSTRUMENT IN FOCUS</h2>
        <p className="mt-1 text-xs text-muted-foreground">See an AI-generated musician playing the instrument you want to focus on.</p>
      </div>
    </div>
    <form onSubmit={(event) => void generate(event)} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="space-y-2 text-sm">Instrument to analyze
        <input value={instrument} onChange={(event) => setInstrument(event.target.value)} maxLength={60} required placeholder="e.g. electric guitar, drums, violin" className="block h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </label>
      <Button type="submit" disabled={!instrument.trim() || busy || !ready || !user} className="h-11 font-display text-xs tracking-wider">
        {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{busy ? "CREATING IMAGE…" : "SHOW MUSICIAN"}
      </Button>
    </form>
    {ready && !user && <p className="mt-3 text-sm text-muted-foreground"><Link to="/auth" className="text-primary underline">Sign in</Link> to generate a musician image — each image uses one of your 3 free daily uses.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {limit && <UpgradeNotice />}
    {busy && !imageUrl && <div className="mt-5 grid aspect-square w-full place-items-center rounded-xl border bg-background/40 text-center"><div><LoaderCircle className="mx-auto h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Creating your {shownInstrument.toLowerCase()} musician…</p></div></div>}
    {imageUrl && <div className="mt-5 overflow-hidden rounded-xl border bg-background">
      <img src={imageUrl} alt={`AI-generated musician playing ${shownInstrument}`} className={`aspect-square w-full object-cover transition-[filter] ${imageFinal ? "blur-0" : "blur-2xl"}`} />
      <p className="px-4 py-3 text-xs text-muted-foreground">{imageFinal ? "AI-generated visual reference — not a real performer or a guide to exact technique." : "Finishing the image…"}</p>
    </div>}
    <p className="mt-3 text-[11px] text-muted-foreground">Visual reference only: key, tempo, chords and loudness are still measured from the full song, not an isolated instrument.</p>
  </section>;
}
