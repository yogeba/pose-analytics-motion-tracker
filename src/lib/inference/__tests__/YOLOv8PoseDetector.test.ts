import { YOLOv8PoseDetector } from '../YOLOv8PoseDetector';
import * as ort from 'onnxruntime-web';
import { Keypoint } from '@tensorflow-models/pose-detection';

// Mock EdgeOptimizedInference
jest.mock('../EdgeOptimizedInference');

// Mock ONNX runtime
jest.mock('onnxruntime-web', () => ({
  InferenceSession: {
    create: jest.fn()
  },
  Tensor: jest.fn((type, data, dims) => ({
    type,
    data,
    dims,
    size: data.length
  })),
  env: {
    wasm: {
      numThreads: 4,
      simd: true
    }
  }
}));

// Mock TensorFlow modules
jest.mock('@tensorflow/tfjs-core', () => ({
  browser: {
    fromPixels: jest.fn((pixels) => ({
      shape: [pixels.height, pixels.width, 3],
      dtype: 'float32',
      dispose: jest.fn()
    }))
  },
  image: {
    resizeBilinear: jest.fn((tensor, size) => ({
      ...tensor,
      shape: [size[0], size[1], 3],
      div: jest.fn((val) => ({
        ...tensor,
        transpose: jest.fn((perm) => ({
          ...tensor,
          expandDims: jest.fn((axis) => ({
            ...tensor,
            shape: [1, ...tensor.shape],
            data: jest.fn(async () => new Float32Array(1 * 3 * size[0] * size[1])),
            dispose: jest.fn()
          })),
          dispose: jest.fn()
        })),
        dispose: jest.fn()
      })),
      dispose: jest.fn()
    }))
  },
  backend: jest.fn(() => 'webgl')
}));

jest.mock('@tensorflow/tfjs-backend-webgl', () => ({}));

