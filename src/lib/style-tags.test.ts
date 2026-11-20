import { describe, expect, it } from "vitest";
import { matchSavedSongs, normalizeStyleTags, type StyleTags } from "./style-tags";
import type { HistoryEntry } from "./history";

const tags: StyleTags = {
  summary: "A dusty instrumental hip-hop clip.",
  styles: ["boom bap", "instrumental hip-hop"],
  instruments: ["dusty drums", "upright bass"],
  moods: ["laid-back"],
  searchPhrase: "dusty boom bap upright bass",
};

function song(overrides: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: "1", title: "Test song", artist: "Test artist", provider: "test", links: [], identifiedAt: "2026-01-01",
    ...overrides,
  };
}

describe("normalizeStyleTags", () => {
  it("deduplicates tags and builds a useful search phrase when the model leaves it empty", () => {
    const result = normalizeStyleTags({ ...tags, styles: [" Boom  Bap ", "BOOM BAP"], searchPhrase: " " });
    expect(result.styles).toEqual(["boom bap"]);
    expect(result.searchPhrase).toContain("boom bap");
    expect(result.searchPhrase).toContain("upright bass");
  });
});

describe("matchSavedSongs", () => {
  it("matches saved genre metadata and explains the matching tags", () => {
    const matches = matchSavedSongs(tags, [song({ genres: ["Boom Bap", "Jazz"] })]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchedTags).toContain("boom bap");
  });

  it("does not label an unrelated saved song as a match", () => {
    expect(matchSavedSongs(tags, [song({ title: "Blue Moon", genres: ["Classical"] })])).toEqual([]);
  });
});
