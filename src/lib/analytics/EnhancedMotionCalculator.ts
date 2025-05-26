import { Keypoint } from '@tensorflow-models/pose-detection';

export interface SpeedMetrics {
  instantaneous: number; // m/s
  average: number; // m/s
  max: number; // m/s
  confidence: number; // 0-1
  centerOfMass: { x: number; y: number };
  limbSpeeds: {
    leftWrist: number;
    rightWrist: number;
    leftAnkle: number;
    rightAnkle: number;
  };
  metersPerSecond: number;
  kilometersPerHour: number;
  milesPerHour: number;
}

export interface DistanceMetrics {
  total: number; // meters
  horizontal: number; // meters
  vertical: number; // meters
  displacement: number; // meters (straight line from start to end)
  meters: number;
  feet: number;
  kilometers: number;
  miles: number;
}

export interface AccelerationMetrics {
  current: number; // m/s²
  max: number; // m/s²
  peak: number; // m/s²
  peakTimestamp?: number;
  linear: { x: number; y: number };
  isDecelerating: boolean;
  decelerationRate?: number;
  isExplosive: boolean;
  explosiveThreshold: number;
}

export interface VelocityData {
  x: number;
  y: number;
  magnitude: number;
  timestamp: number;
}

export interface AngleData {
  angle: number;
  timestamp: number;
}

export interface RotationalAcceleration {
  angular: number; // rad/s²
  degreesPerSecondSquared: number;
}

interface MotionCalculatorConfig {
  smoothingFactor?: number;
  minConfidence?: number;
  pixelsPerMeter?: number;
}

export class EnhancedMotionCalculator {
  private readonly SMOOTHING_FACTOR: number;
  private readonly MIN_CONFIDENCE: number;
  private pixelsPerMeter: number;
  
  // Speed zone thresholds (m/s)
  private readonly SPEED_ZONES = {
    stationary: 1.0,
    walking: 2.0,
    jogging: 3.5,
    running: 5.5,
    sprinting: Infinity
  };
  
  // Kalman filter state
  private kalmanState = {
    x: { estimate: 0, errorCovariance: 1 },
    y: { estimate: 0, errorCovariance: 1 }
  };
  
  // History for averaging
  private speedHistory: number[] = [];
  private maxSpeed = 0;
  private accelerationHistory: number[] = [];
  private maxAcceleration = 0;
  
  constructor(config?: MotionCalculatorConfig) {
    this.SMOOTHING_FACTOR = config?.smoothingFactor || 0.3;
    this.MIN_CONFIDENCE = config?.minConfidence || 0.5;
    this.pixelsPerMeter = config?.pixelsPerMeter || 500;
  }
  
  calculateSpeed(
    currentPose: { keypoints: Keypoint[]; metadata?: any },
    previousPose: { keypoints: Keypoint[]; metadata?: any },
    deltaTime: number
  ): SpeedMetrics {
    // Calculate center of mass for both poses
    const currentCOM = this.calculateCenterOfMass(currentPose.keypoints);
    const previousCOM = this.calculateCenterOfMass(previousPose.keypoints);
    
    // Apply camera compensation if available
    let dx = currentCOM.x - previousCOM.x;
    let dy = currentCOM.y - previousCOM.y;
    
    if (currentPose.metadata?.cameraOffset && previousPose.metadata?.cameraOffset) {
      dx -= (currentPose.metadata.cameraOffset.x - previousPose.metadata.cameraOffset.x);
      dy -= (currentPose.metadata.cameraOffset.y - previousPose.metadata.cameraOffset.y);
    }
    
    // Apply Kalman filtering
    const filtered = this.applyKalmanFilter(dx, dy);
    dx = filtered.x;
    dy = filtered.y;
    
    // Convert pixels to meters
    const distanceMeters = Math.sqrt(dx * dx + dy * dy) / this.pixelsPerMeter;
    const instantaneousSpeed = distanceMeters / deltaTime;
    
    // Update speed history
    this.speedHistory.push(instantaneousSpeed);
    if (this.speedHistory.length > 30) {
      this.speedHistory.shift();
    }
    
    // Calculate average speed
    const averageSpeed = this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;
    
    // Update max speed
    this.maxSpeed = Math.max(this.maxSpeed, instantaneousSpeed);
    
    // Calculate confidence based on frame timing
    const expectedDeltaTime = 0.033; // 30 FPS
    const confidence = Math.min(1, expectedDeltaTime / deltaTime);
    
    // Calculate limb speeds
    const limbSpeeds = this.calculateLimbSpeeds(currentPose.keypoints, previousPose.keypoints, deltaTime);
    
    return {
      instantaneous: instantaneousSpeed,
      average: averageSpeed,
      max: this.maxSpeed,
      confidence,
      centerOfMass: currentCOM,
      limbSpeeds,
      metersPerSecond: instantaneousSpeed,
      kilometersPerHour: instantaneousSpeed * 3.6,
      milesPerHour: instantaneousSpeed * 2.237
    };
  }
  
