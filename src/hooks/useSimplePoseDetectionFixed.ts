'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Fixed pose detection with proper skeleton rendering
// Only using TensorFlow.js MoveNet model

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

export const useSimplePoseDetectionFixed = () => {
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
  const frameCountRef = useRef(0)
  const lastFpsUpdateRef = useRef(Date.now())

  // Initialize simplified pose detection with MoveNet only
  const initializePoseDetection = useCallback(async () => {
    try {
      setError(null)
      
      if (typeof window === 'undefined') {
        return
      }

      console.log('Loading TensorFlow.js and MoveNet...')
      
      // Load TensorFlow.js core
      const tf = await import('@tensorflow/tfjs')
      await import('@tensorflow/tfjs-backend-webgl')
      
      // Wait for TensorFlow to be ready
      await tf.ready()
      
      // Set WebGL backend
      if (tf.getBackend() !== 'webgl') {
        try {
          await tf.setBackend('webgl')
          await tf.ready()
        } catch {
          console.warn('WebGL not available, using CPU')
          await tf.setBackend('cpu')
          await tf.ready()
        }
      }

      // Load pose detection with MoveNet only
      const poseDetection = await import('@tensorflow-models/pose-detection')
      
      console.log('Creating MoveNet detector...')
      
      // Use Lightning model for better performance
      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
          minPoseScore: 0.25
        }
      )
      
      setModelCapabilities({
        modelType: 'MoveNet Lightning',
        supportsVideo: true,
        maxPoses: 1,
        estimatedFPS: 30
      })

      setIsInitialized(true)
      console.log('Simple pose detection initialized successfully')
      
    } catch (err) {
      console.error('Failed to initialize pose detection:', err)
      let errorMessage = 'Failed to initialize AI model'
      
      if (err instanceof Error) {
        if (err.message.includes('WebGL')) {
          errorMessage = 'WebGL not supported. Please use a modern browser with GPU acceleration enabled.'
        } else if (err.message.includes('model')) {
          errorMessage = 'Failed to load AI model. Please check your internet connection.'
        } else {
          errorMessage = `AI initialization error: ${err.message}`
        }
      }
      
      setError(errorMessage)
      setIsInitialized(false)
    }
  }, [])

  // Start camera with basic settings
  const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      // Check if camera API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser')
      }

      // Request camera permission with progressive fallback constraints
      let stream: MediaStream
      const constraints = [
        { video: { facingMode: 'user', width: { ideal: 640, min: 320 }, height: { ideal: 480, min: 240 } } },
        { video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } } },
        { video: { facingMode: 'user' } },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
        { video: true }
      ]
      
      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint)
          break
        } catch (e) {
          console.warn('Failed with constraint:', constraint, e)
          if (constraint === constraints[constraints.length - 1]) {
            throw e
          }
        }
      }
      
      if (!stream!) {
        throw new Error('Failed to get camera stream')
      }
      
      videoElement.srcObject = stream
      videoRef.current = videoElement
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video initialization timeout'))
        }, 5000)
        
        videoElement.onloadedmetadata = () => {
          clearTimeout(timeout)
          videoElement.play()
            .then(resolve)
            .catch(e => {
              console.error('Video play failed:', e)
              reject(new Error('Failed to start video playback'))
            })
        }
        
        videoElement.onerror = (e) => {
          clearTimeout(timeout)
          reject(new Error('Video element error'))
        }
      })
    } catch (err) {
      console.error('Failed to start camera:', err)
      let errorMessage = 'Camera access failed'
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Camera permission denied. Please allow camera access.'
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No camera found. Please connect a camera.'
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'Camera is already in use by another application.'
        } else {
          errorMessage = `Camera error: ${err.message}`
        }
      }
      
      setError(errorMessage)
      throw err
    }
  }, [])

  // Simple pose detection
  const detectPose = useCallback(async (videoElement: HTMLVideoElement): Promise<PoseData | null> => {
    if (!detectorRef.current || !videoElement || videoElement.readyState < 2) {
      return null
    }

    try {
      const poses = await detectorRef.current.estimatePoses(videoElement, {
        maxPoses: 1,
        flipHorizontal: false,  // Don't flip - let the video handle mirroring
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

        return {
          keypoints,
          confidence: avgConfidence,
          timestamp: Date.now()
        }
      }
    } catch (err) {
      console.error('Pose detection error:', err)
      
      // Don't set error state for individual detection failures
      // Just log and continue - this prevents UI disruption
      if (err instanceof Error && err.message.includes('GPU')) {
        console.warn('GPU error detected, may need to restart detection')
      }
    }
    
    return null
  }, [])

  // Fixed rendering with proper skeleton connections
  const renderPose = useCallback((canvas: HTMLCanvasElement, poseData: PoseData) => {
    const ctx = canvas.getContext('2d')
    if (!ctx || !videoRef.current) {
      return
    }

    const videoWidth = videoRef.current.videoWidth || 640
    const videoHeight = videoRef.current.videoHeight || 480
    
    // Only update canvas size if it has changed
    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth
      canvas.height = videoHeight
    }

    // Clear canvas with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Save context state
    ctx.save()
    
    // Mirror the canvas to match the video
    ctx.scale(-1, 1)
    ctx.translate(-canvas.width, 0)

    // Define MoveNet skeleton connections
    const connections = [
      // Face
      [0, 1], [1, 3], // nose to left eye to left ear
      [0, 2], [2, 4], // nose to right eye to right ear
      
      // Arms
      [5, 7], [7, 9],    // left shoulder -> elbow -> wrist
      [6, 8], [8, 10],   // right shoulder -> elbow -> wrist
      
      // Torso
      [5, 6],            // shoulders
      [5, 11], [6, 12],  // shoulders to hips
      [11, 12],          // hips
      
      // Legs
      [11, 13], [13, 15], // left hip -> knee -> ankle
      [12, 14], [14, 16]  // right hip -> knee -> ankle
    ]

    // Draw skeleton connections FIRST (so they appear behind keypoints)
    ctx.shadowBlur = 15
    ctx.shadowColor = 'rgba(0, 255, 255, 0.5)'
    
    connections.forEach(([startIdx, endIdx]) => {
      const start = poseData.keypoints[startIdx]
      const end = poseData.keypoints[endIdx]
      
      if (start && end && start.confidence > 0.2 && end.confidence > 0.2) {
        // Calculate line opacity based on confidence
        const opacity = Math.min(start.confidence, end.confidence)
        
        // Draw connection line
        ctx.strokeStyle = `rgba(0, 255, 255, ${opacity * 0.8})`
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.stroke()
      }
    })
    
    // Reset shadow for keypoints
    ctx.shadowBlur = 20
    ctx.shadowColor = 'rgba(0, 255, 255, 0.8)'

    // Draw keypoints on top
    poseData.keypoints.forEach((kp, index) => {
      if (kp.confidence > 0.2) {
        const radius = 4 + (kp.confidence * 3)
        
        // Outer glow ring
        ctx.fillStyle = `rgba(0, 255, 255, ${kp.confidence * 0.6})`
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, radius + 2, 0, 2 * Math.PI)
        ctx.fill()
        
        // Main keypoint
        ctx.fillStyle = `rgba(0, 255, 255, ${kp.confidence})`
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, radius, 0, 2 * Math.PI)
        ctx.fill()
        
        // Inner white dot
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, radius * 0.4, 0, 2 * Math.PI)
        ctx.fill()
        
        // Reset shadow for next keypoint
        ctx.shadowBlur = 20
      }
    })
    
    // Restore context state
    ctx.restore()
    
    // Draw UI elements (not mirrored)
    ctx.shadowBlur = 10
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    
    // Confidence score
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = 'bold 16px Arial'
    ctx.fillText(`Confidence: ${Math.round(poseData.confidence * 100)}%`, 10, 30)
    
    // Keypoint count
    const activeKeypoints = poseData.keypoints.filter(kp => kp.confidence > 0.2).length
    ctx.fillText(`Keypoints: ${activeKeypoints}/17`, 10, 50)
    
    ctx.shadowBlur = 0
  }, [])

  // Start detection loop
  const startDetection = useCallback(async (canvas: HTMLCanvasElement) => {
    if (!isInitialized || !videoRef.current || isDetecting) {
      console.log('Cannot start detection:', {
        isInitialized,
        hasVideo: !!videoRef.current,
        isDetecting
      })
      return
    }

    canvasRef.current = canvas
    setIsDetecting(true)
    
    console.log('Starting detection with fixed rendering')
    
    const detectLoop = async () => {
      if (!videoRef.current || !canvasRef.current) {
        return
      }

      try {
        const poseData = await detectPose(videoRef.current)
        
        if (poseData) {
          setCurrentPose(poseData)
          
          // Simple metrics
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
        } else {
          // Clear canvas when no pose detected
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
              
              // Show "No pose detected" message
              ctx.save()
              ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
              ctx.font = 'bold 14px Arial'
              ctx.shadowBlur = 10
              ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
              ctx.fillText('Searching for pose...', 10, 30)
              ctx.shadowBlur = 0
              ctx.restore()
            }
          }
        }
      } catch (error) {
        console.error('Detection loop error:', error)
        
        // Handle critical errors that should stop detection
        if (error instanceof Error) {
          if (error.message.includes('WebGL context lost')) {
            setError('GPU connection lost. Please refresh the page.')
            stopDetection()
            return
          }
        }
      }

      // Update FPS
      frameCountRef.current++
      const now = Date.now()
      if (now - lastFpsUpdateRef.current > 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current)))
        frameCountRef.current = 0
        lastFpsUpdateRef.current = now
      }

      if (isDetecting) {
        animationRef.current = requestAnimationFrame(detectLoop)
      }
    }

    detectLoop()
  }, [isInitialized, isDetecting, detectPose, renderPose])

  const stopDetection = useCallback(() => {
    console.log('Stopping pose detection')
    setIsDetecting(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = undefined
    }
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializePoseDetection()
    }
    
    return () => {
      stopDetection()
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
      
      if (detectorRef.current) {
        detectorRef.current.dispose?.()
      }
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