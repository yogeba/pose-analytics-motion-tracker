/**
 * Advanced Movement Analytics - SOTA 2024 Implementation
 * 
 * Implements state-of-the-art athletic performance metrics including:
 * - Frame-to-frame velocity calculation
 * - Distance tracking and path analysis
 * - Acceleration and jerk metrics
 * - Center of mass tracking
 * - Movement efficiency scoring
 */

export interface Vector2D {
  x: number
  y: number
}

export interface MovementMetrics {
  // Velocity metrics (pixels/second)
  velocities: Vector2D[]              // velocity per keypoint
  avgVelocity: Vector2D               // average velocity across all keypoints
  maxVelocity: number                 // peak velocity magnitude
  
  // Speed metrics
  speed: number                       // overall movement speed (magnitude)
  speedProfile: number[]              // speed over time
  
  // Acceleration metrics
  accelerations: Vector2D[]           // acceleration per keypoint
  avgAcceleration: Vector2D           // average acceleration
  maxAcceleration: number             // peak acceleration magnitude
  
  // Distance metrics
  totalDistance: number               // cumulative distance traveled
  distanceProfile: number[]           // distance per frame
  pathLength: number                  // total path length of center of mass
  
  // Advanced metrics
  jerk: Vector2D[]                    // rate of change of acceleration
  smoothness: number                  // movement smoothness score (0-1)
  efficiency: number                  // movement efficiency score (0-1)
  
  // Center of mass tracking
  centerOfMass: Vector2D              // current center of mass
  comVelocity: Vector2D               // center of mass velocity
  comPath: Vector2D[]                 // center of mass trajectory
  
  // Temporal metrics
  timestamp: number                   // current timestamp
  frameCount: number                  // total frames analyzed
}

export interface PoseKeypoint {
  x: number
  y: number
  confidence: number
  name?: string
}

export interface PoseFrame {
  keypoints: PoseKeypoint[]
  timestamp: number
  confidence: number
}

export class MovementAnalytics {
  private previousFrames: PoseFrame[] = []
  private movementHistory: MovementMetrics[] = []
  private readonly maxHistoryFrames = 10 // Keep last 10 frames for smoothing
  private readonly confidenceThreshold = 0.3
  
  // COCO pose keypoint indices for key body parts
  private readonly keypointIndices = {
    nose: 0,
    leftEye: 1, rightEye: 2,
    leftEar: 3, rightEar: 4,
    leftShoulder: 5, rightShoulder: 6,
    leftElbow: 7, rightElbow: 8,
    leftWrist: 9, rightWrist: 10,
    leftHip: 11, rightHip: 12,
    leftKnee: 13, rightKnee: 14,
    leftAnkle: 15, rightAnkle: 16
  }

