// TensorFlow.js specific types

export interface TFFlags {
  WEBGL_VERSION?: number;
  WEBGL_CPU_FORWARD?: boolean;
  WEBGL_PACK?: boolean;
  WEBGL_SIZE_UPLOAD_UNIFORM?: number;
  WEBGL_FORCE_F16_TEXTURES?: boolean;
  WEBGL_RENDER_FLOAT32_CAPABLE?: boolean;
  WEBGL_FLUSH_THRESHOLD?: number;
  WEBGL_PACK_DEPTHWISECONV?: boolean;
  WEBGL_PACK_BINARY_OPERATIONS?: boolean;
  WEBGL_PACK_UNARY_OPERATIONS?: boolean;
  WEBGL_PACK_ARRAY_OPERATIONS?: boolean;
  WEBGL_PACK_IMAGE_OPERATIONS?: boolean;
  WEBGL_PACK_REDUCE?: boolean;
  WEBGL_LAZILY_UNPACK?: boolean;
  WEBGL_CONV_IM2COL?: boolean;
  WEBGL_MAX_TEXTURE_SIZE?: number;
  WEBGL_MAX_TEXTURES_IN_SHADER?: number;
  WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION?: number;
  WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE?: boolean;
  WEBGL_USE_SHAPES_UNIFORMS?: boolean;
  WEBGL_PACK_SELECT?: boolean;
  WEBGL_DELETE_TEXTURE_THRESHOLD?: number;
  IS_BROWSER?: boolean;
  PROD?: boolean;
  [key: string]: unknown;
}

export interface TFEnvironment {
  flags: TFFlags;
  set: (flagName: string, value: unknown) => void;
  get: (flagName: string) => unknown;
  getFlags: () => TFFlags;
  setFlags: (flags: Partial<TFFlags>) => void;
}

export interface PoseDetectorConfig {
  modelType?: string;
  enableSmoothing?: boolean;
  minPoseScore?: number;
  minPartScore?: number;
  [key: string]: unknown;
}

export interface PoseDetector {
  estimatePoses: (
    image: ImageData | HTMLVideoElement | HTMLCanvasElement,
    config?: {
      maxPoses?: number;
      flipHorizontal?: boolean;
      scoreThreshold?: number;
    }
  ) => Promise<Array<{
    keypoints: Array<{
      x: number;
      y: number;
      score?: number;
      name?: string;
    }>;
    score?: number;
  }>>;
  dispose: () => void;
}

export interface TensorFlowJS {
  version: {
    tfjs: string;
  };
  loadGraphModel: (url: string) => Promise<unknown>;
  browser: {
    fromPixels: (pixels: ImageData | HTMLVideoElement | HTMLCanvasElement) => unknown;
  };
  image: {
    resizeBilinear: (tensor: unknown, size: [number, number]) => unknown;
  };
  env: () => TFEnvironment;
  backend: () => {
    getGPGPUContext?: () => {
      gl: WebGLRenderingContext | WebGL2RenderingContext;
    };
  };
  dispose: (tensor: unknown) => void;
  memory: () => {
    numTensors: number;
    numDataBuffers: number;
    numBytes: number;
  };
}

export interface PoseDetectionLibrary {
  createDetector: (
    model: string,
    config?: PoseDetectorConfig
  ) => Promise<PoseDetector>;
  SupportedModels: {
    MoveNet: string;
    PoseNet: string;
    BlazePose: string;
  };
  movenet: {
    modelType: {
      SINGLEPOSE_LIGHTNING: string;
      SINGLEPOSE_THUNDER: string;
      MULTIPOSE_LIGHTNING: string;
    };
  };
}