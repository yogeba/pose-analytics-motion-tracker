/**
 * Performance Optimizer for Pose Detection
 * Achieves 30+ FPS on mobile devices through various optimization techniques
 */

export interface PerformanceConfig {
  targetFPS: number
  maxFPS: number
  adaptiveQuality: boolean
  skipFrames: boolean
  gpuAcceleration: boolean
}

export interface PerformanceMetrics {
  currentFPS: number
  averageFPS: number
  frameTime: number
  droppedFrames: number
  gpuMemory?: number
  cpuUsage?: number
}

export class PerformanceOptimizer {
  private config: PerformanceConfig
  private frameTimestamps: number[] = []
  private lastFrameTime: number = 0
  private frameSkipCounter: number = 0
  private droppedFrames: number = 0
  private performanceLevel: 'high' | 'medium' | 'low' = 'high'
  
  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      targetFPS: 30,
      maxFPS: 60,
      adaptiveQuality: true,
      skipFrames: true,
      gpuAcceleration: true,
      ...config
    }
  }
  
  /**
   * Determine if current frame should be processed
   */
  shouldProcessFrame(): boolean {
    const now = performance.now()
    const deltaTime = now - this.lastFrameTime
    const targetFrameTime = 1000 / this.config.targetFPS
    
    // Skip frame if we're running too slow
    if (this.config.skipFrames && deltaTime < targetFrameTime) {
      this.frameSkipCounter++
      return false
    }
    
    this.lastFrameTime = now
    this.frameSkipCounter = 0
    return true
  }
  
  /**
   * Update FPS metrics
   */
  updateMetrics(): PerformanceMetrics {
    const now = performance.now()
    this.frameTimestamps.push(now)
    
    // Keep only last second of timestamps
    const oneSecondAgo = now - 1000
    this.frameTimestamps = this.frameTimestamps.filter(t => t > oneSecondAgo)
    
    const currentFPS = this.frameTimestamps.length
    const averageFPS = this.calculateAverageFPS()
    const frameTime = this.frameTimestamps.length > 1 
      ? now - this.frameTimestamps[this.frameTimestamps.length - 2]
      : 16.67
    
    // Adapt performance level based on FPS
    if (this.config.adaptiveQuality) {
      this.adaptPerformanceLevel(currentFPS)
    }
    
    return {
      currentFPS,
      averageFPS,
      frameTime,
      droppedFrames: this.droppedFrames,
      gpuMemory: this.getGPUMemory(),
      cpuUsage: this.getCPUUsage()
    }
  }
  
  /**
   * Get recommended model complexity based on device performance
   */
  getRecommendedModelComplexity(): 'lite' | 'full' | 'heavy' {
    switch (this.performanceLevel) {
      case 'high':
        return 'heavy'
      case 'medium':
        return 'full'
      case 'low':
        return 'lite'
    }
  }
  
  /**
   * Get recommended canvas size for current performance level
   */
  getOptimalCanvasSize(videoWidth: number, videoHeight: number): { width: number; height: number } {
    let scale = 1
    
    switch (this.performanceLevel) {
      case 'high':
        scale = 1 // Full resolution
        break
      case 'medium':
        scale = 0.75 // 75% resolution
        break
      case 'low':
        scale = 0.5 // 50% resolution
        break
    }
    
    return {
      width: Math.round(videoWidth * scale),
      height: Math.round(videoHeight * scale)
    }
  }
  
  /**
   * Optimize TensorFlow.js settings for performance
   */
  getTensorFlowOptimizations() {
    return {
      // Enable WebGL optimizations
      webgl: {
        pack: true,
        channelsLast: false,
        downloadUnpackNumChannels: 2,
        enableSharedTextureUpload: true
      },
      // Model execution optimizations
      execution: {
        parallel: true,
        cache: true,
        delayMs: this.performanceLevel === 'low' ? 100 : 0
      }
    }
  }
  
  /**
   * Get skip frame pattern for consistent frame pacing
   */
  getFrameSkipPattern(): number {
    switch (this.performanceLevel) {
      case 'high':
        return 1 // Process every frame
      case 'medium':
        return 2 // Process every 2nd frame
      case 'low':
        return 3 // Process every 3rd frame
    }
  }
  
  /**
   * Clean up tensors to prevent memory leaks
   */
  cleanupTensors(tf: any, tensors: any[]): void {
    tensors.forEach(tensor => {
      if (tensor && !tensor.isDisposed) {
        tensor.dispose()
      }
    })
    
    // Force garbage collection if memory usage is high
    if (tf.memory().numTensors > 100) {
      console.warn('High tensor count, forcing cleanup')
      tf.disposeVariables()
    }
  }
  
  private calculateAverageFPS(): number {
    if (this.frameTimestamps.length < 2) return 0
    
    const duration = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0]
    return Math.round((this.frameTimestamps.length - 1) * 1000 / duration)
  }
  
  private adaptPerformanceLevel(currentFPS: number): void {
    const targetFPS = this.config.targetFPS
    
    if (currentFPS < targetFPS * 0.7) {
      // Running too slow, decrease quality
      if (this.performanceLevel === 'high') {
        this.performanceLevel = 'medium'
        console.log('Performance: Switching to medium quality')
      } else if (this.performanceLevel === 'medium') {
        this.performanceLevel = 'low'
        console.log('Performance: Switching to low quality')
      }
    } else if (currentFPS > targetFPS * 1.2) {
      // Running well, try to increase quality
      if (this.performanceLevel === 'low') {
        this.performanceLevel = 'medium'
        console.log('Performance: Switching to medium quality')
      } else if (this.performanceLevel === 'medium') {
        this.performanceLevel = 'high'
        console.log('Performance: Switching to high quality')
      }
    }
  }
  
  private getGPUMemory(): number | undefined {
    // WebGL memory estimation
    try {
      const gl = document.createElement('canvas').getContext('webgl')
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info')
        if (ext) {
          const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          // Rough estimation based on renderer string
          if (renderer.includes('Apple')) return 4096
          if (renderer.includes('NVIDIA') || renderer.includes('AMD')) return 8192
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return undefined
  }
  
  private getCPUUsage(): number | undefined {
    // This is a rough estimation based on frame timing
    if (this.frameTimestamps.length < 2) return undefined
    
    const avgFrameTime = this.calculateAverageFrameTime()
    const targetFrameTime = 1000 / this.config.targetFPS
    
    // Estimate CPU usage as percentage of target frame time
    return Math.min(100, Math.round((avgFrameTime / targetFrameTime) * 100))
  }
  
  private calculateAverageFrameTime(): number {
    if (this.frameTimestamps.length < 2) return 16.67
    
    let totalTime = 0
    for (let i = 1; i < this.frameTimestamps.length; i++) {
      totalTime += this.frameTimestamps[i] - this.frameTimestamps[i - 1]
    }
    
    return totalTime / (this.frameTimestamps.length - 1)
  }
}

// Singleton instance for global performance tracking
export const performanceOptimizer = new PerformanceOptimizer()

// Utility function for RAF throttling
export function throttleRAF(callback: () => void, fps: number = 30): () => void {
  let lastTime = 0
  const targetInterval = 1000 / fps
  
  return function throttled() {
    const now = performance.now()
    const deltaTime = now - lastTime
    
    if (deltaTime >= targetInterval) {
      lastTime = now - (deltaTime % targetInterval)
      callback()
    }
  }
}

// Memory-efficient circular buffer for metrics
export class MetricsBuffer {
  private buffer: Float32Array
  private index: number = 0
  private size: number
  
  constructor(size: number = 60) {
    this.size = size
    this.buffer = new Float32Array(size)
  }
  
  push(value: number): void {
    this.buffer[this.index] = value
    this.index = (this.index + 1) % this.size
  }
  
  getAverage(): number {
    let sum = 0
    for (let i = 0; i < this.size; i++) {
      sum += this.buffer[i]
    }
    return sum / this.size
  }
  
  getLatest(): number {
    const prevIndex = this.index === 0 ? this.size - 1 : this.index - 1
    return this.buffer[prevIndex]
  }
}