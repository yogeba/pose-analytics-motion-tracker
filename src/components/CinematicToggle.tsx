'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

interface CinematicToggleProps {
  enabled: boolean
  onToggle: () => void
}

export function CinematicToggle({ enabled, onToggle }: CinematicToggleProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onToggle}
      className={`
        relative w-14 h-8 rounded-full transition-colors duration-300
        ${enabled ? 'bg-yellow-500' : 'bg-white/20'}
      `}
    >
      {/* Background blur effect when enabled */}
      {enabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 blur-md"
        />
      )}
      
      {/* Toggle switch */}
      <motion.div
        animate={{ x: enabled ? 24 : 4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`
          absolute top-1 w-6 h-6 rounded-full flex items-center justify-center
          ${enabled ? 'bg-white' : 'bg-white/60'}
        `}
      >
        {enabled && (
          <Sparkles className="w-3 h-3 text-yellow-500" />
        )}
      </motion.div>
      
      {/* Label */}
      <span className={`
        absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-medium uppercase tracking-wider
        ${enabled ? 'text-white/90' : 'text-white/40'}
      `}>
        {enabled ? 'ON' : 'OFF'}
      </span>
    </motion.button>
  )
}