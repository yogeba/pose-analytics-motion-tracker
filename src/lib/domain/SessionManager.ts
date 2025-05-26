import { SessionData, SessionSummary, PoseData, PoseMetrics, ReferencePose, UserSettings } from './types'

export class SessionManager {
  private db?: IDBDatabase
  private readonly dbName = 'PoseAnalyticsDB'
  private readonly dbVersion = 1
  private currentSession?: SessionData

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)
      
      request.onerror = () => reject(new Error('Failed to open database'))
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' })
          sessionStore.createIndex('startTime', 'startTime', { unique: false })
          sessionStore.createIndex('referencePoseId', 'referencePose.id', { unique: false })
        }
        
        // Create user settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' })
        }
        
        // Create reference poses store
        if (!db.objectStoreNames.contains('referencePoses')) {
          const poseStore = db.createObjectStore('referencePoses', { keyPath: 'id' })
          poseStore.createIndex('category', 'category', { unique: false })
          poseStore.createIndex('difficulty', 'difficulty', { unique: false })
        }
      }
    })
  }

  async startSession(referencePose?: ReferencePose, userSettings?: UserSettings): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      referencePose,
      frames: [],
      userSettings: userSettings || await this.getUserSettings()
    }
    
    return sessionId
  }

  async endSession(): Promise<string | null> {
    if (!this.currentSession) return null
    
    this.currentSession.endTime = Date.now()
    this.currentSession.summary = this.generateSessionSummary(this.currentSession)
    
    await this.saveSession(this.currentSession)
    
    const sessionId = this.currentSession.id
    this.currentSession = undefined
    
    return sessionId
  }

  async recordFrame(pose: PoseData, metrics: PoseMetrics, feedback?: string[]): Promise<void> {
    if (!this.currentSession) return
    
    this.currentSession.frames.push({
      timestamp: Date.now(),
      pose,
      metrics,
      feedback
    })
    
    // Auto-save every 100 frames to prevent data loss
    if (this.currentSession.frames.length % 100 === 0) {
      await this.saveSessionProgress()
    }
  }

  private async saveSession(session: SessionData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite')
      const store = transaction.objectStore('sessions')
      
      const request = store.put(session)
      request.onerror = () => reject(new Error('Failed to save session'))
      request.onsuccess = () => resolve()
    })
  }

  private async saveSessionProgress(): Promise<void> {
    if (!this.currentSession) return
    
    // Create a copy of current session for progress saving
    const progressSession = { ...this.currentSession }
    progressSession.summary = this.generateSessionSummary(progressSession)
    
    await this.saveSession(progressSession)
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.db) throw new Error('Database not initialized')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly')
      const store = transaction.objectStore('sessions')
      
      const request = store.get(sessionId)
      request.onerror = () => reject(new Error('Failed to get session'))
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async getAllSessions(): Promise<SessionData[]> {
    if (!this.db) throw new Error('Database not initialized')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly')
      const store = transaction.objectStore('sessions')
      
      const request = store.getAll()
      request.onerror = () => reject(new Error('Failed to get sessions'))
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async getRecentSessions(limit: number = 10): Promise<SessionData[]> {
    const allSessions = await this.getAllSessions()
    
    return allSessions
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit)
  }

  async getSessionsByDateRange(startDate: Date, endDate: Date): Promise<SessionData[]> {
    const allSessions = await this.getAllSessions()
    
    return allSessions.filter(session => 
      session.startTime >= startDate.getTime() && 
      session.startTime <= endDate.getTime()
    )
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite')
      const store = transaction.objectStore('sessions')
      
      const request = store.delete(sessionId)
      request.onerror = () => reject(new Error('Failed to delete session'))
      request.onsuccess = () => resolve()
    })
  }

  private generateSessionSummary(session: SessionData): SessionSummary {
    const duration = (session.endTime || Date.now()) - session.startTime
    const validFrames = session.frames.filter(frame => frame.pose.confidence > 0.5)
    
    if (validFrames.length === 0) {
      return {
        duration,
        averageScore: 0,
        bestScore: 0,
        totalFrames: session.frames.length,
        validFrames: 0,
        improvementAreas: ['Need more stable pose detection'],
        achievements: [],
        nextSteps: ['Try better lighting or camera positioning'],
        overallProgress: 'needs_work'
      }
    }
    
    const scores = validFrames.map(frame => frame.metrics.similarity)
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const bestScore = Math.max(...scores)
    
    // Calculate symmetry scores
    const symmetryScores = validFrames.map(frame => frame.metrics.symmetryScore)
    const averageSymmetry = symmetryScores.reduce((sum, score) => sum + score, 0) / symmetryScores.length
    
    // Calculate stability scores
    const stabilityScores = validFrames.map(frame => frame.metrics.stabilityScore)
    const averageStability = stabilityScores.reduce((sum, score) => sum + score, 0) / stabilityScores.length
    
    // Analyze improvement areas
    const improvementAreas: string[] = []
    const achievements: string[] = []
    const nextSteps: string[] = []
    
    if (averageScore < 0.6) {
      improvementAreas.push('Overall pose accuracy')
      nextSteps.push('Focus on matching the reference pose more closely')
    } else if (averageScore > 0.8) {
      achievements.push('Excellent pose accuracy!')
    }
    
    if (averageSymmetry < 0.7) {
      improvementAreas.push('Body symmetry and alignment')
      nextSteps.push('Work on keeping both sides of your body balanced')
    } else if (averageSymmetry > 0.85) {
      achievements.push('Great body symmetry!')
    }
    
    if (averageStability < 0.6) {
      improvementAreas.push('Pose stability and control')
      nextSteps.push('Practice holding poses for longer periods')
    } else if (averageStability > 0.8) {
      achievements.push('Excellent stability and control!')
    }
    
    // Determine overall progress
    let overallProgress: 'excellent' | 'good' | 'needs_work'
    if (averageScore > 0.8 && averageSymmetry > 0.8 && averageStability > 0.7) {
      overallProgress = 'excellent'
    } else if (averageScore > 0.6 && averageSymmetry > 0.6 && averageStability > 0.5) {
      overallProgress = 'good'
    } else {
      overallProgress = 'needs_work'
    }
    
    // Add session duration achievements
    if (duration > 300000) { // 5 minutes
      achievements.push('Completed a long session!')
    }
    if (validFrames.length > 1000) {
      achievements.push('Maintained consistent tracking!')
    }
    
    return {
      duration,
      averageScore,
      bestScore,
      totalFrames: session.frames.length,
      validFrames: validFrames.length,
      improvementAreas,
      achievements,
      nextSteps,
      overallProgress
    }
  }

  async getUserSettings(): Promise<UserSettings> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['settings'], 'readonly')
        const store = transaction.objectStore('settings')
        
        const request = store.get('userSettings')
        request.onerror = () => {
          console.warn('Failed to get user settings from database, using defaults')
          resolve({
            experience: 'beginner',
            goals: [],
            feedbackFrequency: 'medium',
            voiceFeedbackEnabled: true,
            visualFeedbackEnabled: true,
            aiCoachingEnabled: true,
            preferredVoice: 'default',
            language: 'en'
          })
        }
        request.onsuccess = () => {
          resolve(request.result?.data || {
            experience: 'beginner',
            goals: [],
            feedbackFrequency: 'medium',
            voiceFeedbackEnabled: true,
            visualFeedbackEnabled: true,
            aiCoachingEnabled: true,
            preferredVoice: 'default',
            language: 'en'
          })
        }
      } catch (error) {
        console.warn('Error accessing database for user settings:', error)
        resolve({
          experience: 'beginner',
          goals: [],
          feedbackFrequency: 'medium',
          voiceFeedbackEnabled: true,
          visualFeedbackEnabled: true,
          aiCoachingEnabled: true,
          preferredVoice: 'default',
          language: 'en'
        })
      }
    })
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite')
      const store = transaction.objectStore('settings')
      
      const request = store.put({ id: 'userSettings', data: settings })
      request.onerror = () => reject(new Error('Failed to save user settings'))
      request.onsuccess = () => resolve()
    })
  }

  getCurrentSession(): SessionData | undefined {
    return this.currentSession
  }

  isSessionActive(): boolean {
    return !!this.currentSession
  }

  async exportData(): Promise<{ sessions: SessionData[]; settings: UserSettings }> {
    const sessions = await this.getAllSessions()
    const settings = await this.getUserSettings()
    
    return { sessions, settings }
  }

  async importData(data: { sessions: SessionData[]; settings: UserSettings }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    const transaction = this.db.transaction(['sessions', 'settings'], 'readwrite')
    
    // Import sessions
    const sessionStore = transaction.objectStore('sessions')
    for (const session of data.sessions) {
      await new Promise<void>((resolve, reject) => {
        const request = sessionStore.put(session)
        request.onerror = () => reject(new Error('Failed to import session'))
        request.onsuccess = () => resolve()
      })
    }
    
    // Import settings
    await this.saveUserSettings(data.settings)
  }

  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    const transaction = this.db.transaction(['sessions', 'settings'], 'readwrite')
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('sessions').clear()
        request.onerror = () => reject(new Error('Failed to clear sessions'))
        request.onsuccess = () => resolve()
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('settings').clear()
        request.onerror = () => reject(new Error('Failed to clear settings'))
        request.onsuccess = () => resolve()
      })
    ])
  }
}