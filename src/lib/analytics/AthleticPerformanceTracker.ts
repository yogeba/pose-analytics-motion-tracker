import { Keypoint } from '@tensorflow-models/pose-detection';

export interface PerformanceMetrics {
  speed: {
    instantaneous: number; // m/s
    average: number; // m/s
    max: number; // m/s
  };
  distance: {
    total: number; // meters
    horizontal: number; // meters
    vertical: number; // meters
  };
  acceleration: {
    current: number; // m/s²
    max: number; // m/s²
  };
  power: {
    current: number; // watts
    average: number; // watts
    peak: number; // watts
  };
  cadence: number; // steps/min or reps/min
  strideLength: number; // meters
  verticalOscillation: number; // cm
  groundContactTime: number; // ms
  flightTime: number; // ms
  jumpHeight: number; // cm
}

export interface MovementFrame {
  timestamp: number;
  keypoints: Keypoint[];
  centerOfMass: { x: number; y: number };
  velocity: { x: number; y: number };
}

export class AthleticPerformanceTracker {
  private frameHistory: MovementFrame[] = [];
  private maxHistorySize = 120; // 4 seconds at 30fps
  private pixelsPerMeter = 500; // Calibration factor
  private athleteHeight = 1.75; // meters (default)
  private athleteMass = 70; // kg (default)
  
  // Performance optimization
  private lastComputeTime = 0;
  private computeInterval = 33; // ms (30fps)
  private cachedMetrics: PerformanceMetrics | null = null;

  constructor(config?: {
    pixelsPerMeter?: number;
    athleteHeight?: number;
    athleteMass?: number;
  }) {
    if (config?.pixelsPerMeter) this.pixelsPerMeter = config.pixelsPerMeter;
    if (config?.athleteHeight) this.athleteHeight = config.athleteHeight;
    if (config?.athleteMass) this.athleteMass = config.athleteMass;
  }

  // Auto-calibrate based on detected pose height
  calibrateFromPose(keypoints: Keypoint[]) {
    const nose = keypoints[0];
    const leftAnkle = keypoints[15];
    const rightAnkle = keypoints[16];
    
    if (nose && leftAnkle && rightAnkle && 
        nose.score! > 0.5 && leftAnkle.score! > 0.5 && rightAnkle.score! > 0.5) {
      const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
      const heightPixels = Math.abs(ankleY - nose.y);
      this.pixelsPerMeter = heightPixels / this.athleteHeight;
    }
  }

  addFrame(keypoints: Keypoint[], timestamp: number): PerformanceMetrics {
    const now = Date.now();
    
    // Calculate center of mass
    const centerOfMass = this.calculateCenterOfMass(keypoints);
    
    // Calculate velocity if we have previous frame
    let velocity = { x: 0, y: 0 };
    if (this.frameHistory.length > 0) {
      const prevFrame = this.frameHistory[this.frameHistory.length - 1];
      const dt = (timestamp - prevFrame.timestamp) / 1000; // seconds
      if (dt > 0) {
        velocity = {
          x: (centerOfMass.x - prevFrame.centerOfMass.x) / this.pixelsPerMeter / dt,
          y: (centerOfMass.y - prevFrame.centerOfMass.y) / this.pixelsPerMeter / dt
        };
      }
    }

    // Add frame to history
    const frame: MovementFrame = {
      timestamp,
      keypoints,
      centerOfMass,
      velocity
    };
    
    this.frameHistory.push(frame);
    
    // Maintain history size
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }

    // Compute metrics (with caching for performance)
    if (now - this.lastComputeTime > this.computeInterval || !this.cachedMetrics) {
      this.cachedMetrics = this.computeMetrics();
      this.lastComputeTime = now;
    }

