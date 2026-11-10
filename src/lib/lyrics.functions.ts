import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const lyricSchema = z.object({
  id: z.number(), trackName: z.string(), artistName: z.string(), albumName: z.string(),
  duration: z.number(), instrumental: z.boolean(), plainLyrics: z.string().nullable(), syncedLyrics: z.string().nullable(),
});
export type LyricResult = z.infer<typeof lyricSchema>;

export const searchLyrics = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ title: z.string().trim().min(1).max(150), artist: z.string().trim().max(150) }))
  .handler(async ({ data }): Promise<{ results: LyricResult[]; error: string | null }> => {
    try {
      const url = new URL('https://lrclib.net/api/search');
      url.searchParams.set('track_name', data.title);
      if (data.artist) url.searchParams.set('artist_name', data.artist);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Song Analyzer (https://key-tempo-songfinder.lovable.app)' } });
      if (!response.ok) return { results: [], error: 'Lyrics search is unavailable right now. Please try again later.' };
      const results = z.array(lyricSchema).parse(await response.json()).slice(0, 20);
      return { results, error: null };
    } catch { return { results: [], error: 'Lyrics search is unavailable right now. Please try again later.' }; }
  });