describe('YOLOv8PoseDetector', () => {
  let detector: YOLOv8PoseDetector;
  let mockSession: jest.Mocked<ort.InferenceSession>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock ONNX session
    mockSession = {
      run: jest.fn(),
      release: jest.fn(),
    } as any;
    
    (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);
    
    detector = new YOLOv8PoseDetector();
  });

  afterEach(async () => {
    await detector.dispose();
  });

  describe('Model Loading', () => {
    test('should load YOLOv8 pose model via ONNX.js', async () => {
      await detector.loadModel();
      
      expect(ort.InferenceSession.create).toHaveBeenCalledWith(
        expect.stringContaining('yolov8-pose'),
        expect.objectContaining({
          executionProviders: expect.arrayContaining(['webgl', 'wasm'])
        })
      );
      expect(detector.isModelLoaded()).toBe(true);
    });

    test('should handle model load failure gracefully', async () => {
      (ort.InferenceSession.create as jest.Mock).mockRejectedValue(
        new Error('Model loading failed')
      );
      
      // Should not throw because it initializes fallback
      await detector.loadModel();
      expect(detector.isModelLoaded()).toBe(true); // Fallback loaded
      expect(detector.isUsingFallback()).toBe(true);
    });

    test('should use WebGL provider on compatible devices', async () => {
      // Mock WebGL2 support
      const canvas = document.createElement('canvas');
      jest.spyOn(canvas, 'getContext').mockReturnValue({} as any);
      jest.spyOn(document, 'createElement').mockReturnValue(canvas);
      
      await detector.loadModel();
      
      expect(ort.InferenceSession.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          executionProviders: expect.arrayContaining(['webgl'])
        })
      );
    });
  });

  describe('Pose Detection', () => {
    beforeEach(async () => {
      await detector.loadModel();
    });

    test('should detect 17 keypoints with confidence scores', async () => {
      // Mock model output
      const mockOutput = createMockModelOutput(1, 17);
      mockSession.run.mockResolvedValue(mockOutput);
      
      const imageData = createMockImageData(640, 480);
      const poses = await detector.detectPoses(imageData);
      
      expect(poses).toHaveLength(1);
      expect(poses[0].keypoints).toHaveLength(17);
      
      // Verify keypoint structure
      poses[0].keypoints.forEach((keypoint, index) => {
        expect(keypoint).toMatchObject({
          x: expect.any(Number),
          y: expect.any(Number),
          score: expect.any(Number),
          name: expect.any(String)
        });
        expect(keypoint.score).toBeGreaterThanOrEqual(0);
        expect(keypoint.score).toBeLessThanOrEqual(1);
      });
    });

    test('should filter keypoints below confidence threshold', async () => {
      const mockOutput = createMockModelOutput(1, 17, 0.6); // Above pose threshold
      mockSession.run.mockResolvedValue(mockOutput);
      
      // Create output where some keypoints have low confidence
      const outputData = mockOutput.output.data as Float32Array;
      // Set some keypoint confidences below threshold
      for (let i = 0; i < 5; i++) {
        outputData[5 + i * 3 + 2] = 0.3; // Low confidence for first 5 keypoints
      }
      
      detector.setConfidenceThreshold(0.5);
      const imageData = createMockImageData(640, 480);
      const poses = await detector.detectPoses(imageData);
      
      // Should still return pose but with low-confidence keypoints marked
      expect(poses).toHaveLength(1);
      const visibleKeypoints = poses[0].keypoints.filter(kp => kp.score! >= 0.5);
      expect(visibleKeypoints.length).toBeLessThan(17);
      expect(visibleKeypoints.length).toBeGreaterThan(10); // But still have some visible
    });

    test('should handle multiple poses in single frame', async () => {
      const mockOutput = createMockModelOutput(3, 17); // 3 people
      mockSession.run.mockResolvedValue(mockOutput);
      
      const imageData = createMockImageData(640, 480);
      const poses = await detector.detectPoses(imageData, { maxPoses: 5 });
      
      expect(poses).toHaveLength(3);
      poses.forEach(pose => {
        expect(pose.keypoints).toHaveLength(17);
      });
    });

    test('should respect maxPoses limit', async () => {
      const mockOutput = createMockModelOutput(5, 17); // 5 people detected
      mockSession.run.mockResolvedValue(mockOutput);
      
      const imageData = createMockImageData(640, 480);
      const poses = await detector.detectPoses(imageData, { maxPoses: 2 });
      
      expect(poses).toHaveLength(2); // Limited to 2
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await detector.loadModel();
    });

    test('should process frame at minimum 15 FPS on mobile', async () => {
      const mockOutput = createMockModelOutput(1, 17);
      mockSession.run.mockResolvedValue(mockOutput);
      
      const imageData = createMockImageData(640, 480);
      const startTime = performance.now();
      
      // Run 15 detections
      for (let i = 0; i < 15; i++) {
        await detector.detectPoses(imageData);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerFrame = totalTime / 15;
      
      // Should process each frame in less than 66ms (15 FPS)
      expect(avgTimePerFrame).toBeLessThan(66);
    });

    test('should use frame skipping on low-end devices', async () => {
      // Simulate slow device
      detector.setDeviceProfile('low-end');
      
      const mockOutput = createMockModelOutput(1, 17);
      let runCallCount = 0;
      mockSession.run.mockImplementation(async () => {
        runCallCount++;
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate slow inference
        return mockOutput;
      });
      
      const imageData = createMockImageData(640, 480);
      
      // Process multiple frames
      for (let i = 0; i < 10; i++) {
        await detector.detectPoses(imageData);
      }
      
      // Should skip some frames
      expect(runCallCount).toBeLessThan(10);
    });
  });

  describe('Fallback Mechanism', () => {
    test('should fallback to MoveNet on model load failure', async () => {
      (ort.InferenceSession.create as jest.Mock).mockRejectedValue(
        new Error('ONNX loading failed')
      );
      
      const loadModelSpy = jest.spyOn(detector, 'loadModel');
      const fallbackSpy = jest.spyOn(detector as any, 'initializeFallbackModel');
      
      await detector.loadModel();
      
      expect(loadModelSpy).toHaveBeenCalled();
      expect(fallbackSpy).toHaveBeenCalled();
      expect(detector.isUsingFallback()).toBe(true);
    });

    test('should maintain consistent output format with fallback', async () => {
      // Force fallback
      (ort.InferenceSession.create as jest.Mock).mockRejectedValue(new Error());
      await detector.loadModel();
      
      const imageData = createMockImageData(640, 480);
      const poses = await detector.detectPoses(imageData);
      
      // Should still return standard pose format
      expect(poses).toBeInstanceOf(Array);
      if (poses.length > 0) {
        expect(poses[0].keypoints).toHaveLength(17);
      }
    });
  });

  describe('Format Handling', () => {
    beforeEach(async () => {
      await detector.loadModel();
    });

    test('should handle multiple pose formats (COCO, custom)', async () => {
      const mockOutput = createMockModelOutput(1, 17);
      mockSession.run.mockResolvedValue(mockOutput);
      
      const imageData = createMockImageData(640, 480);
      
      // Test COCO format
      const cocoPoses = await detector.detectPoses(imageData, { format: 'COCO' });
      expect(cocoPoses[0].keypoints[0].name).toBe('nose');
      
      // Test custom format
      const customPoses = await detector.detectPoses(imageData, { format: 'custom' });
      expect(customPoses[0].keypoints).toBeDefined();
    });

    test('should normalize coordinates to image dimensions', async () => {
      const mockOutput = createMockModelOutput(1, 17);
      mockSession.run.mockResolvedValue(mockOutput);
      
      const imageData = createMockImageData(1280, 720);
      const poses = await detector.detectPoses(imageData);
      
      poses[0].keypoints.forEach(keypoint => {
        expect(keypoint.x).toBeGreaterThanOrEqual(0);
        expect(keypoint.x).toBeLessThanOrEqual(1280);
        expect(keypoint.y).toBeGreaterThanOrEqual(0);
        expect(keypoint.y).toBeLessThanOrEqual(720);
      });
    });
  });

  describe('Resource Management', () => {
    test('should properly dispose of resources', async () => {
      await detector.loadModel();
      await detector.dispose();
      
      expect(mockSession.release).toHaveBeenCalled();
      expect(detector.isModelLoaded()).toBe(false);
    });

    test('should handle multiple dispose calls safely', async () => {
      await detector.loadModel();
      
      await detector.dispose();
      await detector.dispose(); // Second call should not throw
      
      expect(mockSession.release).toHaveBeenCalledTimes(1);
    });
  });
});

