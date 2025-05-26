'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

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

export const useWorkingPoseDetection = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [currentPose, setCurrentPose] = useState<PoseData | null>(null)
  const [fps, setFps] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState('Not started')

  const detectorRef = useRef<any>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const frameCountRef = useRef(0)
  const lastFpsUpdateRef = useRef(Date.now())
  const lastDetectionTime = useRef(0)

  // Load scripts from CDN
  const loadScriptsFromCDN = useCallback(async () => {
    try {
      setLoadingStatus('Loading TensorFlow.js...')
      
      // Check if already loaded
      if ((window as any).tf && (window as any).poseDetection) {
        console.log('TensorFlow.js already loaded')
        return true
      }

      // Load TensorFlow.js
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

      setLoadingStatus('Loading pose detection...')

      // Load pose-detection
      if (!(window as any).poseDetection) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js'
          script.onload = () => {
            console.log('Pose detection loaded')
            resolve()
          }
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      return true
    } catch (err) {
      console.error('Failed to load scripts:', err)
      setError('Failed to load AI models')
      return false
    }
  }, [])

  // Initialize pose detection
  const initializePoseDetection = useCallback(async () => {
    try {
      setError(null)
      setLoadingStatus('Initializing...')
      
      if (typeof window === 'undefined') {
        return
      }

      // Load scripts first
      const scriptsLoaded = await loadScriptsFromCDN()
      if (!scriptsLoaded) {
        return
      }

      const tf = (window as any).tf
      const poseDetection = (window as any).poseDetection

      if (!tf || !poseDetection) {
        throw new Error('Libraries not loaded properly')
      }

      setLoadingStatus('Setting up WebGL...')
      
      // Set WebGL backend
      await tf.setBackend('webgl')
      await tf.ready()
      console.log('TensorFlow backend:', tf.getBackend())

      setLoadingStatus('Loading MoveNet model...')
      
      // Create MoveNet detector
      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
          minPoseScore: 0.25
        }
      )
      
      console.log('MoveNet detector created successfully')
      setLoadingStatus('Ready')
      setIsInitialized(true)
      
    } catch (err) {
      console.error('Failed to initialize pose detection:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize')
      setLoadingStatus('Error')
      setIsInitialized(false)
    }
  }, [loadScriptsFromCDN])

  // Detect pose from video frame
  const detectPose = useCallback(async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    if (!detectorRef.current || !video || !canvas) {
      return null
    }

    try {
      const poses = await detectorRef.current.estimatePoses(video, {
        flipHorizontal: false
      })

      if (poses && poses.length > 0) {
        const pose = poses[0]
        
        // Convert to our format
        const keypoints: Keypoint[] = pose.keypoints.map((kp: any, index: number) => ({
          x: kp.x,
          y: kp.y,
          confidence: kp.score || 0,
          name: KEYPOINT_NAMES[index] || `keypoint_${index}`
        }))

        const poseData: PoseData = {
          keypoints,
          confidence: pose.score || keypoints.reduce((sum, kp) => sum + kp.confidence, 0) / keypoints.length,
          timestamp: Date.now()
        }

        // Draw skeleton on canvas
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          
          // Draw keypoints
          ctx.fillStyle = '#00ff00'
          keypoints.forEach(kp => {
            if (kp.confidence > 0.3) {
              ctx.beginPath()
              ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI)
              ctx.fill()
            }
          })

          // Draw skeleton connections
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

        return poseData
      }

      return null
    } catch (err) {
      console.error('Pose detection error:', err)
      return null
    }
  }, [])

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
      
      console.log('Camera started')
      return true
    } catch (err) {
      console.error('Camera error:', err)
      setError('Failed to access camera')
      return false
    }
  }, [])

  // Detection loop
  const runDetection = useCallback(async (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    if (!isInitialized || !detectorRef.current) {
      return
    }

    const detect = async () => {
      if (!isDetecting) {
        return
      }

      const now = Date.now()
      
      // Throttle to 30 FPS
      if (now - lastDetectionTime.current < 33) {
        animationRef.current = requestAnimationFrame(detect)
        return
      }

      const pose = await detectPose(video, canvas)
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

    // Set canvas size to match video
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    setIsDetecting(true)
    runDetection(video, canvas)
  }, [isInitialized, runDetection])

  // Stop detection
  const stopDetection = useCallback(() => {
    setIsDetecting(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = undefined
    }
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

  return {
    isInitialized,
    isDetecting,
    currentPose,
    fps,
    error,
    loadingStatus,
    startCamera,
    startDetection,
    stopDetection,
    metrics: null // Placeholder for metrics calculation
  }
}