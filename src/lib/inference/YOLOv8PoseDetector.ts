import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { EdgeOptimizedInference } from './EdgeOptimizedInference';

// Dynamic import for ONNX runtime to avoid build issues
let ort: any = null;

export interface YOLOv8DetectionOptions {
  maxPoses?: number;
  format?: 'COCO' | 'custom';
  confidenceThreshold?: number;
}

export interface YOLOv8Config {
  modelPath?: string;
  executionProviders?: string[];
  graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
}

// COCO Keypoint mapping for YOLOv8
const COCO_KEYPOINTS = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
];

export class YOLOv8PoseDetector {
  private session: any | null = null;
  private modelPath: string;
  private executionProviders: string[];
  private confidenceThreshold = 0.3;
  private deviceProfile: 'high-end' | 'mid-range' | 'low-end' = 'mid-range';
  private frameSkipCounter = 0;
  private frameSkipRate = 0;
  private lastInferenceTime = 0;
  private fallbackDetector: EdgeOptimizedInference | null = null;
  private usingFallback = false;
  private inputSize = 640; // YOLOv8 default input size

  constructor(config?: YOLOv8Config) {
    this.modelPath = config?.modelPath || '/models/yolov8-pose.onnx';
    this.executionProviders = this.detectOptimalProviders(config?.executionProviders);
  }

  private detectOptimalProviders(requestedProviders?: string[]): string[] {
    if (requestedProviders) return requestedProviders;

    const providers: string[] = [];
    
    // Check WebGL support
    if (this.isWebGLSupported()) {
      providers.push('webgl');
    }
    
    // Always include WASM as fallback
    providers.push('wasm');
    
    return providers;
  }

