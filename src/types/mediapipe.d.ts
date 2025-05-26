declare module '@mediapipe/holistic' {
  export interface Results {
    image: HTMLCanvasElement;
    poseLandmarks?: NormalizedLandmarkList;
    faceLandmarks?: NormalizedLandmarkList;
    leftHandLandmarks?: NormalizedLandmarkList;
    rightHandLandmarks?: NormalizedLandmarkList;
    segmentationMask?: HTMLCanvasElement;
  }

  export interface NormalizedLandmark {
    x: number;
    y: number;
    z?: number;
    visibility?: number;
  }

  export type NormalizedLandmarkList = NormalizedLandmark[];

  export interface Options {
    modelComplexity?: 0 | 1 | 2;
    smoothLandmarks?: boolean;
    enableSegmentation?: boolean;
    smoothSegmentation?: boolean;
    refineFaceLandmarks?: boolean;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }

  export class Holistic {
    constructor(config: { locateFile: (file: string) => string });
    setOptions(options: Options): void;
    onResults(callback: (results: Results) => void): void;
    send(inputs: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>;
    close(): void;
  }
}

declare module '@mediapipe/camera_utils' {
  export interface CameraOptions {
    onFrame: () => Promise<void> | void;
    width?: number;
    height?: number;
    facingMode?: string;
  }

  export class Camera {
    constructor(videoElement: HTMLVideoElement, options: CameraOptions);
    start(): Promise<void>;
    stop(): void;
  }
}