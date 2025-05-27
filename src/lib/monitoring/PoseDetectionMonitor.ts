/**
 * Industry-standard monitoring and debugging for pose detection
 * Provides real-time metrics, error tracking, and performance monitoring
 */

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  detectionTime: number
  renderTime: number
  totalFrames: number
  droppedFrames: number
  memoryUsage?: number
}

export interface DetectionMetrics {
  keypointsDetected: number
  averageConfidence: number
  minConfidence: number
  maxConfidence: number
  timestamp: number
}

export interface ErrorLog {
  timestamp: number
  type: 'initialization' | 'detection' | 'rendering' | 'camera'
  message: string
  stack?: string
  context?: any
}

export class PoseDetectionMonitor {
  private performanceMetrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    detectionTime: 0,
    renderTime: 0,
    totalFrames: 0,
    droppedFrames: 0
  }

  private detectionHistory: DetectionMetrics[] = []
  private errorLogs: ErrorLog[] = []
  private frameTimestamps: number[] = []
  private lastFrameTime = 0
  private isMonitoring = false

  // Configurable thresholds
  private readonly FPS_THRESHOLD = 20
  private readonly CONFIDENCE_THRESHOLD = 0.3
  private readonly MAX_FRAME_TIME = 50 // ms
  private readonly HISTORY_SIZE = 100

  constructor(private onMetricsUpdate?: (metrics: PerformanceMetrics) => void) {}

  /**
   * Start monitoring pose detection performance
   */
  startMonitoring() {
    this.isMonitoring = true
    this.lastFrameTime = performance.now()
    
    // Monitor memory usage if available
    if ('memory' in performance) {
      setInterval(() => {
        this.performanceMetrics.memoryUsage = (performance as any).memory.usedJSHeapSize / 1048576
      }, 1000)
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false
  }

  /**
   * Record frame start
   */
  frameStart(): number {
    const now = performance.now()
    this.frameTimestamps.push(now)
    
    // Keep only recent timestamps for FPS calculation
    const oneSecondAgo = now - 1000
    this.frameTimestamps = this.frameTimestamps.filter(t => t > oneSecondAgo)
    
    return now
  }

  /**
   * Record frame end
   */
  frameEnd(startTime: number, detectionTime: number, renderTime: number) {
    const now = performance.now()
    const frameTime = now - startTime
    
    // Update metrics
    this.performanceMetrics.frameTime = frameTime
    this.performanceMetrics.detectionTime = detectionTime
    this.performanceMetrics.renderTime = renderTime
    this.performanceMetrics.totalFrames++
    this.performanceMetrics.fps = this.frameTimestamps.length
    
    // Check for dropped frames
    if (frameTime > this.MAX_FRAME_TIME) {
      this.performanceMetrics.droppedFrames++
      this.logError('rendering', `Frame took ${frameTime.toFixed(2)}ms (threshold: ${this.MAX_FRAME_TIME}ms)`)
    }
    
    // Notify listeners
    if (this.onMetricsUpdate) {
      this.onMetricsUpdate(this.performanceMetrics)
    }
    
    this.lastFrameTime = now
  }

  /**
   * Record detection results
   */
  recordDetection(keypoints: Array<{confidence: number}>) {
    if (!keypoints.length) return
    
    const confidences = keypoints.map(kp => kp.confidence)
    const metrics: DetectionMetrics = {
      keypointsDetected: keypoints.filter(kp => kp.confidence > this.CONFIDENCE_THRESHOLD).length,
      averageConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
      minConfidence: Math.min(...confidences),
      maxConfidence: Math.max(...confidences),
      timestamp: Date.now()
    }
    
    this.detectionHistory.push(metrics)
    
    // Keep history size limited
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift()
    }
  }

  /**
   * Log an error
   */
  logError(type: ErrorLog['type'], message: string, error?: Error, context?: any) {
    const errorLog: ErrorLog = {
      timestamp: Date.now(),
      type,
      message,
      stack: error?.stack,
      context
    }
    
    this.errorLogs.push(errorLog)
    
    // Keep error log size limited
    if (this.errorLogs.length > 50) {
      this.errorLogs.shift()
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[PoseDetection ${type}]`, message, error, context)
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * Get detection history
   */
  getDetectionHistory(): DetectionMetrics[] {
    return [...this.detectionHistory]
  }

  /**
   * Get error logs
   */
  getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs]
  }

  /**
   * Check if performance is degraded
   */
  isPerformanceDegraded(): boolean {
    return this.performanceMetrics.fps < this.FPS_THRESHOLD ||
           this.performanceMetrics.frameTime > this.MAX_FRAME_TIME ||
           this.performanceMetrics.droppedFrames > this.performanceMetrics.totalFrames * 0.1
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const avgDetectionMetrics = this.detectionHistory.length > 0 ? {
      avgKeypointsDetected: this.detectionHistory.reduce((sum, m) => sum + m.keypointsDetected, 0) / this.detectionHistory.length,
      avgConfidence: this.detectionHistory.reduce((sum, m) => sum + m.averageConfidence, 0) / this.detectionHistory.length
    } : null

    return {
      performance: this.performanceMetrics,
      detection: avgDetectionMetrics,
      errors: this.errorLogs.length,
      recentErrors: this.errorLogs.slice(-5),
      isDegraded: this.isPerformanceDegraded()
    }
  }

  /**
   * Export monitoring data for analysis
   */
  exportData() {
    return {
      timestamp: Date.now(),
      performance: this.performanceMetrics,
      detectionHistory: this.detectionHistory,
      errorLogs: this.errorLogs
    }
  }
}