// Vocoder engine + the pure band-analysis maths behind it.
// Nothing in this module touches the Web Audio API until VocoderEngine is constructed,
// and that only ever happens inside a user gesture (SSR-safe).

export const MIN_BANDS = 8;
export const MAX_BANDS = 32;
export const LOW_HZ = 80;
export const HIGH_HZ = 8000;

/** Band counts offered in the UI. */
export const BAND_STEPS = [8, 12, 16, 24, 32] as const;

export type CarrierType = "saw" | "square" | "sine" | "noise";

export type VocoderSettings = {
  bands: number;
  /** Band-pass resonance; higher = narrower, more "channelled". */
  q: number;
  /** Envelope follower time constant in milliseconds. */
  responseMs: number;
  /** Exponent applied to the rectified band envelope (hardness of the gate). */
  sharpness: number;
  carrier: CarrierType;
  /** Carrier pitch in Hz (harmonic spacing for tonal carriers). */
  baseHz: number;
  /** How far the modulator envelope opens each carrier band, 0..1. */
  depth: number;
  /** 0 = dry modulator only, 1 = vocoded output only. */
  mix: number;
  volume: number;
};

export const DEFAULT_SETTINGS: VocoderSettings = {
  bands: 16,
  q: 6,
  responseMs: 35,
  sharpness: 1.8,
  carrier: "saw",
  baseHz: 60,
  depth: 0.9,
  mix: 1,
  volume: 0.9,
};

export function clampBands(n: number): number {
  if (!Number.isFinite(n)) return MIN_BANDS;
  return Math.max(MIN_BANDS, Math.min(MAX_BANDS, Math.round(n)));
}

/** Log-spaced band centres, ascending, first = low and last = high. */
export function bandCenters(count = DEFAULT_SETTINGS.bands, low = LOW_HZ, high = HIGH_HZ): number[] {
  const n = clampBands(count);
  const ratio = high / low;
  return Array.from({ length: n }, (_, i) => low * Math.pow(ratio, i / (n - 1)));
}

/** Band boundaries: geometric midpoints between centres, extended one step past the ends. */
export function bandEdges(centers: number[]): number[] {
  const n = centers.length;
  if (n === 0) return [0, 0];
  const first = centers[0] ?? 0;
  if (n === 1) return [first / 2, first * 2];
  const e = new Array<number>(n + 1);
  const c0 = centers[0] ?? 0;
  const c1 = centers[1] ?? c0;
  e[0] = (c0 * c0) / c1;
  for (let i = 1; i < n; i++) e[i] = Math.sqrt((centers[i - 1] ?? 0) * (centers[i] ?? 0));
  const last = centers[n - 1] ?? 0;
  const prev = centers[n - 2] ?? last;
  e[n] = (last * last) / prev;
  return e;
}

/**
 * Energy per band from a magnitude spectrum, normalised so the loudest band is 1.
 * `spectrum` may be a Float32Array of magnitudes or the Uint8Array from getByteFrequencyData.
 */
export function bandLevels(spectrum: ArrayLike<number>, sampleRate: number, centers: number[]): number[] {
  const n = centers.length;
  if (!n || spectrum.length < 2) return new Array<number>(n).fill(0);
  const edges = bandEdges(centers);
  const binHz = sampleRate / 2 / spectrum.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, Math.floor(edges[i] / binHz));
    const hi = Math.min(spectrum.length - 1, Math.ceil(edges[i + 1] / binHz));
    let acc = 0, count = 0;
    for (let b = lo; b <= hi; b++) { const v = spectrum[b] ?? 0; acc += v * v; count++; }
    out[i] = count ? Math.sqrt(acc / count) : 0;
  }
  const max = Math.max(...out);
  return max > 0 ? out.map((v) => v / max) : out;
}

/** Amplitude-weighted mean frequency of a spectrum, in Hz. */
export function spectralCentroid(spectrum: ArrayLike<number>, sampleRate: number): number {
  if (spectrum.length < 2) return 0;
  const binHz = sampleRate / 2 / spectrum.length;
  let num = 0, den = 0;
  for (let i = 0; i < spectrum.length; i++) { const v = spectrum[i] ?? 0; num += v * i * binHz; den += v; }
  return den > 0 ? num / den : 0;
}

/** Sign changes per second — low for voiced/tonal audio, high for hiss and noise. */
export function zeroCrossingRate(samples: ArrayLike<number>, sampleRate: number): number {
  const n = samples.length;
  if (n < 2) return 0;
  let z = 0;
  for (let i = 1; i < n; i++) if (((samples[i] ?? 0) >= 0) !== ((samples[i - 1] ?? 0) >= 0)) z++;
  return (z * sampleRate) / (n - 1);
}

