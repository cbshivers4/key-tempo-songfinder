import { describe, expect, it } from 'vitest';
import { polyphonicNotes } from './polyphonic';
import { melodyMidi } from './melody';
import { Midi } from '@tonejs/midi';

describe('multi-note transcription', () => {
  it('preserves simultaneous C4 and E4 notes in exported MIDI', () => {
    const frames = Array.from({ length: 60 }, (_, i) => Array.from({ length: 88 }, (_, pitch) => i >= 5 && i < 45 && (pitch === 39 || pitch === 43) ? 0.9 : 0));
    const onsets = Array.from({ length: 60 }, (_, i) => Array.from({ length: 88 }, (_, pitch) => i === 5 && (pitch === 39 || pitch === 43) ? 0.95 : 0));
    const notes = polyphonicNotes(frames, onsets, 1);
    expect(notes.map(note => note.midi)).toEqual([60, 64]);
    expect(notes[0]?.start).toBe(notes[1]?.start);
    const exported = new Midi(melodyMidi(notes)).tracks[0]?.notes ?? [];
    expect(exported.map(note => note.midi)).toEqual([60, 64]);
    expect(exported[0]?.time).toBe(exported[1]?.time);
  });
  it('does not generate notes from silent predictions', () => {
    const silence = Array.from({ length: 30 }, () => Array(88).fill(0));
    expect(polyphonicNotes(silence, silence, 1)).toEqual([]);
  });
});