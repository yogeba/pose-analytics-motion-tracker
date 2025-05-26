'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Camera, 
  Square, 
  Settings, 
  Play, 
  TrendingUp,
  Brain,
  Target,
  Mic,
  MicOff,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useWorkingPoseDetection } from '@/hooks/useWorkingPoseDetection'

export default function PoseCameraDebug() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [cameraReady, setCameraReady] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [appState, setAppState] = useState<'idle' | 'camera' | 'detecting'>('idle')

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

  // Update debug info
  useEffect(() => {
    const interval = setInterval(() => {
      setDebugInfo({
        videoReady: videoRef.current ? {
          readyState: videoRef.current.readyState,
          paused: videoRef.current.paused,
          videoWidth: videoRef.current.videoWidth,
          videoHeight: videoRef.current.videoHeight,
          currentTime: videoRef.current.currentTime
        } : null,
        canvasReady: canvasRef.current ? {
          width: canvasRef.current.width,
          height: canvasRef.current.height
        } : null,
        detectionState: {
          isInitialized,
          isDetecting,
          fps,
          loadingStatus,
          hasPose: !!currentPose,
          keypointCount: currentPose?.keypoints.length || 0
        }
      })
    }, 500)
    
    return () => clearInterval(interval)
  }, [isInitialized, isDetecting, fps, loadingStatus, currentPose])

  // Handle start camera
  const handleStartCamera = async () => {
    try {
      console.log('Starting camera...')
      setAppState('camera')
      
      if (!videoRef.current) {
        console.error('Video ref not ready')
        return
      }

      const success = await startCamera(videoRef.current)
      if (success) {
        setCameraReady(true)
        console.log('Camera started successfully')
        
        // Set up canvas when video is ready
        videoRef.current.addEventListener('loadedmetadata', () => {
          if (videoRef.current && canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth
            canvasRef.current.height = videoRef.current.videoHeight
            console.log(`Canvas set to ${canvasRef.current.width}x${canvasRef.current.height}`)
          }
        })
      } else {
        console.error('Camera failed to start')
      }
    } catch (err) {
      console.error('Camera error:', err)
    }
  }

  // Handle start detection
  const handleStartDetection = async () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas not ready')
      return
    }

    if (!isInitialized) {
      console.error('Pose detection not initialized')
      return
    }

    console.log('Starting pose detection...')
    setAppState('detecting')
    await startDetection(videoRef.current, canvasRef.current)
  }

  // Handle stop
  const handleStop = () => {
    console.log('Stopping...')
    stopDetection()
    
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    
    setCameraReady(false)
    setAppState('idle')
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-white mb-4">Pose Camera Debug</h1>
        
        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-gray-900 border-gray-800">
            <div className="text-sm text-gray-400">Model</div>
            <div className="font-semibold text-white flex items-center gap-2">
              {loadingStatus}
              {isInitialized && <CheckCircle className="w-4 h-4 text-green-500" />}
            </div>
          </Card>
          <Card className="p-4 bg-gray-900 border-gray-800">
            <div className="text-sm text-gray-400">Camera</div>
            <div className="font-semibold text-white flex items-center gap-2">
              {cameraReady ? 'Ready' : 'Not Ready'}
              {cameraReady && <CheckCircle className="w-4 h-4 text-green-500" />}
            </div>
          </Card>
          <Card className="p-4 bg-gray-900 border-gray-800">
            <div className="text-sm text-gray-400">FPS</div>
            <div className="font-semibold text-white">{fps}</div>
          </Card>
          <Card className="p-4 bg-gray-900 border-gray-800">
            <div className="text-sm text-gray-400">State</div>
            <div className="font-semibold text-white">{appState}</div>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <Button 
            onClick={handleStartCamera}
            disabled={cameraReady}
            variant={cameraReady ? "secondary" : "default"}
          >
            <Camera className="mr-2" size={20} />
            Start Camera
          </Button>
          
          <Button 
            onClick={handleStartDetection}
            disabled={!cameraReady || !isInitialized || isDetecting}
            variant={isDetecting ? "secondary" : "default"}
          >
            <Play className="mr-2" size={20} />
            Start Detection
          </Button>
          
          <Button 
            onClick={handleStop}
            variant="destructive"
            disabled={appState === 'idle'}
          >
            <Square className="mr-2" size={20} />
            Stop
          </Button>
        </div>

        {/* Video and Canvas */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-6" style={{ maxWidth: '640px' }}>
          <video
            ref={videoRef}
            className="w-full"
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
          
          {/* Overlay info */}
          {isDetecting && currentPose && (
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur p-2 rounded">
              <div className="text-xs text-white">
                Keypoints: {currentPose.keypoints.filter(kp => kp.confidence > 0.5).length}/{currentPose.keypoints.length}
              </div>
            </div>
          )}
        </div>

        {/* Debug Info */}
        <Card className="p-4 bg-gray-900 border-gray-800">
          <h3 className="font-semibold text-white mb-2">Debug Information</h3>
          <pre className="text-xs text-gray-300 overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </Card>

        {/* Pose Details */}
        {currentPose && (
          <Card className="mt-4 p-4 bg-gray-900 border-gray-800">
            <h3 className="font-semibold text-white mb-2">Current Pose</h3>
            <div className="grid grid-cols-2 gap-4">
              {currentPose.keypoints.map((kp, i) => (
                <div key={i} className="text-xs text-gray-300">
                  <span className="text-gray-500">{kp.name}:</span> 
                  <span className={kp.confidence > 0.5 ? 'text-green-400' : 'text-red-400'}>
                    {' '}{(kp.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="text-gray-600"> ({kp.x.toFixed(0)}, {kp.y.toFixed(0)})</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}