'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSimplePoseDetection } from './useSimplePoseDetection'
import { SessionManager } from '@/lib/domain/SessionManager'
import { AICoach } from '@/lib/domain/AICoach'
import { VideoRecorderEnhanced as VideoRecorder } from '@/lib/domain/VideoRecorderEnhanced'
import { ReferencePoseLoader } from '@/lib/domain/ReferencePoseLoader'
import { 
  SessionData, 
  UserSettings, 
  ReferencePose, 
  AIFeedback, 
  RecordingState,
  VideoRecordingOptions
} from '@/lib/domain/types'

export const useComprehensivePoseAnalytics = () => {
  // Core pose detection
  const poseDetection = useSimplePoseDetection()
  
  // Domain managers
  const sessionManagerRef = useRef<SessionManager | null>(null)
  const aiCoachRef = useRef<AICoach | null>(null)
  const videoRecorderRef = useRef<VideoRecorder | null>(null)
  const referencePoseLoaderRef = useRef<ReferencePoseLoader | null>(null)
  
  // State
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentSession, setCurrentSession] = useState<SessionData | undefined>()
  const [userSettings, setUserSettings] = useState<UserSettings>()
  const [selectedReferencePose, setSelectedReferencePose] = useState<ReferencePose>()
  const [availableReferencePoses, setAvailableReferencePoses] = useState<ReferencePose[]>([])
  const [recentFeedback, setRecentFeedback] = useState<AIFeedback[]>([])
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0
  })
  const [sessionDuration, setSessionDuration] = useState(0)
  
  // Refs for intervals
  const feedbackIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize all domain managers
  const initializeManagers = useCallback(async () => {
    try {
      // Initialize session manager
      sessionManagerRef.current = new SessionManager()
      await sessionManagerRef.current.initialize()
      
      // Load user settings with default fallback
      let settings: UserSettings
      try {
        settings = await sessionManagerRef.current.getUserSettings()
      } catch (error) {
        console.warn('Failed to load user settings, using defaults:', error)
        // Use default settings if database read fails
        settings = {
          experience: 'beginner',
          goals: [],
          feedbackFrequency: 'medium',
          voiceFeedbackEnabled: true,
          visualFeedbackEnabled: true,
          aiCoachingEnabled: true,
          preferredVoice: 'default',
          language: 'en'
        }
        // Save default settings to database for future use
        try {
          await sessionManagerRef.current.saveUserSettings(settings)
        } catch (saveError) {
          console.warn('Failed to save default settings:', saveError)
        }
      }
      setUserSettings(settings)
      
      // Initialize AI coach
      aiCoachRef.current = new AICoach(settings.geminiApiKey)
      
      // Initialize video recorder
      videoRecorderRef.current = new VideoRecorder()
      
      // Initialize reference pose loader
      referencePoseLoaderRef.current = new ReferencePoseLoader()
      await referencePoseLoaderRef.current.initialize()
      
      // Load available poses
      const poses = referencePoseLoaderRef.current.getAllPoses()
      setAvailableReferencePoses(poses)
      
      setIsInitialized(true)
      console.log('All managers initialized successfully')
    } catch (error) {
      console.error('Failed to initialize managers:', error)
      setIsInitialized(false)
    }
  }, [])

  // Start a new session
  const startSession = useCallback(async (referencePoseId?: string) => {
    if (!sessionManagerRef.current || !userSettings) return null
    
    try {
      const referencePose = referencePoseId 
        ? referencePoseLoaderRef.current?.getPose(referencePoseId)
        : undefined
      
      setSelectedReferencePose(referencePose)
      
      const sessionId = await sessionManagerRef.current.startSession(referencePose, userSettings)
      const session = sessionManagerRef.current.getCurrentSession()
      setCurrentSession(session)
      
      // Start session timer
      sessionTimerRef.current = setInterval(() => {
        if (session) {
          setSessionDuration(Date.now() - session.startTime)
        }
      }, 1000)
      
      // Start AI feedback if enabled
      if (userSettings.aiCoachingEnabled && aiCoachRef.current) {
        startAIFeedbackLoop()
      }
      
      console.log('Session started:', sessionId)
      return sessionId
    } catch (error) {
      console.error('Failed to start session:', error)
      return null
    }
  }, [userSettings])

  // End current session
  const endSession = useCallback(async () => {
    if (!sessionManagerRef.current) return null
    
    try {
      const sessionId = await sessionManagerRef.current.endSession()
      setCurrentSession(undefined)
      setSessionDuration(0)
      
      // Clear timers
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current)
        sessionTimerRef.current = null
      }
      
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current)
        feedbackIntervalRef.current = null
      }
      
      // Stop recording if active
      if (recordingState.isRecording) {
        await stopRecording()
      }
      
      console.log('Session ended:', sessionId)
      return sessionId
    } catch (error) {
      console.error('Failed to end session:', error)
      return null
    }
  }, [recordingState.isRecording])

  // Start AI feedback loop
  const startAIFeedbackLoop = useCallback(() => {
    if (!aiCoachRef.current || !userSettings?.aiCoachingEnabled) return
    
    // Clear existing interval
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current)
    }
    
    const generateFeedback = async () => {
      if (!poseDetection.currentPose || !poseDetection.metrics || !aiCoachRef.current) return
      
      try {
        const feedback = await aiCoachRef.current.generateFeedback(
          poseDetection.currentPose,
          poseDetection.metrics,
          selectedReferencePose,
          userSettings
        )
        
        if (feedback.length > 0) {
          setRecentFeedback(prev => [...prev.slice(-4), ...feedback])
          
          // Record feedback in session
          if (sessionManagerRef.current) {
            await sessionManagerRef.current.recordFrame(
              poseDetection.currentPose,
              poseDetection.metrics,
              feedback.map(f => f.message)
            )
          }
          
          // Voice feedback if enabled
          if (userSettings.voiceFeedbackEnabled) {
            speakFeedback(feedback[0].message)
          }
        }
      } catch (error) {
        console.error('Failed to generate feedback:', error)
      }
    }
    
    // Generate feedback periodically
    feedbackIntervalRef.current = setInterval(generateFeedback, 3000)
  }, [poseDetection.currentPose, poseDetection.metrics, selectedReferencePose, userSettings])

  // Voice feedback
  const speakFeedback = useCallback((message: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.rate = 0.9
      utterance.pitch = 1.1
      utterance.voice = speechSynthesis.getVoices().find(voice => 
        voice.name.includes(userSettings?.preferredVoice || 'default')
      ) || null
      speechSynthesis.speak(utterance)
    }
  }, [userSettings?.preferredVoice])

  // Start recording
  const startRecording = useCallback(async (
    videoElement: HTMLVideoElement,
    overlayCanvas?: HTMLCanvasElement,
    options?: VideoRecordingOptions
  ) => {
    if (!videoRecorderRef.current) return false
    
    try {
      await videoRecorderRef.current.initialize(videoElement, overlayCanvas)
      const success = await videoRecorderRef.current.startRecording(videoElement, options)
      
      if (success) {
        setRecordingState(videoRecorderRef.current.getState())
        
        // Update recording state periodically
        const updateInterval = setInterval(() => {
          if (videoRecorderRef.current) {
            setRecordingState(videoRecorderRef.current.getState())
          }
        }, 100)
        
        // Store interval for cleanup
        ;(videoRecorderRef.current as any).updateInterval = updateInterval
      }
      
      return success
    } catch (error) {
      console.error('Failed to start recording:', error)
      return false
    }
  }, [])

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!videoRecorderRef.current) return null
    
    try {
      const blob = await videoRecorderRef.current.stopRecording()
      setRecordingState(videoRecorderRef.current.getState())
      
      // Clear update interval
      const updateInterval = (videoRecorderRef.current as any).updateInterval
      if (updateInterval) {
        clearInterval(updateInterval)
        ;(videoRecorderRef.current as any).updateInterval = undefined
      }
      
      return blob
    } catch (error) {
      console.error('Failed to stop recording:', error)
      return null
    }
  }, [])

  // Download recording
  const downloadRecording = useCallback(async (filename?: string) => {
    if (!videoRecorderRef.current) return
    
    try {
      await videoRecorderRef.current.downloadRecording(filename)
    } catch (error) {
      console.error('Failed to download recording:', error)
    }
  }, [])

  // Update user settings
  const updateUserSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    if (!sessionManagerRef.current) return
    
    try {
      const updatedSettings = { ...userSettings, ...newSettings } as UserSettings
      await sessionManagerRef.current.saveUserSettings(updatedSettings)
      setUserSettings(updatedSettings)
      
      // Update AI coach API key if changed
      if (newSettings.geminiApiKey && aiCoachRef.current) {
        aiCoachRef.current.setApiKey(newSettings.geminiApiKey)
      }
      
      console.log('User settings updated')
    } catch (error) {
      console.error('Failed to update user settings:', error)
    }
  }, [userSettings])

  // Get session history
  const getSessionHistory = useCallback(async (limit?: number) => {
    if (!sessionManagerRef.current) return []
    
    try {
      return await sessionManagerRef.current.getRecentSessions(limit)
    } catch (error) {
      console.error('Failed to get session history:', error)
      return []
    }
  }, [])

  // Export data
  const exportData = useCallback(async () => {
    if (!sessionManagerRef.current) return null
    
    try {
      const data = await sessionManagerRef.current.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pose-analytics-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      return data
    } catch (error) {
      console.error('Failed to export data:', error)
      return null
    }
  }, [])

  // Record current frame if session is active
  useEffect(() => {
    if (currentSession && poseDetection.currentPose && poseDetection.metrics && sessionManagerRef.current) {
      sessionManagerRef.current.recordFrame(
        poseDetection.currentPose,
        poseDetection.metrics
      ).catch(error => {
        console.error('Failed to record frame:', error)
      })
    }
  }, [currentSession, poseDetection.currentPose, poseDetection.metrics])

  // Initialize on mount
  useEffect(() => {
    initializeManagers()
    
    return () => {
      // Cleanup on unmount
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current)
      }
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current)
      }
      if (videoRecorderRef.current) {
        videoRecorderRef.current.dispose()
      }
    }
  }, [initializeManagers])

  return {
    // Core pose detection
    ...poseDetection,
    
    // Manager state
    isManagersInitialized: isInitialized,
    
    // Session management
    currentSession,
    sessionDuration,
    startSession,
    endSession,
    
    // User settings
    userSettings,
    updateUserSettings,
    
    // Reference poses
    selectedReferencePose,
    availableReferencePoses,
    setSelectedReferencePose,
    
    // AI feedback
    recentFeedback,
    clearFeedback: () => setRecentFeedback([]),
    
    // Video recording
    recordingState,
    startRecording,
    stopRecording,
    downloadRecording,
    
    // Data management
    getSessionHistory,
    exportData,
    
    // Utilities
    speakFeedback,
    
    // Direct manager access (for advanced use)
    sessionManager: sessionManagerRef.current,
    aiCoach: aiCoachRef.current,
    videoRecorder: videoRecorderRef.current,
    referencePoseLoader: referencePoseLoaderRef.current
  }
}