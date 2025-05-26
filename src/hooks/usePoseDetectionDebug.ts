'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Debug version with extensive logging
export const usePoseDetectionDebug = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [modelLoaded, setModelLoaded] = useState(false)
  const [tfLoaded, setTfLoaded] = useState(false)
  const modelRef = useRef<any>(null)
  const animationRef = useRef<number | null>(null)

  const log = useCallback((message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage, data)
    setDebugLogs(prev => [...prev, logMessage + (data ? ` - ${JSON.stringify(data)}` : '')])
  }, [])

  // Initialize TensorFlow.js
  useEffect(() => {
    const initializeTF = async () => {
      try {
        log('Starting TensorFlow.js initialization...')
        
        // Check if already loaded
        if ((window as any).tf) {
          log('TensorFlow.js already loaded')
          setTfLoaded(true)
          return
        }

        // Load from CDN
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js'
          script.onload = () => {
            log('TensorFlow.js script loaded')
            resolve()
          }
          script.onerror = (e) => {
            log('Failed to load TensorFlow.js', e)
            reject(e)
          }
          document.head.appendChild(script)
        })

        // Verify TF is available
        if ((window as any).tf) {
          const version = (window as any).tf.version.tfjs
          log(`TensorFlow.js loaded successfully, version: ${version}`)
          setTfLoaded(true)
        } else {
          throw new Error('TensorFlow.js not available after script load')
        }
      } catch (err) {
        log('Error initializing TensorFlow.js', err)
        setError(err instanceof Error ? err.message : 'Failed to load TensorFlow.js')
      }
    }

    initializeTF()
  }, [log])

  // Load pose detection model
  useEffect(() => {
    if (!tfLoaded) {
      log('Waiting for TensorFlow.js to load...')
      return
    }

    const loadModel = async () => {
      try {
        log('Loading pose detection libraries...')
        
        // Load pose-detection library
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js'
          script.onload = () => {
            log('Pose detection library loaded')
            resolve()
          }
          script.onerror = reject
          document.head.appendChild(script)
        })

        // Check if poseDetection is available
        if (!(window as any).poseDetection) {
          throw new Error('poseDetection not available')
        }

        log('Creating MoveNet detector...')
        const detector = await (window as any).poseDetection.createDetector(
          (window as any).poseDetection.SupportedModels.MoveNet,
          {
            modelType: (window as any).poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true
          }
        )

        modelRef.current = detector
        setModelLoaded(true)
        setIsLoading(false)
        log('MoveNet model loaded successfully')
      } catch (err) {
        log('Error loading model', err)
        setError(err instanceof Error ? err.message : 'Failed to load model')
        setIsLoading(false)
      }
    }

    loadModel()
  }, [tfLoaded, log])

  const detectPose = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!modelLoaded || !modelRef.current) {
      log('Model not ready for detection')
      return null
    }

    try {
      log('Running pose detection...')
      const poses = await modelRef.current.estimatePoses(videoElement)
      
      if (poses && poses.length > 0) {
        log(`Detected ${poses.length} pose(s), keypoints: ${poses[0].keypoints.length}`)
        return poses[0]
      } else {
        log('No poses detected')
        return null
      }
    } catch (err) {
      log('Error during pose detection', err)
      return null
    }
  }, [modelLoaded, log])

  const startDetection = useCallback((
    videoElement: HTMLVideoElement, 
    canvasElement: HTMLCanvasElement,
    onPoseDetected?: (pose: any) => void
  ) => {
    log('Starting detection loop...')
    
    const detect = async () => {
      if (!videoElement.paused && !videoElement.ended) {
        const pose = await detectPose(videoElement)
        
        if (pose && canvasElement) {
          // Draw skeleton
          const ctx = canvasElement.getContext('2d')
          if (ctx) {
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height)
            
            // Draw keypoints
            ctx.fillStyle = 'red'
            pose.keypoints.forEach((keypoint: any) => {
              if (keypoint.score > 0.3) {
                ctx.beginPath()
                ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI)
                ctx.fill()
              }
            })
            
            log(`Drew ${pose.keypoints.filter((kp: any) => kp.score > 0.3).length} keypoints`)
          }
          
          if (onPoseDetected) {
            onPoseDetected(pose)
          }
        }
      }
      
      animationRef.current = requestAnimationFrame(detect)
    }
    
    detect()
  }, [detectPose, log])

  const stopDetection = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
      log('Stopped detection loop')
    }
  }, [log])

  return {
    isLoading,
    error,
    debugLogs,
    modelLoaded,
    tfLoaded,
    startDetection,
    stopDetection,
    detectPose
  }
}