  private isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  }

  async loadModel(): Promise<void> {
    try {
      // Try to dynamically import ONNX runtime
      if (!ort && typeof window !== 'undefined') {
        try {
          ort = await import('onnxruntime-web');
        } catch (e) {
          console.warn('ONNX runtime not available, using fallback');
          await this.initializeFallbackModel();
          return;
        }
      }
      
      // Set ONNX environment for optimal performance
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
      ort.env.wasm.simd = true;
      
      const sessionOptions = {
        executionProviders: this.executionProviders,
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential',
        logSeverityLevel: 3
      };

      this.session = await ort.InferenceSession.create(this.modelPath, sessionOptions);
      
      // Warm up the model
      await this.warmupModel();
      
    } catch (error) {
      console.error('Failed to load YOLOv8 model, initializing fallback:', error);
      await this.initializeFallbackModel();
      // Don't throw if fallback is successful
      if (!this.usingFallback) {
        throw new Error('Failed to load YOLOv8 model');
      }
    }
  }

  private async warmupModel(): Promise<void> {
    if (!this.session) return;
    
    try {
      // Create dummy input
      const dummyInput = new Float32Array(1 * 3 * this.inputSize * this.inputSize);
      const inputTensor = new (ort as any).Tensor('float32', dummyInput, [1, 3, this.inputSize, this.inputSize]);
      
      // Run inference
      await this.session.run({ images: inputTensor });
    } catch (error) {
      console.warn('Model warmup failed:', error);
    }
  }

  private async initializeFallbackModel(): Promise<void> {
    this.fallbackDetector = new EdgeOptimizedInference();
    await this.fallbackDetector.initialize();
    this.usingFallback = true;
  }

  async detectPoses(
    imageData: ImageData, 
    options?: YOLOv8DetectionOptions
  ): Promise<poseDetection.Pose[]> {
    // Use fallback if needed
    if (this.usingFallback && this.fallbackDetector) {
      const fallbackPoses = await this.fallbackDetector.detectPose(imageData);
      return fallbackPoses ? [fallbackPoses] : [];
    }

    if (!this.session) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    // Frame skipping for low-end devices
    if (this.shouldSkipFrame()) {
      return [];
    }

    const startTime = performance.now();

    try {
      // Preprocess image
      const inputTensor = await this.preprocessImage(imageData);
      
      // Run inference
      const outputs = await this.session.run({ images: inputTensor });
      
      // Process outputs
      const poses = this.processOutput(
        outputs, 
        imageData.width, 
        imageData.height,
        options
      );

      // Update performance metrics
      this.lastInferenceTime = performance.now() - startTime;
      this.updateFrameSkipping();

      return poses;
    } catch (error) {
      console.error('Pose detection failed:', error);
      return [];
    }
  }

  private async preprocessImage(imageData: ImageData): Promise<ort.Tensor> {
    // Convert ImageData to tensor
    const imageTensor = tf.browser.fromPixels(imageData);
    
    // Resize to model input size
    const resized = tf.image.resizeBilinear(imageTensor, [this.inputSize, this.inputSize]);
    
    // Normalize to [0, 1]
    const normalized = resized.div(255.0);
    
    // Convert to CHW format (channels first)
    const transposed = normalized.transpose([2, 0, 1]);
    
    // Add batch dimension
    const batched = transposed.expandDims(0);
    
    // Convert to Float32Array
    const data = await batched.data();
    
    // Clean up tensors
    imageTensor.dispose();
    resized.dispose();
    normalized.dispose();
    transposed.dispose();
    batched.dispose();
    
    return new (ort as any).Tensor('float32', data as Float32Array, [1, 3, this.inputSize, this.inputSize]);
  }

  private processOutput(
    outputs: any,
    imageWidth: number,
    imageHeight: number,
    options?: YOLOv8DetectionOptions
  ): poseDetection.Pose[] {
    const output = outputs.output || outputs[Object.keys(outputs)[0]];
    if (!output || !output.data) return [];
    
    const outputData = output.data as Float32Array;
    
    const poses: poseDetection.Pose[] = [];
    const maxPoses = options?.maxPoses || 1;
    const format = options?.format || 'COCO';
    const threshold = options?.confidenceThreshold || this.confidenceThreshold;
    
    // Handle different output formats
    let numDetections = 1;
    let stride = 56;
    
    if (output.dims && output.dims.length >= 2) {
      numDetections = output.dims[1] || 1;
      // YOLOv8 output format: [batch, num_detections, 56]
      // 56 = 5 (x, y, w, h, conf) + 17 keypoints * 3 (x, y, conf)
      stride = output.dims.length >= 3 ? output.dims[2] : 56;
    }
    
    for (let i = 0; i < Math.min(numDetections, maxPoses); i++) {
      const baseIdx = i * stride;
      const confidence = outputData[baseIdx + 4] || 0.8; // Default confidence if not available
      
      if (confidence < threshold) continue;
      
      const keypoints: poseDetection.Keypoint[] = [];
      
      // Extract keypoints
      for (let k = 0; k < 17; k++) {
        const kptIdx = baseIdx + 5 + k * 3;
        const x = (outputData[kptIdx] || 0.5) * imageWidth;
        const y = (outputData[kptIdx + 1] || 0.5) * imageHeight;
        const score = outputData[kptIdx + 2] || confidence;
        
        keypoints.push({
          x,
          y,
          score,
          name: format === 'COCO' ? COCO_KEYPOINTS[k] : `keypoint_${k}`
        });
      }
      
      poses.push({
        keypoints,
        score: confidence
      });
    }
    
    return poses;
  }

  private shouldSkipFrame(): boolean {
    if (this.deviceProfile === 'high-end') return false;
    
    this.frameSkipCounter++;
    if (this.frameSkipCounter <= this.frameSkipRate) {
      return true;
    }
    
    this.frameSkipCounter = 0;
    return false;
  }

  private updateFrameSkipping(): void {
    // Adjust frame skipping based on inference time
    if (this.lastInferenceTime > 66) { // Less than 15 FPS
      this.frameSkipRate = Math.min(this.frameSkipRate + 1, 3);
    } else if (this.lastInferenceTime < 33 && this.frameSkipRate > 0) { // More than 30 FPS
      this.frameSkipRate = Math.max(this.frameSkipRate - 1, 0);
    }
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  setDeviceProfile(profile: 'high-end' | 'mid-range' | 'low-end'): void {
    this.deviceProfile = profile;
    
    // Adjust settings based on profile
    switch (profile) {
      case 'low-end':
        this.frameSkipRate = 2;
        this.inputSize = 320;
        break;
      case 'mid-range':
        this.frameSkipRate = 1;
        this.inputSize = 416;
        break;
      case 'high-end':
        this.frameSkipRate = 0;
        this.inputSize = 640;
        break;
    }
  }

  isModelLoaded(): boolean {
    return this.session !== null || (this.usingFallback && this.fallbackDetector !== null);
  }

  isUsingFallback(): boolean {
    return this.usingFallback;
  }

  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    
    if (this.fallbackDetector) {
      // Fallback detector has its own cleanup
      this.fallbackDetector = null;
    }
    
    this.usingFallback = false;
  }

  getPerformanceMetrics() {
    return {
      lastInferenceTime: this.lastInferenceTime,
      frameSkipRate: this.frameSkipRate,
      deviceProfile: this.deviceProfile,
      usingFallback: this.usingFallback,
      estimatedFPS: this.lastInferenceTime > 0 ? 1000 / this.lastInferenceTime : 0
    };
  }
}