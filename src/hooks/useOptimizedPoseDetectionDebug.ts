'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PerformanceOptimizer, performanceOptimizer, throttleRAF, MetricsBuffer } from '@/lib/performance/PerformanceOptimizer'

// DEBUG VERSION - Extensive logging for troubleshooting

export interface Keypoint {
  x: number
  y: number
  confidence: number
  name?: string
}

export interface PoseData {
  keypoints: Keypoint[]
  confidence: number
  timestamp: number
}

export interface PoseMetrics {
  similarity: number
  keyDeviations: Array<{
    keypointId: number
    distance: number
    direction: { x: number; y: number }
  }>
  jointAngles: Record<string, number>
  symmetryScore: number
  stabilityScore: number
  velocities: Record<string, number>
  accelerations: Record<string, number>
  balanceMetrics: {
    centerOfMass: { x: number; y: number }
    stability: number
    sway: number
  }
}

export interface ModelCapabilities {
  modelType: string
  supportsVideo: boolean
  maxPoses: number
  estimatedFPS: number
}

// Global debug object
if (typeof window !== 'undefined') {
  (window as any).__POSE_DEBUG__ = {
    logs: [],
    detections: 0,
    errors: [],
    state: {},
    lastUpdate: Date.now()
  }
}

const debugLog = (category: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString()
  const logEntry = { timestamp, category, message, data }
  
  console.log(`[${category}] ${message}`, data || '')
  
  if (typeof window !== 'undefined' && (window as any).__POSE_DEBUG__) {
    (window as any).__POSE_DEBUG__.logs.push(logEntry)
    ;(window as any).__POSE_DEBUG__.lastUpdate = Date.now()
    
    // Keep only last 100 logs
    if ((window as any).__POSE_DEBUG__.logs.length > 100) {
      (window as any).__POSE_DEBUG__.logs.shift()
    }
  }
}

