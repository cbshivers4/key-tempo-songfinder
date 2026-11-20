import { describe, expect, it } from "vitest";
import { clipStart, IDENTIFY_CLIP_SECONDS } from "./identify-clip";

describe("identifying a song from your own music", () => {
  it("listens for 12 seconds", () => {
    expect(IDENTIFY_CLIP_SECONDS).toBe(12);
  });

  it("keeps the listen inside the song", () => {
    expect(clipStart(180, 24)).toBe(24);
    expect(clipStart(180, 175)).toBe(168);
    expect(clipStart(180, -5)).toBe(0);
  });

  it("uses the whole song when it is shorter than the listen window", () => {
    expect(clipStart(8, 6)).toBe(0);
    expect(clipStart(8, 99)).toBe(0);
  });

  it("falls back to the beginning for unreadable durations", () => {
    expect(clipStart(Number.NaN, 10)).toBe(0);
    expect(clipStart(0, 10)).toBe(0);
    expect(clipStart(180, Number.NaN)).toBe(0);
  });
});