  /**
   * Calculate comprehensive movement metrics for current frame
   */
  public calculateMovementMetrics(currentFrame: PoseFrame): MovementMetrics {
    // Add current frame to history
    this.previousFrames.push(currentFrame)
    if (this.previousFrames.length > this.maxHistoryFrames) {
      this.previousFrames.shift()
    }

    // Need at least 2 frames for movement calculation
    if (this.previousFrames.length < 2) {
      return this.createZeroMetrics(currentFrame)
    }

    const previousFrame = this.previousFrames[this.previousFrames.length - 2]
    const deltaTime = (currentFrame.timestamp - previousFrame.timestamp) / 1000 // Convert to seconds

    if (deltaTime <= 0) {
      return this.createZeroMetrics(currentFrame)
    }

    // Calculate velocities
    const velocities = this.calculateVelocities(currentFrame, previousFrame, deltaTime)
    const avgVelocity = this.calculateAverageVelocity(velocities)
    const maxVelocity = this.calculateMaxVelocity(velocities)
    const speed = this.calculateMagnitude(avgVelocity)

    // Calculate accelerations (need 3+ frames)
    let accelerations: Vector2D[] = []
    let avgAcceleration: Vector2D = { x: 0, y: 0 }
    let maxAcceleration = 0
    let jerk: Vector2D[] = []

    if (this.previousFrames.length >= 3) {
      const prevPrevFrame = this.previousFrames[this.previousFrames.length - 3]
      accelerations = this.calculateAccelerations(currentFrame, previousFrame, prevPrevFrame, deltaTime)
      avgAcceleration = this.calculateAverageVelocity(accelerations)
      maxAcceleration = this.calculateMaxVelocity(accelerations)
      
      // Calculate jerk (need 4+ frames)
      if (this.previousFrames.length >= 4) {
        jerk = this.calculateJerk(accelerations, deltaTime)
      }
    }

    // Calculate distance metrics
    const frameDistance = this.calculateFrameDistance(velocities, deltaTime)
    const totalDistance = this.calculateTotalDistance(frameDistance)
    
    // Calculate center of mass
    const centerOfMass = this.calculateCenterOfMass(currentFrame)
    const comVelocity = this.calculateCenterOfMassVelocity(currentFrame, previousFrame, deltaTime)
    
    // Update center of mass path
    const comPath = this.updateCenterOfMassPath(centerOfMass)
    const pathLength = this.calculatePathLength(comPath)

    // Calculate advanced metrics
    const smoothness = this.calculateSmoothness(velocities, jerk)
    const efficiency = this.calculateMovementEfficiency(velocities, accelerations, totalDistance)

    const metrics: MovementMetrics = {
      velocities,
      avgVelocity,
      maxVelocity,
      speed,
      speedProfile: this.updateSpeedProfile(speed),
      accelerations,
      avgAcceleration,
      maxAcceleration,
      totalDistance,
      distanceProfile: this.updateDistanceProfile(frameDistance),
      pathLength,
      jerk,
      smoothness,
      efficiency,
      centerOfMass,
      comVelocity,
      comPath,
      timestamp: currentFrame.timestamp,
      frameCount: this.previousFrames.length
    }

    // Store in movement history
    this.movementHistory.push(metrics)
    if (this.movementHistory.length > 100) { // Keep last 100 measurements
      this.movementHistory.shift()
    }

    return metrics
  }

  /**
   * Calculate velocities for each keypoint
   */
  private calculateVelocities(current: PoseFrame, previous: PoseFrame, deltaTime: number): Vector2D[] {
    const velocities: Vector2D[] = []
    
    for (let i = 0; i < current.keypoints.length; i++) {
      const currentKp = current.keypoints[i]
      const previousKp = previous.keypoints[i]
      
      if (currentKp && previousKp && 
          currentKp.confidence > this.confidenceThreshold && 
          previousKp.confidence > this.confidenceThreshold) {
        
        const dx = currentKp.x - previousKp.x
        const dy = currentKp.y - previousKp.y
        
        velocities.push({
          x: dx / deltaTime,
          y: dy / deltaTime
        })
      } else {
        velocities.push({ x: 0, y: 0 })
      }
    }
    
    return velocities
  }

  /**
   * Calculate accelerations for each keypoint
   */
  private calculateAccelerations(
    current: PoseFrame, 
    previous: PoseFrame, 
    prevPrev: PoseFrame, 
    deltaTime: number
  ): Vector2D[] {
    const currentVelocities = this.calculateVelocities(current, previous, deltaTime)
    const previousVelocities = this.calculateVelocities(previous, prevPrev, deltaTime)
    
    const accelerations: Vector2D[] = []
    
    for (let i = 0; i < currentVelocities.length; i++) {
      const dvx = currentVelocities[i].x - previousVelocities[i].x
      const dvy = currentVelocities[i].y - previousVelocities[i].y
      
      accelerations.push({
        x: dvx / deltaTime,
        y: dvy / deltaTime
      })
    }
    
    return accelerations
  }

  /**
   * Calculate jerk (rate of change of acceleration)
   */
  private calculateJerk(accelerations: Vector2D[], deltaTime: number): Vector2D[] {
    if (this.movementHistory.length === 0) return []
    
    const previousAccelerations = this.movementHistory[this.movementHistory.length - 1].accelerations
    const jerk: Vector2D[] = []
    
    for (let i = 0; i < accelerations.length; i++) {
      const dax = accelerations[i].x - (previousAccelerations[i]?.x || 0)
      const day = accelerations[i].y - (previousAccelerations[i]?.y || 0)
      
      jerk.push({
        x: dax / deltaTime,
        y: day / deltaTime
      })
    }
    
    return jerk
  }

