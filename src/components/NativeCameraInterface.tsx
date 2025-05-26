'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Video,
  Image,
  BarChart3,
  Zap,
  RotateCcw,
  FlashlightOff,
  FlashlightIcon,
  Settings,
  X,
  Circle
} from 'lucide-react'
import { CameraControls } from './CameraControls'
import { RecordingIndicator } from './RecordingIndicator'
import { CinematicToggle } from './CinematicToggle'

export type CameraMode = 'pose' | 'video' | 'photo' | 'analysis' | 'slo-mo'

interface NativeCameraInterfaceProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onModeChange: (mode: CameraMode) => void
  onCameraToggle: () => void
  onRecordingToggle: () => void
  isRecording: boolean
  isDetecting: boolean
  recordingDuration: number
  currentMode: CameraMode
  fps?: number
  onClose?: () => void
}

const CAMERA_MODES: Array<{
  id: CameraMode
  label: string
  icon: React.ComponentType<{ size?: number }>
  color: string
}> = [
  { id: 'slo-mo', label: 'SLO-MO', icon: Circle, color: 'text-white' },
  { id: 'video', label: 'VIDEO', icon: Video, color: 'text-white' },
  { id: 'photo', label: 'PHOTO', icon: Image, color: 'text-white' },
  { id: 'pose', label: 'POSE', icon: BarChart3, color: 'text-yellow-400' },
  { id: 'analysis', label: 'ANALYSIS', icon: Zap, color: 'text-white' }
]

