'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Bug, Camera, Monitor, Cpu, Wifi, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface DebugInfo {
  camera: {
    available: boolean
    permissions: string
    activeStream: boolean
    videoTrack?: MediaStreamTrack
    constraints?: MediaStreamConstraints
    error?: string
  }
  webgl: {
    supported: boolean
    vendor?: string
    renderer?: string
    error?: string
  }
  tensorflow: {
    loaded: boolean
    backend?: string
    version?: string
    memory?: unknown
    error?: string
  }
  video: {
    element: boolean
    srcObject: boolean
    dimensions: { width: number; height: number }
    readyState: number
    error?: string
  }
  canvas: {
    element: boolean
    context: boolean
    dimensions: { width: number; height: number }
    overlay: boolean
    error?: string
  }
}

interface CameraDebuggerProps {
  videoRef?: React.RefObject<HTMLVideoElement | null>
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  isActive?: boolean
}

export function CameraDebugger({ videoRef, canvasRef, isActive = false }: CameraDebuggerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const checkCameraStatus = async (): Promise<DebugInfo['camera']> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          available: false,
          permissions: 'unsupported',
          activeStream: false,
          error: 'MediaDevices API not available'
        }
      }

      // Check permissions
      let permissions = 'unknown'
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName })
        permissions = permissionStatus.state
      } catch {
        permissions = 'check-failed'
      }

      // Check if we have an active stream
      let activeStream = false
      let videoTrack: MediaStreamTrack | undefined
      
      if (videoRef?.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        const tracks = stream.getVideoTracks()
        activeStream = tracks.length > 0 && tracks[0].readyState === 'live'
        videoTrack = tracks[0]
      }

      return {
        available: true,
        permissions,
        activeStream,
        videoTrack,
        constraints: undefined // Could store last used constraints
      }
    } catch (error) {
      return {
        available: false,
        permissions: 'error',
        activeStream: false,
        error: error instanceof Error ? error.message : 'Unknown camera error'
      }
    }
  }

  const checkWebGLStatus = (): DebugInfo['webgl'] => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null
      
      if (!gl) {
        return {
          supported: false,
          error: 'WebGL context not available'
        }
      }

      return {
        supported: true,
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER)
      }
    } catch (error) {
      return {
        supported: false,
        error: error instanceof Error ? error.message : 'WebGL check failed'
      }
    }
  }

  const checkTensorFlowStatus = async (): Promise<DebugInfo['tensorflow']> => {
    try {
      // Check if TensorFlow is available globally
      if (typeof (window as Record<string, unknown>).tf !== 'undefined') {
        const tf = (window as Record<string, unknown>).tf as { getBackend: () => string; version: { tfjs: string }; memory: () => unknown }
        return {
          loaded: true,
          backend: tf.getBackend(),
          version: tf.version.tfjs || 'unknown',
          memory: tf.memory()
        }
      }

      // Try to import TensorFlow
      const tf = await import('@tensorflow/tfjs')
      return {
        loaded: true,
        backend: tf.getBackend(),
        version: tf.version.tfjs || 'unknown',
        memory: tf.memory()
      }
    } catch (error) {
      return {
        loaded: false,
        error: error instanceof Error ? error.message : 'TensorFlow import failed'
      }
    }
  }

  const checkVideoStatus = (): DebugInfo['video'] => {
    const video = videoRef?.current
    
    if (!video) {
      return {
        element: false,
        srcObject: false,
        dimensions: { width: 0, height: 0 },
        readyState: 0,
        error: 'Video element not found'
      }
    }

    return {
      element: true,
      srcObject: !!video.srcObject,
      dimensions: { width: video.videoWidth, height: video.videoHeight },
      readyState: video.readyState,
      error: video.error ? video.error.message : undefined
    }
  }

  const checkCanvasStatus = (): DebugInfo['canvas'] => {
    const canvas = canvasRef?.current
    
    if (!canvas) {
      return {
        element: false,
        context: false,
        dimensions: { width: 0, height: 0 },
        overlay: false,
        error: 'Canvas element not found'
      }
    }

    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    
    return {
      element: true,
      context: !!ctx,
      dimensions: { width: canvas.width, height: canvas.height },
      overlay: rect.width > 0 && rect.height > 0
    }
  }

  const refreshDebugInfo = async () => {
    setIsRefreshing(true)
    
    try {
      const [camera, webgl, tensorflow, video, canvas] = await Promise.all([
        checkCameraStatus(),
        Promise.resolve(checkWebGLStatus()),
        checkTensorFlowStatus(),
        Promise.resolve(checkVideoStatus()),
        Promise.resolve(checkCanvasStatus())
      ])

      setDebugInfo({
        camera,
        webgl,
        tensorflow,
        video,
        canvas
      })
    } catch (error) {
      console.error('Debug info refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStatusIcon = (success: boolean, error?: string) => {
    if (error) return <XCircle className="w-4 h-4 text-red-400" />
    if (success) return <CheckCircle className="w-4 h-4 text-green-400" />
    return <AlertTriangle className="w-4 h-4 text-yellow-400" />
  }

  const getStatusColor = (success: boolean, error?: string) => {
    if (error) return 'text-red-400'
    if (success) return 'text-green-400'
    return 'text-yellow-400'
  }

  const fixCameraIssues = async () => {
    if (!debugInfo) return
    
    try {
      // Try to restart camera with fallback constraints
      if (videoRef?.current && !debugInfo.camera.activeStream) {
        const constraints = [
          { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } },
          { video: { facingMode: 'user' } },
          { video: true }
        ]

        for (const constraint of constraints) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia(constraint)
            videoRef.current.srcObject = stream
            await videoRef.current.play()
            break
          } catch (e) {
            console.warn('Camera constraint failed, trying next:', e)
          }
        }
      }

      // Refresh debug info
      await refreshDebugInfo()
    } catch (error) {
      console.error('Failed to fix camera issues:', error)
    }
  }

  // Auto-refresh when active
  useEffect(() => {
    if (isActive && isOpen) {
      refreshDebugInfo()
      intervalRef.current = setInterval(refreshDebugInfo, 2000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isActive, isOpen])

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="sm"
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
        >
          <Bug className="w-4 h-4 mr-2" />
          Debug
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="bg-black/90 backdrop-blur-lg border-white/20 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold">Camera Debug</h3>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={refreshDebugInfo}
              disabled={isRefreshing}
              size="sm"
              variant="ghost"
              className="text-white/60 hover:text-white"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              onClick={() => setIsOpen(false)}
              size="sm"
              variant="ghost"
              className="text-white/60 hover:text-white"
            >
              ×
            </Button>
          </div>
        </div>

        {debugInfo && (
          <div className="space-y-3">
            {/* Camera Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <span className="text-sm font-medium">Camera</span>
                {getStatusIcon(debugInfo.camera.activeStream, debugInfo.camera.error)}
              </div>
              <div className="text-xs space-y-1 ml-6">
                <div className={getStatusColor(debugInfo.camera.available)}>
                  API: {debugInfo.camera.available ? 'Available' : 'Unavailable'}
                </div>
                <div className={getStatusColor(debugInfo.camera.permissions === 'granted')}>
                  Permissions: {debugInfo.camera.permissions}
                </div>
                <div className={getStatusColor(debugInfo.camera.activeStream)}>
                  Stream: {debugInfo.camera.activeStream ? 'Active' : 'Inactive'}
                </div>
                {debugInfo.camera.error && (
                  <div className="text-red-400">Error: {debugInfo.camera.error}</div>
                )}
              </div>
            </div>

            {/* WebGL Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                <span className="text-sm font-medium">WebGL</span>
                {getStatusIcon(debugInfo.webgl.supported, debugInfo.webgl.error)}
              </div>
              <div className="text-xs space-y-1 ml-6">
                <div className={getStatusColor(debugInfo.webgl.supported)}>
                  Status: {debugInfo.webgl.supported ? 'Supported' : 'Not Supported'}
                </div>
                {debugInfo.webgl.vendor && (
                  <div className="text-white/60">Vendor: {debugInfo.webgl.vendor}</div>
                )}
                {debugInfo.webgl.error && (
                  <div className="text-red-400">Error: {debugInfo.webgl.error}</div>
                )}
              </div>
            </div>

            {/* TensorFlow Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                <span className="text-sm font-medium">TensorFlow</span>
                {getStatusIcon(debugInfo.tensorflow.loaded, debugInfo.tensorflow.error)}
              </div>
              <div className="text-xs space-y-1 ml-6">
                <div className={getStatusColor(debugInfo.tensorflow.loaded)}>
                  Status: {debugInfo.tensorflow.loaded ? 'Loaded' : 'Not Loaded'}
                </div>
                {debugInfo.tensorflow.backend && (
                  <div className="text-white/60">Backend: {debugInfo.tensorflow.backend}</div>
                )}
                {debugInfo.tensorflow.version && (
                  <div className="text-white/60">Version: {debugInfo.tensorflow.version}</div>
                )}
                {debugInfo.tensorflow.error && (
                  <div className="text-red-400">Error: {debugInfo.tensorflow.error}</div>
                )}
              </div>
            </div>

            {/* Video Element Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-medium">Video Element</span>
                {getStatusIcon(debugInfo.video.element && debugInfo.video.srcObject, debugInfo.video.error)}
              </div>
              <div className="text-xs space-y-1 ml-6">
                <div className={getStatusColor(debugInfo.video.element)}>
                  Element: {debugInfo.video.element ? 'Found' : 'Not Found'}
                </div>
                <div className={getStatusColor(debugInfo.video.srcObject)}>
                  Stream: {debugInfo.video.srcObject ? 'Connected' : 'No Stream'}
                </div>
                <div className="text-white/60">
                  Size: {debugInfo.video.dimensions.width}×{debugInfo.video.dimensions.height}
                </div>
                <div className="text-white/60">
                  Ready State: {debugInfo.video.readyState}/4
                </div>
              </div>
            </div>

            {/* Canvas Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                <span className="text-sm font-medium">Canvas Overlay</span>
                {getStatusIcon(debugInfo.canvas.element && debugInfo.canvas.context)}
              </div>
              <div className="text-xs space-y-1 ml-6">
                <div className={getStatusColor(debugInfo.canvas.element)}>
                  Element: {debugInfo.canvas.element ? 'Found' : 'Not Found'}
                </div>
                <div className={getStatusColor(debugInfo.canvas.context)}>
                  Context: {debugInfo.canvas.context ? 'Available' : 'Unavailable'}
                </div>
                <div className="text-white/60">
                  Size: {debugInfo.canvas.dimensions.width}×{debugInfo.canvas.dimensions.height}
                </div>
              </div>
            </div>

            {/* Quick Fixes */}
            {(!debugInfo.camera.activeStream || debugInfo.video.readyState < 2) && (
              <div className="pt-2 border-t border-white/20">
                <Button
                  onClick={fixCameraIssues}
                  size="sm"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  🔧 Try Auto-Fix Camera
                </Button>
              </div>
            )}
          </div>
        )}

        {!debugInfo && (
          <div className="text-center py-4">
            <Button onClick={refreshDebugInfo} disabled={isRefreshing}>
              {isRefreshing ? 'Loading...' : 'Run Diagnostics'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}