  /**
   * Calculate center of mass for pose
   */
  private calculateCenterOfMass(frame: PoseFrame): Vector2D {
    const validKeypoints = frame.keypoints.filter(kp => kp.confidence > this.confidenceThreshold)
    
    if (validKeypoints.length === 0) {
      return { x: 0, y: 0 }
    }
    
    const totalX = validKeypoints.reduce((sum, kp) => sum + kp.x, 0)
    const totalY = validKeypoints.reduce((sum, kp) => sum + kp.y, 0)
    
    return {
      x: totalX / validKeypoints.length,
      y: totalY / validKeypoints.length
    }
  }

  /**
   * Calculate center of mass velocity
   */
  private calculateCenterOfMassVelocity(
    current: PoseFrame, 
    previous: PoseFrame, 
    deltaTime: number
  ): Vector2D {
    const currentCom = this.calculateCenterOfMass(current)
    const previousCom = this.calculateCenterOfMass(previous)
    
    return {
      x: (currentCom.x - previousCom.x) / deltaTime,
      y: (currentCom.y - previousCom.y) / deltaTime
    }
  }

  /**
   * Calculate movement smoothness based on jerk
   */
  private calculateSmoothness(velocities: Vector2D[], jerk: Vector2D[]): number {
    if (jerk.length === 0) return 1.0
    
    const avgJerkMagnitude = jerk.reduce((sum, j) => sum + this.calculateMagnitude(j), 0) / jerk.length
    const avgVelocityMagnitude = velocities.reduce((sum, v) => sum + this.calculateMagnitude(v), 0) / velocities.length
    
    // Normalize smoothness (lower jerk relative to velocity = smoother)
    if (avgVelocityMagnitude === 0) return 1.0
    
    const smoothness = Math.max(0, 1 - (avgJerkMagnitude / (avgVelocityMagnitude * 100)))
    return Math.min(1, smoothness)
  }

  /**
   * Calculate movement efficiency
   */
  private calculateMovementEfficiency(
    velocities: Vector2D[], 
    accelerations: Vector2D[], 
    totalDistance: number
  ): number {
    if (totalDistance === 0) return 1.0
    
    // Calculate energy expenditure (simplified model)
    const velocityMagnitudes = velocities.map(v => this.calculateMagnitude(v))
    const accelerationMagnitudes = accelerations.map(a => this.calculateMagnitude(a))
    
    const avgVelocity = velocityMagnitudes.reduce((sum, v) => sum + v, 0) / velocityMagnitudes.length
    const avgAcceleration = accelerationMagnitudes.reduce((sum, a) => sum + a, 0) / accelerationMagnitudes.length
    
    // Efficiency = distance covered / energy expenditure
    const energyExpenditure = avgVelocity * avgVelocity + avgAcceleration * 0.1
    const efficiency = energyExpenditure === 0 ? 1.0 : Math.min(1.0, totalDistance / (energyExpenditure * 10))
    
    return Math.max(0, efficiency)
  }

  // Helper methods
  private calculateAverageVelocity(velocities: Vector2D[]): Vector2D {
    if (velocities.length === 0) return { x: 0, y: 0 }
    
    const totalX = velocities.reduce((sum, v) => sum + v.x, 0)
    const totalY = velocities.reduce((sum, v) => sum + v.y, 0)
    
    return {
      x: totalX / velocities.length,
      y: totalY / velocities.length
    }
  }

  private calculateMaxVelocity(velocities: Vector2D[]): number {
    return Math.max(...velocities.map(v => this.calculateMagnitude(v)))
  }

  private calculateMagnitude(vector: Vector2D): number {
    return Math.sqrt(vector.x * vector.x + vector.y * vector.y)
  }

  private calculateFrameDistance(velocities: Vector2D[], deltaTime: number): number {
    const avgVelocity = this.calculateAverageVelocity(velocities)
    return this.calculateMagnitude(avgVelocity) * deltaTime
  }

  private calculateTotalDistance(frameDistance: number): number {
    if (this.movementHistory.length === 0) return frameDistance
    
    const lastTotal = this.movementHistory[this.movementHistory.length - 1].totalDistance
    return lastTotal + frameDistance
  }

