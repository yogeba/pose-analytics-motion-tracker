'use client'

import { useEffect, useState, useRef } from 'react'

export default function TestPage() {
  const [status, setStatus] = useState<string[]>(['Test page loaded'])
  const [detections, setDetections] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const addStatus = (msg: string) => {
    console.log(msg)
    setStatus(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  useEffect(() => {
    let detector: any = null
    let animationId: number

    const initializeTest = async () => {
      try {
        addStatus('Starting camera...')
        
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          addStatus('Camera started successfully')
        }

        // Load TensorFlow.js
        addStatus('Loading TensorFlow.js...')
        const tf = await import('@tensorflow/tfjs')
        await import('@tensorflow/tfjs-backend-webgl')
        await tf.ready()
        addStatus(`TensorFlow ready with backend: ${tf.getBackend()}`)

        // Load pose detection
        addStatus('Loading pose detection...')
        const poseDetection = await import('@tensorflow-models/pose-detection')
        
        // Create detector
        addStatus('Creating MoveNet detector...')
        detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
          }
        )
        addStatus('Detector created successfully')

        // Start detection loop
        let frameCount = 0
        const detect = async () => {
          if (!videoRef.current || !canvasRef.current || !detector) return

          try {
            const poses = await detector.estimatePoses(videoRef.current)
            frameCount++

            if (poses.length > 0) {
              const pose = poses[0]
              const validKeypoints = pose.keypoints.filter((kp: any) => kp.score > 0.3)
              
              setDetections(prev => prev + 1)
              
              // Draw on canvas
              const ctx = canvasRef.current.getContext('2d')
              if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                
                // Draw keypoints
                ctx.fillStyle = 'lime'
                validKeypoints.forEach((kp: any) => {
                  ctx.beginPath()
                  ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI)
                  ctx.fill()
                })
              }

              if (frameCount % 30 === 0) {
                addStatus(`Detection working: ${validKeypoints.length} keypoints detected`)
              }
            }
          } catch (err: any) {
            addStatus(`Error: ${err.message}`)
          }

          animationId = requestAnimationFrame(detect)
        }

        addStatus('Starting detection loop...')
        detect()

      } catch (err: any) {
        addStatus(`Error: ${err.message}`)
      }
    }

    initializeTest()

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
      if (detector) detector.dispose?.()
    }
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Pose Detection Test</h1>
      
      <div className="relative mb-4">
        <video 
          ref={videoRef} 
          width={640} 
          height={480}
          className="border-2 border-gray-300"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas 
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />
      </div>

      <div className="mb-4">
        <p className="text-lg">Detections: <span className="font-bold text-green-500">{detections}</span></p>
      </div>

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-bold mb-2">Status Log:</h2>
        <div className="text-sm font-mono space-y-1 max-h-60 overflow-y-auto">
          {status.map((msg, i) => (
            <div key={i} className={msg.includes('Error') ? 'text-red-500' : ''}>
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}