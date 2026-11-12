import { describe, expect, it } from 'vitest';
import { excerptStarts, rankInstruments } from './instruments';

describe('rankInstruments', () => {
  it('ranks instruments by score and ignores non-instrument classes', () => {
    const s = new Array(521).fill(0); s[148] = 0.6; s[135] = 0.2; s[0] = 0.9; // piano, guitar, speech
    expect(rankInstruments(s).map(g => g.name)).toEqual(['Piano', 'Guitar']);
  });
  it('returns no match when every score is weak', () => {
    const s = new Array(521).fill(0.01);
    expect(rankInstruments(s)).toEqual([]);
  });
  it('spreads excerpts across the whole recording', () => {
    expect(excerptStarts(100, 10, 4)).toEqual([0, 30, 60, 90]);
    expect(excerptStarts(5, 10, 4)).toEqual([0]);
  });
});
