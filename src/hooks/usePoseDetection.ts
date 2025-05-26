'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Dynamic imports for TensorFlow modules (client-side only)
const loadTensorFlowModules = async () => {
  if (typeof window === 'undefined') {
    throw new Error('TensorFlow modules can only be loaded on the client side')
  }
  
  try {
    // Import TensorFlow core first
    const tf = await import('@tensorflow/tfjs-core')
    
    // Import backends
    await import('@tensorflow/tfjs-backend-webgl')
    try {
      await import('@tensorflow/tfjs-backend-webgpu')
    } catch (e) {
      console.log('WebGPU backend not available, using WebGL')
    }
    
    // Import converter for model loading
    await import('@tensorflow/tfjs-converter')
    
    // Import main TensorFlow.js
    const tfMain = await import('@tensorflow/tfjs')
    
    // Import pose detection with error handling - exclude MediaPipe models
    const poseDetection = await import('@tensorflow-models/pose-detection')
    
    // Ensure we only use models that don't require MediaPipe
    if (!poseDetection.SupportedModels.MoveNet) {
      throw new Error('MoveNet model not available')
    }
    
    return { tf: tfMain, poseDetection }
  } catch (error) {
    console.error('Failed to load TensorFlow modules:', error)
    throw new Error(`Failed to load AI models: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

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

export const usePoseDetection = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [currentPose, setCurrentPose] = useState<PoseData | null>(null)
  const [metrics, setMetrics] = useState<PoseMetrics | null>(null)
  const [fps, setFps] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [modelCapabilities, setModelCapabilities] = useState<ModelCapabilities | null>(null)
  const [tfModules, setTfModules] = useState<{ tf: any; poseDetection: any } | null>(null)

  const detectorRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const frameCountRef = useRef(0)
  const lastFpsUpdateRef = useRef(Date.now())
  const previousPoseRef = useRef<PoseData | null>(null)
  const poseHistoryRef = useRef<PoseData[]>([])

  // Device capability detection
  const detectDeviceCapabilities = useCallback(async (tf: any) => {
    try {
      await tf.ready()
      const backendName = tf.getBackend()
      const webglSupported = backendName === 'webgl'
      
      // Check GPU memory and compute capability
      const gpuInfo = tf.env().get('WEBGL_VERSION')
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      console.log('Device capabilities:', {
        backend: backendName,
        webgl: webglSupported,
        gpu: gpuInfo,
        mobile: isMobile
      })

      return {
        webglSupported,
        isMobile,
        estimatedPerformance: webglSupported ? (isMobile ? 'medium' : 'high') : 'low'
      }
    } catch (error) {
      console.error('Failed to detect device capabilities:', error)
      return { webglSupported: false, isMobile: true, estimatedPerformance: 'low' }
    }
  }, [])

  // Initialize TensorFlow and pose detection model
  const initializePoseDetection = useCallback(async () => {
    try {
      setError(null)
      
      // Load TensorFlow modules dynamically (client-side only)
      if (!tfModules) {
        console.log('Loading TensorFlow modules...')
        const modules = await loadTensorFlowModules()
        setTfModules(modules)
        
        const { tf, poseDetection } = modules
        
        // Initialize TensorFlow backend with optimization
        await tf.ready()
        
        // Set backend preferences
        if (tf.getBackend() !== 'webgl') {
          try {
            await tf.setBackend('webgl')
            await tf.ready()
          } catch (webglError) {
            console.warn('WebGL backend failed, falling back to CPU:', webglError)
            await tf.setBackend('cpu')
            await tf.ready()
          }
        }

        // Detect device capabilities
        const capabilities = await detectDeviceCapabilities(tf)
        
        // Choose optimal TensorFlow.js-only model based on device capabilities
        let model: any
        let detectorConfig: any

        if (capabilities.estimatedPerformance === 'high') {
          // High-end devices: Use MoveNet Thunder for accuracy
          model = poseDetection.SupportedModels.MoveNet
          detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
            enableSmoothing: true,
            minPoseScore: 0.15
          }
        } else if (capabilities.estimatedPerformance === 'medium') {
          // Medium devices: Use MoveNet Lightning for speed
          model = poseDetection.SupportedModels.MoveNet
          detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true,
            minPoseScore: 0.25
          }
        } else {
          // Low-end devices: Use PoseNet for compatibility (TensorFlow.js only)
          model = poseDetection.SupportedModels.PoseNet
          detectorConfig = {
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: { width: 257, height: 193 },
            multiplier: 0.5,
            quantBytes: 2
          }
        }

        console.log('Loading pose detection model:', model, detectorConfig)
        
        // Create pose detector
        detectorRef.current = await poseDetection.createDetector(model, detectorConfig)
        console.log('Pose detector created successfully:', detectorRef.current)
        
        // Set model capabilities
        setModelCapabilities({
          modelType: model === poseDetection.SupportedModels.MoveNet ? 
            (detectorConfig.modelType?.includes('thunder') ? 'MoveNet Thunder' : 'MoveNet Lightning') : 
            'PoseNet',
          supportsVideo: true,
          maxPoses: 1,
          estimatedFPS: capabilities.estimatedPerformance === 'high' ? 30 : 
                       capabilities.estimatedPerformance === 'medium' ? 25 : 15
        })

        setIsInitialized(true)
        console.log('Pose detection initialized successfully')
      }
    } catch (err) {
      console.error('Failed to initialize pose detection:', err)
      setError(`Failed to initialize AI model: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [detectDeviceCapabilities, tfModules])

  // Start camera stream with optimal settings
  const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      // Get optimal camera settings based on device
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      videoElement.srcObject = stream
      videoRef.current = videoElement
      
      return new Promise<void>((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play()
            .then(() => {
              console.log('Camera started:', {
                width: videoElement.videoWidth,
                height: videoElement.videoHeight,
                tracks: stream.getVideoTracks().map(track => ({
                  label: track.label,
                  settings: track.getSettings()
                }))
              })
              resolve()
            })
            .catch(reject)
        }
        videoElement.onerror = reject
      })
    } catch (err) {
      console.error('Failed to start camera:', err)
      setError(`Camera access failed: ${err instanceof Error ? err.message : 'Permission denied'}`)
      throw err
    }
  }, [])

  // Advanced pose detection with preprocessing
  const detectPose = useCallback(async (videoElement: HTMLVideoElement): Promise<PoseData | null> => {
    if (!detectorRef.current || !videoElement || videoElement.readyState < 2) {
      return null
    }

    try {
      // Preprocess video frame for optimal detection
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      canvas.width = videoElement.videoWidth
      canvas.height = videoElement.videoHeight
      
      // Draw and potentially enhance the frame
      ctx.drawImage(videoElement, 0, 0)
      
      // Apply preprocessing if needed (contrast, brightness adjustment)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      
      // Estimate poses
      const poses = await detectorRef.current.estimatePoses(canvas, {
        maxPoses: 1,
        flipHorizontal: true,
        scoreThreshold: 0.2
      })
      
      if (poses.length > 0) {
        const pose = poses[0]
        
        // Convert to standardized format
        const keypoints: Keypoint[] = pose.keypoints.map((kp, index) => ({
          x: kp.x,
          y: kp.y,
          confidence: kp.score || 0,
          name: kp.name || `keypoint_${index}`
        }))

        // Filter low-confidence keypoints
        const filteredKeypoints = keypoints.map(kp => ({
          ...kp,
          confidence: kp.confidence < 0.2 ? 0 : kp.confidence
        }))

        // Calculate overall pose confidence
        const validKeypoints = filteredKeypoints.filter(kp => kp.confidence > 0.2)
        const avgConfidence = validKeypoints.length > 0 ? 
          validKeypoints.reduce((sum, kp) => sum + kp.confidence, 0) / validKeypoints.length : 0

        const poseData: PoseData = {
          keypoints: filteredKeypoints,
          confidence: avgConfidence,
          timestamp: Date.now()
        }
        
        return poseData
      }
    } catch (err) {
      console.error('Pose detection error:', err)
    }
    
    return null
  }, [])

  // Advanced metrics calculation with biomechanical analysis
  const calculateMetrics = useCallback((poseData: PoseData, referencePose?: PoseData): PoseMetrics => {
    const metrics: PoseMetrics = {
      similarity: 0,
      keyDeviations: [],
      jointAngles: {},
      symmetryScore: 0,
      stabilityScore: 0,
      velocities: {},
      accelerations: {},
      balanceMetrics: {
        centerOfMass: { x: 0, y: 0 },
        stability: 0,
        sway: 0
      }
    }

    if (!poseData.keypoints.length) return metrics

    // Calculate joint angles with biomechanical accuracy
    metrics.jointAngles = calculateAdvancedJointAngles(poseData.keypoints)
    
    // Calculate symmetry with weighted scoring
    metrics.symmetryScore = calculateWeightedSymmetryScore(poseData.keypoints)
    
    // Calculate stability based on confidence and temporal consistency
    metrics.stabilityScore = calculateStabilityScore(poseData, previousPoseRef.current)
    
    // Calculate velocities and accelerations
    if (previousPoseRef.current) {
      const { velocities, accelerations } = calculateMotionMetrics(
        poseData, 
        previousPoseRef.current,
        poseHistoryRef.current
      )
      metrics.velocities = velocities
      metrics.accelerations = accelerations
    }

    // Calculate balance and center of mass
    metrics.balanceMetrics = calculateBalanceMetrics(poseData.keypoints)

    // Compare with reference pose if provided
    if (referencePose) {
      const { similarity, deviations } = compareAdvancedPoses(poseData, referencePose)
      metrics.similarity = similarity
      metrics.keyDeviations = deviations
    }

    return metrics
  }, [])

  // Start pose detection loop with performance optimization
  const startDetection = useCallback(async (canvas: HTMLCanvasElement) => {
    if (!isInitialized || !videoRef.current || isDetecting) return

    canvasRef.current = canvas
    setIsDetecting(true)
    
    let lastDetectionTime = 0
    const targetFPS = modelCapabilities?.estimatedFPS || 25
    const frameInterval = 1000 / targetFPS

    const detectLoop = async () => {
      if (!isDetecting || !videoRef.current || !canvasRef.current) return

      const now = performance.now()
      
      // Throttle detection based on target FPS
      if (now - lastDetectionTime >= frameInterval) {
        try {
          // Detect pose
          const poseData = await detectPose(videoRef.current)
          
          if (poseData) {
            setCurrentPose(poseData)
            
            // Calculate comprehensive metrics
            const poseMetrics = calculateMetrics(poseData)
            setMetrics(poseMetrics)
            
            // Update pose history for temporal analysis
            poseHistoryRef.current = [...poseHistoryRef.current.slice(-9), poseData] // Keep last 10 frames
            previousPoseRef.current = poseData
            
            // Render pose visualization with error handling
            if (canvasRef.current) {
              try {
                console.log('Rendering pose with', poseData.keypoints.length, 'keypoints')
                renderAdvancedPose(canvasRef.current, poseData, poseMetrics)
              } catch (renderError) {
                console.error('Render error:', renderError)
              }
            }
          }

          lastDetectionTime = now
        } catch (error) {
          console.error('Detection loop error:', error)
        }
      }

      // Update FPS counter
      frameCountRef.current++
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
  }, [isInitialized, isDetecting, detectPose, calculateMetrics, modelCapabilities])

  // Stop pose detection
  const stopDetection = useCallback(() => {
    setIsDetecting(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    
    // Clear pose history
    poseHistoryRef.current = []
    previousPoseRef.current = null
  }, [])

  // Advanced pose rendering with multiple visual layers
  const renderAdvancedPose = useCallback((canvas: HTMLCanvasElement, poseData: PoseData, metrics: PoseMetrics) => {
    const ctx = canvas.getContext('2d')
    if (!ctx || !videoRef.current) return

    // Get video dimensions
    const videoWidth = videoRef.current.videoWidth || videoRef.current.clientWidth
    const videoHeight = videoRef.current.videoHeight || videoRef.current.clientHeight
    
    // Set canvas size to match video - ensure it's not zero
    if (videoWidth > 0 && videoHeight > 0) {
      canvas.width = videoWidth
      canvas.height = videoHeight
      
      // Set CSS size to match container
      canvas.style.width = '100%'
      canvas.style.height = '100%'
    } else {
      // Fallback dimensions
      canvas.width = 640
      canvas.height = 480
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set rendering quality
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Draw skeleton with confidence-based styling
    drawAdvancedSkeleton(ctx, poseData.keypoints)
    
    // Draw keypoints with size based on confidence
    drawAdvancedKeypoints(ctx, poseData.keypoints)
    
    // Draw center of mass
    if (metrics.balanceMetrics.centerOfMass) {
      drawCenterOfMass(ctx, metrics.balanceMetrics.centerOfMass)
    }
    
    // Draw deviations with advanced visual feedback
    if (metrics.keyDeviations.length > 0) {
      drawAdvancedDeviations(ctx, poseData.keypoints, metrics.keyDeviations)
    }

    // Draw joint angle indicators for key joints
    drawJointAngleIndicators(ctx, poseData.keypoints, metrics.jointAngles)
  }, [])

  // Initialize on mount (client-side only)
  useEffect(() => {
    // Only initialize if we're on the client side
    if (typeof window !== 'undefined') {
      initializePoseDetection()
    }
    
    return () => {
      stopDetection()
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
      
      // Clean up TensorFlow resources
      if (detectorRef.current) {
        detectorRef.current.dispose?.()
      }
    }
  }, [initializePoseDetection, stopDetection])

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

// Advanced helper functions for biomechanical analysis

function calculateAdvancedJointAngles(keypoints: Keypoint[]): Record<string, number> {
  const angles: Record<string, number> = {}
  
  // Define joint angle calculations with anatomical accuracy
  const jointDefinitions = [
    { name: 'leftElbow', points: [5, 7, 9], weight: 1.0 },     // left shoulder, elbow, wrist
    { name: 'rightElbow', points: [6, 8, 10], weight: 1.0 },   // right shoulder, elbow, wrist
    { name: 'leftKnee', points: [11, 13, 15], weight: 1.2 },   // left hip, knee, ankle
    { name: 'rightKnee', points: [12, 14, 16], weight: 1.2 },  // right hip, knee, ankle
    { name: 'leftShoulder', points: [7, 5, 11], weight: 0.8 }, // left elbow, shoulder, hip
    { name: 'rightShoulder', points: [8, 6, 12], weight: 0.8 }, // right elbow, shoulder, hip
    { name: 'leftHip', points: [5, 11, 13], weight: 1.1 },     // left shoulder, hip, knee
    { name: 'rightHip', points: [6, 12, 14], weight: 1.1 },    // right shoulder, hip, knee
    { name: 'neck', points: [0, 5, 6], weight: 0.7 },          // nose, left shoulder, right shoulder
  ]

  jointDefinitions.forEach(joint => {
    const [p1Idx, p2Idx, p3Idx] = joint.points
    const p1 = keypoints[p1Idx]
    const p2 = keypoints[p2Idx]
    const p3 = keypoints[p3Idx]
    
    if (p1 && p2 && p3 && 
        p1.confidence > 0.3 && p2.confidence > 0.3 && p3.confidence > 0.3) {
      const angle = calculateAngleWithConfidence(p1, p2, p3, joint.weight)
      if (angle !== null) {
        angles[joint.name] = angle
      }
    }
  })

  return angles
}

function calculateAngleWithConfidence(p1: Keypoint, p2: Keypoint, p3: Keypoint, weight: number): number | null {
  // Vector from p2 to p1
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
  // Vector from p2 to p3
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }
  
  // Calculate magnitudes
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
  
  if (mag1 === 0 || mag2 === 0) return null
  
  // Calculate dot product
  const dot = v1.x * v2.x + v1.y * v2.y
  
  // Calculate angle
  const cosAngle = dot / (mag1 * mag2)
  const clampedCos = Math.max(-1, Math.min(1, cosAngle))
  const angle = Math.acos(clampedCos) * (180 / Math.PI)
  
  // Apply confidence weighting
  const avgConfidence = (p1.confidence + p2.confidence + p3.confidence) / 3
  return angle * avgConfidence * weight
}

function calculateWeightedSymmetryScore(keypoints: Keypoint[]): number {
  const symmetryPairs = [
    { left: 5, right: 6, weight: 1.2 },   // shoulders
    { left: 7, right: 8, weight: 1.0 },   // elbows
    { left: 9, right: 10, weight: 0.8 },  // wrists
    { left: 11, right: 12, weight: 1.3 }, // hips
    { left: 13, right: 14, weight: 1.1 }, // knees
    { left: 15, right: 16, weight: 0.9 }, // ankles
  ]

  let totalScore = 0
  let totalWeight = 0

  symmetryPairs.forEach(pair => {
    const leftKp = keypoints[pair.left]
    const rightKp = keypoints[pair.right]
    
    if (leftKp && rightKp && leftKp.confidence > 0.3 && rightKp.confidence > 0.3) {
      // Calculate height difference (y-coordinate symmetry)
      const heightDiff = Math.abs(leftKp.y - rightKp.y)
      
      // Calculate distance-based symmetry score
      const maxExpectedDiff = 50 // pixels
      const symmetryScore = Math.max(0, 1 - (heightDiff / maxExpectedDiff))
      
      // Weight by confidence and anatomical importance
      const confidence = (leftKp.confidence + rightKp.confidence) / 2
      const weightedScore = symmetryScore * confidence * pair.weight
      
      totalScore += weightedScore
      totalWeight += pair.weight
    }
  })

  return totalWeight > 0 ? totalScore / totalWeight : 0
}

function calculateStabilityScore(currentPose: PoseData, previousPose: PoseData | null): number {
  if (!previousPose) return currentPose.confidence

  let totalStability = 0
  let validPoints = 0

  currentPose.keypoints.forEach((currentKp, index) => {
    const prevKp = previousPose.keypoints[index]
    
    if (currentKp && prevKp && currentKp.confidence > 0.3 && prevKp.confidence > 0.3) {
      // Calculate movement distance
      const distance = Math.sqrt(
        Math.pow(currentKp.x - prevKp.x, 2) + 
        Math.pow(currentKp.y - prevKp.y, 2)
      )
      
      // Stability decreases with movement (expect some natural movement)
      const expectedMovement = 10 // pixels per frame
      const stability = Math.max(0, 1 - Math.max(0, distance - expectedMovement) / 50)
      
      totalStability += stability * currentKp.confidence
      validPoints++
    }
  })

  return validPoints > 0 ? totalStability / validPoints : 0
}

function calculateMotionMetrics(
  currentPose: PoseData, 
  previousPose: PoseData, 
  poseHistory: PoseData[]
): { velocities: Record<string, number>; accelerations: Record<string, number> } {
  const velocities: Record<string, number> = {}
  const accelerations: Record<string, number> = {}

  const timeDelta = currentPose.timestamp - previousPose.timestamp
  if (timeDelta === 0) return { velocities, accelerations }

  // Calculate velocities for key body parts
  const bodyParts = [
    { name: 'leftHand', index: 9 },
    { name: 'rightHand', index: 10 },
    { name: 'leftFoot', index: 15 },
    { name: 'rightFoot', index: 16 },
    { name: 'head', index: 0 },
    { name: 'torso', index: 5 }, // Using left shoulder as torso proxy
  ]

  bodyParts.forEach(part => {
    const currentKp = currentPose.keypoints[part.index]
    const prevKp = previousPose.keypoints[part.index]
    
    if (currentKp && prevKp && currentKp.confidence > 0.3 && prevKp.confidence > 0.3) {
      // Calculate velocity (pixels per second)
      const deltaX = currentKp.x - prevKp.x
      const deltaY = currentKp.y - prevKp.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      const velocity = distance / (timeDelta / 1000)
      
      velocities[part.name] = velocity
      
      // Calculate acceleration if we have enough history
      if (poseHistory.length >= 2) {
        const prevPrevPose = poseHistory[poseHistory.length - 2]
        const prevPrevKp = prevPrevPose.keypoints[part.index]
        
        if (prevPrevKp && prevPrevKp.confidence > 0.3) {
          const prevTimeDelta = previousPose.timestamp - prevPrevPose.timestamp
          if (prevTimeDelta > 0) {
            const prevDeltaX = prevKp.x - prevPrevKp.x
            const prevDeltaY = prevKp.y - prevPrevKp.y
            const prevDistance = Math.sqrt(prevDeltaX * prevDeltaX + prevDeltaY * prevDeltaY)
            const prevVelocity = prevDistance / (prevTimeDelta / 1000)
            
            const acceleration = (velocity - prevVelocity) / (timeDelta / 1000)
            accelerations[part.name] = acceleration
          }
        }
      }
    }
  })

  return { velocities, accelerations }
}

function calculateBalanceMetrics(keypoints: Keypoint[]): {
  centerOfMass: { x: number; y: number }
  stability: number
  sway: number
} {
  // Define body segment weights for center of mass calculation
  const segmentWeights = [
    { indices: [0, 1, 2, 3, 4], weight: 0.08 },  // head
    { indices: [5, 6], weight: 0.16 },           // shoulders
    { indices: [7, 8], weight: 0.06 },           // upper arms
    { indices: [9, 10], weight: 0.04 },          // forearms + hands
    { indices: [11, 12], weight: 0.46 },         // torso + hips
    { indices: [13, 14], weight: 0.14 },         // thighs
    { indices: [15, 16], weight: 0.06 },         // lower legs + feet
  ]

  let totalX = 0
  let totalY = 0
  let totalWeight = 0

  segmentWeights.forEach(segment => {
    const validKeypoints = segment.indices
      .map(i => keypoints[i])
      .filter(kp => kp && kp.confidence > 0.3)
    
    if (validKeypoints.length > 0) {
      const avgX = validKeypoints.reduce((sum, kp) => sum + kp.x, 0) / validKeypoints.length
      const avgY = validKeypoints.reduce((sum, kp) => sum + kp.y, 0) / validKeypoints.length
      
      totalX += avgX * segment.weight
      totalY += avgY * segment.weight
      totalWeight += segment.weight
    }
  })

  const centerOfMass = totalWeight > 0 ? 
    { x: totalX / totalWeight, y: totalY / totalWeight } : 
    { x: 0, y: 0 }

  // Calculate stability based on base of support
  const leftFoot = keypoints[15]
  const rightFoot = keypoints[16]
  
  let stability = 0
  if (leftFoot && rightFoot && leftFoot.confidence > 0.3 && rightFoot.confidence > 0.3) {
    const footSpan = Math.abs(leftFoot.x - rightFoot.x)
    const comWithinBase = centerOfMass.x >= Math.min(leftFoot.x, rightFoot.x) - 20 &&
                          centerOfMass.x <= Math.max(leftFoot.x, rightFoot.x) + 20
    stability = comWithinBase ? Math.min(1, footSpan / 100) : 0
  }

  // Calculate sway (simplified - would need temporal data for full implementation)
  const sway = 0 // This would require pose history to calculate properly

  return { centerOfMass, stability, sway }
}

function compareAdvancedPoses(current: PoseData, reference: PoseData): {
  similarity: number
  deviations: Array<{
    keypointId: number
    distance: number
    direction: { x: number; y: number }
  }>
} {
  const deviations = []
  let totalDistance = 0
  let validComparisons = 0

  // Weight different keypoints by importance
  const keypointWeights = [
    1.0, 0.8, 0.8, 0.6, 0.6, // head keypoints
    1.2, 1.2,                 // shoulders
    1.0, 1.0,                 // elbows
    0.8, 0.8,                 // wrists
    1.3, 1.3,                 // hips
    1.1, 1.1,                 // knees
    0.9, 0.9                  // ankles
  ]

  for (let i = 0; i < Math.min(current.keypoints.length, reference.keypoints.length); i++) {
    const currentKp = current.keypoints[i]
    const refKp = reference.keypoints[i]
    const weight = keypointWeights[i] || 1.0
    
    if (currentKp.confidence > 0.3 && refKp.confidence > 0.3) {
      const distance = Math.sqrt(
        Math.pow(currentKp.x - refKp.x, 2) + 
        Math.pow(currentKp.y - refKp.y, 2)
      )
      
      totalDistance += distance * weight
      validComparisons++
      
      // Significant deviation threshold (adaptive based on keypoint importance)
      const deviationThreshold = 30 / weight
      if (distance > deviationThreshold) {
        deviations.push({
          keypointId: i,
          distance,
          direction: {
            x: refKp.x - currentKp.x,
            y: refKp.y - currentKp.y
          }
        })
      }
    }
  }

  // Calculate similarity with exponential decay for larger distances
  const avgDistance = validComparisons > 0 ? totalDistance / validComparisons : 0
  const similarity = Math.max(0, Math.exp(-avgDistance / 50))

  return { similarity, deviations }
}

// Advanced rendering functions

function drawAdvancedSkeleton(ctx: CanvasRenderingContext2D, keypoints: Keypoint[]) {
  const connections = [
    // Face
    { start: 0, end: 1, weight: 0.5 },
    { start: 0, end: 2, weight: 0.5 },
    { start: 1, end: 3, weight: 0.5 },
    { start: 2, end: 4, weight: 0.5 },
    
    // Upper body
    { start: 5, end: 7, weight: 1.0 },   // left shoulder to elbow
    { start: 7, end: 9, weight: 1.0 },   // left elbow to wrist
    { start: 6, end: 8, weight: 1.0 },   // right shoulder to elbow
    { start: 8, end: 10, weight: 1.0 },  // right elbow to wrist
    { start: 5, end: 6, weight: 1.2 },   // shoulders
    { start: 5, end: 11, weight: 1.1 },  // left shoulder to hip
    { start: 6, end: 12, weight: 1.1 },  // right shoulder to hip
    
    // Lower body
    { start: 11, end: 13, weight: 1.2 }, // left hip to knee
    { start: 13, end: 15, weight: 1.2 }, // left knee to ankle
    { start: 12, end: 14, weight: 1.2 }, // right hip to knee
    { start: 14, end: 16, weight: 1.2 }, // right knee to ankle
    { start: 11, end: 12, weight: 1.3 }, // hips
  ]

  connections.forEach(conn => {
    const startKp = keypoints[conn.start]
    const endKp = keypoints[conn.end]
    
    if (startKp && endKp && startKp.confidence > 0.3 && endKp.confidence > 0.3) {
      const avgConfidence = (startKp.confidence + endKp.confidence) / 2
      const alpha = Math.max(0.3, avgConfidence)
      const lineWidth = 2 + (conn.weight * 2 * avgConfidence)
      
      ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`
      ctx.lineWidth = lineWidth
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 3 + (conn.weight * 2)
      
      ctx.beginPath()
      ctx.moveTo(startKp.x, startKp.y)
      ctx.lineTo(endKp.x, endKp.y)
      ctx.stroke()
    }
  })

  ctx.shadowBlur = 0
}

function drawAdvancedKeypoints(ctx: CanvasRenderingContext2D, keypoints: Keypoint[]) {
  keypoints.forEach((kp, index) => {
    if (kp.confidence > 0.2) {
      const radius = 3 + (kp.confidence * 5)
      const alpha = Math.max(0.3, kp.confidence)
      
      // Different colors for different body parts
      let color = '#00ff00' // default green
      if (index === 0) color = '#ffff00'        // head - yellow
      else if (index >= 1 && index <= 4) color = '#ff8800' // face - orange
      else if (index >= 5 && index <= 10) color = '#00ff88' // arms - light green
      else if (index >= 11 && index <= 16) color = '#0088ff' // legs - blue
      
      ctx.fillStyle = `rgba(${parseInt(color.slice(1,3), 16)}, ${parseInt(color.slice(3,5), 16)}, ${parseInt(color.slice(5,7), 16)}, ${alpha})`
      ctx.shadowColor = color
      ctx.shadowBlur = 6 + (kp.confidence * 4)
      
      ctx.beginPath()
      ctx.arc(kp.x, kp.y, radius, 0, 2 * Math.PI)
      ctx.fill()
    }
  })
  
  ctx.shadowBlur = 0
}

function drawCenterOfMass(ctx: CanvasRenderingContext2D, centerOfMass: { x: number; y: number }) {
  ctx.fillStyle = 'rgba(255, 0, 255, 0.8)'
  ctx.shadowColor = '#ff00ff'
  ctx.shadowBlur = 8
  
  ctx.beginPath()
  ctx.arc(centerOfMass.x, centerOfMass.y, 8, 0, 2 * Math.PI)
  ctx.fill()
  
  // Draw crosshairs
  ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(centerOfMass.x - 15, centerOfMass.y)
  ctx.lineTo(centerOfMass.x + 15, centerOfMass.y)
  ctx.moveTo(centerOfMass.x, centerOfMass.y - 15)
  ctx.lineTo(centerOfMass.x, centerOfMass.y + 15)
  ctx.stroke()
  
  ctx.shadowBlur = 0
}

function drawAdvancedDeviations(
  ctx: CanvasRenderingContext2D, 
  keypoints: Keypoint[], 
  deviations: Array<{keypointId: number; distance: number; direction: {x: number; y: number}}>
) {
  deviations.forEach(deviation => {
    const kp = keypoints[deviation.keypointId]
    if (kp && kp.confidence > 0.3) {
      const time = Date.now() / 400
      const pulse = 0.5 + 0.5 * Math.sin(time)
      const intensity = Math.min(1, deviation.distance / 100)
      
      // Pulsing error circle
      ctx.fillStyle = `rgba(255, 68, 68, ${0.4 + pulse * 0.4 * intensity})`
      ctx.shadowColor = '#ff4444'
      ctx.shadowBlur = 8 + pulse * 4
      
      ctx.beginPath()
      ctx.arc(kp.x, kp.y, 12 + pulse * 6 * intensity, 0, 2 * Math.PI)
      ctx.fill()
      
      // Direction arrow for significant deviations
      if (deviation.distance > 25) {
        const arrowLength = Math.min(60, deviation.distance * 0.8)
        const direction = deviation.direction
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
        
        if (magnitude > 0) {
          const normalizedDir = {
            x: direction.x / magnitude,
            y: direction.y / magnitude
          }
          
          ctx.strokeStyle = `rgba(255, 68, 68, ${0.8 * intensity})`
          ctx.lineWidth = 3 + intensity
          ctx.shadowColor = '#ff4444'
          ctx.shadowBlur = 6
          
          // Arrow body
          ctx.beginPath()
          ctx.moveTo(kp.x, kp.y)
          ctx.lineTo(kp.x + normalizedDir.x * arrowLength, kp.y + normalizedDir.y * arrowLength)
          ctx.stroke()
          
          // Arrow head
          const headLength = 8 + intensity * 4
          const angle = Math.atan2(normalizedDir.y, normalizedDir.x)
          
          ctx.fillStyle = `rgba(255, 68, 68, ${0.8 * intensity})`
          ctx.beginPath()
          ctx.moveTo(kp.x + normalizedDir.x * arrowLength, kp.y + normalizedDir.y * arrowLength)
          ctx.lineTo(
            kp.x + normalizedDir.x * arrowLength - headLength * Math.cos(angle - Math.PI / 6),
            kp.y + normalizedDir.y * arrowLength - headLength * Math.sin(angle - Math.PI / 6)
          )
          ctx.lineTo(
            kp.x + normalizedDir.x * arrowLength - headLength * Math.cos(angle + Math.PI / 6),
            kp.y + normalizedDir.y * arrowLength - headLength * Math.sin(angle + Math.PI / 6)
          )
          ctx.closePath()
          ctx.fill()
        }
      }
    }
  })
  
  ctx.shadowBlur = 0
}

function drawJointAngleIndicators(
  ctx: CanvasRenderingContext2D, 
  keypoints: Keypoint[], 
  jointAngles: Record<string, number>
) {
  const jointPositions = {
    leftElbow: 7,
    rightElbow: 8,
    leftKnee: 13,
    rightKnee: 14
  }

  Object.entries(jointAngles).forEach(([jointName, angle]) => {
    const keypointIndex = jointPositions[jointName as keyof typeof jointPositions]
    if (keypointIndex !== undefined) {
      const kp = keypoints[keypointIndex]
      if (kp && kp.confidence > 0.5) {
        // Color based on angle (green for good, yellow for caution, red for extreme)
        let color = '#00ff00'
        if (angle < 30 || angle > 170) color = '#ff4444'
        else if (angle < 60 || angle > 150) color = '#ffff00'
        
        ctx.fillStyle = color
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 2
        
        ctx.fillText(`${Math.round(angle)}°`, kp.x, kp.y - 20)
      }
    }
  })
  
  ctx.shadowBlur = 0
}