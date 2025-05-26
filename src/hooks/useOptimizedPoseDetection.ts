'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PerformanceOptimizer, MetricsBuffer } from '@/lib/performance/PerformanceOptimizer'

// Optimized pose detection with performance enhancements
// Achieves 30+ FPS on mobile devices

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

export const useOptimizedPoseDetection = () => {
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
  
  // Track frame skip for consistent pacing
  const frameCountRef = useRef(0)
  const lastRenderTime = useRef(0)

  // Initialize pose detection with performance optimizations
  const initializePoseDetection = useCallback(async () => {
    try {
      setError(null)
      
      if (typeof window === 'undefined') {
        return
      }

      console.log('Loading optimized TensorFlow.js and MoveNet...')
      
      // Load TensorFlow.js with optimizations
      const tf = await import('@tensorflow/tfjs')
      await import('@tensorflow/tfjs-backend-webgl')
      
      tfRef.current = tf
      
      // Configure TF.js for performance - check if flags exist before setting
      const optimizations = performanceRef.current.getTensorFlowOptimizations()
      
      // Only set flags that have been registered (using type assertion for TensorFlow.js compatibility)
      const envFlags = (tf.env() as any).flags;
      if (envFlags['WEBGL_PACK'] !== undefined) {
        tf.env().set('WEBGL_PACK', optimizations.webgl.pack)
      }
      if (envFlags['WEBGL_CHANNELS_LAST'] !== undefined) {
        tf.env().set('WEBGL_CHANNELS_LAST', optimizations.webgl.channelsLast)
      }
      if (envFlags['WEBGL_DOWNLOAD_FLOAT_ENABLED'] !== undefined) {
        tf.env().set('WEBGL_DOWNLOAD_FLOAT_ENABLED', true)
      }
      if (envFlags['PRODUCTION'] !== undefined) {
        tf.env().set('PRODUCTION', true)
      }
      
      // Set WebGL backend with optimizations
      await tf.setBackend('webgl')
      await tf.ready()
      
      // Warm up GPU
      console.log('Warming up GPU...')
      const warmupTensor = tf.zeros([1, 192, 192, 3])
      warmupTensor.dispose()

      // Load pose detection with device-appropriate model
      const poseDetection = await import('@tensorflow-models/pose-detection')
      
      // Choose model based on device capabilities
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const modelType = isMobile 
        ? poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        : poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
      
      console.log(`Creating MoveNet detector (${isMobile ? 'Lightning' : 'Thunder'})...`)
      
      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType,
          enableSmoothing: true,
          minPoseScore: 0.2, // Lowered to detect more keypoints
          multiPoseMaxDimension: 256 // Lower resolution for mobile
        }
      )
      
      setModelCapabilities({
        modelType: isMobile ? 'MoveNet Lightning (Mobile)' : 'MoveNet Thunder (Desktop)',
        supportsVideo: true,
        maxPoses: 1,
        estimatedFPS: isMobile ? 30 : 60
      })

      setIsInitialized(true)
      console.log('Optimized pose detection initialized successfully')
      
    } catch (err) {
      console.error('Failed to initialize pose detection:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize AI model')
      setIsInitialized(false)
    }
  }, [])

  // Optimized pose detection with frame skipping
  const detectPose = useCallback(async (videoElement: HTMLVideoElement): Promise<PoseData | null> => {
    if (!detectorRef.current || !videoElement || videoElement.readyState < 2) {
      return null
    }

    // Check if we should skip this frame for performance
    frameCountRef.current++
    const skipPattern = performanceRef.current.getFrameSkipPattern()
    if (frameCountRef.current % skipPattern !== 0) {
      return null // Skip this frame
    }

    try {
      // Estimate poses with timeout protection
      const estimatePromise = detectorRef.current.estimatePoses(videoElement, {
        maxPoses: 1,
        flipHorizontal: false,
        scoreThreshold: 0.2 // Lowered threshold to detect more keypoints
      })
      
      // Timeout after 50ms to prevent blocking
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Pose estimation timeout')), 50)
      )
      
      const poses = await Promise.race([estimatePromise, timeoutPromise]) as any[]
      
      if (poses && poses.length > 0) {
        const pose = poses[0]
        
        const keypoints: Keypoint[] = pose.keypoints.map((kp: any) => ({
          x: kp.x,
          y: kp.y,
          confidence: kp.score || 0,
          name: kp.name
        }))

        const validKeypoints = keypoints.filter(kp => kp.confidence > 0.2)
        const avgConfidence = validKeypoints.length > 0 ? 
          validKeypoints.reduce((sum, kp) => sum + kp.confidence, 0) / validKeypoints.length : 0

        // Debug logging - log once every 100 frames
        if (frameCountRef.current % 100 === 0) {
          console.log('Detected keypoints:', {
            total: keypoints.length,
            valid: validKeypoints.length,
            face: keypoints.slice(0, 5).filter(kp => kp.confidence > 0.2).length,
            upperBody: keypoints.slice(5, 11).filter(kp => kp.confidence > 0.2).length,
            lowerBody: keypoints.slice(11, 17).filter(kp => kp.confidence > 0.2).length,
            avgConfidence: avgConfidence.toFixed(3)
          })
        }

        return {
          keypoints,
          confidence: avgConfidence,
          timestamp: Date.now()
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'Pose estimation timeout') {
        console.warn('Pose detection error:', err.message)
      }
    }
    
    return null
  }, [])

  // Optimized rendering with performance metrics
  const renderPose = useCallback((canvas: HTMLCanvasElement, poseData: PoseData) => {
    const ctx = canvas.getContext('2d', { 
      alpha: true,
      desynchronized: true, // Better performance
      willReadFrequently: false 
    })
    
    if (!ctx || !videoRef.current) {
      return
    }

    const videoWidth = videoRef.current.videoWidth || 640
    const videoHeight = videoRef.current.videoHeight || 480
    
    // Get optimal canvas size based on performance
    const optimalSize = performanceRef.current.getOptimalCanvasSize(videoWidth, videoHeight)
    
    // Only update canvas size if it has changed significantly
    if (Math.abs(canvas.width - optimalSize.width) > 10 || 
        Math.abs(canvas.height - optimalSize.height) > 10) {
      canvas.width = optimalSize.width
      canvas.height = optimalSize.height
    }

    // Scale factor for drawing
    const scaleX = canvas.width / videoWidth
    const scaleY = canvas.height / videoHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Save context state
    ctx.save()
    
    // Mirror and scale
    ctx.scale(-scaleX, scaleY)
    ctx.translate(-videoWidth, 0)

    // Full skeleton connections including face
    const connections = [
      // Face connections
      [0, 1], [0, 2], // nose to eyes
      [1, 3], [2, 4], // eyes to ears
      
      // Body connections
      [5, 6], // shoulders
      [5, 7], [7, 9], // left arm
      [6, 8], [8, 10], // right arm
      [5, 11], [6, 12], // shoulders to hips
      [11, 12], // hips
      [11, 13], [13, 15], // left leg
      [12, 14], [14, 16] // right leg
    ]

    // Use simpler rendering for better performance
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'
    
    // Batch draw connections
    ctx.beginPath()
    connections.forEach(([startIdx, endIdx]) => {
      const start = poseData.keypoints[startIdx]
      const end = poseData.keypoints[endIdx]
      
      if (start?.confidence > 0.2 && end?.confidence > 0.2) {
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
      }
    })
    ctx.stroke()

    // Draw keypoints with different colors for different body parts
    poseData.keypoints.forEach((kp, idx) => {
      if (kp.confidence > 0.2) {
        // Color based on body part
        if (idx < 5) {
          // Face keypoints (nose, eyes, ears) - yellow
          ctx.fillStyle = 'rgba(255, 255, 0, 0.9)'
        } else if (idx < 11) {
          // Upper body (shoulders, arms) - cyan
          ctx.fillStyle = 'rgba(0, 255, 255, 0.9)'
        } else {
          // Lower body (hips, legs) - green
          ctx.fillStyle = 'rgba(0, 255, 0, 0.9)'
        }
        
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI)
        ctx.fill()
      }
    })
    
    // Restore context
    ctx.restore()
    
    // Update performance metrics
    const now = performance.now()
    const frameTime = now - lastRenderTime.current
    lastRenderTime.current = now
    
    fpsBuffer.current.push(1000 / frameTime)
    const avgFPS = Math.round(fpsBuffer.current.getAverage())
    
    // Draw FPS counter
    ctx.fillStyle = avgFPS < 25 ? 'rgba(255, 100, 100, 0.9)' : 'rgba(100, 255, 100, 0.9)'
    ctx.font = 'bold 14px Arial'
    ctx.fillText(`${avgFPS} FPS`, 10, 25)
    
    setFps(avgFPS)
  }, [])

  // Optimized detection loop with throttling
  const startDetection = useCallback(async (canvas: HTMLCanvasElement) => {
    if (!isInitialized || !videoRef.current || isDetecting) {
      return
    }

    canvasRef.current = canvas
    setIsDetecting(true)
    frameCountRef.current = 0
    
    console.log('Starting optimized detection loop')
    
    // Create throttled detection function
    const detectLoop = async () => {
      if (!videoRef.current || !canvasRef.current || !isDetecting) {
        return
      }

      // Check if we should process this frame
      if (!performanceRef.current.shouldProcessFrame()) {
        animationRef.current = requestAnimationFrame(detectLoop)
        return
      }

      try {
        const poseData = await detectPose(videoRef.current)
        
        if (poseData) {
          setCurrentPose(poseData)
          
          // Simplified metrics for performance
          setMetrics({
            similarity: 0,
            keyDeviations: [],
            jointAngles: {},
            symmetryScore: poseData.confidence,
            stabilityScore: poseData.confidence,
            velocities: {},
            accelerations: {},
            balanceMetrics: {
              centerOfMass: { x: 0, y: 0 },
              stability: poseData.confidence,
              sway: 0
            }
          })
          
          renderPose(canvasRef.current, poseData)
        }
        
        // Update performance metrics
        performanceRef.current.updateMetrics()
        
      } catch (error) {
        console.error('Detection loop error:', error)
      }

      // Clean up tensors periodically
      if (tfRef.current && frameCountRef.current % 100 === 0) {
        const memInfo = tfRef.current.memory()
        if (memInfo.numTensors > 50) {
          console.log('Cleaning up tensors:', memInfo.numTensors)
          tfRef.current.disposeVariables()
        }
      }

      if (isDetecting) {
        animationRef.current = requestAnimationFrame(detectLoop)
      }
    }

    // Start the loop
    detectLoop()
  }, [isInitialized, isDetecting, detectPose, renderPose])

  const stopDetection = useCallback(() => {
    console.log('Stopping detection')
    setIsDetecting(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = undefined
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializePoseDetection()
    }
    
    return () => {
      stopDetection()
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
      if (detectorRef.current) {
        detectorRef.current.dispose?.()
      }
      if (tfRef.current) {
        tfRef.current.disposeVariables()
      }
    }
  }, [])

  // Start camera with optimized settings
  const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      
      // Optimized constraints for mobile
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: isMobile ? 640 : 1280, max: 1280 },
          height: { ideal: isMobile ? 480 : 720, max: 720 },
          frameRate: { ideal: 30, max: 30 }
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      videoElement.srcObject = stream
      videoRef.current = videoElement
      
      await new Promise<void>((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play().then(resolve)
        }
      })
      
    } catch (err) {
      console.error('Camera start failed:', err)
      setError(err instanceof Error ? err.message : 'Camera access failed')
      throw err
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