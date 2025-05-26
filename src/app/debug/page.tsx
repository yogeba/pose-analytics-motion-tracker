'use client'

import { useRef, useState, useEffect } from 'react'
import { useSimplePoseDetection } from '@/hooks/useSimplePoseDetection'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function DebugPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  
  const {
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
  } = useSimplePoseDetection()

  const addDebugLog = (message: string) => {
    setDebugInfo(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    addDebugLog(`Initialized: ${isInitialized}`)
  }, [isInitialized])

  useEffect(() => {
    addDebugLog(`Detecting: ${isDetecting}`)
  }, [isDetecting])

  useEffect(() => {
    if (currentPose) {
      addDebugLog(`Pose detected: ${currentPose.keypoints.length} keypoints, confidence: ${currentPose.confidence.toFixed(2)}`)
    }
  }, [currentPose])

  useEffect(() => {
    if (error) {
      addDebugLog(`Error: ${error}`)
    }
  }, [error])

  const handleStartCamera = async () => {
    if (videoRef.current) {
      try {
        await startCamera(videoRef.current)
        addDebugLog('Camera started successfully')
      } catch (err) {
        addDebugLog(`Camera error: ${err}`)
      }
    }
  }

  const handleStartDetection = async () => {
    if (canvasRef.current) {
      addDebugLog('Starting detection...')
      await startDetection(canvasRef.current)
    }
  }

  const handleStopDetection = () => {
    stopDetection()
    addDebugLog('Detection stopped')
  }

  // Draw test pattern on canvas
  const drawTestPattern = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'
        ctx.fillRect(0, 0, 100, 100)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
        ctx.fillRect(100, 0, 100, 100)
        ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'
        ctx.fillRect(0, 100, 100, 100)
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'
        ctx.fillRect(100, 100, 100, 100)
        addDebugLog('Test pattern drawn on canvas')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Pose Detection Debug</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Video and Canvas */}
        <Card className="bg-black/50 p-4">
          <h2 className="text-white mb-2">Camera View</h2>
          <div className="relative aspect-video bg-gray-800 rounded overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: '2px solid yellow',
                pointerEvents: 'none'
              }}
            />
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex gap-2">
              <Button onClick={handleStartCamera} disabled={!isInitialized}>
                Start Camera
              </Button>
              <Button onClick={handleStartDetection} disabled={!isInitialized || isDetecting}>
                Start Detection
              </Button>
              <Button onClick={handleStopDetection} disabled={!isDetecting}>
                Stop Detection
              </Button>
            </div>
            <Button onClick={drawTestPattern} variant="outline">
              Draw Test Pattern
            </Button>
          </div>
        </Card>

        {/* Debug Info */}
        <Card className="bg-black/50 p-4">
          <h2 className="text-white mb-2">Debug Information</h2>
          
          <div className="space-y-2 mb-4">
            <div className="text-sm text-gray-300">
              <span className="text-gray-500">Status:</span> {isInitialized ? 'Initialized' : 'Not Initialized'}
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-gray-500">Detecting:</span> {isDetecting ? 'Yes' : 'No'}
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-gray-500">FPS:</span> {fps}
            </div>
            <div className="text-sm text-gray-300">
              <span className="text-gray-500">Model:</span> {modelCapabilities?.modelType || 'Not loaded'}
            </div>
            {currentPose && (
              <>
                <div className="text-sm text-gray-300">
                  <span className="text-gray-500">Keypoints:</span> {currentPose.keypoints.length}
                </div>
                <div className="text-sm text-gray-300">
                  <span className="text-gray-500">Confidence:</span> {(currentPose.confidence * 100).toFixed(1)}%
                </div>
              </>
            )}
            {error && (
              <div className="text-sm text-red-400">
                <span className="text-gray-500">Error:</span> {error}
              </div>
            )}
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-white text-sm mb-2">Debug Logs</h3>
            <div className="bg-black/30 rounded p-2 h-48 overflow-y-auto">
              {debugInfo.map((log, index) => (
                <div key={index} className="text-xs text-gray-400 font-mono">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {currentPose && (
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-white text-sm mb-2">Keypoint Details</h3>
              <div className="bg-black/30 rounded p-2 h-48 overflow-y-auto">
                {currentPose.keypoints
                  .filter(kp => kp.confidence > 0.3)
                  .map((kp, index) => (
                    <div key={index} className="text-xs text-gray-400 font-mono">
                      {kp.name || `KP${index}`}: ({kp.x.toFixed(0)}, {kp.y.toFixed(0)}) - {(kp.confidence * 100).toFixed(0)}%
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}