export function rms(samples: ArrayLike<number>): number {
  const n = samples.length;
  if (!n) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) { const v = samples[i] ?? 0; s += v * v; }
  return Math.sqrt(s / n);
}

/** WaveShaper curve for |x|^sharpness — the rectifier + hardness stage. */
export function envelopeCurve(sharpness: number, n = 1024): Float32Array {
  const c = new Float32Array(n);
  const p = Math.max(0.2, sharpness);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.pow(Math.abs(x), p);
  }
  return c;
}

/** One-pole smoothing filter cutoff for an envelope time constant, clamped to useful range. */
export function smoothingHz(responseMs: number): number {
  const ms = Math.max(0.05, responseMs);
  return Math.min(12000, Math.max(2, 1000 / (2 * Math.PI * ms)));
}

/** Soft-clip curve so heavy carrier levels stay listenable. */
export function softClipCurve(n = 2048): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * 1.8) / Math.tanh(1.8);
  }
  return c;
}

function oscillatorType(carrier: CarrierType): OscillatorType {
  return carrier === "saw" ? "sawtooth" : carrier === "square" ? "square" : "sine";
}

type BandNodes = {
  center: number;
  carrierFilter: BiquadFilterNode;
  carrierGain: GainNode;
  modFilter: BiquadFilterNode;
  rectifier: WaveShaperNode;
  smoother: BiquadFilterNode;
  depthGain: GainNode;
};

export class VocoderEngine {
  readonly ctx: AudioContext;
  /** Everything you want vocoded is connected here (mic stream, audio element, ...). */
  readonly modIn: GainNode;
  readonly master: GainNode;
  /** Output (vocoded + dry) for scope drawing. */
  readonly analyser: AnalyserNode;
  /** Modulator spectrum — this is what drives the band display. */
  readonly modAnalyser: AnalyserNode;
  centers: number[] = [];
  settings: VocoderSettings;

