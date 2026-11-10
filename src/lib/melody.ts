import { PitchDetector } from 'pitchy';
import { Midi } from '@tonejs/midi';
import type { MelodyNote } from './music-files';

export async function detectMelody(samples: Float32Array, sampleRate: number, progress: (value: number) => void = () => {}) {
  const size = 2048, hop = 256;
  const detector = PitchDetector.forFloat32Array(size);
  const notes: MelodyNote[] = [];
  let current: MelodyNote | undefined;
  for (let i = 0; i + size <= samples.length; i += hop) {
    const frame = samples.subarray(i, i + size);
    let energy = 0;
    for (const sample of frame) energy += sample * sample;
    const rms = Math.sqrt(energy / size);
    const [hz, clarity] = detector.findPitch(frame, sampleRate);
    const midi = rms > 0.008 && clarity >= 0.9 && hz >= 65 && hz <= 2100 ? Math.round(69 + 12 * Math.log2(hz / 440)) : null;
    const time = i / sampleRate;
    if (midi !== null && current?.midi === midi) current.duration = time + hop / sampleRate - current.start;
    else {
      if (current && current.duration >= 0.08) notes.push(current);
      current = midi === null ? undefined : { midi, start: time, duration: hop / sampleRate, velocity: Math.min(1, Math.max(0.2, rms * 3)) };
    }
    if (i % (hop * 100) === 0) { progress(i / samples.length); await new Promise(r => setTimeout(r, 0)); }
  }
  if (current && current.duration >= 0.08) notes.push(current);
  progress(1);
  return notes;
}

export function melodyMidi(notes: MelodyNote[]) {
  const midi = new Midi(); midi.header.setTempo(120);
  const track = midi.addTrack(); track.name = 'Detected melody';
  for (const note of notes) track.addNote({ midi: note.midi, time: note.start, duration: note.duration, velocity: note.velocity });
  return new Uint8Array(midi.toArray());
}