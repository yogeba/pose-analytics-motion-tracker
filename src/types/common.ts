// Common types used across the application

export interface Keypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export interface Pose {
  keypoints: Keypoint[];
  score?: number;
  id?: number;
}

export interface PoseWithMetadata {
  keypoints: Keypoint[];
  metadata?: {
    timestamp?: number;
    frameIndex?: number;
    [key: string]: unknown;
  };
}

export interface SportMetrics {
  currentSpeed?: number;
  maxSpeed?: number;
  averageSpeed?: number;
  totalDistance?: number;
  currentPower?: number;
  averagePower?: number;
  maxPower?: number;
  cadence?: number;
  strideLength?: number;
  verticalOscillation?: number;
  jumpHeight?: number;
  flightTime?: number;
  barVelocity?: number;
  repCount?: number;
  timeUnderTension?: number;
  performanceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  pace?: number;
  gradeAdjustedPace?: number;
  energyExpenditure?: number;
  takeoffVelocity?: number;
  peakPower?: number;
  contactTime?: number;
  avgCadence?: number;
  avgStrideLength?: number;
  currentBarSpeed?: number;
  rangeOfMotion?: number;
  tempoRatio?: number;
  groundContactTime?: number;
  speed?: number;
  power?: number;
  acceleration?: number;
  range?: number;
}

export interface MediaPipeLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface CameraCapabilities {
  zoom?: {
    min: number;
    max: number;
    step: number;
  };
  exposureCompensation?: {
    min: number;
    max: number;
    step: number;
  };
  focusDistance?: {
    min: number;
    max: number;
    step: number;
  };
}

export interface CameraConstraints {
  video: {
    facingMode?: string;
    width?: { ideal: number };
    height?: { ideal: number };
    frameRate?: { ideal: number };
    aspectRatio?: { ideal: number };
    zoom?: number;
    exposureCompensation?: number;
    focusDistance?: number;
  };
  audio: boolean;
}

export interface TensorFlowBackend {
  getGPGPUContext?: () => {
    gl: WebGLRenderingContext | WebGL2RenderingContext;
  };
}

export interface WindowWithTF extends Window {
  tf?: {
    version: {
      tfjs: string;
    };
    loadGraphModel: (url: string, options?: { fromTFHub?: boolean }) => Promise<unknown>;
    browser: {
      fromPixels: (pixels: ImageData | HTMLVideoElement | HTMLCanvasElement) => unknown;
    };
    image: {
      resizeBilinear: (tensor: unknown, size: [number, number]) => unknown;
    };
    env: () => {
      flags: Record<string, unknown>;
    };
    backend: () => TensorFlowBackend;
  };
}

export interface PoseDebugState {
  initialized: boolean;
  modelType: string;
  lastDetection: number;
  detections: number;
  errors: Array<{
    timestamp: number;
    error: string;
    stack?: string;
  }>;
  logs: Array<{
    timestamp: number;
    level: string;
    message: string;
    data?: unknown;
  }>;
  lastUpdate: number;
  state: {
    initialized: boolean;
    modelType: string;
    lastDetection: number;
  };
}

export interface WindowWithDebug extends Window {
  __POSE_DEBUG__?: PoseDebugState;
  __POSE_DATA__?: Pose[];
}

export interface AIFeedbackItem {
  priority: number;
  message: string;
  correction?: string;
  encouragement?: string;
}

export interface ORTTensor {
  new (data: Float32Array, dims: number[]): {
    data: Float32Array;
    dims: number[];
  };
}

export interface ORTSession {
  run: (inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface ORT {
  InferenceSession: {
    create: (modelPath: string) => Promise<ORTSession>;
  };
  Tensor: ORTTensor;
}