import { describe, it, expect } from 'vitest';
import { encodeWav } from './music-files';
import { detectMelody, melodyMidi } from './melody';
import { Midi } from '@tonejs/midi';

describe('music export', () => {
  it('exports actual stereo PCM samples at 44100 Hz', () => {
    const view = new DataView(encodeWav([new Float32Array([1, -1]), new Float32Array([0.5, 0])], 44100));
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });
  it('detects A4 from a solo 440 Hz recording and preserves it in MIDI', async () => {
    const rate = 22050;
    const samples = Float32Array.from({ length: rate }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 440 * i / rate));
    const notes = await detectMelody(samples, rate);
    expect(notes.length).toBe(1);
    expect(notes[0]?.midi).toBe(69);
    const midi = new Midi(melodyMidi(notes));
    expect(midi.tracks[0]?.notes[0]?.midi).toBe(69);
    expect(midi.tracks[0]?.notes[0]?.duration).toBeGreaterThan(0.8);
  });
  it('does not turn silence into notes', async () => {
    expect(await detectMelody(new Float32Array(22050), 22050)).toEqual([]);
  });
});