import * as ort from 'onnxruntime-web/wasm';
import { DemucsProcessor } from 'demucs-web';
import wasmUrl from 'onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import moduleUrl from 'onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';

self.onmessage = async (event: MessageEvent<{ left: Float32Array; right: Float32Array }>) => {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: moduleUrl };
  const processor = new DemucsProcessor({
    ort,
    sessionOptions: { executionProviders: ['wasm'], enableCpuMemArena: false, enableMemPattern: false },
    onProgress: ({ progress }) => self.postMessage({ type: 'progress', progress, phase: 'Separating instruments' }),
    onDownloadProgress: (loaded, total) => self.postMessage({ type: 'progress', progress: loaded / total, phase: 'Downloading separation model (181 MB)' }),
  });
  try {
    await processor.loadModel('https://huggingface.co/timcsy/demucs-web-onnx/resolve/main/htdemucs_embedded.onnx');
    self.postMessage({ type: 'progress', progress: 0, phase: 'Separating instruments' });
    const stems = await processor.separate(event.data.left, event.data.right);
    self.postMessage({ type: 'done', stems });
  } catch { self.postMessage({ type: 'error', message: 'Separation could not finish. Try a shorter recording on a desktop browser with more available memory.' }); }
  finally { await processor.session?.release(); }
};