import { PoseData, PoseMetrics, ReferencePose, AIFeedback, UserSettings } from './types'

export class AICoach {
  private apiKey?: string
  private lastFeedbackTime = 0
  private feedbackHistory: AIFeedback[] = []
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'

  constructor(apiKey?: string) {
    this.apiKey = apiKey
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }

  async generateFeedback(
    currentPose: PoseData,
    metrics: PoseMetrics,
    referencePose?: ReferencePose,
    userSettings?: UserSettings
  ): Promise<AIFeedback[]> {
    if (!this.apiKey) {
      return this.generateBasicFeedback(metrics, referencePose)
    }

    // Rate limiting: don't generate AI feedback too frequently
    const now = Date.now()
    const minInterval = this.getMinFeedbackInterval(userSettings?.feedbackFrequency)
    
    if (now - this.lastFeedbackTime < minInterval) {
      return []
    }

    try {
      const feedback = await this.generateAdvancedAIFeedback(
        currentPose,
        metrics,
        referencePose,
        userSettings
      )
      
      this.lastFeedbackTime = now
      this.feedbackHistory.push(...feedback)
      
      // Keep only recent feedback history
      this.feedbackHistory = this.feedbackHistory.slice(-20)
      
      return feedback
    } catch (error) {
      console.error('AI feedback generation failed:', error)
      return this.generateBasicFeedback(metrics, referencePose)
    }
  }

