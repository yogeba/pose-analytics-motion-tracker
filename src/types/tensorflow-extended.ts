// Extended TensorFlow.js types for direct browser usage

export interface TFTensor {
  cast: (dtype: string) => TFTensor;
  expandDims: (axis: number) => TFTensor;
  dispose: () => void;
  data: () => Promise<Float32Array>;
}

export interface TFModel {
  predict: (input: TFTensor) => TFTensor;
  dispose: () => void;
}

export interface ExtendedWindowWithTF extends Window {
  tf?: {
    version: {
      tfjs: string;
    };
    loadGraphModel: (url: string, options?: { fromTFHub?: boolean }) => Promise<TFModel>;
    browser: {
      fromPixels: (pixels: ImageData | HTMLVideoElement | HTMLCanvasElement) => TFTensor;
    };
    image: {
      resizeBilinear: (tensor: TFTensor, size: [number, number]) => TFTensor;
    };
    env: () => {
      flags: Record<string, unknown>;
    };
    backend: () => {
      getGPGPUContext?: () => {
        gl: WebGLRenderingContext | WebGL2RenderingContext;
      };
    };
    dispose: (tensor: TFTensor) => void;
    memory: () => {
      numTensors: number;
      numDataBuffers: number;
      numBytes: number;
    };
  };
}