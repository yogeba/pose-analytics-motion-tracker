'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sun, 
  Focus, 
  ZoomIn,
  Sliders,
  X,
  Minus,
  Plus
} from 'lucide-react'

interface CameraControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  onClose: () => void
}

interface CameraCapabilities {
  zoom: { min: number; max: number; step: number; current: number }
  exposure: { min: number; max: number; step: number; current: number }
  focus: { min: number; max: number; step: number; current: number }
  hasManualControls: boolean
}

export function CameraControls({ videoRef, onClose }: CameraControlsProps) {
  const [activeControl, setActiveControl] = useState<'exposure' | 'focus' | 'zoom' | null>(null)
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null)
  const [currentValues, setCurrentValues] = useState({
    zoom: 1,
    exposure: 0,
    focus: 50
  })
  const trackRef = useRef<MediaStreamTrack | null>(null)

  // Get camera capabilities on mount
  useEffect(() => {
    const initializeCapabilities = async () => {
      if (!videoRef.current?.srcObject) return
      
      const stream = videoRef.current.srcObject as MediaStream
      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack) return
      
      trackRef.current = videoTrack
      
      // Get capabilities
      // @ts-ignore - getCapabilities is not in TypeScript types yet
      if (videoTrack.getCapabilities) {
        try {
          // @ts-ignore
          const caps = videoTrack.getCapabilities()
          console.log('Camera capabilities:', caps)
          
          setCapabilities({
            zoom: (caps as any).zoom || { min: 1, max: 4, step: 0.1, current: 1 },
            exposure: (caps as any).exposureCompensation || { min: -2, max: 2, step: 0.1, current: 0 },
            focus: (caps as any).focusDistance || { min: 0, max: 100, step: 1, current: 50 },
            hasManualControls: !!((caps as any).zoom || (caps as any).exposureCompensation || (caps as any).focusDistance)
          })
          
          // Get current settings
          // @ts-ignore
          if (videoTrack.getSettings) {
            // @ts-ignore
            const settings = videoTrack.getSettings()
            setCurrentValues({
              zoom: (settings as any).zoom || 1,
              exposure: (settings as any).exposureCompensation || 0,
              focus: (settings as any).focusDistance || 50
            })
          }
        } catch (error) {
          console.error('Failed to get camera capabilities:', error)
        }
      }
    }
    
    initializeCapabilities()
  }, [videoRef])
  
  // Apply camera constraints
  const applyConstraint = async (constraint: string, value: number) => {
    if (!trackRef.current) return
    
    try {
      const constraints: any = {}
      constraints[constraint] = value
      
      // @ts-ignore - applyConstraints is not in TypeScript types yet
      if (trackRef.current.applyConstraints) {
        // @ts-ignore
        await trackRef.current.applyConstraints({ advanced: [constraints] })
        
        setCurrentValues(prev => ({
          ...prev,
          [constraint]: value
        }))
      }
    } catch (error) {
      console.error(`Failed to apply ${constraint}:`, error)
    }
  }
  
  const handleZoomChange = (value: number) => {
    applyConstraint('zoom', value)
  }
  
  const handleExposureChange = (value: number) => {
    applyConstraint('exposureCompensation', value)
  }
  
  const handleFocusChange = (value: number) => {
    applyConstraint('focusDistance', value)
  }
  
  // Manual fallback controls for devices without API support
  const renderFallbackControls = () => (
    <div className="space-y-4">
      <div className="text-center text-white/60 text-sm">
        Manual camera controls not available on this device
      </div>
      <div className="text-center text-white/40 text-xs">
        Use pinch-to-zoom gesture on the video
      </div>
    </div>
  )
  
  const renderControl = (
    type: 'exposure' | 'focus' | 'zoom',
    icon: React.ReactNode,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-black/50 backdrop-blur-lg rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-white text-sm font-medium capitalize">{type}</span>
        </div>
        <span className="text-white/60 text-sm">{value.toFixed(1)}</span>
      </div>
      
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
        >
          <Minus className="w-4 h-4 text-white" />
        </button>
        
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.6) ${
              ((value - min) / (max - min)) * 100
            }%, rgba(255,255,255,0.2) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.2) 100%)`
          }}
        />
        
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>
    </motion.div>
  )
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 pointer-events-none"
    >
      {/* Control buttons */}
      <div className="absolute bottom-32 left-0 right-0 flex justify-center gap-4 pointer-events-auto">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveControl(activeControl === 'exposure' ? null : 'exposure')}
          className={`w-12 h-12 rounded-full backdrop-blur flex items-center justify-center ${
            activeControl === 'exposure' ? 'bg-white/20' : 'bg-black/30'
          }`}
        >
          <Sun className="w-6 h-6 text-white" />
        </motion.button>
        
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveControl(activeControl === 'focus' ? null : 'focus')}
          className={`w-12 h-12 rounded-full backdrop-blur flex items-center justify-center ${
            activeControl === 'focus' ? 'bg-white/20' : 'bg-black/30'
          }`}
        >
          <Focus className="w-6 h-6 text-white" />
        </motion.button>
        
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveControl(activeControl === 'zoom' ? null : 'zoom')}
          className={`w-12 h-12 rounded-full backdrop-blur flex items-center justify-center ${
            activeControl === 'zoom' ? 'bg-white/20' : 'bg-black/30'
          }`}
        >
          <ZoomIn className="w-6 h-6 text-white" />
        </motion.button>
      </div>
      
      {/* Active control panel */}
      <AnimatePresence>
        {activeControl && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-48 left-4 right-4 pointer-events-auto"
          >
            {!capabilities?.hasManualControls ? (
              renderFallbackControls()
            ) : (
              <>
                {activeControl === 'exposure' && capabilities?.exposure && 
                  renderControl(
                    'exposure',
                    <Sun className="w-5 h-5 text-white" />,
                    currentValues.exposure,
                    capabilities.exposure.min,
                    capabilities.exposure.max,
                    capabilities.exposure.step,
                    handleExposureChange
                  )
                }
                
                {activeControl === 'focus' && capabilities?.focus &&
                  renderControl(
                    'focus',
                    <Focus className="w-5 h-5 text-white" />,
                    currentValues.focus,
                    capabilities.focus.min,
                    capabilities.focus.max,
                    capabilities.focus.step,
                    handleFocusChange
                  )
                }
                
                {activeControl === 'zoom' && capabilities?.zoom &&
                  renderControl(
                    'zoom',
                    <ZoomIn className="w-5 h-5 text-white" />,
                    currentValues.zoom,
                    capabilities.zoom.min,
                    capabilities.zoom.max,
                    capabilities.zoom.step,
                    handleZoomChange
                  )
                }
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Settings button (top right) */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/30 backdrop-blur flex items-center justify-center pointer-events-auto"
      >
        <Sliders className="w-6 h-6 text-white" />
      </motion.button>
    </motion.div>
  )
}