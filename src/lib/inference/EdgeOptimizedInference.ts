import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-webgpu';
import * as poseDetection from '@tensorflow-models/pose-detection';
import type { TensorFlowBackend } from '@/types/common';

export interface InferenceConfig {
  backend: 'webgl' | 'webgpu' | 'wasm';
  modelComplexity: 'lite' | 'full' | 'heavy';
  enableQuantization: boolean;
  targetFPS: number;
  enableGPUAcceleration: boolean;
}

export interface PerformanceMetrics {
  inferenceTime: number; // ms
  fps: number;
  memoryUsage: number; // MB
  gpuUtilization?: number; // %
}

export class EdgeOptimizedInference {
  private detector: poseDetection.PoseDetector | null = null;
  private config: InferenceConfig;
  private performanceMetrics: PerformanceMetrics = {
    inferenceTime: 0,
    fps: 0,
    memoryUsage: 0
  };
  
  // Performance optimization
  private frameSkipCounter = 0;
  private dynamicFrameSkip = 1;
  private lastInferenceTime = 0;
  private fpsHistory: number[] = [];
  private readonly FPS_HISTORY_SIZE = 30;
  
  // Model caching
  private warmupComplete = false;
  private tensorCache = new Map<string, tf.Tensor>();

  constructor(config: Partial<InferenceConfig> = {}) {
    this.config = {
      backend: 'webgl',
      modelComplexity: 'lite',
      enableQuantization: true,
      targetFPS: 30,
      enableGPUAcceleration: true,
      ...config
    };
  }

  async initialize(): Promise<void> {
    // Set up TensorFlow.js backend
    await this.setupBackend();
    
    // Create optimized detector
    const modelConfig = this.getOptimizedModelConfig();
    this.detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      modelConfig
    );
    