export const useOptimizedPoseDetectionDebug = () => {
  debugLog('HOOK', 'useOptimizedPoseDetectionDebug initialized')
  
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [currentPose, setCurrentPose] = useState<PoseData | null>(null)
  const [metrics, setMetrics] = useState<PoseMetrics | null>(null)
  const [fps, setFps] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [modelCapabilities, setModelCapabilities] = useState<ModelCapabilities | null>(null)

  const detectorRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const performanceRef = useRef(new PerformanceOptimizer({ targetFPS: 30 }))
  const fpsBuffer = useRef(new MetricsBuffer(30))
  const tfRef = useRef<any>(null)
  
  const frameCountRef = useRef(0)
  const lastRenderTime = useRef(0)
  const detectionCount = useRef(0)

  // Initialize pose detection with debugging
  const initializePoseDetection = useCallback(async () => {
    try {
      debugLog('INIT', 'Starting pose detection initialization')
      setError(null)
      
      if (typeof window === 'undefined') {
        debugLog('INIT', 'Window undefined, skipping initialization')
        return
      }

      debugLog('INIT', 'Loading TensorFlow.js...')
      
      const tf = await import('@tensorflow/tfjs')
      await import('@tensorflow/tfjs-backend-webgl')
      
      tfRef.current = tf
      debugLog('INIT', 'TensorFlow.js loaded', { version: tf.version })
      
      await tf.ready()
      debugLog('INIT', 'TensorFlow ready', { backend: tf.getBackend() })
      
      // Set WebGL backend
      if (tf.getBackend() !== 'webgl') {
        debugLog('INIT', 'Switching to WebGL backend')
        try {
          await tf.setBackend('webgl')
          await tf.ready()
          debugLog('INIT', 'WebGL backend set successfully')
        } catch (e) {
          debugLog('INIT', 'WebGL failed, falling back to CPU', e)
          await tf.setBackend('cpu')
          await tf.ready()
        }
      }

      // Load pose detection
      debugLog('INIT', 'Loading pose-detection models...')
      const poseDetection = await import('@tensorflow-models/pose-detection')
      debugLog('INIT', 'Pose-detection loaded')
      
      // Create detector
      debugLog('INIT', 'Creating MoveNet detector...')
      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
          minPoseScore: 0.25
        }
      )
      
      debugLog('INIT', 'MoveNet detector created successfully')
      
      setModelCapabilities({
        modelType: 'MoveNet Lightning',
        supportsVideo: true,
        maxPoses: 1,
        estimatedFPS: 30
      })

      setIsInitialized(true)
      debugLog('INIT', 'Initialization complete')
      
      // Update debug state
      if ((window as any).__POSE_DEBUG__) {
        (window as any).__POSE_DEBUG__.state.initialized = true
        ;(window as any).__POSE_DEBUG__.state.modelType = 'MoveNet Lightning'
      }
      
    } catch (err) {
      debugLog('INIT', 'Initialization failed', err)
      console.error('Failed to initialize pose detection:', err)
      
      let errorMessage = 'Failed to initialize AI model'
      if (err instanceof Error) {
        errorMessage = err.message
        if ((window as any).__POSE_DEBUG__) {
          (window as any).__POSE_DEBUG__.errors.push({
            timestamp: Date.now(),
            error: err.message,
            stack: err.stack
          })
        }
      }
      
      setError(errorMessage)
      setIsInitialized(false)
    }
  }, [])

  // Start camera with debugging
  const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    debugLog('CAMERA', 'Starting camera', { 
      element: videoElement.tagName,
      width: videoElement.width,
      height: videoElement.height 
    })
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported')
      }

      debugLog('CAMERA', 'Requesting camera access...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      })
      
      debugLog('CAMERA', 'Camera stream obtained', {
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled
        }))
      })
      
      videoElement.srcObject = stream
      videoRef.current = videoElement
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          debugLog('CAMERA', 'Video initialization timeout')
          reject(new Error('Video initialization timeout'))
        }, 5000)
        
        videoElement.onloadedmetadata = () => {
          debugLog('CAMERA', 'Video metadata loaded', {
            videoWidth: videoElement.videoWidth,
            videoHeight: videoElement.videoHeight
          })
          clearTimeout(timeout)
          videoElement.play()
            .then(() => {
              debugLog('CAMERA', 'Video playback started')
              resolve()
            })
            .catch(e => {
              debugLog('CAMERA', 'Video play failed', e)
              reject(e)
            })
        }
      })
    } catch (err) {
      debugLog('CAMERA', 'Camera start failed', err)
      console.error('Failed to start camera:', err)
      throw err
    }
  }, [])

  // Detect pose with debugging
  const detectPose = useCallback(async (videoElement: HTMLVideoElement): Promise<PoseData | null> => {
    if (!detectorRef.current || !videoElement || videoElement.readyState < 2) {
      debugLog('DETECT', 'Detection blocked', {
        hasDetector: !!detectorRef.current,
        hasVideo: !!videoElement,
        readyState: videoElement?.readyState
      })
      return null
    }

    try {
      detectionCount.current++
      
      const poses = await detectorRef.current.estimatePoses(videoElement, {
        maxPoses: 1,
        flipHorizontal: false,
        scoreThreshold: 0.2
      })
      
      if (poses.length > 0) {
        const pose = poses[0]
        
        const keypoints: Keypoint[] = pose.keypoints.map((kp: any, index: number) => ({
          x: kp.x,
          y: kp.y,
          confidence: kp.score || 0,
          name: kp.name || `keypoint_${index}`
        }))

        const validKeypoints = keypoints.filter(kp => kp.confidence > 0.2)
        const avgConfidence = validKeypoints.length > 0 ? 
          validKeypoints.reduce((sum, kp) => sum + kp.confidence, 0) / validKeypoints.length : 0

        debugLog('DETECT', `Detection ${detectionCount.current}: ${validKeypoints.length} valid keypoints @ ${(avgConfidence * 100).toFixed(1)}%`)
        
        if ((window as any).__POSE_DEBUG__) {
          (window as any).__POSE_DEBUG__.detections++
          ;(window as any).__POSE_DEBUG__.state.lastDetection = {
            timestamp: Date.now(),
            keypoints: validKeypoints.length,
            confidence: avgConfidence
          }
        }

        const poseData = {
          keypoints,
          confidence: avgConfidence,
          timestamp: Date.now()
        }
        
        // Expose globally for testing
        if (typeof window !== 'undefined') {
          (window as any).__POSE_DATA__ = poseData
        }
        
        return poseData
      }
      
      debugLog('DETECT', 'No poses detected in frame')
    } catch (err) {
      debugLog('DETECT', 'Detection error', err)
      if ((window as any).__POSE_DEBUG__) {
        (window as any).__POSE_DEBUG__.errors.push({
          timestamp: Date.now(),
          phase: 'detection',
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
    
    return null
  }, [])

  // Render pose with debugging
  const renderPose = useCallback((canvas: HTMLCanvasElement, poseData: PoseData) => {
    const ctx = canvas.getContext('2d')
    if (!ctx || !videoRef.current) {
      debugLog('RENDER', 'Render blocked', {
        hasContext: !!ctx,
        hasVideo: !!videoRef.current
      })
      return
    }

    const videoWidth = videoRef.current.videoWidth || 640
    const videoHeight = videoRef.current.videoHeight || 480
    
    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth
      canvas.height = videoHeight
      debugLog('RENDER', 'Canvas resized', { width: videoWidth, height: videoHeight })
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw skeleton
    ctx.save()
    ctx.scale(-1, 1)
    ctx.translate(-canvas.width, 0)

    // Draw connections and keypoints
    const validKeypoints = poseData.keypoints.filter(kp => kp.confidence > 0.3)
    debugLog('RENDER', `Rendering ${validKeypoints.length} keypoints`)

    // Simple keypoint rendering
    validKeypoints.forEach(kp => {
      ctx.fillStyle = `rgba(0, 255, 255, ${kp.confidence})`
      ctx.beginPath()
      ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI)
      ctx.fill()
    })
    
    ctx.restore()
    
    // Update FPS
    const now = performance.now()
    const frameTime = now - lastRenderTime.current
    lastRenderTime.current = now
    fpsBuffer.current.push(1000 / frameTime)
    setFps(Math.round(fpsBuffer.current.getAverage()))
  }, [])

  // Start detection with debugging
  const startDetection = useCallback(async (canvas: HTMLCanvasElement) => {
    debugLog('START', 'Starting detection', {
      isInitialized,
      hasVideo: !!videoRef.current,
      isDetecting
    })
    
    if (!isInitialized || !videoRef.current || isDetecting) {
      return
    }

    canvasRef.current = canvas
    setIsDetecting(true)
    
    const detectLoop = async () => {
      if (!videoRef.current || !canvasRef.current || !isDetecting) {
        debugLog('LOOP', 'Detection loop stopped')
        return
      }

      try {
        const poseData = await detectPose(videoRef.current)
        
        if (poseData) {
          setCurrentPose(poseData)
          renderPose(canvasRef.current, poseData)
        }
      } catch (error) {
        debugLog('LOOP', 'Loop error', error)
      }

      if (isDetecting) {
        animationRef.current = requestAnimationFrame(detectLoop)
      }
    }

    debugLog('START', 'Detection loop started')
    detectLoop()
  }, [isInitialized, isDetecting, detectPose, renderPose])

  const stopDetection = useCallback(() => {
    debugLog('STOP', 'Stopping detection')
    setIsDetecting(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    debugLog('MOUNT', 'Component mounted')
    if (typeof window !== 'undefined') {
      initializePoseDetection()
    }
    
    return () => {
      debugLog('UNMOUNT', 'Component unmounting')
      stopDetection()
    }
  }, [])

  return {
    isInitialized,
    isDetecting,
    currentPose,
    metrics,
    fps,
    error,
    modelCapabilities,
    startCamera,
    startDetection,
    stopDetection
  }
}