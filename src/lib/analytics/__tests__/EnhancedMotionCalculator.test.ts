import { EnhancedMotionCalculator, SpeedMetrics, DistanceMetrics, AccelerationMetrics } from '../EnhancedMotionCalculator';
import { Keypoint } from '@tensorflow-models/pose-detection';

describe('EnhancedMotionCalculator', () => {
  let calculator: EnhancedMotionCalculator;
  
  beforeEach(() => {
    calculator = new EnhancedMotionCalculator({
      smoothingFactor: 0.3,
      minConfidence: 0.5,
      pixelsPerMeter: 500 // Test calibration
    });
  });
  
  describe('Speed Calculation', () => {
    test('should calculate instantaneous speed from keypoint displacement', () => {
      const pose1 = createMockPose(100, 100);
      const pose2 = createMockPose(150, 100); // 50 pixels right
      
      const speed = calculator.calculateSpeed(pose2, pose1, 0.1); // 100ms
      
      expect(speed.instantaneous).toBeCloseTo(1.0); // 50px / 500px/m / 0.1s = 1 m/s
      expect(speed.average).toBeDefined();
      expect(speed.max).toBeGreaterThanOrEqual(speed.instantaneous);
    });
    
    test('should compute cumulative distance traveled', () => {
      const poses = [
        createMockPose(100, 100),
        createMockPose(150, 100),
        createMockPose(150, 150),
        createMockPose(100, 150),
        createMockPose(100, 100)
      ];
      
      const distance = calculator.calculateDistance(poses);
      
      expect(distance.total).toBeCloseTo(0.4); // 200px / 500px/m = 0.4m
      expect(distance.horizontal).toBeCloseTo(0.2); // 100px traveled horizontally
      expect(distance.vertical).toBeCloseTo(0.2); // 100px traveled vertically
    });
    
    test('should derive acceleration from velocity changes', () => {
      const velocityHistory = [
        { x: 0, y: 0, magnitude: 0, timestamp: 0 },
        { x: 1, y: 0, magnitude: 1, timestamp: 100 },
        { x: 2, y: 0, magnitude: 2, timestamp: 200 }
      ];
      
      const acceleration = calculator.calculateAcceleration(velocityHistory, 0.1);
      
      expect(acceleration.current).toBeCloseTo(10); // 1 m/s change in 0.1s = 10 m/s²
      expect(acceleration.max).toBeGreaterThanOrEqual(acceleration.current);
    });
    
    test('should detect deceleration patterns', () => {
      const velocityHistory = [
        { x: 2, y: 0, magnitude: 2, timestamp: 0 },
        { x: 1, y: 0, magnitude: 1, timestamp: 100 },
        { x: 0, y: 0, magnitude: 0, timestamp: 200 }
      ];
      
      const acceleration = calculator.calculateAcceleration(velocityHistory, 0.1);
      
      expect(acceleration.current).toBeLessThan(0); // Negative acceleration = deceleration
      expect(acceleration.isDecelerating).toBe(true);
    });
    
    test('should handle frame drops gracefully', () => {
      const pose1 = createMockPose(100, 100);
      const pose2 = createMockPose(200, 100);
      
      // Large time gap (frame drop)
      const speed = calculator.calculateSpeed(pose2, pose1, 1.0); // 1 second gap
      
      expect(speed.instantaneous).toBeCloseTo(0.2); // 100px / 500px/m / 1s = 0.2 m/s
      expect(speed.confidence).toBeLessThan(1.0); // Lower confidence due to frame drop
    });
    
    test('should apply Kalman filtering for smooth metrics', () => {
      const noisyPoses = Array.from({ length: 10 }, (_, i) => 
        createMockPose(100 + i * 10 + Math.random() * 5, 100)
      );
      
      const speeds: number[] = [];
      for (let i = 1; i < noisyPoses.length; i++) {
        const speed = calculator.calculateSpeed(noisyPoses[i], noisyPoses[i-1], 0.033);
        speeds.push(speed.instantaneous);
      }
      
      // Check that speeds are smoothed (variance should be lower than raw data)
      const variance = calculateVariance(speeds);
      expect(variance).toBeLessThan(1.0);
    });
  });
  
  describe('Distance Tracking', () => {
    test('should track horizontal distance traveled', () => {
      const poses = [
        createMockPose(100, 100),
        createMockPose(200, 100),
        createMockPose(300, 100)
      ];
      
      const distance = calculator.calculateDistance(poses);
      
      expect(distance.horizontal).toBeCloseTo(0.4); // 200px / 500px/m
      expect(distance.vertical).toBe(0);
    });
    
    test('should track vertical distance (jumps)', () => {
      const poses = [
        createMockPose(100, 100),
        createMockPose(100, 50), // Jump up
        createMockPose(100, 100) // Land
      ];
      
      const distance = calculator.calculateDistance(poses);
      
      expect(distance.vertical).toBeCloseTo(0.2); // 100px total / 500px/m
      expect(distance.horizontal).toBe(0);
    });
    
    test('should calculate path distance vs displacement', () => {
      const poses = [
        createMockPose(0, 0),
        createMockPose(100, 0),
        createMockPose(100, 100),
        createMockPose(0, 100),
        createMockPose(0, 0)
      ];
      
      const distance = calculator.calculateDistance(poses);
      
      expect(distance.total).toBeCloseTo(0.8); // 400px path / 500px/m
      expect(distance.displacement).toBe(0); // Returned to start
    });
    
    test('should handle camera movement compensation', () => {
      // Simulate camera shake
      const poses = [
        createMockPose(100, 100, 1.0, { cameraOffset: { x: 0, y: 0 } }),
        createMockPose(105, 102, 1.0, { cameraOffset: { x: 5, y: 2 } })
      ];
      
      const distance = calculator.calculateDistance(poses);
      
      // Should compensate for camera movement
      expect(distance.total).toBeLessThan(0.02); // Very small actual movement
    });
    
    test('should provide distance in multiple units', () => {
      const poses = [
        createMockPose(0, 0),
        createMockPose(500, 0) // 1 meter
      ];
      
      const distance = calculator.calculateDistance(poses);
      
      expect(distance.meters).toBeCloseTo(1.0);
      expect(distance.feet).toBeCloseTo(3.28084);
      expect(distance.kilometers).toBeCloseTo(0.001);
      expect(distance.miles).toBeCloseTo(0.000621371);
    });
  });
  
  describe('Acceleration Calculation', () => {
    test('should calculate linear acceleration', () => {
      const velocityHistory = [
        { x: 0, y: 0, magnitude: 0, timestamp: 0 },
        { x: 0.5, y: 0, magnitude: 0.5, timestamp: 50 },
        { x: 1.0, y: 0, magnitude: 1.0, timestamp: 100 }
      ];
      
      const acceleration = calculator.calculateAcceleration(velocityHistory, 0.05);
      
      expect(acceleration.linear.x).toBeCloseTo(10); // 0.5 m/s per 0.05s
      expect(acceleration.linear.y).toBe(0);
    });
    
    test('should detect peak acceleration events', () => {
      // Create history with a peak
      const velocityHistory = [
        { x: 0, y: 0, magnitude: 0, timestamp: 0 },
        { x: 2, y: 0, magnitude: 2, timestamp: 50 }, // Sudden acceleration (peak)
        { x: 2.5, y: 0, magnitude: 2.5, timestamp: 100 } // Slower acceleration
      ];
      
      // First call to establish history
      calculator.calculateAcceleration(velocityHistory.slice(0, 2), 0.05);
      
      // Second call should show reduced acceleration
      const acceleration = calculator.calculateAcceleration(velocityHistory, 0.05);
      
      expect(acceleration.peak).toBeGreaterThanOrEqual(acceleration.current);
      expect(acceleration.max).toBeGreaterThan(0);
    });
    
    test('should identify deceleration patterns', () => {
      const velocityHistory = [
        { x: 3, y: 0, magnitude: 3, timestamp: 0 },
        { x: 2, y: 0, magnitude: 2, timestamp: 50 },
        { x: 1, y: 0, magnitude: 1, timestamp: 100 },
        { x: 0, y: 0, magnitude: 0, timestamp: 150 }
      ];
      
      const acceleration = calculator.calculateAcceleration(velocityHistory, 0.05);
      
      expect(acceleration.isDecelerating).toBe(true);
      expect(acceleration.decelerationRate).toBeLessThan(0);
    });
    
    test('should calculate rotational acceleration for joints', () => {
      const angleHistory = [
        { angle: 0, timestamp: 0 },
        { angle: Math.PI / 4, timestamp: 50 }, // 45 degrees at 50ms
        { angle: Math.PI / 2, timestamp: 100 } // 90 degrees at 100ms
      ];
      
      const rotationalAccel = calculator.calculateRotationalAcceleration(angleHistory, 0.05);
      
      // v1 = π/4 / 0.05 = 5π rad/s
      // v2 = π/4 / 0.05 = 5π rad/s
      // Since velocities are constant, acceleration should be 0
      expect(rotationalAccel.angular).toBe(0);
      expect(rotationalAccel.degreesPerSecondSquared).toBe(0);
    });
    
    test('should detect explosive movements', () => {
      const velocityHistory = [
        { x: 0, y: 0, magnitude: 0, timestamp: 0 },
        { x: 0, y: 5, magnitude: 5, timestamp: 50 } // Vertical jump
      ];
      
      const acceleration = calculator.calculateAcceleration(velocityHistory, 0.05);
      
      expect(acceleration.isExplosive).toBe(true);
      expect(acceleration.explosiveThreshold).toBeLessThan(acceleration.peak);
    });
  });
  
  describe('Motion Zones', () => {
    test('should detect speed zones (walking, jogging, running, sprinting)', () => {
      expect(calculator.getSpeedZone(0.5)).toBe('stationary');
      expect(calculator.getSpeedZone(1.2)).toBe('walking');
      expect(calculator.getSpeedZone(2.5)).toBe('jogging');
      expect(calculator.getSpeedZone(4.0)).toBe('running');
      expect(calculator.getSpeedZone(7.0)).toBe('sprinting');
    });
    
    test('should handle stationary poses correctly', () => {
      const pose1 = createMockPose(100, 100);
      const pose2 = createMockPose(100.5, 100.2); // Tiny movement (noise)
      
      const speed = calculator.calculateSpeed(pose2, pose1, 0.033);
      
      expect(speed.instantaneous).toBeLessThan(0.1); // Very low speed
      expect(calculator.getSpeedZone(speed.instantaneous)).toBe('stationary');
    });
  });
  
  describe('Calibration', () => {
    test('should calculate center of mass speed', () => {
      const pose1 = createMockPose(100, 100);
      const pose2 = createMockPose(150, 150);
      
      const speed = calculator.calculateSpeed(pose2, pose1, 0.1);
      
      // Center of mass should be calculated correctly
      expect(speed.centerOfMass).toBeDefined();
      expect(speed.centerOfMass.x).toBeGreaterThan(100);
      expect(speed.centerOfMass.y).toBeGreaterThan(100);
    });
    
    test('should compute limb-specific speeds', () => {
      const pose1 = createMockPose(100, 100);
      const pose2 = { ...createMockPose(100, 100) };
      
      // Move only right wrist
      pose2.keypoints[10] = { x: 200, y: 100, score: 0.9, name: 'right_wrist' };
      
      const speed = calculator.calculateSpeed(pose2, pose1, 0.1);
      
      expect(speed.limbSpeeds.rightWrist).toBeGreaterThan(0);
      expect(speed.limbSpeeds.leftWrist).toBe(0);
    });
    
    test('should provide speed in multiple units (m/s, km/h, mph)', () => {
      const pose1 = createMockPose(100, 100);
      const pose2 = createMockPose(600, 100); // 1 meter movement
      
      const speed = calculator.calculateSpeed(pose2, pose1, 1.0); // 1 second
      
      expect(speed.metersPerSecond).toBeCloseTo(1.0);
      expect(speed.kilometersPerHour).toBeCloseTo(3.6);
      expect(speed.milesPerHour).toBeCloseTo(2.237);
    });
  });
});

