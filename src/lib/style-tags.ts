import type { HistoryEntry } from "@/lib/history";

export type StyleTags = {
  summary: string;
  styles: string[];
  instruments: string[];
  moods: string[];
  searchPhrase: string;
};

function cleanList(values: string[], limit: number) {
  const cleaned = values
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 48))
    .filter(Boolean);
  return [...new Set(cleaned)].slice(0, limit);
}

/** Keep model output concise, predictable and safe to render as search tags. */
export function normalizeStyleTags(value: StyleTags): StyleTags {
  const styles = cleanList(value.styles, 6);
  const instruments = cleanList(value.instruments, 8);
  const moods = cleanList(value.moods, 5);
  return {
    summary: value.summary.trim().replace(/\s+/g, " ").slice(0, 320),
    styles,
    instruments,
    moods,
    searchPhrase: value.searchPhrase.trim().replace(/\s+/g, " ").slice(0, 180)
      || [...styles, ...instruments, ...moods].join(" ").slice(0, 180),
  };
}

export type LibraryMatch = { song: HistoryEntry; score: number; matchedTags: string[] };

/**
 * Match only against metadata actually stored with a saved song. Exact tag
 * matches rank above shared words; unrelated songs are not presented as matches.
 */
export function matchSavedSongs(tags: StyleTags, songs: HistoryEntry[]): LibraryMatch[] {
  const allTags = cleanList([...tags.styles, ...tags.instruments, ...tags.moods], 19);
  return songs.flatMap((song) => {
    const metadata = [song.title, song.artist, song.album ?? "", ...(song.genres ?? [])].join(" ").toLowerCase();
    const words = new Set(metadata.split(/[^a-z0-9]+/).filter(Boolean));
    let score = 0;
    const matchedTags = allTags.filter((tag) => {
      if (metadata.includes(tag)) { score += 3; return true; }
      const shared = tag.split(" ").filter((word) => word.length >= 4 && words.has(word));
      if (shared.length) { score += shared.length; return true; }
      return false;
    });
    return score ? [{ song, score, matchedTags }] : [];
  }).sort((a, b) => b.score - a.score).slice(0, 8);
}