// Helper functions
function createMockModelOutput(numPoses: number, numKeypoints: number, confidence = 0.8) {
  // YOLOv8 output format: [batch, num_detections, 56]
  // 56 = 5 (x, y, w, h, conf) + 17 keypoints * 3 (x, y, conf)
  const stride = 56;
  const output = new Float32Array(1 * numPoses * stride);
  
  for (let p = 0; p < numPoses; p++) {
    const baseIdx = p * stride;
    // Bounding box (not used but part of format)
    output[baseIdx] = 0.5;     // x
    output[baseIdx + 1] = 0.5; // y
    output[baseIdx + 2] = 0.2; // w
    output[baseIdx + 3] = 0.4; // h
    output[baseIdx + 4] = confidence; // confidence
    
    // Keypoints
    for (let k = 0; k < numKeypoints; k++) {
      const kptIdx = baseIdx + 5 + k * 3;
      output[kptIdx] = Math.random();     // x (normalized 0-1)
      output[kptIdx + 1] = Math.random(); // y (normalized 0-1)
      output[kptIdx + 2] = confidence + (Math.random() * 0.2 - 0.1); // confidence
    }
  }
  
  const tensor = new ort.Tensor('float32', output, [1, numPoses, stride]);
  
  // Ensure dims property is set (in case mock doesn't set it automatically)
  if (!tensor.dims) {
    (tensor as any).dims = [1, numPoses, stride];
  }
  
  return {
    output: tensor
  };
}

function createMockImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  // Fill with some data to simulate real image
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;     // R
    data[i + 1] = 128; // G
    data[i + 2] = 128; // B
    data[i + 3] = 255; // A
  }
  return new ImageData(data, width, height);
}