  private sum: GainNode;
  private wet: GainNode;
  private dry: GainNode;
  private carrierBus: GainNode;
  private bank: BandNodes[] = [];
  private osc: OscillatorNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private recDest: MediaStreamAudioDestinationNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  constructor(ctx: AudioContext, settings: VocoderSettings = DEFAULT_SETTINGS) {
    this.ctx = ctx;
    this.settings = { ...settings };

    this.modIn = ctx.createGain();
    this.modIn.gain.value = 1;

    this.modAnalyser = ctx.createAnalyser();
    this.modAnalyser.fftSize = 2048;
    this.modAnalyser.smoothingTimeConstant = 0.5;
    this.modIn.connect(this.modAnalyser);

    this.sum = ctx.createGain();
    this.sum.gain.value = 3; // makeup: band-passes and envelopes leave a lot of headroom

    this.wet = ctx.createGain();
    this.wet.gain.value = this.settings.mix;
    this.dry = ctx.createGain();
    this.dry.gain.value = 1 - this.settings.mix;

    this.sum.connect(this.wet);
    this.modIn.connect(this.dry);

    this.master = ctx.createGain();
    this.master.gain.value = this.settings.volume;
    this.wet.connect(this.master);
    this.dry.connect(this.master);

    const clip = ctx.createWaveShaper();
    clip.curve = softClipCurve();
    clip.oversample = "2x";
    this.master.connect(clip);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    clip.connect(this.analyser);
    clip.connect(ctx.destination);

    this.carrierBus = ctx.createGain();
    this.carrierBus.gain.value = 1;

    this.buildCarrier();
    this.rebuildBank();
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const len = Math.floor(this.ctx.sampleRate * 2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  }

  private buildCarrier() {
    this.osc?.stop();
    this.osc?.disconnect();
    this.noise?.stop();
    this.noise?.disconnect();
    this.osc = null;
    this.noise = null;

    if (this.settings.carrier === "noise") {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;
      src.connect(this.carrierBus);
      src.start();
      this.noise = src;
    } else {
      const osc = this.ctx.createOscillator();
      osc.type = oscillatorType(this.settings.carrier);
      osc.frequency.value = this.settings.baseHz;
      osc.connect(this.carrierBus);
      osc.start();
      this.osc = osc;
    }
  }

  private rebuildBank() {
    for (const b of this.bank) {
      b.carrierFilter.disconnect();
      b.carrierGain.disconnect();
      b.modFilter.disconnect();
      b.rectifier.disconnect();
      b.smoother.disconnect();
      b.depthGain.disconnect();
    }
    const centers = bandCenters(this.settings.bands);
    this.centers = centers;
    const curve = envelopeCurve(this.settings.sharpness);
    const smooth = smoothingHz(this.settings.responseMs);

    this.bank = centers.map((center) => {
      const carrierFilter = this.ctx.createBiquadFilter();
      carrierFilter.type = "bandpass";
      carrierFilter.frequency.value = center;
      carrierFilter.Q.value = this.settings.q;

      const carrierGain = this.ctx.createGain();
      carrierGain.gain.value = 0;

      this.carrierBus.connect(carrierFilter);
      carrierFilter.connect(carrierGain);
      carrierGain.connect(this.sum);

      const modFilter = this.ctx.createBiquadFilter();
      modFilter.type = "bandpass";
      modFilter.frequency.value = center;
      modFilter.Q.value = this.settings.q;

      const rectifier = this.ctx.createWaveShaper();
      rectifier.curve = curve;
      rectifier.oversample = "2x";

      const smoother = this.ctx.createBiquadFilter();
      smoother.type = "lowpass";
      smoother.frequency.value = smooth;

      const depthGain = this.ctx.createGain();
      depthGain.gain.value = this.settings.depth;

      this.modIn.connect(modFilter);
      modFilter.connect(rectifier);
      rectifier.connect(smoother);
      smoother.connect(depthGain);
      depthGain.connect(carrierGain.gain);

      return { center, carrierFilter, carrierGain, modFilter, rectifier, smoother, depthGain };
    });
  }

  setSettings(next: Partial<VocoderSettings>) {
    const prev = this.settings;
    const s = { ...prev, ...next };
    this.settings = s;

    if (next.bands !== undefined && next.bands !== prev.bands) this.rebuildBank();
    if (next.carrier !== undefined && next.carrier !== prev.carrier) this.buildCarrier();

    if (next.baseHz !== undefined && this.osc) {
      this.osc.frequency.setTargetAtTime(s.baseHz, this.ctx.currentTime, 0.02);
    }
    if (next.q !== undefined) {
      for (const b of this.bank) { b.carrierFilter.Q.value = s.q; b.modFilter.Q.value = s.q; }
    }
    if (next.responseMs !== undefined) {
      const f = smoothingHz(s.responseMs);
      for (const b of this.bank) b.smoother.frequency.value = f;
    }
    if (next.sharpness !== undefined) {
      const c = envelopeCurve(s.sharpness);
      for (const b of this.bank) b.rectifier.curve = c;
    }
    if (next.depth !== undefined) {
      for (const b of this.bank) b.depthGain.gain.value = s.depth;
    }
    if (next.mix !== undefined) {
      this.wet.gain.value = s.mix;
      this.dry.gain.value = 1 - s.mix;
    }
    if (next.volume !== undefined) this.master.gain.value = s.volume;
  }

  get recording() {
    return this.recorder !== null;
  }

  startRecording() {
    if (this.recorder) return;
    if (typeof MediaRecorder === "undefined") throw new Error("This browser can't record audio.");
    this.recDest = this.ctx.createMediaStreamDestination();
    this.master.connect(this.recDest);
    this.chunks = [];
    const rec = new MediaRecorder(this.recDest.stream);
    rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    rec.start();
    this.recorder = rec;
  }

  stopRecording(): Promise<Blob | null> {
    const rec = this.recorder;
    if (!rec) return Promise.resolve(null);
    this.recorder = null;
    return new Promise((resolve) => {
      rec.onstop = () => {
        this.recDest?.disconnect();
        this.recDest = null;
        const type = rec.mimeType || "audio/webm";
        const blob = this.chunks.length ? new Blob(this.chunks, { type }) : null;
        this.chunks = [];
        resolve(blob);
      };
      rec.stop();
    });
  }

  dispose() {
    for (const b of this.bank) {
      b.carrierFilter.disconnect();
      b.carrierGain.disconnect();
      b.modFilter.disconnect();
      b.rectifier.disconnect();
      b.smoother.disconnect();
      b.depthGain.disconnect();
    }
    this.bank = [];
    this.centers = [];
    this.osc?.stop();
    this.osc?.disconnect();
    this.noise?.stop();
    this.noise?.disconnect();
    this.modIn.disconnect();
    this.master.disconnect();
    this.sum.disconnect();
    this.wet.disconnect();
    this.dry.disconnect();
    this.carrierBus.disconnect();
    this.recDest?.disconnect();
  }
}
