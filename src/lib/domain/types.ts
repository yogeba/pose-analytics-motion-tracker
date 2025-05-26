export interface Keypoint {
  x: number
  y: number
  confidence: number
  name?: string
}

export interface PoseData {
  keypoints: Keypoint[]
  confidence: number
  timestamp: number
}

export interface PoseMetrics {
  similarity: number
  keyDeviations: Array<{
    keypointId: number
    distance: number
    direction: { x: number; y: number }
  }>
  jointAngles: Record<string, number>
  symmetryScore: number
  stabilityScore: number
  velocities: Record<string, number>
  accelerations: Record<string, number>
  balanceMetrics: {
    centerOfMass: { x: number; y: number }
    stability: number
    sway: number
  }
}

export interface ReferencePose {
  id: string
  name: string
  description: string
  category: 'yoga' | 'fitness' | 'therapy' | 'sports'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  keypoints: Keypoint[]
  instructions: string[]
  tips: string[]
  commonMistakes: string[]
  targetMetrics: {
    symmetryThreshold: number
    stabilityThreshold: number
    jointAngleRanges: Record<string, { min: number; max: number }>
  }
}

export interface SessionData {
  id: string
  startTime: number
  endTime?: number
  referencePose?: ReferencePose
  frames: Array<{
    timestamp: number
    pose: PoseData
    metrics: PoseMetrics
    feedback?: string[]
  }>
  summary?: SessionSummary
  userSettings: UserSettings
}

export interface SessionSummary {
  duration: number
  averageScore: number
  bestScore: number
  totalFrames: number
  validFrames: number
  improvementAreas: string[]
  achievements: string[]
  nextSteps: string[]
  overallProgress: 'excellent' | 'good' | 'needs_work'
}

export interface UserSettings {
  experience: 'beginner' | 'intermediate' | 'expert'
  goals: string[]
  feedbackFrequency: 'high' | 'medium' | 'low'
  voiceFeedbackEnabled: boolean
  visualFeedbackEnabled: boolean
  aiCoachingEnabled: boolean
  geminiApiKey?: string
  preferredVoice: string
  language: 'en' | 'es' | 'fr' | 'de'
}

export interface AIFeedback {
  type: 'correction' | 'encouragement' | 'instruction' | 'warning'
  priority: 'high' | 'medium' | 'low'
  message: string
  timestamp: number
  relatedKeypoints?: number[]
  suggestedDuration?: number
}

export interface ProgressMetrics {
  sessions: SessionData[]
  trends: {
    averageScores: Array<{ date: string; score: number }>
    consistencyMetrics: Array<{ date: string; consistency: number }>
    improvementRate: number
    currentStreak: number
    longestStreak: number
  }
  insights: {
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
  }
}

export interface VideoRecordingOptions {
  quality: 'low' | 'medium' | 'high' | 'ultra'
  frameRate: number
  includeOverlay: boolean
  format: 'webm' | 'mp4'
  maxDuration?: number
}

export interface RecordingState {
  isRecording: boolean
  startTime?: number
  duration: number
  data?: Blob
  url?: string
  size?: number
}

export interface ModelCapabilities {
  modelType: string
  supportsVideo: boolean
  maxPoses: number
  estimatedFPS: number
  accuracy: 'high' | 'medium' | 'low'
  deviceOptimized: boolean
}

export interface DeviceCapabilities {
  webglSupported: boolean
  isMobile: boolean
  estimatedPerformance: 'high' | 'medium' | 'low'
  cameraResolution: { width: number; height: number }
  memoryLimit?: number
}