  private async generateAdvancedAIFeedback(
    currentPose: PoseData,
    metrics: PoseMetrics,
    referencePose?: ReferencePose,
    userSettings?: UserSettings
  ): Promise<AIFeedback[]> {
    const prompt = this.buildAdvancedPrompt(currentPose, metrics, referencePose, userSettings)
    
    const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`AI API request failed: ${response.status}`)
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!generatedText) {
      throw new Error('No feedback generated')
    }

    return this.parseAIResponse(generatedText)
  }

  private buildAdvancedPrompt(
    currentPose: PoseData,
    metrics: PoseMetrics,
    referencePose?: ReferencePose,
    userSettings?: UserSettings
  ): string {
    const experience = userSettings?.experience || 'beginner'
    const goals = userSettings?.goals || []
    
    let prompt = `You are an expert movement coach providing real-time feedback for pose analysis. 

Current Analysis:
- Pose confidence: ${(currentPose.confidence * 100).toFixed(1)}%
- Symmetry score: ${(metrics.symmetryScore * 100).toFixed(1)}%
- Stability score: ${(metrics.stabilityScore * 100).toFixed(1)}%`

    if (referencePose) {
      prompt += `
- Reference pose: ${referencePose.name}
- Pose similarity: ${(metrics.similarity * 100).toFixed(1)}%
- Key deviations: ${metrics.keyDeviations.length} areas need adjustment`
    }

    prompt += `

Joint Angles Analysis:
${Object.entries(metrics.jointAngles)
  .map(([joint, angle]) => `- ${joint}: ${angle.toFixed(1)}°`)
  .join('\n')}

Balance & Motion:
- Center of mass stability: ${(metrics.balanceMetrics.stability * 100).toFixed(1)}%`

    if (Object.keys(metrics.velocities).length > 0) {
      prompt += `
- Movement velocities: ${Object.entries(metrics.velocities)
        .map(([part, vel]) => `${part}: ${vel.toFixed(1)}px/s`)
        .join(', ')}`
    }

    prompt += `

User Profile:
- Experience level: ${experience}
- Goals: ${goals.length > 0 ? goals.join(', ') : 'General fitness'}

Please provide specific, actionable feedback in this JSON format:
{
  "feedback": [
    {
      "type": "correction|encouragement|instruction|warning",
      "priority": "high|medium|low",
      "message": "Brief, specific coaching tip (max 20 words)",
      "relatedKeypoints": [array of keypoint indices if relevant]
    }
  ]
}

Guidelines:
1. Max 3 feedback items at once
2. Prioritize the most important corrections
3. Use encouraging, coach-like language
4. Be specific about body parts and movements
5. Adapt complexity to user's experience level
6. Focus on safety for beginners`

    if (referencePose) {
      prompt += `
7. Reference the target pose: "${referencePose.name}"
8. Consider common mistakes: ${referencePose.commonMistakes?.join(', ')}`
    }

    return prompt
  }

  private parseAIResponse(response: string): AIFeedback[] {
    try {
      // Clean up the response (remove markdown formatting if present)
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim()
      
      const parsed = JSON.parse(cleanResponse)
      
      if (!parsed.feedback || !Array.isArray(parsed.feedback)) {
        throw new Error('Invalid feedback format')
      }

      return parsed.feedback.map((item: any): AIFeedback => ({
        type: item.type || 'instruction',
        priority: item.priority || 'medium',
        message: item.message || 'Keep up the good work!',
        timestamp: Date.now(),
        relatedKeypoints: item.relatedKeypoints || [],
        suggestedDuration: item.suggestedDuration
      }))
    } catch (error) {
      console.error('Failed to parse AI response:', error)
      return [{
        type: 'encouragement',
        priority: 'low',
        message: 'Great work! Keep focusing on your form.',
        timestamp: Date.now()
      }]
    }
  }

  private generateBasicFeedback(metrics: PoseMetrics, referencePose?: ReferencePose): AIFeedback[] {
    const feedback: AIFeedback[] = []
    const now = Date.now()

    // Symmetry feedback
    if (metrics.symmetryScore < 0.7) {
      feedback.push({
        type: 'correction',
        priority: 'high',
        message: 'Focus on keeping both sides of your body balanced',
        timestamp: now,
        relatedKeypoints: [5, 6, 11, 12] // shoulders and hips
      })
    } else if (metrics.symmetryScore > 0.85) {
      feedback.push({
        type: 'encouragement',
        priority: 'low',
        message: 'Excellent body symmetry!',
        timestamp: now
      })
    }

    // Stability feedback
    if (metrics.stabilityScore < 0.6) {
      feedback.push({
        type: 'instruction',
        priority: 'medium',
        message: 'Try to hold your pose more steadily',
        timestamp: now
      })
    }

    // Joint angle feedback
    Object.entries(metrics.jointAngles).forEach(([joint, angle]) => {
      if (joint.includes('Knee') && (angle < 30 || angle > 170)) {
        feedback.push({
          type: 'warning',
          priority: 'high',
          message: `Check your ${joint.toLowerCase()} angle - avoid extreme positions`,
          timestamp: now,
          relatedKeypoints: joint.includes('left') ? [13] : [14]
        })
      }
    })

    // Reference pose feedback
    if (referencePose && metrics.similarity < 0.5) {
      feedback.push({
        type: 'instruction',
        priority: 'medium',
        message: `Work on matching the ${referencePose.name} position more closely`,
        timestamp: now
      })
    }

    // Balance feedback
    if (metrics.balanceMetrics.stability < 0.5) {
      feedback.push({
        type: 'instruction',
        priority: 'medium',
        message: 'Engage your core for better balance',
        timestamp: now,
        relatedKeypoints: [11, 12] // hips
      })
    }

    return feedback.slice(0, 3) // Limit to 3 feedback items
  }

  private getMinFeedbackInterval(frequency?: string): number {
    switch (frequency) {
      case 'high': return 2000 // 2 seconds
      case 'medium': return 4000 // 4 seconds
      case 'low': return 8000 // 8 seconds
      default: return 4000
    }
  }

  async generateSessionSummary(
    sessionDuration: number,
    averageScore: number,
    improvementAreas: string[],
    achievements: string[],
    userSettings?: UserSettings
  ): Promise<string> {
    if (!this.apiKey) {
      return this.generateBasicSessionSummary(sessionDuration, averageScore, achievements)
    }

    try {
      const prompt = `You are a fitness coach providing a session summary.

Session Stats:
- Duration: ${Math.round(sessionDuration / 60000)} minutes
- Average performance: ${(averageScore * 100).toFixed(1)}%
- Areas for improvement: ${improvementAreas.join(', ')}
- Achievements: ${achievements.join(', ')}
- User experience: ${userSettings?.experience || 'beginner'}

Provide an encouraging, personalized summary in 2-3 sentences. Include:
1. Recognition of effort and achievements
2. One specific area to focus on next time
3. Motivational closing

Keep it positive and actionable.`

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 256
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 
               this.generateBasicSessionSummary(sessionDuration, averageScore, achievements)
      }
    } catch (error) {
      console.error('Failed to generate AI session summary:', error)
    }

    return this.generateBasicSessionSummary(sessionDuration, averageScore, achievements)
  }

  private generateBasicSessionSummary(
    sessionDuration: number,
    averageScore: number,
    achievements: string[]
  ): string {
    const minutes = Math.round(sessionDuration / 60000)
    const scorePercent = Math.round(averageScore * 100)

    let summary = `Great ${minutes}-minute session! `

    if (scorePercent >= 80) {
      summary += `Excellent performance with ${scorePercent}% accuracy. `
    } else if (scorePercent >= 60) {
      summary += `Good work with ${scorePercent}% accuracy - you're improving! `
    } else {
      summary += `Keep practicing - consistency is key to improvement. `
    }

    if (achievements.length > 0) {
      summary += `You achieved: ${achievements[0]}. `
    }

    summary += `Keep up the excellent work!`

    return summary
  }

  getRecentFeedback(limit: number = 5): AIFeedback[] {
    return this.feedbackHistory.slice(-limit)
  }

  clearFeedbackHistory(): void {
    this.feedbackHistory = []
  }

  isReady(): boolean {
    return !!this.apiKey
  }
}