  calculateDistance(poseHistory: { keypoints: Keypoint[]; metadata?: any }[]): DistanceMetrics {
    if (poseHistory.length < 2) {
      return {
        total: 0,
        horizontal: 0,
        vertical: 0,
        displacement: 0,
        meters: 0,
        feet: 0,
        kilometers: 0,
        miles: 0
      };
    }
    
    let totalDistance = 0;
    let horizontalDistance = 0;
    let verticalDistance = 0;
    
    for (let i = 1; i < poseHistory.length; i++) {
      const currentCOM = this.calculateCenterOfMass(poseHistory[i].keypoints);
      const previousCOM = this.calculateCenterOfMass(poseHistory[i - 1].keypoints);
      
      let dx = currentCOM.x - previousCOM.x;
      let dy = currentCOM.y - previousCOM.y;
      
      // Apply camera compensation
      if (poseHistory[i].metadata?.cameraOffset && poseHistory[i - 1].metadata?.cameraOffset) {
        dx -= (poseHistory[i].metadata.cameraOffset.x - poseHistory[i - 1].metadata.cameraOffset.x);
        dy -= (poseHistory[i].metadata.cameraOffset.y - poseHistory[i - 1].metadata.cameraOffset.y);
      }
      
      const segmentDistance = Math.sqrt(dx * dx + dy * dy) / this.pixelsPerMeter;
      totalDistance += segmentDistance;
      
      horizontalDistance += Math.abs(dx) / this.pixelsPerMeter;
      verticalDistance += Math.abs(dy) / this.pixelsPerMeter;
    }
    
    // Calculate displacement (straight line from start to end)
    const startCOM = this.calculateCenterOfMass(poseHistory[0].keypoints);
    const endCOM = this.calculateCenterOfMass(poseHistory[poseHistory.length - 1].keypoints);
    const displacement = Math.sqrt(
      Math.pow(endCOM.x - startCOM.x, 2) + Math.pow(endCOM.y - startCOM.y, 2)
    ) / this.pixelsPerMeter;
    
    return {
      total: totalDistance,
      horizontal: horizontalDistance,
      vertical: verticalDistance,
      displacement,
      meters: totalDistance,
      feet: totalDistance * 3.28084,
      kilometers: totalDistance / 1000,
      miles: totalDistance * 0.000621371
    };
  }
  
  calculateAcceleration(velocityHistory: VelocityData[], deltaTime: number): AccelerationMetrics {
    if (velocityHistory.length < 2) {
      return {
        current: 0,
        max: this.maxAcceleration,
        peak: this.maxAcceleration,
        linear: { x: 0, y: 0 },
        isDecelerating: false,
        isExplosive: false,
        explosiveThreshold: 15 // m/s²
      };
    }
    
    // Get last two velocity readings
    const current = velocityHistory[velocityHistory.length - 1];
    const previous = velocityHistory[velocityHistory.length - 2];
    
    // Calculate acceleration components
    const ax = (current.x - previous.x) / deltaTime;
    const ay = (current.y - previous.y) / deltaTime;
    const currentAcceleration = (current.magnitude - previous.magnitude) / deltaTime;
    
    // Update acceleration history
    this.accelerationHistory.push(Math.abs(currentAcceleration));
    if (this.accelerationHistory.length > 30) {
      this.accelerationHistory.shift();
    }
    
    // Find peak acceleration
    let peak = Math.max(...this.accelerationHistory);
    let peakTimestamp: number | undefined;
    
    if (peak === Math.abs(currentAcceleration)) {
      peakTimestamp = current.timestamp;
    }
    
    // Update max acceleration
    this.maxAcceleration = Math.max(this.maxAcceleration, Math.abs(currentAcceleration));
    
    // Check for deceleration
    const isDecelerating = currentAcceleration < 0;
    const decelerationRate = isDecelerating ? currentAcceleration : undefined;
    
    // Check for explosive movement (high acceleration)
    const explosiveThreshold = 15; // m/s²
    const isExplosive = Math.abs(currentAcceleration) > explosiveThreshold;
    
    return {
      current: currentAcceleration,
      max: this.maxAcceleration,
      peak,
      peakTimestamp,
      linear: { x: ax, y: ay },
      isDecelerating,
      decelerationRate,
      isExplosive,
      explosiveThreshold
    };
  }
  
  calculateRotationalAcceleration(angleHistory: AngleData[], deltaTime: number): RotationalAcceleration {
    if (angleHistory.length < 3) {
      return { angular: 0, degreesPerSecondSquared: 0 };
    }
    
    // Get the last three angle measurements
    const a0 = angleHistory[angleHistory.length - 3];
    const a1 = angleHistory[angleHistory.length - 2];
    const a2 = angleHistory[angleHistory.length - 1];
    
    // Calculate time differences
    const dt1 = (a1.timestamp - a0.timestamp) / 1000 || deltaTime;
    const dt2 = (a2.timestamp - a1.timestamp) / 1000 || deltaTime;
    
    // Calculate angular velocities
    const v1 = (a1.angle - a0.angle) / dt1;
    const v2 = (a2.angle - a1.angle) / dt2;
    
    // Calculate angular acceleration
    const angular = (v2 - v1) / ((dt1 + dt2) / 2);
    const degreesPerSecondSquared = angular * (180 / Math.PI);
    
    return { angular, degreesPerSecondSquared };
  }
  