export function NativeCameraInterface({
  videoRef,
  canvasRef,
  onModeChange,
  onCameraToggle,
  onRecordingToggle,
  isRecording,
  isDetecting,
  recordingDuration,
  currentMode,
  fps,
  onClose
}: NativeCameraInterfaceProps) {
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off')
  const [showControls, setShowControls] = useState(true)
  const [showCameraControls, setShowCameraControls] = useState(false)
  const [cinematicMode, setCinematicMode] = useState(false)
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)

  // Auto-hide controls after 3 seconds of inactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isRecording) {
        setShowControls(false)
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [showControls, isRecording])

  // Show controls on any interaction
  const handleInteraction = () => {
    setShowControls(true)
  }

  // Handle tap to focus
  const handleVideoTap = (event: React.TouchEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.touches[0].clientX - rect.left
    const y = event.touches[0].clientY - rect.top
    
    setFocusPoint({ x, y })
    handleInteraction()
    
    // Hide focus point after 2 seconds
    setTimeout(() => setFocusPoint(null), 2000)
  }


  // Get current mode config
  const currentModeConfig = CAMERA_MODES.find(mode => mode.id === currentMode)

  return (
    <div 
      className="relative w-full h-full bg-black overflow-hidden"
      onTouchStart={handleInteraction}
      onMouseMove={handleInteraction}
    >
      {/* Video Feed */}
      <div 
        className="relative w-full h-full"
        onTouchStart={handleVideoTap}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover scale-x-[-1]"
          autoPlay
          playsInline
          muted
        />
        
        {/* Cinematic Blur Effect */}
        {cinematicMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 5 }}
          >
            {/* Depth of field blur gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/20" />
            
            {/* Vignette effect */}
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/30" />
            
            {/* Cinematic bars */}
            <div className="absolute top-0 left-0 right-0 h-[10%] bg-black" />
            <div className="absolute bottom-0 left-0 right-0 h-[10%] bg-black" />
          </motion.div>
        )}
        
        {/* Pose Detection Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ 
            width: '100%',
            height: '100%',
            zIndex: 10,
            objectFit: 'cover'
          }}
        />

        {/* Focus Point Indicator */}
        <AnimatePresence>
          {focusPoint && (
            <motion.div
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute w-20 h-20 border-2 border-yellow-400 rounded-sm pointer-events-none"
              style={{
                left: focusPoint.x - 40,
                top: focusPoint.y - 40,
                zIndex: 20
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Top Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-30 p-4"
          >
            <div className="flex justify-between items-center">
              {/* Left Controls */}
              <div className="flex items-center gap-4">
                {onClose && (
                  <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-black/30 backdrop-blur flex items-center justify-center"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                )}
                
                <button
                  onClick={() => setFlashMode(prev => 
                    prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off'
                  )}
                  className="w-10 h-10 rounded-full bg-black/30 backdrop-blur flex items-center justify-center"
                >
                  {flashMode === 'off' ? (
                    <FlashlightOff className="w-6 h-6 text-white" />
                  ) : (
                    <FlashlightIcon className="w-6 h-6 text-yellow-400" />
                  )}
                </button>
              </div>

              {/* Center - Current Mode and Cinematic Toggle */}
              <div className="flex items-center gap-3">
                <div className="bg-black/30 backdrop-blur px-4 py-2 rounded-full">
                  <div className="flex items-center gap-2">
                    {currentModeConfig && (
                      <>
                        <currentModeConfig.icon size={16} className={currentModeConfig.color} />
                        <span className="text-white text-sm font-medium">
                          {currentModeConfig.label}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Cinematic Mode Toggle for video/pose modes */}
                {(currentMode === 'video' || currentMode === 'pose' || currentMode === 'analysis') && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-white/60 text-xs">Cinematic</span>
                    <CinematicToggle 
                      enabled={cinematicMode}
                      onToggle={() => setCinematicMode(!cinematicMode)}
                    />
                  </motion.div>
                )}
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={onCameraToggle}
                  className="w-10 h-10 rounded-full bg-black/30 backdrop-blur flex items-center justify-center"
                >
                  <RotateCcw className="w-6 h-6 text-white" />
                </button>
                
                <button 
                  onClick={() => setShowCameraControls(!showCameraControls)}
                  className="w-10 h-10 rounded-full bg-black/30 backdrop-blur flex items-center justify-center"
                >
                  <Settings className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional Recording Indicator */}
      <RecordingIndicator 
        isRecording={isRecording}
        duration={recordingDuration}
        mode={currentMode as 'video' | 'slo-mo' | 'pose' | 'analysis'}
      />

      {/* Bottom Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 z-30 pb-8"
          >
            {/* Mode Selector - iOS Style */}
            <div className="overflow-x-auto scrollbar-hide mb-8">
              <div className="flex justify-center min-w-min px-8">
                <div className="flex items-center gap-6">
                  {CAMERA_MODES.map((mode) => (
                    <motion.button
                      key={mode.id}
                      onClick={() => onModeChange(mode.id)}
                      className="relative"
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.div
                        className={`
                          text-xs font-semibold tracking-wide transition-all duration-300
                          ${currentMode === mode.id 
                            ? mode.id === 'pose' ? 'text-yellow-400' : 'text-yellow-400' 
                            : 'text-white/60'
                          }
                        `}
                        animate={{
                          scale: currentMode === mode.id ? 1.1 : 1,
                          y: currentMode === mode.id ? -2 : 0
                        }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        {mode.label}
                      </motion.div>
                      {currentMode === mode.id && (
                        <motion.div
                          className="absolute -bottom-1 left-0 right-0 h-[2px] bg-yellow-400 rounded-full"
                          layoutId="modeIndicator"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-center gap-8 px-8">
              {/* Gallery/Settings */}
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-600 rounded" />
              </motion.button>

              {/* Main Shutter Button - iOS Style */}
              <motion.button
                onTouchStart={onRecordingToggle}
                onClick={onRecordingToggle}
                whileTap={{ scale: 0.9 }}
                className="relative"
              >
                <div className={`
                  relative w-[70px] h-[70px] rounded-full flex items-center justify-center
                  transition-all duration-200
                `}>
                  {/* Outer ring */}
                  <div className={`
                    absolute inset-0 rounded-full border-[3px] transition-all duration-200
                    ${isRecording
                      ? 'border-white/60'
                      : 'border-white'
                    }
                  `} />
                  
                  {/* Inner button */}
                  {isRecording ? (
                    <motion.div
                      className="w-[24px] h-[24px] bg-red-500 rounded-sm"
                      initial={{ scale: 1 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring" }}
                    />
                  ) : currentMode === 'photo' ? (
                    <div className="w-[58px] h-[58px] rounded-full bg-white" />
                  ) : (
                    <div className="w-[58px] h-[58px] rounded-full bg-red-500" />
                  )}
                </div>
                
                {/* Recording timer ring */}
                {isRecording && currentMode !== 'photo' && (
                  <svg className="absolute inset-0 w-[70px] h-[70px] -rotate-90">
                    <circle
                      cx="35"
                      cy="35"
                      r="33"
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <motion.circle
                      cx="35"
                      cy="35"
                      r="33"
                      stroke="white"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 33}`}
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 33 }}
                      transition={{
                        duration: 60,
                        ease: "linear"
                      }}
                    />
                  </svg>
                )}
              </motion.button>

              {/* Camera Switch */}
              <motion.button 
                onClick={onCameraToggle}
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center"
              >
                <RotateCcw className="w-6 h-6 text-white" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pose Detection Status Indicator */}
      {(currentMode === 'pose' || currentMode === 'analysis') && isDetecting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-20 right-4 z-30"
        >
          <div className="bg-green-500/20 backdrop-blur border border-green-500/30 px-3 py-1 rounded-full">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-xs font-medium">POSE AI</span>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* FPS Counter */}
      {fps !== undefined && (currentMode === 'pose' || currentMode === 'analysis') && isDetecting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-20 left-4 z-30"
        >
          <div className={`backdrop-blur border px-3 py-1 rounded-full ${
            fps >= 28 ? 'bg-green-500/20 border-green-500/30' : 
            fps >= 20 ? 'bg-yellow-500/20 border-yellow-500/30' : 
            'bg-red-500/20 border-red-500/30'
          }`}>
            <span className={`text-xs font-medium ${
              fps >= 28 ? 'text-green-400' : 
              fps >= 20 ? 'text-yellow-400' : 
              'text-red-400'
            }`}>
              {fps} FPS
            </span>
          </div>
        </motion.div>
      )}
      
      {/* Camera Controls Overlay */}
      <AnimatePresence>
        {showCameraControls && (
          <CameraControls 
            videoRef={videoRef}
            onClose={() => setShowCameraControls(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}