// Helper functions
function createMockPose(x: number, y: number, confidence = 0.9, metadata?: any): { keypoints: Keypoint[], metadata?: any } {
  const keypoints: Keypoint[] = [
    { x, y, score: confidence, name: 'nose' },
    { x: x - 5, y: y + 5, score: confidence, name: 'left_eye' },
    { x: x + 5, y: y + 5, score: confidence, name: 'right_eye' },
    { x: x - 7, y: y + 7, score: confidence, name: 'left_ear' },
    { x: x + 7, y: y + 7, score: confidence, name: 'right_ear' },
    { x: x - 20, y: y + 30, score: confidence, name: 'left_shoulder' },
    { x: x + 20, y: y + 30, score: confidence, name: 'right_shoulder' },
    { x: x - 25, y: y + 50, score: confidence, name: 'left_elbow' },
    { x: x + 25, y: y + 50, score: confidence, name: 'right_elbow' },
    { x: x - 30, y: y + 70, score: confidence, name: 'left_wrist' },
    { x: x + 30, y: y + 70, score: confidence, name: 'right_wrist' },
    { x: x - 15, y: y + 80, score: confidence, name: 'left_hip' },
    { x: x + 15, y: y + 80, score: confidence, name: 'right_hip' },
    { x: x - 15, y: y + 120, score: confidence, name: 'left_knee' },
    { x: x + 15, y: y + 120, score: confidence, name: 'right_knee' },
    { x: x - 15, y: y + 160, score: confidence, name: 'left_ankle' },
    { x: x + 15, y: y + 160, score: confidence, name: 'right_ankle' }
  ];
  
  return { keypoints, metadata };
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b) / values.length;
}