    // Warm up the model
    await this.warmupModel();
  }

  private async setupBackend(): Promise<void> {
    // Check available backends
    const backends = tf.engine().backendNames();
    console.log('Available backends:', backends);

    // Try to use WebGPU if available and requested
    if (this.config.backend === 'webgpu' && backends.includes('webgpu')) {
      await tf.setBackend('webgpu');
      console.log('Using WebGPU backend for maximum performance');
    } else if (this.config.backend === 'webgl' || backends.includes('webgl')) {
      await tf.setBackend('webgl');
      
      // Configure WebGL for performance (using type assertion for API compatibility)
      const backend = tf.backend() as TensorFlowBackend;
      if (backend.getGPGPUContext) {
        const gl = backend.getGPGPUContext().gl;
        gl.getExtension('EXT_color_buffer_float');
        gl.getExtension('WEBGL_lose_context');
      }
      
      // Set WebGL flags for performance
      tf.env().set('WEBGL_VERSION', 2);
      tf.env().set('WEBGL_RENDER_FLOAT32_CAPABLE', true);
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', this.config.enableQuantization);
      tf.env().set('WEBGL_PACK', true);
      tf.env().set('WEBGL_LAZILY_UNPACK', true);
      tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
      
      console.log('Using WebGL backend with optimizations');
    } else {
      await tf.setBackend('wasm');
      console.log('Fallback to WASM backend');
    }

    // Enable production mode for better performance
    tf.enableProdMode();
  }

  private getOptimizedModelConfig(): poseDetection.MoveNetModelConfig {
    const modelTypeMap = {
      lite: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      full: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
      heavy: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING
    };

    return {
      modelType: modelTypeMap[this.config.modelComplexity],
      enableSmoothing: false, // We'll handle smoothing ourselves
      modelUrl: undefined, // Use default URLs
      minPoseScore: 0.25, // Lower threshold for speed
      multiPoseMaxDimension: 256, // Smaller input for speed
      enableTracking: true,
      trackerType: poseDetection.TrackerType.BoundingBox,
      trackerConfig: {
        maxTracks: 1,
        maxAge: 100,
        minSimilarity: 0.3,
        keypointTrackerParams: {
          keypointConfidenceThreshold: 0.2,
          minNumberOfKeypoints: 4,
          keypointFalloff: [0.026, 0.025, 0.025, 0.035, 0.035, 0.079, 0.079, 0.072, 0.072, 0.062, 0.062, 0.107, 0.107, 0.087, 0.087, 0.089, 0.089]
        }
      }
    };
  }

  private async warmupModel(): Promise<void> {
    if (!this.detector) return;

    console.log('Warming up model...');
    
    // Create dummy image for warmup
    const dummyImage = tf.zeros([256, 256, 3], 'int32');
    
    // Run inference multiple times to warm up GPU
    for (let i = 0; i < 5; i++) {
      await this.detector.estimatePoses(dummyImage as any);
      await tf.nextFrame();
    }
    
    dummyImage.dispose();
    this.warmupComplete = true;
    console.log('Model warmup complete');
  }

  async detectPose(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ): Promise<poseDetection.Pose[]> {
    if (!this.detector || !this.warmupComplete) {
      throw new Error('Detector not initialized');
    }

    // Dynamic frame skipping based on performance
    this.frameSkipCounter++;
    if (this.frameSkipCounter < this.dynamicFrameSkip) {
      return []; // Skip this frame
    }
    this.frameSkipCounter = 0;

    const startTime = performance.now();

    try {
      // Optimize input tensor
      const inputTensor = await this.preprocessInput(input);
      
      // Run inference (cannot use tidy with async functions)
      const poses = await this.detector!.estimatePoses(input, {
        flipHorizontal: false,
        maxPoses: 1
      });

      // Clean up input tensor if we created one
      if (inputTensor) {
        inputTensor.dispose();
      }

      // Update performance metrics
      this.updatePerformanceMetrics(startTime);
      
      // Adjust frame skipping based on performance
      this.adjustFrameSkipping();

      return poses;
    } catch (error) {
      console.error('Pose detection error:', error);
      return [];
    }
  }

  private async preprocessInput(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ): Promise<tf.Tensor3D | null> {
    // For video elements, we can optimize by resizing
    if (input instanceof HTMLVideoElement && this.config.modelComplexity === 'lite') {
      const targetSize = 192; // Smaller size for Lightning model
      
      return tf.tidy(() => {
        const imageTensor = tf.browser.fromPixels(input);
        const resized = tf.image.resizeBilinear(imageTensor, [targetSize, targetSize]);
        imageTensor.dispose();
        return resized as tf.Tensor3D;
      });
    }
    
    return null; // Use original input
  }

  private updatePerformanceMetrics(startTime: number): void {
    const inferenceTime = performance.now() - startTime;
    this.performanceMetrics.inferenceTime = inferenceTime;
    
    // Update FPS
    const currentFPS = 1000 / inferenceTime;
    this.fpsHistory.push(currentFPS);
    if (this.fpsHistory.length > this.FPS_HISTORY_SIZE) {
      this.fpsHistory.shift();
    }
    this.performanceMetrics.fps = 
      this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    // Estimate memory usage
    const numTensors = tf.memory().numTensors;
    const numBytes = tf.memory().numBytes;
    this.performanceMetrics.memoryUsage = numBytes / 1024 / 1024; // MB

    // GPU utilization (approximation based on inference time)
    const targetInferenceTime = 1000 / this.config.targetFPS;
    this.performanceMetrics.gpuUtilization = 
      Math.min(100, (inferenceTime / targetInferenceTime) * 100);
  }

  private adjustFrameSkipping(): void {
    const currentFPS = this.performanceMetrics.fps;
    const targetFPS = this.config.targetFPS;
    
    if (currentFPS < targetFPS * 0.8) {
      // Performance is too low, increase frame skipping
      this.dynamicFrameSkip = Math.min(this.dynamicFrameSkip + 1, 4);
    } else if (currentFPS > targetFPS * 1.2 && this.dynamicFrameSkip > 1) {
      // Performance is good, reduce frame skipping
      this.dynamicFrameSkip = Math.max(this.dynamicFrameSkip - 1, 1);
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  async optimizeForDevice(): Promise<InferenceConfig> {
    // Test device capabilities
    const deviceScore = await this.benchmarkDevice();
    
    // Adjust configuration based on device score
    if (deviceScore < 30) {
      // Low-end device
      this.config.modelComplexity = 'lite';
      this.config.targetFPS = 15;
      this.config.enableQuantization = true;
    } else if (deviceScore < 60) {
      // Mid-range device
      this.config.modelComplexity = 'lite';
      this.config.targetFPS = 30;
      this.config.enableQuantization = true;
    } else {
      // High-end device
      this.config.modelComplexity = 'full';
      this.config.targetFPS = 30;
      this.config.enableQuantization = false;
    }

    // Reinitialize with new config
    if (this.detector) {
      this.detector.dispose();
      await this.initialize();
    }

    return this.config;
  }

  private async benchmarkDevice(): Promise<number> {
    console.log('Benchmarking device...');
    
    // Create test tensor
    const size = 224;
    const testTensor = tf.randomNormal([1, size, size, 3]);
    
    // Measure convolution performance
    const startTime = performance.now();
    
    for (let i = 0; i < 10; i++) {
      const result = tf.tidy(() => {
        const conv = tf.conv2d(
          testTensor as tf.Tensor4D,
          tf.randomNormal([3, 3, 3, 32]),
          1,
          'same'
        );
        return tf.relu(conv);
      });
      result.dispose();
      await tf.nextFrame();
    }
    
    const elapsedTime = performance.now() - startTime;
    testTensor.dispose();
    
    // Calculate device score (higher is better)
    const deviceScore = 10000 / elapsedTime;
    console.log(`Device score: ${deviceScore.toFixed(2)}`);
    
    return deviceScore;
  }

  dispose(): void {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
    }
    
    // Clear tensor cache
    this.tensorCache.forEach(tensor => tensor.dispose());
    this.tensorCache.clear();
    
    // Clear TensorFlow.js memory
    tf.disposeVariables();
  }
}