  private updateCenterOfMassPath(com: Vector2D): Vector2D[] {
    const maxPathLength = 50 // Keep last 50 points
    
    if (this.movementHistory.length === 0) {
      return [com]
    }
    
    const lastPath = this.movementHistory[this.movementHistory.length - 1].comPath
    const newPath = [...lastPath, com]
    
    if (newPath.length > maxPathLength) {
      newPath.shift()
    }
    
    return newPath
  }

  private calculatePathLength(path: Vector2D[]): number {
    if (path.length < 2) return 0
    
    let length = 0
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x
      const dy = path[i].y - path[i-1].y
      length += Math.sqrt(dx * dx + dy * dy)
    }
    
    return length
  }

  private updateSpeedProfile(speed: number): number[] {
    const maxProfileLength = 100
    
    if (this.movementHistory.length === 0) {
      return [speed]
    }
    
    const lastProfile = this.movementHistory[this.movementHistory.length - 1].speedProfile
    const newProfile = [...lastProfile, speed]
    
    if (newProfile.length > maxProfileLength) {
      newProfile.shift()
    }
    
    return newProfile
  }

  private updateDistanceProfile(distance: number): number[] {
    const maxProfileLength = 100
    
    if (this.movementHistory.length === 0) {
      return [distance]
    }
    
    const lastProfile = this.movementHistory[this.movementHistory.length - 1].distanceProfile
    const newProfile = [...lastProfile, distance]
    
    if (newProfile.length > maxProfileLength) {
      newProfile.shift()
    }
    
    return newProfile
  }

  private createZeroMetrics(frame: PoseFrame): MovementMetrics {
    const centerOfMass = this.calculateCenterOfMass(frame)
    
    return {
      velocities: frame.keypoints.map(() => ({ x: 0, y: 0 })),
      avgVelocity: { x: 0, y: 0 },
      maxVelocity: 0,
      speed: 0,
      speedProfile: [0],
      accelerations: [],
      avgAcceleration: { x: 0, y: 0 },
      maxAcceleration: 0,
      totalDistance: 0,
      distanceProfile: [0],
      pathLength: 0,
      jerk: [],
      smoothness: 1.0,
      efficiency: 1.0,
      centerOfMass,
      comVelocity: { x: 0, y: 0 },
      comPath: [centerOfMass],
      timestamp: frame.timestamp,
      frameCount: 1
    }
  }

  /**
   * Get movement summary over time period
   */
  public getMovementSummary(timeWindowMs: number = 10000): {
    avgSpeed: number
    maxSpeed: number
    totalDistance: number
    avgAcceleration: number
    smoothnessScore: number
    efficiencyScore: number
  } {
    const cutoffTime = Date.now() - timeWindowMs
    const recentMetrics = this.movementHistory.filter(m => m.timestamp > cutoffTime)
    
    if (recentMetrics.length === 0) {
      return {
        avgSpeed: 0,
        maxSpeed: 0,
        totalDistance: 0,
        avgAcceleration: 0,
        smoothnessScore: 1.0,
        efficiencyScore: 1.0
      }
    }
    
    const avgSpeed = recentMetrics.reduce((sum, m) => sum + m.speed, 0) / recentMetrics.length
    const maxSpeed = Math.max(...recentMetrics.map(m => m.speed))
    const totalDistance = recentMetrics[recentMetrics.length - 1].totalDistance - recentMetrics[0].totalDistance
    const avgAcceleration = recentMetrics.reduce((sum, m) => sum + m.maxAcceleration, 0) / recentMetrics.length
    const smoothnessScore = recentMetrics.reduce((sum, m) => sum + m.smoothness, 0) / recentMetrics.length
    const efficiencyScore = recentMetrics.reduce((sum, m) => sum + m.efficiency, 0) / recentMetrics.length
    
    return {
      avgSpeed,
      maxSpeed,
      totalDistance,
      avgAcceleration,
      smoothnessScore,
      efficiencyScore
    }
  }

  /**
   * Reset analytics (for new session)
   */
  public reset(): void {
    this.previousFrames = []
    this.movementHistory = []
  }

  /**
   * Get current movement history
   */
  public getMovementHistory(): MovementMetrics[] {
    return [...this.movementHistory]
  }
}