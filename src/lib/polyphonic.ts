import { noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import type { MelodyNote } from './music-files';

export function polyphonicNotes(frames: number[][], onsets: number[][], duration: number): MelodyNote[] {
  return noteFramesToTime(outputToNotesPoly(frames, onsets, 0.5, 0.3, 8))
    .filter(note => note.startTimeSeconds < duration && note.durationSeconds > 0)
    .map(note => ({
      midi: note.pitchMidi,
      start: Math.max(0, note.startTimeSeconds),
      duration: Math.min(note.durationSeconds, duration - Math.max(0, note.startTimeSeconds)),
      velocity: Math.min(1, Math.max(0.1, note.amplitude)),
    }))
    .filter(note => note.duration > 0)
    .sort((a, b) => a.start - b.start || a.midi - b.midi);
}