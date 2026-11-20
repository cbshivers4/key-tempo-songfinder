import { encodeWav } from "@/lib/music-files";

export const STYLE_CLIP_SECONDS = 30;
const MAX_FILE_BYTES = 25_000_000;

/** Decode, trim and downmix in a user gesture; no audio objects exist at import time. */
export async function prepareStyleClip(file: File): Promise<string> {
  if (file.size === 0) throw new Error("Choose a non-empty audio file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Choose an audio file smaller than 25 MB.");
  const looksLikeAudio = file.type.startsWith("audio/") || /\.(wav|mp3|webm|m4a|ogg|aac|flac)$/i.test(file.name);
  if (!looksLikeAudio) throw new Error("Choose a WAV, MP3, M4A, OGG, AAC, FLAC or WebM audio file.");

  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration < 0.2) throw new Error("The clip is too short to analyze.");
    const sampleRate = decoded.sampleRate;
    const frames = Math.min(decoded.length, STYLE_CLIP_SECONDS * sampleRate);
    const mono = new Float32Array(frames);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const samples = decoded.getChannelData(channel);
      for (let i = 0; i < frames; i++) mono[i] = (mono[i] ?? 0) + (samples[i] ?? 0) / decoded.numberOfChannels;
    }
    const bytes = new Uint8Array(encodeWav([mono], sampleRate));
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("This audio file could not be read. Try a different clip.");
  } finally {
    await context.close();
  }
}
