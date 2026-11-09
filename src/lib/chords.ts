// Chord and song-section estimation from frame chroma. Pure math, SSR-safe.
import { NOTE_NAMES, fftMag } from "./audio-analysis";

export type ChordSeg = { start: number; end: number; chord: string };
export type Section = { start: number; end: number; label: string };

/** 24 major/minor triad templates. */
export const CHORDS = NOTE_NAMES.flatMap((n, r) => [
  { name: n, tpl: tpl([r, r + 4, r + 7]) },
  { name: `${n}m`, tpl: tpl([r, r + 3, r + 7]) },
]);
function tpl(notes: number[]) {
  const t = new Array(12).fill(0);
  notes.forEach((x) => (t[x % 12] = 1));
  return t;
}

/** Chroma per frame; returns frames and seconds per frame. */
export function frameChroma(samples: Float32Array, sampleRate: number, hopSec = 0.25) {
  const N = 4096;
  const hop = Math.max(1, Math.floor(sampleRate * hopSec));
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const frames: number[][] = [];
  const energy: number[] = [];
  for (let s = 0; s + N <= samples.length; s += hop) {
    const f = new Float32Array(N);
    let e = 0;
    for (let i = 0; i < N; i++) { const v = samples[s + i]; f[i] = v * win[i]; e += v * v; }
    const mag = fftMag(f);
    const c = new Array(12).fill(0);
    for (let k = 1; k < mag.length; k++) {
      const hz = (k * sampleRate) / N;
      if (hz < 65 || hz > 2100) continue;
      const m = Math.round(69 + 12 * Math.log2(hz / 440));
      c[((m % 12) + 12) % 12] += mag[k];
    }
    const mx = Math.max(...c);
    frames.push(mx > 0 ? c.map((v) => v / mx) : c);
    energy.push(Math.sqrt(e / N));
  }
  return { frames, energy, secPerFrame: hop / sampleRate };
}

export function matchChord(c: number[]): { name: string; score: number } {
  let best = { name: "N", score: -Infinity };
  const total = c.reduce((a, b) => a + b, 0);
  if (total < 1e-6) return { name: "N", score: 0 };
  for (const ch of CHORDS) {
    let inside = 0;
    for (let i = 0; i < 12; i++) if (ch.tpl[i]) inside += c[i];
    const score = inside / 3 - (total - inside) / 9;
    if (score > best.score) best = { name: ch.name, score };
  }
  return best;
}

/** Chord timeline with median-style smoothing and merging of short segments. */
export function detectChords(frames: number[][], energy: number[], secPerFrame: number, minSec = 0.75): ChordSeg[] {
  const peak = Math.max(...energy, 1e-9);
  const labels = frames.map((_, i) => {
    if (energy[i] < peak * 0.02) return "N";
    // average chroma over a ~1s window for stability
    const avg = new Array(12).fill(0);
    let n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(frames.length - 1, i + 2); j++, n++) for (let k = 0; k < 12; k++) avg[k] += frames[j][k];
    return matchChord(avg.map((v) => v / n)).name;
  });
  const segs: ChordSeg[] = [];
  labels.forEach((l, i) => {
    const last = segs[segs.length - 1];
    if (last && last.chord === l) last.end = (i + 1) * secPerFrame;
    else segs.push({ start: i * secPerFrame, end: (i + 1) * secPerFrame, chord: l });
  });
  // absorb short blips into the previous segment
  const out: ChordSeg[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && (s.end - s.start < minSec || last.chord === s.chord)) last.end = s.end;
    else out.push({ ...s });
  }
  // a short leading segment merges forward
  if (out.length > 1 && out[0].end - out[0].start < minSec) { out[1].start = 0; out.shift(); }
  return out;
}

function cos(a: number[], b: number[]) {
  let d = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return d / Math.sqrt(x * y || 1);
}

/** Song sections via novelty on block features, labelled A/B/C by similarity. */
export function detectSections(frames: number[][], energy: number[], secPerFrame: number, blockSec = 4): Section[] {
  const per = Math.max(1, Math.round(blockSec / secPerFrame));
  const peak = Math.max(...energy, 1e-9);
  const blocks: number[][] = [];
  for (let s = 0; s < frames.length; s += per) {
    const f = new Array(13).fill(0);
    const e = Math.min(frames.length, s + per);
    for (let i = s; i < e; i++) { for (let k = 0; k < 12; k++) f[k] += frames[i][k]; f[12] += (energy[i] / peak) * 6; }
    blocks.push(f.map((v) => v / (e - s)));
  }
  if (blocks.length < 3) return [{ start: 0, end: frames.length * secPerFrame, label: "A" }];
  const nov = blocks.map((b, i) => (i === 0 ? 0 : 1 - cos(blocks[i - 1], b)));
  const mean = nov.reduce((a, b) => a + b, 0) / nov.length;
  const sd = Math.sqrt(nov.reduce((a, b) => a + (b - mean) ** 2, 0) / nov.length);
  const cuts = [0];
  for (let i = 1; i < blocks.length; i++) {
    const isPeak = nov[i] >= (nov[i - 1] ?? 0) && nov[i] >= (nov[i + 1] ?? 0);
    if (isPeak && nov[i] > mean + 0.5 * sd && i - cuts[cuts.length - 1] >= 2) cuts.push(i);
  }
  cuts.push(blocks.length);
  const groups: { avg: number[]; label: string }[] = [];
  const out: Section[] = [];
  for (let c = 0; c < cuts.length - 1; c++) {
    const avg = new Array(13).fill(0);
    for (let i = cuts[c]; i < cuts[c + 1]; i++) for (let k = 0; k < 13; k++) avg[k] += blocks[i][k] / (cuts[c + 1] - cuts[c]);
    let g = groups.find((x) => cos(x.avg, avg) > 0.97);
    if (!g) { g = { avg, label: String.fromCharCode(65 + Math.min(groups.length, 25)) }; groups.push(g); }
    out.push({ start: cuts[c] * per * secPerFrame, end: Math.min(frames.length, cuts[c + 1] * per) * secPerFrame, label: g.label });
  }
  return out;
}

/** Most common chords by total duration. */
export function chordSummary(segs: ChordSeg[], top = 6) {
  const m = new Map<string, number>();
  segs.forEach((s) => s.chord !== "N" && m.set(s.chord, (m.get(s.chord) ?? 0) + s.end - s.start));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([chord]) => chord);
}
