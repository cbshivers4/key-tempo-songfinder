export type MelodyNote = { midi: number; start: number; duration: number; velocity: number };

export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const frames = channels[0]?.length ?? 0;
  const count = channels.length;
  const buffer = new ArrayBuffer(44 + frames * count * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, frames * count * 2, true);
  for (let i = 0; i < frames; i++) for (let c = 0; c < count; c++) {
    const sample = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
    view.setInt16(44 + (i * count + c) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}

export const noteName = (midi: number) => `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`;

export async function decodeMusic(file: File, sampleRate: number) {
  const ctx = new AudioContext({ sampleRate });
  try { return await ctx.decodeAudioData(await file.arrayBuffer()); }
  finally { await ctx.close(); }
}

export function downloadMusic(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}