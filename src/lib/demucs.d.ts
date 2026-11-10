declare module 'demucs-web' {
  export type StereoStem = { left: Float32Array; right: Float32Array };
  export type SeparationResult = Record<'vocals' | 'drums' | 'bass' | 'other', StereoStem>;
  export class DemucsProcessor {
    constructor(options: {
      ort: typeof import('onnxruntime-web');
      sessionOptions: import('onnxruntime-web').InferenceSession.SessionOptions;
      onProgress: (info: { progress: number }) => void;
      onDownloadProgress: (loaded: number, total: number) => void;
    });
    session: import('onnxruntime-web').InferenceSession | null;
    loadModel(url: string): Promise<unknown>;
    separate(left: Float32Array, right: Float32Array): Promise<SeparationResult>;
  }
}