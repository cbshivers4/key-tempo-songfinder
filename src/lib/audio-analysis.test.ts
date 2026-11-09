import { describe, it, expect } from "vitest";
import { detectKey, detectTempo, computeChroma, noteFrequency } from "./audio-analysis";

describe("audio analysis", () => {
  it("note frequencies match standard tuning", () => {
    expect(noteFrequency("C", 4)).toBeCloseTo(261.63, 1);
    expect(noteFrequency("C", 3)).toBeCloseTo(130.81, 1);
  });

  it("detects C major from a C major triad", () => {
    const sr = 22050;
    const s = new Float32Array(sr * 3);
    for (const f of [261.63, 329.63, 392.0]) for (let i = 0; i < s.length; i++) s[i]! += Math.sin((2 * Math.PI * f * i) / sr) / 3;
    const k = detectKey(computeChroma(s, sr));
    expect(k.key).toBe("C");
    expect(k.mode).toBe("major");
  });

  it("detects 120 BPM click track", () => {
    const sr = 22050;
    const s = new Float32Array(sr * 10);
    for (let t = 0; t < 10; t += 0.5) for (let i = 0; i < 400; i++) s[Math.floor(t * sr) + i] = Math.sin(i / 3) * (1 - i / 400);
    expect(Math.abs(detectTempo(s, sr).bpm - 120)).toBeLessThan(2);
  });
});
