import * as tf from '@tensorflow/tfjs';
import { BasicPitch } from '@spotify/basic-pitch';
import { polyphonicNotes } from './polyphonic';

self.onmessage = async (event: MessageEvent<{ samples: Float32Array }>) => {
  let model: tf.GraphModel | undefined;
  try {
    await tf.setBackend('cpu'); await tf.ready();
    self.postMessage({ type: 'progress', progress: 0, phase: 'Loading multi-note model' });
    model = await tf.loadGraphModel(new URL('/models/basic-pitch/model.json', self.location.origin).href);
    const engine = new BasicPitch(Promise.resolve(model));
    const frames: number[][] = [], onsets: number[][] = [];
    await engine.evaluateModel(event.data.samples,
      (f, o) => { frames.push(...f); onsets.push(...o); },
      progress => self.postMessage({ type: 'progress', progress, phase: 'Detecting overlapping notes' }),
    );
    self.postMessage({ type: 'done', notes: polyphonicNotes(frames, onsets, event.data.samples.length / 22050) });
  } catch { self.postMessage({ type: 'error', message: 'Multi-note transcription could not finish. Try a shorter solo-instrument recording.' }); }
  finally { model?.dispose(); }
};