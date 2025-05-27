'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PoseDetectionMonitor } from '@/lib/monitoring/PoseDetectionMonitor'

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
  symmetryScore: number
  stabilityScore: number
  balanceMetrics: {
    stability: number
    centerOfMass: { x: number; y: number }
  }
}

// Keypoint names for MoveNet
const KEYPOINT_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle'
]

export const useUnifiedPoseDetection = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [currentPose, setCurrentPose] = useState<PoseData | null>(null)
  const [metrics, setMetrics] = useState<PoseMetrics | null>(null)
  const [fps, setFps] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState('Not started')

  const detectorRef = useRef<any>(null)
  const monitorRef = useRef(new PoseDetectionMonitor())
  const animationRef = useRef<number | undefined>(undefined)
  const frameCountRef = useRef(0)
  const lastFpsUpdateRef = useRef(Date.now())
  const lastDetectionTime = useRef(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Initialize pose detection
  const initializePoseDetection = useCallback(async () => {
    try {
      setLoadingStatus('Loading TensorFlow.js...')
      
      // Load TensorFlow.js from CDN
      if (!(window as any).tf) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js'
          script.onload = () => {
            console.log('TensorFlow.js loaded')
            resolve()
          }
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      setLoadingStatus('Loading pose-detection...')
      
      // Load pose-detection library
      if (!(window as any).poseDetection) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js'
          script.onload = () => {
            console.log('Pose detection library loaded')
            resolve()
          }
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      setLoadingStatus('Creating detector...')
      
      // Create detector
      const model = (window as any).poseDetection.SupportedModels.MoveNet
      const detectorConfig = {
        modelType: (window as any).poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
        minPoseScore: 0.25
      }
      
      detectorRef.current = await (window as any).poseDetection.createDetector(model, detectorConfig)
      
      setLoadingStatus('Ready')
      setIsInitialized(true)
      console.log('Pose detector initialized')
      
      // Start monitoring
      monitorRef.current.startMonitoring()
      
    } catch (err) {
      console.error('Failed to initialize pose detection:', err)
      setError('Failed to initialize pose detection')
      setLoadingStatus('Failed')
    }
  }, [])

  // Calculate metrics from pose data
  const calculateMetrics = useCallback((poseData: PoseData): PoseMetrics => {
    const keypoints = poseData.keypoints
    
    // Calculate center of mass
    const centerOfMass = keypoints.reduce((acc, kp) => {
      if (kp.confidence > 0.3) {
        acc.x += kp.x
        acc.y += kp.y
        acc.count++
      }
      return acc
    }, { x: 0, y: 0, count: 0 })
    
    if (centerOfMass.count > 0) {
      centerOfMass.x /= centerOfMass.count
      centerOfMass.y /= centerOfMass.count
    }
    
    // Calculate symmetry
    const leftShoulder = keypoints[5]
    const rightShoulder = keypoints[6]
    const leftHip = keypoints[11]
    const rightHip = keypoints[12]
    
    let symmetryScore = 0
    if (leftShoulder.confidence > 0.3 && rightShoulder.confidence > 0.3) {
      const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y)
      symmetryScore += 1 - Math.min(shoulderDiff / 50, 1)
    }
    if (leftHip.confidence > 0.3 && rightHip.confidence > 0.3) {
      const hipDiff = Math.abs(leftHip.y - rightHip.y)
      symmetryScore += 1 - Math.min(hipDiff / 50, 1)
    }
    symmetryScore = symmetryScore / 2
    
    // Calculate stability (based on pose confidence)
    const avgConfidence = keypoints.reduce((sum, kp) => sum + kp.confidence, 0) / keypoints.length
    const stabilityScore = avgConfidence
    
    return {
      similarity: 0.85, // Placeholder - would calculate against reference pose
      symmetryScore,
      stabilityScore,
      balanceMetrics: {
        stability: stabilityScore,
        centerOfMass: {
          x: centerOfMass.x,
          y: centerOfMass.y
        }
      }
    }
  }, [])

  // Detect pose
  const detectPose = useCallback(async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    if (!detectorRef.current || !video || !canvas) {
      return null
    }

    const frameStart = monitorRef.current.frameStart()
    const detectionStart = performance.now()

    try {
      // Detect pose
      const poses = await detectorRef.current.estimatePoses(video)
      
      const detectionTime = performance.now() - detectionStart

      if (poses && poses.length > 0) {
        const pose = poses[0]
        const keypoints = pose.keypoints.map((kp: any, index: number) => ({
          x: kp.x,
          y: kp.y,
          confidence: kp.score || 0,
          name: KEYPOINT_NAMES[index]
        }))

        const poseData: PoseData = {
          keypoints,
          confidence: pose.score || keypoints.reduce((sum: number, kp: Keypoint) => sum + kp.confidence, 0) / keypoints.length,
          timestamp: Date.now()
        }

        // Draw skeleton
        const renderStart = performance.now()
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          
          // Draw keypoints
          ctx.fillStyle = '#00ff00'
          keypoints.forEach((kp: Keypoint) => {
            if (kp.confidence > 0.3) {
              ctx.beginPath()
              ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI)
              ctx.fill()
            }
          })

          // Draw skeleton
          const connections = [
            [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
            [5, 11], [6, 12], [11, 12],
            [11, 13], [13, 15], [12, 14], [14, 16]
          ]

          ctx.strokeStyle = '#00ff00'
          ctx.lineWidth = 2
          connections.forEach(([i, j]) => {
            if (keypoints[i].confidence > 0.3 && keypoints[j].confidence > 0.3) {
              ctx.beginPath()
              ctx.moveTo(keypoints[i].x, keypoints[i].y)
              ctx.lineTo(keypoints[j].x, keypoints[j].y)
              ctx.stroke()
            }
          })
        }
        const renderTime = performance.now() - renderStart

        // Update monitoring
        monitorRef.current.frameEnd(frameStart, detectionTime, renderTime)
        monitorRef.current.recordDetection(keypoints)

        // Calculate metrics
        const calculatedMetrics = calculateMetrics(poseData)
        setMetrics(calculatedMetrics)

        return poseData
      }

      return null
    } catch (err) {
      console.error('Pose detection error:', err)
      monitorRef.current.logError('detection', 'Failed to detect pose', err as Error)
      return null
    }
  }, [calculateMetrics])

  // Start camera
  const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      })
      
      videoElement.srcObject = stream
      await videoElement.play()
      
      videoRef.current = videoElement
      console.log('Camera started')
      return true
    } catch (err) {
      console.error('Camera error:', err)
      setError('Failed to access camera')
      monitorRef.current.logError('camera', 'Failed to access camera', err as Error)
      return false
    }
  }, [])

  // Detection loop
  const runDetection = useCallback(async () => {
    if (!isInitialized || !detectorRef.current || !videoRef.current || !canvasRef.current) {
      return
    }

    const detect = async () => {
      if (!isDetecting || !videoRef.current || !canvasRef.current) {
        return
      }

      const now = Date.now()
      
      // Throttle to 30 FPS
      if (now - lastDetectionTime.current < 33) {
        animationRef.current = requestAnimationFrame(detect)
        return
      }

      const pose = await detectPose(videoRef.current, canvasRef.current)
      if (pose) {
        setCurrentPose(pose)
      }

      // Update FPS
      frameCountRef.current++
      if (now - lastFpsUpdateRef.current > 1000) {
        setFps(frameCountRef.current)
        frameCountRef.current = 0
        lastFpsUpdateRef.current = now
      }

      lastDetectionTime.current = now
      animationRef.current = requestAnimationFrame(detect)
    }

    detect()
  }, [isInitialized, isDetecting, detectPose])

  // Start detection
  const startDetection = useCallback(async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    if (!isInitialized) {
      console.error('Not initialized')
      return
    }

    // Store refs
    videoRef.current = video
    canvasRef.current = canvas

    // Set canvas size to match video
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    
    setIsDetecting(true)
    console.log('Starting detection loop')
    runDetection()
  }, [isInitialized, runDetection])

  // Stop detection
  const stopDetection = useCallback(() => {
    setIsDetecting(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = undefined
    }
    monitorRef.current.stopMonitoring()
  }, [])

  // Initialize on mount
  useEffect(() => {
    initializePoseDetection()
  }, [initializePoseDetection])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection()
      if (detectorRef.current?.dispose) {
        detectorRef.current.dispose()
      }
    }
  }, [stopDetection])

  // Run detection when isDetecting changes
  useEffect(() => {
    if (isDetecting) {
      runDetection()
    }
  }, [isDetecting, runDetection])

  return {
    isInitialized,
    isDetecting,
    currentPose,
    metrics,
    fps,
    error,
    loadingStatus,
    startCamera,
    startDetection,
    stopDetection,
    monitor: monitorRef.current
  }
}