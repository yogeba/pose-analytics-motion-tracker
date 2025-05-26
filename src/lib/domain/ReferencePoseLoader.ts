import { ReferencePose, Keypoint } from './types'

export class ReferencePoseLoader {
  private poses: Map<string, ReferencePose> = new Map()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    // Load built-in reference poses
    this.loadBuiltInPoses()
    this.initialized = true
  }

  private loadBuiltInPoses(): void {
    const builtInPoses: ReferencePose[] = [
      {
        id: 't_pose',
        name: 'T-Pose',
        description: 'Basic calibration pose with arms extended horizontally',
        category: 'fitness',
        difficulty: 'beginner',
        keypoints: this.generateTPose(),
        instructions: [
          'Stand straight with feet hip-width apart',
          'Extend arms out to the sides parallel to the ground',
          'Keep palms facing forward',
          'Hold head up and look straight ahead'
        ],
        tips: [
          'Keep shoulders relaxed and down',
          'Engage your core for stability',
          'Maintain even weight on both feet'
        ],
        commonMistakes: [
          'Arms too high or too low',
          'Leaning to one side',
          'Hunched shoulders'
        ],
        targetMetrics: {
          symmetryThreshold: 0.85,
          stabilityThreshold: 0.8,
          jointAngleRanges: {
            leftShoulder: { min: 80, max: 100 },
            rightShoulder: { min: 80, max: 100 }
          }
        }
      },
      {
        id: 'mountain_pose',
        name: 'Mountain Pose',
        description: 'Foundational yoga pose for alignment and balance',
        category: 'yoga',
        difficulty: 'beginner',
        keypoints: this.generateMountainPose(),
        instructions: [
          'Stand tall with feet parallel and hip-width apart',
          'Arms at your sides, palms facing forward',
          'Engage your thigh muscles and lift kneecaps',
          'Lengthen your spine and reach crown of head up'
        ],
        tips: [
          'Root down through all four corners of feet',
          'Soften your face and jaw',
          'Breathe deeply and evenly'
        ],
        commonMistakes: [
          'Locking knees',
          'Tensing shoulders',
          'Tilting pelvis forward or back'
        ],
        targetMetrics: {
          symmetryThreshold: 0.9,
          stabilityThreshold: 0.85,
          jointAngleRanges: {
            leftKnee: { min: 170, max: 180 },
            rightKnee: { min: 170, max: 180 }
          }
        }
      },
      {
        id: 'warrior_ii',
        name: 'Warrior II',
        description: 'Strong standing yoga pose building leg strength and focus',
        category: 'yoga',
        difficulty: 'intermediate',
        keypoints: this.generateWarriorII(),
        instructions: [
          'Step left foot back 3-4 feet, turn out 90 degrees',
          'Bend right knee directly over ankle',
          'Extend arms parallel to floor',
          'Gaze over right fingertips'
        ],
        tips: [
          'Keep front thigh parallel to floor',
          'Press down through back foot edge',
          'Keep torso upright between legs'
        ],
        commonMistakes: [
          'Front knee collapsing inward',
          'Leaning over front leg',
          'Dropping back arm'
        ],
        targetMetrics: {
          symmetryThreshold: 0.75,
          stabilityThreshold: 0.7,
          jointAngleRanges: {
            rightKnee: { min: 85, max: 95 },
            leftKnee: { min: 170, max: 180 }
          }
        }
      },
      {
        id: 'squat',
        name: 'Squat',
        description: 'Fundamental lower body exercise for strength and mobility',
        category: 'fitness',
        difficulty: 'beginner',
        keypoints: this.generateSquat(),
        instructions: [
          'Stand with feet shoulder-width apart',
          'Lower body by bending knees and hips',
          'Keep chest up and weight on heels',
          'Descend until thighs are parallel to floor'
        ],
        tips: [
          'Keep knees tracking over toes',
          'Maintain neutral spine',
          'Push through heels to stand'
        ],
        commonMistakes: [
          'Knees caving inward',
          'Rounding lower back',
          'Rising onto toes'
        ],
        targetMetrics: {
          symmetryThreshold: 0.8,
          stabilityThreshold: 0.75,
          jointAngleRanges: {
            leftKnee: { min: 85, max: 95 },
            rightKnee: { min: 85, max: 95 },
            leftHip: { min: 85, max: 105 },
            rightHip: { min: 85, max: 105 }
          }
        }
      },
      {
        id: 'plank',
        name: 'Plank',
        description: 'Core strengthening pose maintaining straight body line',
        category: 'fitness',
        difficulty: 'intermediate',
        keypoints: this.generatePlank(),
        instructions: [
          'Start in push-up position',
          'Keep body in straight line from head to heels',
          'Engage core and breathe normally',
          'Hold position maintaining alignment'
        ],
        tips: [
          'Don\'t let hips sag or pike up',
          'Keep shoulders over wrists',
          'Engage glutes and core'
        ],
        commonMistakes: [
          'Sagging hips',
          'Hiking hips too high',
          'Holding breath'
        ],
        targetMetrics: {
          symmetryThreshold: 0.85,
          stabilityThreshold: 0.8,
          jointAngleRanges: {
            leftShoulder: { min: 85, max: 95 },
            rightShoulder: { min: 85, max: 95 }
          }
        }
      },
      {
        id: 'lunge',
        name: 'Lunge',
        description: 'Single-leg exercise for strength, balance, and flexibility',
        category: 'fitness',
        difficulty: 'intermediate',
        keypoints: this.generateLunge(),
        instructions: [
          'Step right foot forward into wide stance',
          'Lower body until both knees are at 90 degrees',
          'Keep front knee over ankle',
          'Push back to starting position'
        ],
        tips: [
          'Keep torso upright',
          'Don\'t let front knee drift forward',
          'Control the descent'
        ],
        commonMistakes: [
          'Front knee past toes',
          'Leaning forward',
          'Not lowering enough'
        ],
        targetMetrics: {
          symmetryThreshold: 0.7,
          stabilityThreshold: 0.65,
          jointAngleRanges: {
            rightKnee: { min: 85, max: 95 },
            leftKnee: { min: 85, max: 95 }
          }
        }
      }
    ]

    builtInPoses.forEach(pose => {
      this.poses.set(pose.id, pose)
    })
  }

  private generateTPose(): Keypoint[] {
    // Simplified keypoint positions for T-pose (normalized coordinates 0-1)
    return [
      { x: 0.5, y: 0.15, confidence: 0.9, name: 'nose' },           // 0
      { x: 0.48, y: 0.12, confidence: 0.8, name: 'left_eye' },     // 1
      { x: 0.52, y: 0.12, confidence: 0.8, name: 'right_eye' },    // 2
      { x: 0.46, y: 0.14, confidence: 0.7, name: 'left_ear' },     // 3
      { x: 0.54, y: 0.14, confidence: 0.7, name: 'right_ear' },    // 4
      { x: 0.35, y: 0.25, confidence: 0.95, name: 'left_shoulder' }, // 5
      { x: 0.65, y: 0.25, confidence: 0.95, name: 'right_shoulder' }, // 6
      { x: 0.15, y: 0.25, confidence: 0.9, name: 'left_elbow' },   // 7
      { x: 0.85, y: 0.25, confidence: 0.9, name: 'right_elbow' },  // 8
      { x: 0.05, y: 0.25, confidence: 0.85, name: 'left_wrist' },  // 9
      { x: 0.95, y: 0.25, confidence: 0.85, name: 'right_wrist' }, // 10
      { x: 0.4, y: 0.5, confidence: 0.9, name: 'left_hip' },       // 11
      { x: 0.6, y: 0.5, confidence: 0.9, name: 'right_hip' },      // 12
      { x: 0.4, y: 0.75, confidence: 0.85, name: 'left_knee' },    // 13
      { x: 0.6, y: 0.75, confidence: 0.85, name: 'right_knee' },   // 14
      { x: 0.4, y: 0.95, confidence: 0.8, name: 'left_ankle' },    // 15
      { x: 0.6, y: 0.95, confidence: 0.8, name: 'right_ankle' }    // 16
    ]
  }

  private generateMountainPose(): Keypoint[] {
    return [
      { x: 0.5, y: 0.15, confidence: 0.9, name: 'nose' },
      { x: 0.48, y: 0.12, confidence: 0.8, name: 'left_eye' },
      { x: 0.52, y: 0.12, confidence: 0.8, name: 'right_eye' },
      { x: 0.46, y: 0.14, confidence: 0.7, name: 'left_ear' },
      { x: 0.54, y: 0.14, confidence: 0.7, name: 'right_ear' },
      { x: 0.42, y: 0.28, confidence: 0.95, name: 'left_shoulder' },
      { x: 0.58, y: 0.28, confidence: 0.95, name: 'right_shoulder' },
      { x: 0.4, y: 0.42, confidence: 0.9, name: 'left_elbow' },
      { x: 0.6, y: 0.42, confidence: 0.9, name: 'right_elbow' },
      { x: 0.38, y: 0.55, confidence: 0.85, name: 'left_wrist' },
      { x: 0.62, y: 0.55, confidence: 0.85, name: 'right_wrist' },
      { x: 0.44, y: 0.5, confidence: 0.9, name: 'left_hip' },
      { x: 0.56, y: 0.5, confidence: 0.9, name: 'right_hip' },
      { x: 0.44, y: 0.72, confidence: 0.85, name: 'left_knee' },
      { x: 0.56, y: 0.72, confidence: 0.85, name: 'right_knee' },
      { x: 0.44, y: 0.95, confidence: 0.8, name: 'left_ankle' },
      { x: 0.56, y: 0.95, confidence: 0.8, name: 'right_ankle' }
    ]
  }

  private generateWarriorII(): Keypoint[] {
    return [
      { x: 0.5, y: 0.15, confidence: 0.9, name: 'nose' },
      { x: 0.48, y: 0.12, confidence: 0.8, name: 'left_eye' },
      { x: 0.52, y: 0.12, confidence: 0.8, name: 'right_eye' },
      { x: 0.46, y: 0.14, confidence: 0.7, name: 'left_ear' },
      { x: 0.54, y: 0.14, confidence: 0.7, name: 'right_ear' },
      { x: 0.25, y: 0.3, confidence: 0.95, name: 'left_shoulder' },
      { x: 0.75, y: 0.3, confidence: 0.95, name: 'right_shoulder' },
      { x: 0.1, y: 0.3, confidence: 0.9, name: 'left_elbow' },
      { x: 0.9, y: 0.3, confidence: 0.9, name: 'right_elbow' },
      { x: 0.05, y: 0.3, confidence: 0.85, name: 'left_wrist' },
      { x: 0.95, y: 0.3, confidence: 0.85, name: 'right_wrist' },
      { x: 0.35, y: 0.55, confidence: 0.9, name: 'left_hip' },
      { x: 0.65, y: 0.55, confidence: 0.9, name: 'right_hip' },
      { x: 0.15, y: 0.75, confidence: 0.85, name: 'left_knee' },
      { x: 0.65, y: 0.68, confidence: 0.85, name: 'right_knee' },
      { x: 0.1, y: 0.95, confidence: 0.8, name: 'left_ankle' },
      { x: 0.65, y: 0.95, confidence: 0.8, name: 'right_ankle' }
    ]
  }

  private generateSquat(): Keypoint[] {
    return [
      { x: 0.5, y: 0.2, confidence: 0.9, name: 'nose' },
      { x: 0.48, y: 0.17, confidence: 0.8, name: 'left_eye' },
      { x: 0.52, y: 0.17, confidence: 0.8, name: 'right_eye' },
      { x: 0.46, y: 0.19, confidence: 0.7, name: 'left_ear' },
      { x: 0.54, y: 0.19, confidence: 0.7, name: 'right_ear' },
      { x: 0.4, y: 0.32, confidence: 0.95, name: 'left_shoulder' },
      { x: 0.6, y: 0.32, confidence: 0.95, name: 'right_shoulder' },
      { x: 0.35, y: 0.45, confidence: 0.9, name: 'left_elbow' },
      { x: 0.65, y: 0.45, confidence: 0.9, name: 'right_elbow' },
      { x: 0.3, y: 0.58, confidence: 0.85, name: 'left_wrist' },
      { x: 0.7, y: 0.58, confidence: 0.85, name: 'right_wrist' },
      { x: 0.42, y: 0.65, confidence: 0.9, name: 'left_hip' },
      { x: 0.58, y: 0.65, confidence: 0.9, name: 'right_hip' },
      { x: 0.4, y: 0.78, confidence: 0.85, name: 'left_knee' },
      { x: 0.6, y: 0.78, confidence: 0.85, name: 'right_knee' },
      { x: 0.4, y: 0.95, confidence: 0.8, name: 'left_ankle' },
      { x: 0.6, y: 0.95, confidence: 0.8, name: 'right_ankle' }
    ]
  }

  private generatePlank(): Keypoint[] {
    return [
      { x: 0.3, y: 0.25, confidence: 0.9, name: 'nose' },
      { x: 0.28, y: 0.22, confidence: 0.8, name: 'left_eye' },
      { x: 0.32, y: 0.22, confidence: 0.8, name: 'right_eye' },
      { x: 0.26, y: 0.24, confidence: 0.7, name: 'left_ear' },
      { x: 0.34, y: 0.24, confidence: 0.7, name: 'right_ear' },
      { x: 0.25, y: 0.35, confidence: 0.95, name: 'left_shoulder' },
      { x: 0.35, y: 0.35, confidence: 0.95, name: 'right_shoulder' },
      { x: 0.22, y: 0.42, confidence: 0.9, name: 'left_elbow' },
      { x: 0.38, y: 0.42, confidence: 0.9, name: 'right_elbow' },
      { x: 0.2, y: 0.48, confidence: 0.85, name: 'left_wrist' },
      { x: 0.4, y: 0.48, confidence: 0.85, name: 'right_wrist' },
      { x: 0.55, y: 0.4, confidence: 0.9, name: 'left_hip' },
      { x: 0.65, y: 0.4, confidence: 0.9, name: 'right_hip' },
      { x: 0.7, y: 0.45, confidence: 0.85, name: 'left_knee' },
      { x: 0.8, y: 0.45, confidence: 0.85, name: 'right_knee' },
      { x: 0.85, y: 0.5, confidence: 0.8, name: 'left_ankle' },
      { x: 0.95, y: 0.5, confidence: 0.8, name: 'right_ankle' }
    ]
  }

  private generateLunge(): Keypoint[] {
    return [
      { x: 0.5, y: 0.15, confidence: 0.9, name: 'nose' },
      { x: 0.48, y: 0.12, confidence: 0.8, name: 'left_eye' },
      { x: 0.52, y: 0.12, confidence: 0.8, name: 'right_eye' },
      { x: 0.46, y: 0.14, confidence: 0.7, name: 'left_ear' },
      { x: 0.54, y: 0.14, confidence: 0.7, name: 'right_ear' },
      { x: 0.42, y: 0.28, confidence: 0.95, name: 'left_shoulder' },
      { x: 0.58, y: 0.28, confidence: 0.95, name: 'right_shoulder' },
      { x: 0.4, y: 0.42, confidence: 0.9, name: 'left_elbow' },
      { x: 0.6, y: 0.42, confidence: 0.9, name: 'right_elbow' },
      { x: 0.38, y: 0.55, confidence: 0.85, name: 'left_wrist' },
      { x: 0.62, y: 0.55, confidence: 0.85, name: 'right_wrist' },
      { x: 0.44, y: 0.5, confidence: 0.9, name: 'left_hip' },
      { x: 0.56, y: 0.5, confidence: 0.9, name: 'right_hip' },
      { x: 0.35, y: 0.7, confidence: 0.85, name: 'left_knee' },
      { x: 0.65, y: 0.65, confidence: 0.85, name: 'right_knee' },
      { x: 0.3, y: 0.95, confidence: 0.8, name: 'left_ankle' },
      { x: 0.7, y: 0.95, confidence: 0.8, name: 'right_ankle' }
    ]
  }

  getAllPoses(): ReferencePose[] {
    return Array.from(this.poses.values())
  }

  getPose(id: string): ReferencePose | undefined {
    return this.poses.get(id)
  }

  getPosesByCategory(category: string): ReferencePose[] {
    return Array.from(this.poses.values())
      .filter(pose => pose.category === category)
  }

  getPosesByDifficulty(difficulty: string): ReferencePose[] {
    return Array.from(this.poses.values())
      .filter(pose => pose.difficulty === difficulty)
  }

  async addCustomPose(pose: ReferencePose): Promise<void> {
    this.poses.set(pose.id, pose)
    
    // Save to IndexedDB for persistence
    try {
      const db = await this.openDatabase()
      const transaction = db.transaction(['referencePoses'], 'readwrite')
      const store = transaction.objectStore('referencePoses')
      await store.put(pose)
    } catch (error) {
      console.error('Failed to save custom pose:', error)
    }
  }

  async removeCustomPose(id: string): Promise<boolean> {
    if (!this.poses.has(id)) return false
    
    this.poses.delete(id)
    
    // Remove from IndexedDB
    try {
      const db = await this.openDatabase()
      const transaction = db.transaction(['referencePoses'], 'readwrite')
      const store = transaction.objectStore('referencePoses')
      await store.delete(id)
      return true
    } catch (error) {
      console.error('Failed to remove custom pose:', error)
      return false
    }
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PoseAnalyticsDB', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async loadCustomPoses(): Promise<void> {
    try {
      const db = await this.openDatabase()
      const transaction = db.transaction(['referencePoses'], 'readonly')
      const store = transaction.objectStore('referencePoses')
      const request = store.getAll()
      
      request.onsuccess = () => {
        const customPoses = request.result as ReferencePose[]
        customPoses.forEach(pose => {
          this.poses.set(pose.id, pose)
        })
      }
    } catch (error) {
      console.error('Failed to load custom poses:', error)
    }
  }

  getCategories(): string[] {
    const categories = new Set<string>()
    this.poses.forEach(pose => categories.add(pose.category))
    return Array.from(categories)
  }

  getDifficulties(): string[] {
    const difficulties = new Set<string>()
    this.poses.forEach(pose => difficulties.add(pose.difficulty))
    return Array.from(difficulties)
  }

  searchPoses(query: string): ReferencePose[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.poses.values()).filter(pose =>
      pose.name.toLowerCase().includes(lowerQuery) ||
      pose.description.toLowerCase().includes(lowerQuery) ||
      pose.category.toLowerCase().includes(lowerQuery)
    )
  }
}