  getSpeedZone(speed: number): string {
    if (speed < this.SPEED_ZONES.stationary) return 'stationary';
    if (speed < this.SPEED_ZONES.walking) return 'walking';
    if (speed < this.SPEED_ZONES.jogging) return 'jogging';
    if (speed < this.SPEED_ZONES.running) return 'running';
    return 'sprinting';
  }
  
  private calculateCenterOfMass(keypoints: Keypoint[]): { x: number; y: number } {
    const validKeypoints = keypoints.filter(kp => kp.score && kp.score >= this.MIN_CONFIDENCE);
    
    if (validKeypoints.length === 0) {
      return { x: 0, y: 0 };
    }
    
    const sumX = validKeypoints.reduce((sum, kp) => sum + kp.x, 0);
    const sumY = validKeypoints.reduce((sum, kp) => sum + kp.y, 0);
    
    return {
      x: sumX / validKeypoints.length,
      y: sumY / validKeypoints.length
    };
  }
  
  private calculateLimbSpeeds(
    currentKeypoints: Keypoint[],
    previousKeypoints: Keypoint[],
    deltaTime: number
  ): SpeedMetrics['limbSpeeds'] {
    const calculateKeypointSpeed = (current: Keypoint, previous: Keypoint): number => {
      if (!current || !previous || current.score! < this.MIN_CONFIDENCE || previous.score! < this.MIN_CONFIDENCE) {
        return 0;
      }
      
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const distance = Math.sqrt(dx * dx + dy * dy) / this.pixelsPerMeter;
      
      return distance / deltaTime;
    };
    
    // Find keypoints by name
    const findKeypoint = (keypoints: Keypoint[], name: string) => 
      keypoints.find(kp => kp.name === name);
    
    return {
      leftWrist: calculateKeypointSpeed(
        findKeypoint(currentKeypoints, 'left_wrist')!,
        findKeypoint(previousKeypoints, 'left_wrist')!
      ),
      rightWrist: calculateKeypointSpeed(
        findKeypoint(currentKeypoints, 'right_wrist')!,
        findKeypoint(previousKeypoints, 'right_wrist')!
      ),
      leftAnkle: calculateKeypointSpeed(
        findKeypoint(currentKeypoints, 'left_ankle')!,
        findKeypoint(previousKeypoints, 'left_ankle')!
      ),
      rightAnkle: calculateKeypointSpeed(
        findKeypoint(currentKeypoints, 'right_ankle')!,
        findKeypoint(previousKeypoints, 'right_ankle')!
      )
    };
  }
  
  private applyKalmanFilter(dx: number, dy: number): { x: number; y: number } {
    // Simple Kalman filter implementation
    const processNoise = 0.01;
    const measurementNoise = 5.0;
    
    // For first measurement, use it directly
    if (this.kalmanState.x.errorCovariance === 1 && this.kalmanState.x.estimate === 0) {
      this.kalmanState.x.estimate = dx;
      this.kalmanState.y.estimate = dy;
      return { x: dx, y: dy };
    }
    
    // Update x
    const xPrediction = this.kalmanState.x.estimate;
    const xPredictionError = this.kalmanState.x.errorCovariance + processNoise;
    const xKalmanGain = xPredictionError / (xPredictionError + measurementNoise);
    this.kalmanState.x.estimate = xPrediction + xKalmanGain * (dx - xPrediction);
    this.kalmanState.x.errorCovariance = (1 - xKalmanGain) * xPredictionError;
    
    // Update y
    const yPrediction = this.kalmanState.y.estimate;
    const yPredictionError = this.kalmanState.y.errorCovariance + processNoise;
    const yKalmanGain = yPredictionError / (yPredictionError + measurementNoise);
    this.kalmanState.y.estimate = yPrediction + yKalmanGain * (dy - yPrediction);
    this.kalmanState.y.errorCovariance = (1 - yKalmanGain) * yPredictionError;
    
    // Apply lighter smoothing to preserve more of the actual movement
    const smoothedX = dx * 0.7 + this.kalmanState.x.estimate * 0.3;
    const smoothedY = dy * 0.7 + this.kalmanState.y.estimate * 0.3;
    
    return { x: smoothedX, y: smoothedY };
  }
  
  // Calibration methods
  calibrateFromHeight(heightPixels: number, actualHeightMeters: number): void {
    this.pixelsPerMeter = heightPixels / actualHeightMeters;
  }
  
  reset(): void {
    this.speedHistory = [];
    this.maxSpeed = 0;
    this.accelerationHistory = [];
    this.maxAcceleration = 0;
    this.kalmanState = {
      x: { estimate: 0, errorCovariance: 1 },
      y: { estimate: 0, errorCovariance: 1 }
    };
  }
}