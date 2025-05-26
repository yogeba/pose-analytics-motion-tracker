'use client'

import { useEffect, useState, useRef } from 'react'

export default function SimpleTestPage() {
  const [log, setLog] = useState<string[]>([])
  const [detecting, setDetecting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const addLog = (msg: string) => {
    console.log(msg)
    setLog(prev => [...prev, msg])
  }

  useEffect(() => {
    let mounted = true
    let animationId: number

    const runTest = async () => {
      try {
        // Step 1: Start camera
        addLog('Getting camera...')
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        
        if (!mounted || !videoRef.current) return
        
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        addLog('Camera started ✓')

        // Step 2: Load TensorFlow.js directly from CDN
        addLog('Loading TensorFlow.js from CDN...')
        
        // @ts-ignore
        await new Promise((resolve) => {
          if (window.tf) {
            resolve(true)
            return
          }
          
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js'
          script.onload = resolve
          document.head.appendChild(script)
        })
        
        // @ts-ignore
        addLog(`TensorFlow.js loaded, version: ${window.tf.version.tfjs}`)

        // Step 3: Load MoveNet model directly
        addLog('Loading MoveNet model...')
        
        // @ts-ignore
        const model = await window.tf.loadGraphModel(
          'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4', 
          { fromTFHub: true }
        )
        
        addLog('Model loaded ✓')
        setDetecting(true)

        // Step 4: Run detection
        let frameCount = 0
        const detect = async () => {
          if (!mounted || !videoRef.current || !canvasRef.current) return

          frameCount++
          
          try {
            // @ts-ignore
            const imageTensor = window.tf.browser.fromPixels(videoRef.current)
            const resized = window.tf.image.resizeBilinear(imageTensor, [192, 192])
            const casted = resized.cast('int32')
            const expanded = casted.expandDims(0)
            
            // Run model
            const result = await model.predict(expanded).data()
            
            // Parse keypoints (17 keypoints x 3 values each)
            const keypoints = []
            for (let i = 0; i < 17; i++) {
              const y = result[i * 3] * 480  // Scale to video height
              const x = result[i * 3 + 1] * 640  // Scale to video width
              const score = result[i * 3 + 2]
              
              if (score > 0.3) {
                keypoints.push({ x, y, score })
              }
            }
            
            // Draw keypoints
            const ctx = canvasRef.current.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, 640, 480)
              ctx.fillStyle = 'lime'
              
              keypoints.forEach(kp => {
                ctx.beginPath()
                ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI)
                ctx.fill()
              })
            }
            
            if (frameCount % 30 === 0 && keypoints.length > 0) {
              addLog(`Frame ${frameCount}: ${keypoints.length} keypoints detected`)
            }
            
            // Clean up tensors
            imageTensor.dispose()
            resized.dispose()
            casted.dispose()
            expanded.dispose()
            
          } catch (err: any) {
            addLog(`Error: ${err.message}`)
          }

          animationId = requestAnimationFrame(detect)
        }

        detect()

      } catch (err: any) {
        addLog(`Setup error: ${err.message}`)
      }
    }

    runTest()

    return () => {
      mounted = false
      if (animationId) cancelAnimationFrame(animationId)
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Simple MoveNet Test (Direct CDN)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="font-bold mb-2">Video Feed</h2>
          <div className="relative">
            <video 
              ref={videoRef}
              width={640}
              height={480}
              className="w-full border-2 border-gray-300"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
          <div className="mt-2">
            Status: {detecting ? (
              <span className="text-green-500 font-bold">Detecting ✓</span>
            ) : (
              <span className="text-yellow-500">Loading...</span>
            )}
          </div>
        </div>
        
        <div>
          <h2 className="font-bold mb-2">Log</h2>
          <div className="bg-gray-100 p-2 rounded h-96 overflow-y-auto text-sm font-mono">
            {log.map((msg, i) => (
              <div key={i} className={msg.includes('Error') ? 'text-red-500' : ''}>
                {msg}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>This test loads TensorFlow.js and MoveNet directly from CDN.</p>
        <p>Green dots should appear on detected body keypoints.</p>
      </div>
    </div>
  )
}