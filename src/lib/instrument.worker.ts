import * as tf from '@tensorflow/tfjs';
import { excerptStarts, rankInstruments } from './instruments';

const RATE = 16000, SIZE = RATE * 10;
self.onmessage = async (event: MessageEvent<{ samples: Float32Array }>) => {
  let model: tf.GraphModel | undefined;
  try {
    tf.env().global.atob = self.atob.bind(self);
    await tf.setBackend('cpu'); await tf.ready();
    self.postMessage({ type: 'progress', progress: 0, phase: 'Loading sound model' });
    model = await tf.loadGraphModel(new URL('/models/yamnet/model.json', self.location.origin).href);
    const { samples } = event.data;
    const starts = excerptStarts(samples.length, SIZE, 8);
    const sum = new Float64Array(521); let frames = 0;
    for (const [k, start] of starts.entries()) {
      const out = tf.tidy(() => {
        const result = model!.execute(tf.tensor1d(samples.subarray(start, start + SIZE)), 'Identity:0') as tf.Tensor2D;
        return result.sum(0);
      });
      const n = Math.max(1, Math.floor((Math.min(SIZE, samples.length - start) - 15600) / 7680) + 1);
      const data = await out.data(); out.dispose();
      data.forEach((v, i) => { sum[i] = (sum[i] ?? 0) + v; }); frames += n;
      self.postMessage({ type: 'progress', progress: (k + 1) / starts.length, phase: 'Listening for instruments' });
    }
    self.postMessage({ type: 'done', guesses: rankInstruments(Array.from(sum, v => v / frames)) });
  } catch (error) { console.error('Instrument identification failed', error); self.postMessage({ type: 'error', message: 'Instrument identification could not finish. Try a shorter recording.' }); }
  finally { model?.dispose(); }
};
