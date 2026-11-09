import { describe, it, expect } from "vitest";
import {
  bandCenters, bandEdges, bandLevels, clampBands, envelopeCurve,
  smoothingHz, spectralCentroid, zeroCrossingRate, rms, LOW_HZ, HIGH_HZ,
} from "./vocoder";

const SR = 8192; // spectrum of 1024 bins -> 4 Hz per bin

describe("vocoder band bank", () => {
  it("clamps the band count to the usable range", () => {
    expect(clampBands(3)).toBe(8);
    expect(clampBands(40)).toBe(32);
    expect(clampBands(16.6)).toBe(17);
    expect(clampBands(Number.NaN)).toBe(8);
  });

  it("spaces 16 bands logarithmically from 80 Hz to 8 kHz", () => {
    const c = bandCenters(16, LOW_HZ, HIGH_HZ);
    expect(c).toHaveLength(16);
    expect(c[0]).toBeCloseTo(80, 6);
    expect(c[15]).toBeCloseTo(8000, 6);
    const ratio = Math.pow(HIGH_HZ / LOW_HZ, 1 / 15);
    expect(c[1]).toBeCloseTo(80 * ratio, 4);
    expect(c[2]).toBeCloseTo(80 * ratio * ratio, 3);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1]);
  });

  it("puts band edges at geometric midpoints and covers every centre", () => {
    const c = bandCenters(16);
    const e = bandEdges(c);
    expect(e).toHaveLength(17);
    expect(e[0]).toBeLessThan(80);
    expect(e[16]).toBeGreaterThan(8000);
    for (let i = 1; i < e.length; i++) expect(e[i]).toBeGreaterThan(e[i - 1]);
    for (let i = 0; i < c.length; i++) {
      expect(c[i]).toBeGreaterThan(e[i]);
      expect(c[i]).toBeLessThan(e[i + 1]);
    }
  });

  it("lights only the band holding a 1 kHz spike", () => {
    const spectrum = new Uint8Array(1024);
    spectrum[250] = 255; // 250 bins * 4 Hz = 1000 Hz
    const lv = bandLevels(spectrum, SR, bandCenters(16));
    const top = lv.indexOf(Math.max(...lv));
    expect(top).toBe(8); // 16 bands 80 Hz..8 kHz: band 8 spans ~850-1090 Hz
    expect(lv[top]).toBeCloseTo(1, 6);
    expect(Math.max(...lv.filter((_, i) => i !== top))).toBeLessThan(0.01);
  });

  it("returns silence as all-zero bands", () => {
    const lv = bandLevels(new Uint8Array(1024), SR, bandCenters(12));
    expect(lv).toHaveLength(12);
    expect(lv.every((v) => v === 0)).toBe(true);
  });

  it("reports the centroid of a single spectral line", () => {
    const spectrum = new Float32Array(1024);
    spectrum[250] = 1;
    expect(spectralCentroid(spectrum, SR)).toBeCloseTo(1000, 1);
    expect(spectralCentroid(new Float32Array(1024), SR)).toBe(0);
  });
});

describe("vocoder envelope + time domain", () => {
  it("rectifies and hardens with |x|^sharpness", () => {
    expect(Array.from(envelopeCurve(2, 5))).toEqual([1, 0.25, 0, 0.25, 1]);
    const c = envelopeCurve(1.8, 1024);
    expect(c[0]).toBeCloseTo(1, 6);
    expect(c[511]).toBeLessThan(0.01); // centre (x ~ 0) is closed
  });

  it("turns an envelope time constant into a filter cutoff", () => {
    expect(smoothingHz(20)).toBeCloseTo(7.96, 1);
    expect(smoothingHz(5000)).toBe(2); // clamped, never a dead filter
    expect(smoothingHz(0.01)).toBeCloseTo(smoothingHz(0.05), 6); // floor: never above ~3.2 kHz
    expect(smoothingHz(0.01)).toBeLessThan(3200);
  });

  it("counts sign changes so noise reads rougher than a vowel", () => {
    const sr = 8000;
    const n = 2000;
    const sine = new Float32Array(n);
    for (let i = 0; i < n; i++) sine[i] = Math.sin((2 * Math.PI * 440 * i) / sr);
    expect(Math.abs(zeroCrossingRate(sine, sr) - 880) / 880).toBeLessThan(0.01);
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) noise[i] = Math.random() * 2 - 1;
    expect(zeroCrossingRate(noise, sr)).toBeGreaterThan(2000);
    expect(rms(sine)).toBeCloseTo(0.707, 2);
    expect(rms(new Float32Array(n))).toBe(0);
  });
});
