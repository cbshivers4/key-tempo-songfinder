// YAMNet (Apache-2.0) AudioSet class indices that describe instruments or voices.
export const INSTRUMENT_CLASSES: ReadonlyArray<readonly [number, string]> = [
  [24, "Singing"],
  [25, "Choir"],
  [30, "Synthetic singing"],
  [31, "Rapping"],
  [134, "Plucked string instrument"],
  [135, "Guitar"],
  [136, "Electric guitar"],
  [137, "Bass guitar"],
  [138, "Acoustic guitar"],
  [139, "Steel guitar, slide guitar"],
  [142, "Banjo"],
  [143, "Sitar"],
  [144, "Mandolin"],
  [145, "Zither"],
  [146, "Ukulele"],
  [147, "Keyboard (musical)"],
  [148, "Piano"],
  [149, "Electric piano"],
  [150, "Organ"],
  [151, "Electronic organ"],
  [152, "Hammond organ"],
  [153, "Synthesizer"],
  [154, "Sampler"],
  [155, "Harpsichord"],
  [156, "Percussion"],
  [157, "Drum kit"],
  [158, "Drum machine"],
  [159, "Drum"],
  [160, "Snare drum"],
  [161, "Rimshot"],
  [162, "Drum roll"],
  [163, "Bass drum"],
  [164, "Timpani"],
  [165, "Tabla"],
  [166, "Cymbal"],
  [167, "Hi-hat"],
  [168, "Wood block"],
  [169, "Tambourine"],
  [170, "Rattle (instrument)"],
  [171, "Maraca"],
  [172, "Gong"],
  [173, "Tubular bells"],
  [174, "Mallet percussion"],
  [175, "Marimba, xylophone"],
  [176, "Glockenspiel"],
  [177, "Vibraphone"],
  [178, "Steelpan"],
  [179, "Orchestra"],
  [180, "Brass instrument"],
  [181, "French horn"],
  [182, "Trumpet"],
  [183, "Trombone"],
  [184, "Bowed string instrument"],
  [185, "String section"],
  [186, "Violin, fiddle"],
  [187, "Pizzicato"],
  [188, "Cello"],
  [189, "Double bass"],
  [190, "Wind instrument, woodwind instrument"],
  [191, "Flute"],
  [192, "Saxophone"],
  [193, "Clarinet"],
  [194, "Harp"],
  [200, "Chime"],
  [201, "Wind chime"],
  [202, "Change ringing (campanology)"],
  [203, "Harmonica"],
  [204, "Accordion"],
  [205, "Bagpipes"],
  [206, "Didgeridoo"],
  [207, "Shofar"],
  [208, "Theremin"],
  [209, "Singing bowl"],
];

export type InstrumentGuess = { name: string; score: number };
export const MIN_SCORE = 0.05;

/** Rank instrument classes from per-class mean scores; weak evidence returns []. */
export function rankInstruments(meanScores: ArrayLike<number>, limit = 6): InstrumentGuess[] {
  return INSTRUMENT_CLASSES
    .map(([i, name]) => ({ name, score: meanScores[i] ?? 0 }))
    .filter(g => g.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Pick up to `count` excerpt start offsets spread evenly across a recording. */
export function excerptStarts(total: number, size: number, count: number): number[] {
  if (total <= size) return [0];
  const n = Math.min(count, Math.ceil(total / size));
  return Array.from({ length: n }, (_, k) => Math.round(((total - size) * k) / Math.max(1, n - 1)));
}