    return this.cachedMetrics!;
  }

  private calculateCenterOfMass(keypoints: Keypoint[]): { x: number; y: number } {
    // Weighted center of mass based on body segment masses
    const segmentWeights: Record<number, number> = {
      0: 0.08,  // nose/head
      5: 0.12,  // left shoulder
      6: 0.12,  // right shoulder
      11: 0.15, // left hip
      12: 0.15, // right hip
      13: 0.10, // left knee
      14: 0.10, // right knee
      15: 0.09, // left ankle
      16: 0.09  // right ankle
    };

    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;

    Object.entries(segmentWeights).forEach(([index, weight]) => {
      const kp = keypoints[parseInt(index)];
      if (kp && kp.score! > 0.3) {
        weightedX += kp.x * weight;
        weightedY += kp.y * weight;
        totalWeight += weight;
      }
    });

    return {
      x: totalWeight > 0 ? weightedX / totalWeight : 0,
      y: totalWeight > 0 ? weightedY / totalWeight : 0
    };
  }

  private computeMetrics(): PerformanceMetrics {
    const frames = this.frameHistory;
    if (frames.length < 2) {
      return this.getEmptyMetrics();
    }

    // Speed calculations
    const speeds = frames.map(f => Math.sqrt(f.velocity.x ** 2 + f.velocity.y ** 2));
    const currentSpeed = speeds[speeds.length - 1];
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const maxSpeed = Math.max(...speeds);

    // Distance calculations
    let totalDistance = 0;
    let horizontalDistance = 0;
    let verticalDistance = 0;
    
    for (let i = 1; i < frames.length; i++) {
      const dx = (frames[i].centerOfMass.x - frames[i-1].centerOfMass.x) / this.pixelsPerMeter;
      const dy = (frames[i].centerOfMass.y - frames[i-1].centerOfMass.y) / this.pixelsPerMeter;
      totalDistance += Math.sqrt(dx ** 2 + dy ** 2);
      horizontalDistance += Math.abs(dx);
      verticalDistance += Math.abs(dy);
    }

    // Acceleration
    const accelerations: number[] = [];
    for (let i = 1; i < frames.length; i++) {
      const dt = (frames[i].timestamp - frames[i-1].timestamp) / 1000;
      if (dt > 0) {
        const dv = speeds[i] - speeds[i-1];
        accelerations.push(dv / dt);
      }
    }
    const currentAcceleration = accelerations.length > 0 ? accelerations[accelerations.length - 1] : 0;
    const maxAcceleration = accelerations.length > 0 ? Math.max(...accelerations.map(Math.abs)) : 0;

    // Power calculations (P = F * v = m * a * v)
    const currentPower = this.athleteMass * Math.abs(currentAcceleration) * currentSpeed;
    const powers = speeds.map((v, i) => {
      const a = i < accelerations.length ? accelerations[i] : 0;
      return this.athleteMass * Math.abs(a) * v;
    });
    const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
    const peakPower = Math.max(...powers);

    // Gait analysis
    const { cadence, strideLength, groundContactTime, flightTime } = this.analyzeGait(frames);
    
    // Vertical oscillation and jump height
    const { verticalOscillation, jumpHeight } = this.analyzeVerticalMovement(frames);

    return {
      speed: {
        instantaneous: currentSpeed,
        average: avgSpeed,
        max: maxSpeed
      },
      distance: {
        total: totalDistance,
        horizontal: horizontalDistance,
        vertical: verticalDistance
      },
      acceleration: {
        current: currentAcceleration,
        max: maxAcceleration
      },
      power: {
        current: currentPower,
        average: avgPower,
        peak: peakPower
      },
      cadence,
      strideLength,
      verticalOscillation,
      groundContactTime,
      flightTime,
      jumpHeight
    };
  }

  private analyzeGait(frames: MovementFrame[]): {
    cadence: number;
    strideLength: number;
    groundContactTime: number;
    flightTime: number;
  } {
    if (frames.length < 30) { // Need at least 1 second of data
      return { cadence: 0, strideLength: 0, groundContactTime: 0, flightTime: 0 };
    }

    // Detect foot strikes by analyzing ankle vertical velocity
    const leftAnkleVelocities: number[] = [];
    const rightAnkleVelocities: number[] = [];
    
    for (let i = 1; i < frames.length; i++) {
      const dt = (frames[i].timestamp - frames[i-1].timestamp) / 1000;
      if (dt > 0) {
        const leftAnkle = frames[i].keypoints[15];
        const prevLeftAnkle = frames[i-1].keypoints[15];
        const rightAnkle = frames[i].keypoints[16];
        const prevRightAnkle = frames[i-1].keypoints[16];
        
        if (leftAnkle?.score! > 0.3 && prevLeftAnkle?.score! > 0.3) {
          const vy = (leftAnkle.y - prevLeftAnkle.y) / dt;
          leftAnkleVelocities.push(vy);
        }
        
        if (rightAnkle?.score! > 0.3 && prevRightAnkle?.score! > 0.3) {
          const vy = (rightAnkle.y - prevRightAnkle.y) / dt;
          rightAnkleVelocities.push(vy);
        }
      }
    }

    // Count steps (velocity sign changes from positive to negative)
    let stepCount = 0;
    const stepTimestamps: number[] = [];
    
    for (let i = 1; i < leftAnkleVelocities.length; i++) {
      if (leftAnkleVelocities[i-1] > 0 && leftAnkleVelocities[i] <= 0) {
        stepCount++;
        stepTimestamps.push(frames[i].timestamp);
      }
    }
    
    for (let i = 1; i < rightAnkleVelocities.length; i++) {
      if (rightAnkleVelocities[i-1] > 0 && rightAnkleVelocities[i] <= 0) {
        stepCount++;
        stepTimestamps.push(frames[i].timestamp);
      }
    }

    // Calculate cadence
    const timeRange = (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000 / 60; // minutes
    const cadence = timeRange > 0 ? stepCount / timeRange : 0;

    // Calculate stride length
    const totalHorizontalDistance = Math.abs(
      (frames[frames.length - 1].centerOfMass.x - frames[0].centerOfMass.x) / this.pixelsPerMeter
    );
    const strideLength = stepCount > 0 ? totalHorizontalDistance / stepCount : 0;

    // Estimate ground contact and flight times (simplified)
    const groundContactTime = cadence > 0 ? (60000 / cadence) * 0.35 : 0; // 35% of gait cycle
    const flightTime = cadence > 0 ? (60000 / cadence) * 0.15 : 0; // 15% of gait cycle

    return { cadence, strideLength, groundContactTime, flightTime };
  }

  private analyzeVerticalMovement(frames: MovementFrame[]): {
    verticalOscillation: number;
    jumpHeight: number;
  } {
    if (frames.length < 10) {
      return { verticalOscillation: 0, jumpHeight: 0 };
    }

    // Get vertical positions of center of mass
    const verticalPositions = frames.map(f => f.centerOfMass.y / this.pixelsPerMeter);
    
    // Calculate vertical oscillation (standard deviation)
    const avgY = verticalPositions.reduce((a, b) => a + b, 0) / verticalPositions.length;
    const variance = verticalPositions.reduce((sum, y) => sum + Math.pow(y - avgY, 2), 0) / verticalPositions.length;
    const verticalOscillation = Math.sqrt(variance) * 100; // Convert to cm

    // Calculate jump height using flight time method
    const maxJumpHeight = this.detectJumpHeight(frames);

    return { verticalOscillation, jumpHeight: maxJumpHeight };
  }

  private detectJumpHeight(frames: MovementFrame[]): number {
    let maxJumpHeight = 0;
    let inFlight = false;
    let takeoffY = 0;
    let peakY = 0;

    for (let i = 1; i < frames.length; i++) {
      const currentY = frames[i].centerOfMass.y;
      const prevY = frames[i-1].centerOfMass.y;
      const velocity = frames[i].velocity.y;

      // Detect takeoff (upward velocity threshold)
      if (!inFlight && velocity < -1) { // Moving up (negative Y)
        inFlight = true;
        takeoffY = currentY;
        peakY = currentY;
      }

      // Track peak height
      if (inFlight && currentY < peakY) {
        peakY = currentY;
      }

      // Detect landing (downward movement after peak)
      if (inFlight && currentY > prevY && velocity > 0.5) {
        const jumpHeight = (takeoffY - peakY) / this.pixelsPerMeter * 100; // cm
        maxJumpHeight = Math.max(maxJumpHeight, jumpHeight);
        inFlight = false;
      }
    }

    return maxJumpHeight;
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      speed: { instantaneous: 0, average: 0, max: 0 },
      distance: { total: 0, horizontal: 0, vertical: 0 },
      acceleration: { current: 0, max: 0 },
      power: { current: 0, average: 0, peak: 0 },
      cadence: 0,
      strideLength: 0,
      verticalOscillation: 0,
      groundContactTime: 0,
      flightTime: 0,
      jumpHeight: 0
    };
  }

  reset() {
    this.frameHistory = [];
    this.cachedMetrics = null;
    this.lastComputeTime = 0;
  }

  // Get sport-specific metrics
  getSportMetrics(sport: 'running' | 'jumping' | 'cycling' | 'weightlifting'): any {
    const metrics = this.cachedMetrics || this.getEmptyMetrics();
    
    switch (sport) {
      case 'running':
        return {
          pace: metrics.speed.average > 0 ? 1000 / metrics.speed.average / 60 : 0, // min/km
          cadence: metrics.cadence,
          strideLength: metrics.strideLength,
          verticalOscillation: metrics.verticalOscillation,
          groundContactTime: metrics.groundContactTime
        };
        
      case 'jumping':
        return {
          jumpHeight: metrics.jumpHeight,
          peakPower: metrics.power.peak,
          flightTime: metrics.flightTime,
          takeoffVelocity: Math.sqrt(2 * 9.81 * metrics.jumpHeight / 100) // m/s
        };
        
      case 'cycling':
        return {
          speed: metrics.speed.average * 3.6, // km/h
          power: metrics.power.average,
          cadence: metrics.cadence
        };
        
      case 'weightlifting':
        return {
          barVelocity: metrics.speed.instantaneous,
          peakPower: metrics.power.peak,
          acceleration: metrics.acceleration.current,
          range: metrics.distance.vertical
        };
        
      default:
        return metrics;
    }
  }
}