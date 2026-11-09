// @ts-nocheck -- tight numeric DSP loops; array indexes are bounds-checked by loop limits (covered by audio-analysis.test.ts)
// Real client-side signal analysis: tempo (onset autocorrelation), key (chroma + Krumhansl profiles).

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export function noteFrequency(name: string, octave: number) {
  const midi = NOTE_NAMES.indexOf(name) + (octave + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function pearson(a: number[], b: number[]) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db || 1);
}

export function detectKey(chroma: number[]) {
  const results: { key: string; mode: "major" | "minor"; score: number }[] = [];
  for (let t = 0; t < 12; t++) {
    const rot = chroma.map((_, i) => chroma[(i + t) % 12]);
    results.push({ key: NOTE_NAMES[t], mode: "major", score: pearson(rot, MAJOR) });
    results.push({ key: NOTE_NAMES[t], mode: "minor", score: pearson(rot, MINOR) });
  }
  results.sort((a, b) => b.score - a.score);
  const best = results[0];
  const margin = best.score - results[1].score;
  return { ...best, confidence: Math.max(0, Math.min(1, best.score * 0.6 + margin * 4)), alternates: results.slice(1, 4) };
}

export function fftMag(re: Float32Array): Float32Array {
  const n = re.length;
  const im = new Float32Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(ang * k), s = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  const mag = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

export function computeChroma(samples: Float32Array, sampleRate: number, maxFrames = 400) {
  const N = 8192;
  const chroma = new Array(12).fill(0);
  const hop = Math.max(N, Math.floor((samples.length - N) / maxFrames));
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  for (let start = 0; start + N <= samples.length; start += hop) {
    const frame = new Float32Array(N);
    for (let i = 0; i < N; i++) frame[i] = samples[start + i] * win[i];
    const mag = fftMag(frame);
    for (let k = 1; k < mag.length; k++) {
      const f = (k * sampleRate) / N;
      if (f < 55 || f > 2000) continue;
      const midi = Math.round(69 + 12 * Math.log2(f / 440));
      chroma[((midi % 12) + 12) % 12] += mag[k] * mag[k];
    }
  }
  const max = Math.max(...chroma) || 1;
  return chroma.map((v) => v / max);
}

export function detectTempo(samples: Float32Array, sampleRate: number) {
  const hop = 512;
  const frames = Math.floor(samples.length / hop);
  const env = new Float32Array(frames);
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = 0; i < hop; i++) { const v = samples[f * hop + i]; e += v * v; }
    e = Math.log(1e-6 + e);
    env[f] = Math.max(0, e - prev);
    prev = e;
  }
  // smooth onset envelope so frame-quantized onsets still align at fractional lags
  const sm = new Float32Array(frames);
  for (let i = 0; i < frames; i++) sm[i] = 0.25 * (env[i - 1] ?? 0) + 0.5 * env[i] + 0.25 * (env[i + 1] ?? 0);
  env.set(sm);
  const fps = sampleRate / hop;
  const scores: { bpm: number; s: number }[] = [];
  for (let bpm = 60; bpm <= 200; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    const l0 = Math.floor(lag), fr = lag - l0;
    let s = 0;
    // comb over 4 beat multiples sharpens the peak around the true period
    for (let m = 1; m <= 4; m++) {
      const L = lag * m, a = Math.floor(L), r = L - a;
      let acc = 0;
      for (let i = 0; i + a + 1 < frames; i++) acc += env[i] * (env[i + a] * (1 - r) + env[i + a + 1] * r);
      s += acc / Math.max(1, frames - a);
    }
    void l0; void fr;
    // mild prior toward 120 BPM to resolve octave errors
    const w = Math.exp(-0.5 * Math.log2(bpm / 120) ** 2 / 0.6);
    scores.push({ bpm, s: s * w });
  }
  scores.sort((a, b) => b.s - a.s);
  const best = scores[0];
  const mean = scores.reduce((t, x) => t + x.s, 0) / scores.length;
  return { bpm: Math.round(best.bpm * 10) / 10, confidence: Math.max(0, Math.min(1, (best.s / (mean || 1) - 1) / 2)) };
}

export function waveformPeaks(samples: Float32Array, bars = 600) {
  const size = Math.floor(samples.length / bars) || 1;
  const out: number[] = [];
  for (let b = 0; b < bars; b++) {
    let m = 0;
    for (let i = b * size; i < (b + 1) * size && i < samples.length; i++) m = Math.max(m, Math.abs(samples[i]));
    out.push(m);
  }
  return out;
}

export function loudness(samples: Float32Array) {
  let s = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) { s += samples[i] ** 2; peak = Math.max(peak, Math.abs(samples[i])); }
  const rms = Math.sqrt(s / samples.length);
  return { rmsDb: 20 * Math.log10(rms || 1e-9), peakDb: 20 * Math.log10(peak || 1e-9) };
}

export function toMono(buf: AudioBuffer) {
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}
