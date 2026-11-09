import { describe, it, expect } from "vitest";
import { detectChords, detectSections, frameChroma, matchChord } from "./chords";

const SR = 22050;
function tone(freqs: number[], sec: number) {
  const out = new Float32Array(Math.floor(SR * sec));
  for (let i = 0; i < out.length; i++) for (const f of freqs) out[i] += Math.sin((2 * Math.PI * f * i) / SR) / freqs.length;
  return out;
}
const C = [261.63, 329.63, 392.0];
const Am = [220.0, 261.63, 329.63];
const G = [196.0, 246.94, 293.66];

describe("chords", () => {
  it("matches a C major chroma", () => {
    const c = new Array(12).fill(0); c[0] = 1; c[4] = 1; c[7] = 1;
    expect(matchChord(c).name).toBe("C");
  });
  it("matches an A minor chroma", () => {
    const c = new Array(12).fill(0); c[9] = 1; c[0] = 1; c[4] = 1;
    expect(matchChord(c).name).toBe("Am");
  });
  it("finds C then G in audio", () => {
    const a = tone(C, 3), b = tone(G, 3);
    const s = new Float32Array(a.length + b.length); s.set(a); s.set(b, a.length);
    const { frames, energy, secPerFrame } = frameChroma(s, SR);
    const segs = detectChords(frames, energy, secPerFrame).map((x) => x.chord);
    expect(segs).toEqual(["C", "G"]);
  });
  it("labels a repeated section with the same letter", () => {
    const parts = [tone(C, 12), tone(Am, 12), tone(C, 12)];
    const s = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of parts) { s.set(p, o); o += p.length; }
    const { frames, energy, secPerFrame } = frameChroma(s, SR);
    expect(detectSections(frames, energy, secPerFrame).map((x) => x.label)).toEqual(["A", "B", "A"]);
  });
});
