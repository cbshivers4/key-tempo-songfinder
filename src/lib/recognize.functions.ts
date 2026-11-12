import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RecognizedSong = {
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  artwork?: string;
  durationMs?: number;
  genres?: string[];
  links: { label: string; url: string }[];
  provider: string;
};

export type RecognizeResult =
  | { status: "match"; song: RecognizedSong }
  | { status: "no_match" }
  | { status: "not_configured" }
  | { status: "limit" }
  | { status: "error"; message: string };

// Provider layer: add more providers (ACRCloud, etc.) here and pick by available secret.
async function recognizeWithAudD(token: string, audio: Blob): Promise<RecognizeResult> {
  const form = new FormData();
  form.append("api_token", token);
  form.append("file", audio, "sample.webm");
  form.append("return", "apple_music,spotify");
  const res = await fetch("https://api.audd.io/", { method: "POST", body: form });
  const json = (await res.json()) as any;
  if (json.status !== "success") return { status: "error", message: json.error?.error_message ?? "Recognition failed" };
  const r = json.result;
  if (!r) return { status: "no_match" };
  const links: { label: string; url: string }[] = [];
  if (r.song_link) links.push({ label: "All platforms", url: r.song_link });
  if (r.spotify?.external_urls?.spotify) links.push({ label: "Spotify", url: r.spotify.external_urls.spotify });
  if (r.apple_music?.url) links.push({ label: "Apple Music", url: r.apple_music.url });
  return {
    status: "match",
    song: {
      title: r.title,
      artist: r.artist,
      album: r.album,
      releaseDate: r.release_date,
      artwork:
        r.apple_music?.artwork?.url?.replace("{w}", "600").replace("{h}", "600") ??
        r.spotify?.album?.images?.[0]?.url,
      durationMs: r.spotify?.duration_ms ?? r.apple_music?.durationInMillis,
      genres: r.apple_music?.genreNames,
      links,
      provider: "AudD",
    },
  };
}

// Signed-in only: each identification uses one free daily use unless subscribed (enforced in the database).
export const recognizeSong = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { audioBase64: string; mime: string }) => {
    if (typeof d?.audioBase64 !== "string" || d.audioBase64.length > 8_000_000) throw new Error("Invalid audio");
    return d;
  })
  .handler(async ({ data, context }): Promise<RecognizeResult> => {
    const token = process.env["AUDD_API_TOKEN"];
    if (!token) return { status: "not_configured" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildPaymentsEnv } = await import("@/lib/payments-env");
    const { data: remaining, error } = await supabaseAdmin.rpc("consume_use_for", { _user: context.userId, check_env: buildPaymentsEnv() });
    if (error) return { status: "error", message: "Couldn't check your plan" };
    if (remaining === null) return { status: "limit" };
    try {
      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return await recognizeWithAudD(token, new Blob([bytes], { type: data.mime || "audio/webm" }));
    } catch (e) {
      console.error(e);
      return { status: "error", message: "Recognition service unavailable" };
    }
  });
