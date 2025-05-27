'use client'

import { useRef, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
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
  MicOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useComprehensivePoseAnalytics } from '@/hooks/useComprehensivePoseAnalytics'
import { useWorkingPoseDetection } from '@/hooks/useWorkingPoseDetection'
import { NativeCameraInterface, type CameraMode } from './NativeCameraInterface'
import { CameraDebugger } from './CameraDebugger'

function PoseCameraCore() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Client-side mounting check for hydration
  const [isMounted, setIsMounted] = useState(false)
  
  // Main app state - start with camera state and native UI
  const [appState, setAppState] = useState<'idle' | 'camera' | 'session' | 'recording'>('camera')
  const [selectedPoseId, setSelectedPoseId] = useState<string>()
  const [cameraMode, setCameraMode] = useState<CameraMode>('pose')
  const [showNativeUI, setShowNativeUI] = useState(true)
  
  // Use the working pose detection hook
  const {
    isInitialized,
    isDetecting,
    currentPose,
    fps,
    error,
    loadingStatus,
    startCamera: startPoseCamera,
    startDetection,
    stopDetection,
    metrics
  } = useWorkingPoseDetection()
  
  // Use comprehensive analytics for other features
  const {
    // Get metrics from comprehensive analytics
    metrics: analyticsMetrics,
    
    // Managers
    isManagersInitialized,
    
    // Session
    currentSession,
    sessionDuration,
    startSession,
    endSession,
    
    // Settings
    userSettings,
    updateUserSettings,
    
    // Reference poses
    selectedReferencePose,
    availableReferencePoses,
    setSelectedReferencePose,
    
    // AI feedback
    recentFeedback,
    
    // Recording
    recordingState,
    startRecording,
    stopRecording,
    downloadRecording
  } = useComprehensivePoseAnalytics()

  // Initialize component and auto-start camera on mount
  useEffect(() => {
    setIsMounted(true)
    
    // Auto-start camera after mount if initialized
    const autoStartCamera = async () => {
      if (isInitialized && videoRef.current && appState === 'camera') {
        try {
          console.log('Auto-starting camera on mount')
          await startPoseCamera(videoRef.current)
          
          // Start pose detection for pose mode
          if (cameraMode === 'pose') {
            setTimeout(() => {
              const video = videoRef.current
              const canvas = canvasRef.current
              if (video && canvas && !isDetecting) {
                console.log('Auto-starting pose detection')
                startDetection(video, canvas)
              }
            }, 500)
          }
        } catch (error) {
          console.error('Auto-start camera failed:', error)
          // Fall back to idle state if auto-start fails
          setAppState('idle')
          setShowNativeUI(false)
        }
      }
    }
    
    // Small delay to ensure DOM is ready
    setTimeout(autoStartCamera, 100)
  }, [isInitialized])

  // Handle camera mode changes with proper functionality
  const handleModeChange = async (mode: CameraMode) => {
    console.log(`Switching camera mode: ${cameraMode} → ${mode}`)
    setCameraMode(mode)
    
    // Clear any existing detection/recording state
    if (isDetecting && mode !== 'pose' && mode !== 'analysis') {
      console.log('Stopping pose detection for non-pose mode')
      stopDetection()
    }
    
    // Handle mode-specific initialization
    switch (mode) {
      case 'pose':
      case 'analysis':
        // Start pose detection for pose and analysis modes
        if (!isDetecting && appState === 'camera') {
          const video = videoRef.current
          const canvas = canvasRef.current
          if (video && canvas) {
            console.log(`Starting pose detection for ${mode} mode`)
            await startDetection(video, canvas)
          } else {
            console.warn('Video or canvas ref not available for pose detection')
          }
        }
        break
        
      case 'video':
        // Standard video recording mode - no pose overlay
        console.log('Video mode activated - standard recording')
        break
        
      case 'slo-mo':
        // Slow motion mode - prepare for high FPS capture
        console.log('Slo-mo mode activated - high FPS recording')
        // TODO: Configure high frame rate capture
        break
        
      case 'photo':
        // Photo mode - prepare for single frame capture
        console.log('Photo mode activated - single frame capture')
        // TODO: Implement photo capture functionality
        break
    }
  }

  // Handle camera toggle (front/back)
  const handleCameraToggle = async () => {
    // TODO: Implement camera switching
    console.log('Camera toggle - TODO: Implement front/back camera switching')
  }
  
  // Handle photo capture
  const capturePhoto = async () => {
    if (!videoRef.current) {
      console.error('Video element not available')
      return
    }
    
    try {
      // Create a canvas to capture the frame
      const captureCanvas = document.createElement('canvas')
      const video = videoRef.current
      captureCanvas.width = video.videoWidth
      captureCanvas.height = video.videoHeight
      
      const ctx = captureCanvas.getContext('2d')
      if (!ctx) return
      
      // Draw the video frame (mirrored to match display)
      ctx.save()
      ctx.scale(-1, 1)
      ctx.translate(-captureCanvas.width, 0)
      ctx.drawImage(video, 0, 0)
      ctx.restore()
      
      // Add pose overlay if in analysis mode
      if (cameraMode === 'analysis' && currentPose && canvasRef.current) {
        // Copy the pose overlay
        ctx.drawImage(canvasRef.current, 0, 0)
      }
      
      // Convert to blob and download
      captureCanvas.toBlob((blob) => {
        if (!blob) return
        
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `pose-photo-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jpg`
        a.click()
        URL.revokeObjectURL(url)
        
        // Visual feedback
        console.log('Photo captured and downloaded')
      }, 'image/jpeg', 0.95)
      
    } catch (error) {
      console.error('Photo capture failed:', error)
      alert('Failed to capture photo')
    }
  }

  // Handle recording toggle based on camera mode
  const handleRecordingToggle = async () => {
    try {
      // Handle photo mode differently
      if (cameraMode === 'photo' && !recordingState.isRecording) {
        await capturePhoto()
        return
      }
      
      if (recordingState.isRecording) {
        // Stop recording
        const recordingBlob = await stopRecording()
        if (recordingBlob) {
          const shouldDownload = confirm('Recording completed! Download it?')
          if (shouldDownload) {
            await downloadRecording()
          }
        }
      } else {
        // Start recording - validate prerequisites
        if (!videoRef.current) {
          console.error('Video element not available')
          alert('Camera not ready. Please wait and try again.')
          return
        }

        // Wait a bit for video to be ready if it's not playing yet
        if (videoRef.current.paused || videoRef.current.readyState < 2) {
          console.log('Waiting for video to be ready...')
          await new Promise((resolve) => {
            const checkReady = () => {
              if (videoRef.current && !videoRef.current.paused && videoRef.current.readyState >= 2) {
                resolve(undefined)
              } else {
                setTimeout(checkReady, 100)
              }
            }
            checkReady()
          })
        }

        if (!videoRef.current.srcObject) {
          console.error('No video stream found')
          alert('Camera stream not active. Please restart the camera.')
          return
        }

        const stream = videoRef.current.srcObject as MediaStream
        const tracks = stream.getVideoTracks()
        if (tracks.length === 0 || !tracks.some(t => t.enabled && t.readyState === 'live')) {
          console.error('No active video tracks')
          alert('Camera is not active. Please restart the camera.')
          return
        }

        // Configure recording based on mode
        const canvas = (cameraMode === 'pose' || cameraMode === 'analysis') ? canvasRef.current || undefined : undefined
        
        // Mode-specific recording configuration
        let recordingConfig = {
          quality: 'high' as const,
          frameRate: 30,
          includeOverlay: false,
          format: 'webm' as const
        }
        
        switch (cameraMode) {
          case 'pose':
          case 'analysis':
            recordingConfig = {
              quality: 'high',
              frameRate: 30,
              includeOverlay: true,
              format: 'webm'
            }
            break
            
          case 'video':
            recordingConfig = {
              quality: 'high',
              frameRate: 30,
              includeOverlay: false,
              format: 'webm'
            }
            break
            
          case 'slo-mo':
            recordingConfig = {
              quality: 'high',
              frameRate: 60, // High FPS for slow motion
              includeOverlay: false,
              format: 'webm'
            }
            break
        }
        
        console.log('Starting recording with:', { 
          mode: cameraMode,
          config: recordingConfig,
          hasCanvas: !!canvas
        })

        const success = await startRecording(videoRef.current, canvas, recordingConfig)

        if (!success) {
          console.error('Recording failed to start')
          alert('Failed to start recording. Please try again.')
        }
      }
    } catch (error) {
      console.error('Recording toggle error:', error)
      alert(`Recording error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Handle main camera button click (for legacy UI)
  const handleMainButtonClick = async () => {
    try {
      switch (appState) {
        case 'idle':
          // Start camera and switch to native UI
          if (videoRef.current) {
            await startPoseCamera(videoRef.current)
            
            // Wait for video to be ready
            await new Promise((resolve) => {
              const checkVideoReady = () => {
                if (videoRef.current && 
                    videoRef.current.srcObject && 
                    !videoRef.current.paused && 
                    videoRef.current.readyState >= 2) {
                  resolve(undefined)
                } else {
                  setTimeout(checkVideoReady, 50)
                }
              }
              checkVideoReady()
            })
            
            setAppState('camera')
            setShowNativeUI(true)
            
            // Delay pose detection start to ensure canvas is ready
            if (cameraMode === 'pose') {
              setTimeout(async () => {
                const video = videoRef.current
                const canvas = canvasRef.current
                if (video && canvas && !isDetecting) {
                  console.log('Starting pose detection after UI ready')
                  await startDetection(video, canvas)
                }
              }, 100)
            }
          }
          break
          
        case 'camera':
          // Start session
          await startSession(selectedPoseId)
          setAppState('session')
          break
          
        case 'session':
          // Start recording
          const video = videoRef.current
          const canvas = canvasRef.current
          if (video && canvas) {
            await startRecording(video, canvas, {
              quality: 'medium',
              frameRate: 30,
              includeOverlay: true,
              format: 'webm'
            })
            setAppState('recording')
          }
          break
          
        case 'recording':
          // Stop everything
          const recordingBlob = await stopRecording()
          await endSession()
          
          // Offer download
          if (recordingBlob) {
            const shouldDownload = confirm('Recording completed! Download it?')
            if (shouldDownload) {
              await downloadRecording()
            }
          }
          
          stopDetection()
          setAppState('idle')
          setShowNativeUI(false)
          break
      }
    } catch (error) {
      console.error('Main button action failed:', error)
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? 
        (error.message.includes('camera') ? 'Camera error. Please check permissions.' :
         error.message.includes('AI') || error.message.includes('model') ? 'AI model error. Please refresh the page.' :
         error.message) : 'Something went wrong'
      
      alert(errorMessage)
      
      // Reset state on error
      setAppState('idle')
      setShowNativeUI(false)
      stopDetection()
    }
  }

  // Get main button config based on state
  const getMainButtonConfig = () => {
    switch (appState) {
      case 'idle':
        return {
          icon: Camera,
          color: 'bg-blue-500 hover:bg-blue-600',
          text: 'Start Camera',
          disabled: !isInitialized || !isManagersInitialized
        }
      case 'camera':
        return {
          icon: Play,
          color: 'bg-green-500 hover:bg-green-600',
          text: 'Start Session',
          disabled: false
        }
      case 'session':
        return {
          icon: Square,
          color: 'bg-orange-500 hover:bg-orange-600',
          text: 'Start Recording',
          disabled: false
        }
      case 'recording':
        return {
          icon: Square,
          color: 'bg-red-500 hover:bg-red-600 animate-pulse',
          text: 'Stop & Save',
          disabled: false
        }
    }
  }

  const buttonConfig = getMainButtonConfig()

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Handle reference pose selection
  const handlePoseSelection = (poseId: string) => {
    setSelectedPoseId(poseId)
    const pose = availableReferencePoses.find(p => p.id === poseId)
    setSelectedReferencePose(pose)
  }

  // Voice feedback toggle
  const toggleVoiceFeedback = () => {
    updateUserSettings({
      voiceFeedbackEnabled: !userSettings?.voiceFeedbackEnabled
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">
      {/* Show Native Camera Interface when camera is active */}
      {showNativeUI && isMounted ? (
        <div className="fixed inset-0 z-50">
          <NativeCameraInterface
            videoRef={videoRef}
            canvasRef={canvasRef}
            onModeChange={handleModeChange}
            onCameraToggle={handleCameraToggle}
            onRecordingToggle={handleRecordingToggle}
            isRecording={recordingState.isRecording}
            isDetecting={isDetecting && (cameraMode === 'pose' || cameraMode === 'analysis')}
            recordingDuration={recordingState.duration}
            currentMode={cameraMode}
            fps={fps}
            onClose={() => {
              setShowNativeUI(false)
              setAppState('idle')
              stopDetection()
            }}
          />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="p-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">PoseAnalytics</h1>
              <p className="text-white/60 text-sm">AI-powered movement analysis</p>
            </div>
            
            <div className="flex gap-2">
              {userSettings?.voiceFeedbackEnabled !== undefined && (
                <Button
                  onClick={toggleVoiceFeedback}
                  size="sm"
                  variant="ghost"
                  className="text-white/80 hover:text-white hover:bg-white/10"
                >
                  {userSettings.voiceFeedbackEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                </Button>
              )}
              
              <Button
                onClick={() => console.log('Progress view - TODO')}
                size="sm"
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <TrendingUp size={16} />
              </Button>
              
              <Button
                onClick={() => console.log('Settings view - TODO')}
                size="sm"
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <Settings size={16} />
              </Button>
            </div>
          </div>

          {/* Main Camera View */}
          <div className="flex-1 px-4 pb-4">
            <Card className="bg-black/30 backdrop-blur-lg border-white/20 overflow-hidden">
              <div className="relative aspect-video">
                {/* Video Feed */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover scale-x-[-1]"
                  autoPlay
                  playsInline
                  muted
                />
                
                {/* Pose Canvas Overlay - Only render client-side */}
                {isMounted && (
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      zIndex: 10
                    }}
                  />
                )}

            {/* Reference Pose Selector */}
            {appState === 'camera' && availableReferencePoses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-4 left-4 right-4"
              >
                <select
                  value={selectedPoseId || ''}
                  onChange={(e) => handlePoseSelection(e.target.value)}
                  className="w-full bg-black/50 backdrop-blur text-white rounded-lg px-3 py-2 border border-white/20"
                >
                  <option value="">Free Mode (No Reference)</option>
                  {availableReferencePoses.map(pose => (
                    <option key={pose.id} value={pose.id}>
                      {pose.name} ({pose.category})
                    </option>
                  ))}
                </select>
              </motion.div>
            )}

            {/* Recording Indicator */}
            {appState === 'recording' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 backdrop-blur px-3 py-1 rounded-full"
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-sm font-medium">REC</span>
                <span className="text-white text-sm font-mono">
                  {formatDuration(recordingState.duration)}
                </span>
              </motion.div>
            )}

            {/* Session Timer */}
            {currentSession && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-4 right-4 bg-black/50 backdrop-blur px-3 py-1 rounded-full"
              >
                <span className="text-white text-sm font-mono">
                  {formatDuration(sessionDuration)}
                </span>
              </motion.div>
            )}

            {/* Main Action Button */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleMainButtonClick}
                  disabled={buttonConfig.disabled}
                  size="lg"
                  className={`
                    w-20 h-20 rounded-full relative overflow-hidden
                    ${buttonConfig.color}
                    transition-all duration-300 shadow-2xl
                    ${appState === 'recording' ? 'shadow-red-500/50' : 'shadow-black/30'}
                  `}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={appState}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <buttonConfig.icon className="w-8 h-8 text-white" />
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Pulse ring for recording */}
                  {appState === 'recording' && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-red-400"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.8, 0.2, 0.8]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                </Button>
              </motion.div>
            </div>
          </div>
        </Card>
      </div>

      {/* Status Row */}
      <div className="px-4 pb-4">
        <div className="flex justify-center gap-4">
          {/* AI Status */}
          <Badge 
            variant={userSettings?.aiCoachingEnabled ? "default" : "secondary"}
            className="bg-black/30 backdrop-blur border-white/20 text-white"
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${
              userSettings?.aiCoachingEnabled ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
            }`} />
            <Brain size={12} className="mr-1" />
            AI Coach
          </Badge>

          {/* Detection Status */}
          <Badge 
            variant={isDetecting ? "default" : "secondary"}
            className="bg-black/30 backdrop-blur border-white/20 text-white"
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isDetecting ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
            }`} />
            {fps > 0 ? `${fps} FPS` : 'Standby'}
          </Badge>

          {/* Session Status */}
          <Badge 
            variant={currentSession ? "default" : "secondary"}
            className="bg-black/30 backdrop-blur border-white/20 text-white"
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${
              currentSession ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
            }`} />
            <Target size={12} className="mr-1" />
            {currentSession ? 'Session Active' : 'No Session'}
          </Badge>
        </div>
      </div>

      {/* Real-time Metrics */}
      <AnimatePresence>
        {isDetecting && metrics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-4 pb-4"
          >
            <Card className="bg-black/30 backdrop-blur-lg border-white/20 p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Confidence */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {Math.round((currentPose?.confidence || 0) * 100)}%
                  </div>
                  <div className="text-white/60 text-sm">Confidence</div>
                </div>

                {/* Similarity */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {selectedReferencePose && analyticsMetrics ? `${Math.round(analyticsMetrics.similarity * 100)}%` : '--'}
                  </div>
                  <div className="text-white/60 text-sm">Pose Match</div>
                </div>
              </div>

              {/* Mini metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-white/5 rounded">
                  <div className="text-sm font-bold text-cyan-400">
                    {analyticsMetrics ? Math.round(analyticsMetrics.symmetryScore * 100) : 0}%
                  </div>
                  <div className="text-xs text-white/60">Symmetry</div>
                </div>
                <div className="text-center p-2 bg-white/5 rounded">
                  <div className="text-sm font-bold text-green-400">
                    {analyticsMetrics ? Math.round(analyticsMetrics.stabilityScore * 100) : 0}%
                  </div>
                  <div className="text-xs text-white/60">Stability</div>
                </div>
                <div className="text-center p-2 bg-white/5 rounded">
                  <div className="text-sm font-bold text-orange-400">
                    {analyticsMetrics?.balanceMetrics ? Math.round(analyticsMetrics.balanceMetrics.stability * 100) : 0}%
                  </div>
                  <div className="text-xs text-white/60">Balance</div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Feedback */}
      <AnimatePresence>
        {recentFeedback.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-4 pb-4"
          >
            <Card className="bg-black/30 backdrop-blur-lg border-white/20 p-4">
              <h3 className="text-white font-medium mb-2">AI Coach</h3>
              <div className="space-y-2">
                {recentFeedback.slice(-2).map((feedback, index) => (
                  <motion.div
                    key={feedback.timestamp}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-2 rounded text-sm ${
                      feedback.type === 'correction' ? 'bg-red-500/20 text-red-200' :
                      feedback.type === 'encouragement' ? 'bg-green-500/20 text-green-200' :
                      feedback.type === 'warning' ? 'bg-yellow-500/20 text-yellow-200' :
                      'bg-blue-500/20 text-blue-200'
                    }`}
                  >
                    {feedback.message}
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 pb-4"
            >
              <Card className="bg-red-500/20 backdrop-blur-lg border-red-500/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-red-200 text-sm flex-1">
                    {error}
                  </div>
                  <Button
                    onClick={() => {
                      // Clear error and retry initialization
                      window.location.reload()
                    }}
                    size="sm"
                    variant="ghost"
                    className="text-red-200 hover:text-white hover:bg-red-500/20 ml-2"
                  >
                    Retry
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}
      
      {/* Camera Debugger - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <CameraDebugger 
          videoRef={videoRef}
          canvasRef={canvasRef}
          isActive={appState !== 'idle'}
        />
      )}
    </div>
  )
}

// Export with SSR disabled to prevent hydration issues
const PoseCamera = dynamic(() => Promise.resolve(PoseCameraCore), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Loading Pose Analytics...</p>
      </div>
    </div>
  )
})

export default PoseCamera