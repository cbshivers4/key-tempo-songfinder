import { encodeWav } from "@/lib/music-files";

/** How many seconds the recognizer listens to when identifying a saved or picked song. */
export const IDENTIFY_CLIP_SECONDS = 12;
const IDENTIFY_SAMPLE_RATE = 22050;

/** Where a 12-second listen should start, never past the point where 12 seconds would run off the end. */
export function clipStart(duration: number, requested: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const window = Math.min(IDENTIFY_CLIP_SECONDS, duration);
  const max = Math.max(0, duration - window);
  const value = Number.isFinite(requested) ? requested : 0;
  return Math.min(Math.max(0, value), max);
}

/** Decode in a user gesture only: AudioContext is never touched at import time. */
export async function decodeAudioBuffer(source: ArrayBuffer): Promise<AudioBuffer> {
  const context = new AudioContext({ sampleRate: IDENTIFY_SAMPLE_RATE });
  try {
    const decoded = await context.decodeAudioData(source.slice(0));
    if (decoded.duration < 0.2) throw new Error("This song is too short to identify.");
    return decoded;
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("This audio file could not be read. Try an MP3 or WAV file.");
  } finally {
    await context.close();
  }
}

/** Downmix the chosen window to mono WAV and base64 it for the recognizer. */
export function encodeClipBase64(
  decoded: AudioBuffer,
  startSeconds: number,
  seconds = IDENTIFY_CLIP_SECONDS,
): string {
  const sampleRate = decoded.sampleRate;
  const from = Math.floor(clipStart(decoded.duration, startSeconds) * sampleRate);
  const to = Math.min(decoded.length, from + Math.floor(seconds * sampleRate));
  const frames = Math.max(0, to - from);
  const mono = new Float32Array(frames);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const samples = decoded.getChannelData(channel);
    for (let i = 0; i < frames; i++) mono[i] = (mono[i] ?? 0) + (samples[from + i] ?? 0) / decoded.numberOfChannels;
  }
  const bytes = new Uint8Array(encodeWav([mono], sampleRate));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
