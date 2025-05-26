export class EdgeOptimizedInference {
  async initialize(): Promise<void> {
    // Mock implementation
  }

  async detectPose(imageData: ImageData): Promise<any> {
    // Return mock pose data
    return {
      keypoints: Array.from({ length: 17 }, (_, i) => ({
        x: 100 + i * 10,
        y: 100 + i * 10,
        score: 0.9,
        name: `keypoint_${i}`
      })),
      score: 0.85
    };
  }
}