'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface RecordingIndicatorProps {
  isRecording: boolean
  duration: number
  mode: 'video' | 'slo-mo' | 'pose' | 'analysis'
}

export function RecordingIndicator({ isRecording, duration, mode }: RecordingIndicatorProps) {
  const [pulseAnimation, setPulseAnimation] = useState(false)
  
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setPulseAnimation(prev => !prev)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isRecording])
  
  // Format duration to HH:MM:SS
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  
  // Get storage estimate
  const getStorageInfo = () => {
    const bytesPerSecond = mode === 'slo-mo' ? 8000000 : 4000000 // 8Mbps for slo-mo, 4Mbps for normal
    const totalBytes = (duration / 1000) * bytesPerSecond
    const totalMB = totalBytes / (1024 * 1024)
    
    if (totalMB < 1) {
      return `${Math.round(totalBytes / 1024)} KB`
    } else if (totalMB < 1024) {
      return `${totalMB.toFixed(1)} MB`
    } else {
      return `${(totalMB / 1024).toFixed(2)} GB`
    }
  }
  
  if (!isRecording) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-16 left-0 right-0 z-30"
    >
      {/* Main recording bar */}
      <div className="mx-4 bg-black/80 backdrop-blur-lg rounded-full px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left side - Recording status */}
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: pulseAnimation ? 1.2 : 1 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            </motion.div>
            
            <span className="text-white font-mono text-lg">
              {formatDuration(duration)}
            </span>
          </div>
          
          {/* Center - Mode indicator */}
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs uppercase tracking-wide">
              {mode === 'slo-mo' ? '60 FPS' : '30 FPS'}
            </span>
            {mode === 'pose' || mode === 'analysis' ? (
              <span className="text-cyan-400 text-xs">• AI</span>
            ) : null}
          </div>
          
          {/* Right side - Storage */}
          <div className="text-white/60 text-sm">
            {getStorageInfo()}
          </div>
        </div>
      </div>
      
      {/* Recording quality indicator */}
      <div className="flex justify-center mt-2">
        <div className="bg-black/60 backdrop-blur rounded-full px-3 py-1">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-1 h-3 bg-green-400 rounded-full" />
              <div className="w-1 h-3 bg-green-400 rounded-full" />
              <div className="w-1 h-3 bg-green-400 rounded-full" />
              <div className="w-1 h-3 bg-green-400 rounded-full" />
              <div className="w-1 h-3 bg-white/20 rounded-full" />
            </div>
            <span className="text-white/60 text-xs">HD</span>
          </div>
        </div>
      </div>
      
      {/* Waveform visualization (placeholder) */}
      <div className="mx-4 mt-2">
        <div className="h-8 flex items-center justify-center gap-[2px]">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-[2px] bg-white/30 rounded-full"
              animate={{
                height: isRecording ? Math.random() * 24 + 8 : 4
              }}
              transition={{
                duration: 0.3,
                repeat: Infinity,
                repeatType: 'reverse',
                delay: i * 0.02
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}