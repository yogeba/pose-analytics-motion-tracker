'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useWorkingPoseDetection } from '@/hooks/useWorkingPoseDetection'
import { Camera, CameraOff, Activity } from 'lucide-react'

export default function PoseTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraStarted, setCameraStarted] = useState(false)

  const {
    isInitialized,
    isDetecting,
    currentPose,
    fps,
    error,
    loadingStatus,
    startCamera,
    startDetection,
    stopDetection
  } = useWorkingPoseDetection()

  // Start camera when button clicked
  const handleStartCamera = async () => {
    if (videoRef.current) {
      const success = await startCamera(videoRef.current)
      if (success) {
        setCameraStarted(true)
      }
    }
  }

  // Start detection when camera is ready
  useEffect(() => {
    if (cameraStarted && isInitialized && videoRef.current && canvasRef.current) {
      // Wait for video to be ready
      const video = videoRef.current
      const canvas = canvasRef.current

      const startWhenReady = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          startDetection(video, canvas)
        } else {
          video.addEventListener('loadeddata', () => {
            startDetection(video, canvas)
          }, { once: true })
        }
      }

      startWhenReady()
    }

    return () => {
      if (isDetecting) {
        stopDetection()
      }
    }
  }, [cameraStarted, isInitialized, startDetection, stopDetection, isDetecting])

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Pose Detection Test</h1>
      
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Model Status</div>
          <div className="font-semibold">{loadingStatus}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Initialized</div>
          <div className="font-semibold">{isInitialized ? 'Yes' : 'No'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">FPS</div>
          <div className="font-semibold">{fps}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Detecting</div>
          <div className="font-semibold">{isDetecting ? 'Yes' : 'No'}</div>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {/* Camera Controls */}
      <div className="mb-6 flex gap-4">
        <Button 
          onClick={handleStartCamera}
          disabled={cameraStarted || !isInitialized}
          className="flex items-center gap-2"
        >
          {cameraStarted ? <CameraOff size={20} /> : <Camera size={20} />}
          {cameraStarted ? 'Camera Started' : 'Start Camera'}
        </Button>
        
        {isDetecting && (
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-2">
            <Activity className="w-4 h-4 animate-pulse" />
            Detecting Pose
          </Badge>
        )}
      </div>

      {/* Video and Canvas */}
      <div className="relative bg-black rounded-lg overflow-hidden mb-6">
        <video
          ref={videoRef}
          className="w-full"
          style={{ maxHeight: '480px' }}
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
      </div>

      {/* Pose Data */}
      {currentPose && (
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Detected Pose</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Keypoints: {currentPose.keypoints.length}</div>
            <div>Confidence: {(currentPose.confidence * 100).toFixed(1)}%</div>
            <div>High Confidence Points: {currentPose.keypoints.filter(kp => kp.confidence > 0.5).length}</div>
            <div>Timestamp: {new Date(currentPose.timestamp).toLocaleTimeString()}</div>
          </div>
          
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground">View Keypoints</summary>
            <div className="mt-2 space-y-1 text-xs">
              {currentPose.keypoints.map((kp, i) => (
                <div key={i} className="flex justify-between">
                  <span>{kp.name}</span>
                  <span>({kp.x.toFixed(0)}, {kp.y.toFixed(0)}) - {(kp.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </details>
        </Card>
      )}

      {/* Debug Info */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-muted-foreground">Debug Information</summary>
        <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
{JSON.stringify({
  isInitialized,
  isDetecting,
  cameraStarted,
  fps,
  error,
  loadingStatus,
  hasPose: !!currentPose,
  keypointCount: currentPose?.keypoints.length || 0
}, null, 2)}
        </pre>
      </details>
    </div>
  )
}