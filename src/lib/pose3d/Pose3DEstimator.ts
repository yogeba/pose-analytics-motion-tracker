import { Keypoint } from '@tensorflow-models/pose-detection';

export interface Keypoint3D extends Keypoint {
  z: number; // Depth in meters
}

export interface Pose3D {
  keypoints3D: Keypoint3D[];
  jointAngles3D: Map<string, number>;
  bodyOrientation: {
    pitch: number; // degrees
    yaw: number; // degrees
    roll: number; // degrees
  };
  centerOfMass3D: { x: number; y: number; z: number };
}

export interface CalibrationData {
  focalLength: number; // pixels
  principalPoint: { x: number; y: number };
  distortionCoefficients?: number[];
}

export class Pose3DEstimator {
  private calibration: CalibrationData;
  private referenceBodyModel: Map<string, number>; // Joint name to average length in meters
  private previousPose3D: Pose3D | null = null;
  
  // Anthropometric ratios based on body height
  private readonly BODY_RATIOS = {
    shoulderWidth: 0.259,
    hipWidth: 0.191,
    upperArmLength: 0.186,
    forearmLength: 0.146,
    thighLength: 0.245,
    shinLength: 0.246,
    torsoLength: 0.288,
    neckLength: 0.052
  };

  constructor(calibration?: CalibrationData) {
    // Default calibration for typical webcam
    this.calibration = calibration || {
      focalLength: 800, // Approximate for 60° FOV
      principalPoint: { x: 640, y: 360 }
    };
    
    this.referenceBodyModel = this.createReferenceModel(1.75); // Default 1.75m height
  }

  private createReferenceModel(height: number): Map<string, number> {
    const model = new Map<string, number>();
    
    // Calculate body segment lengths based on height
    model.set('shoulder_width', height * this.BODY_RATIOS.shoulderWidth);
    model.set('hip_width', height * this.BODY_RATIOS.hipWidth);
    model.set('upper_arm', height * this.BODY_RATIOS.upperArmLength);
    model.set('forearm', height * this.BODY_RATIOS.forearmLength);
    model.set('thigh', height * this.BODY_RATIOS.thighLength);
    model.set('shin', height * this.BODY_RATIOS.shinLength);
    model.set('torso', height * this.BODY_RATIOS.torsoLength);
    model.set('neck', height * this.BODY_RATIOS.neckLength);
    
    return model;
  }

  estimatePose3D(keypoints2D: Keypoint[], imageWidth: number, imageHeight: number): Pose3D {
    // Update calibration principal point if image size changed
    this.calibration.principalPoint = {
      x: imageWidth / 2,
      y: imageHeight / 2
    };

    // Step 1: Estimate depth for each keypoint
    const keypoints3D = this.estimateDepth(keypoints2D);
    
    // Step 2: Apply temporal smoothing if we have previous pose
    const smoothedKeypoints = this.temporalSmoothing(keypoints3D);
    
    // Step 3: Calculate 3D joint angles
    const jointAngles3D = this.calculate3DJointAngles(smoothedKeypoints);
    
    // Step 4: Estimate body orientation
    const bodyOrientation = this.estimateBodyOrientation(smoothedKeypoints);
    
    // Step 5: Calculate 3D center of mass
    const centerOfMass3D = this.calculate3DCenterOfMass(smoothedKeypoints);
    
    const pose3D: Pose3D = {
      keypoints3D: smoothedKeypoints,
      jointAngles3D,
      bodyOrientation,
      centerOfMass3D
    };
    
    this.previousPose3D = pose3D;
    return pose3D;
  }

  private estimateDepth(keypoints2D: Keypoint[]): Keypoint3D[] {
    const keypoints3D: Keypoint3D[] = [];
    
    // Use anthropometric constraints to estimate depth
    // Start with hip depth estimation using shoulder-hip ratio
    const leftShoulder = keypoints2D[5];
    const rightShoulder = keypoints2D[6];
    const leftHip = keypoints2D[11];
    const rightHip = keypoints2D[12];
    
    if (leftShoulder?.score! > 0.3 && rightShoulder?.score! > 0.3 &&
        leftHip?.score! > 0.3 && rightHip?.score! > 0.3) {
      
      // Calculate 2D distances
      const shoulderWidth2D = Math.abs(rightShoulder.x - leftShoulder.x);
      const hipWidth2D = Math.abs(rightHip.x - leftHip.x);
      
      // Estimate torso depth using perspective projection
      const shoulderDepth = this.estimateDepthFromWidth(
        this.referenceBodyModel.get('shoulder_width')!,
        shoulderWidth2D
      );
      
      const hipDepth = this.estimateDepthFromWidth(
        this.referenceBodyModel.get('hip_width')!,
        hipWidth2D
      );
      
      // Propagate depth estimation to all keypoints
      keypoints2D.forEach((kp2d, index) => {
        if (kp2d && kp2d.score! > 0.1) {
          let estimatedDepth = 2.0; // Default 2 meters
          
          // Assign depth based on body part
          if (index >= 5 && index <= 10) {
            // Upper body
            estimatedDepth = shoulderDepth;
          } else if (index >= 11 && index <= 16) {
            // Lower body
            const heightRatio = (kp2d.y - shoulderWidth2D) / (hipWidth2D - shoulderWidth2D);
            estimatedDepth = shoulderDepth + (hipDepth - shoulderDepth) * Math.max(0, Math.min(1, heightRatio));
          } else if (index <= 4) {
            // Head
            estimatedDepth = shoulderDepth - 0.1;
          }
          
          // Add noise based on confidence
          const noise = (1 - kp2d.score!) * 0.1;
          estimatedDepth += (Math.random() - 0.5) * noise;
          
          keypoints3D.push({
            ...kp2d,
            z: estimatedDepth
          });
        } else {
          keypoints3D.push({
            x: 0,
            y: 0,
            z: 0,
            score: 0,
            name: kp2d?.name
          });
        }
      });
    } else {
      // Fallback: assign default depth
      keypoints2D.forEach(kp => {
        keypoints3D.push({
          ...kp,
          z: 2.0
        });
      });
    }
    
    return keypoints3D;
  }

  private estimateDepthFromWidth(realWidth: number, pixelWidth: number): number {
    // Z = f * W / w
    // where Z is depth, f is focal length, W is real width, w is pixel width
    return (this.calibration.focalLength * realWidth) / pixelWidth;
  }

  private temporalSmoothing(keypoints3D: Keypoint3D[]): Keypoint3D[] {
    if (!this.previousPose3D) return keypoints3D;
    
    const alpha = 0.7; // Smoothing factor
    return keypoints3D.map((kp, index) => {
      const prevKp = this.previousPose3D!.keypoints3D[index];
      if (kp.score! > 0.1 && prevKp && prevKp.score! > 0.1) {
        return {
          ...kp,
          x: alpha * kp.x + (1 - alpha) * prevKp.x,
          y: alpha * kp.y + (1 - alpha) * prevKp.y,
          z: alpha * kp.z + (1 - alpha) * prevKp.z
        };
      }
      return kp;
    });
  }

  private calculate3DJointAngles(keypoints3D: Keypoint3D[]): Map<string, number> {
    const angles = new Map<string, number>();
    
    // Define joint triads
    const jointTriads = [
      { name: 'left_elbow', indices: [5, 7, 9], range: [0, 180] },
      { name: 'right_elbow', indices: [6, 8, 10], range: [0, 180] },
      { name: 'left_shoulder', indices: [11, 5, 7], range: [0, 180] },
      { name: 'right_shoulder', indices: [12, 6, 8], range: [0, 180] },
      { name: 'left_hip', indices: [5, 11, 13], range: [0, 180] },
      { name: 'right_hip', indices: [6, 12, 14], range: [0, 180] },
      { name: 'left_knee', indices: [11, 13, 15], range: [0, 180] },
      { name: 'right_knee', indices: [12, 14, 16], range: [0, 180] }
    ];
    
    jointTriads.forEach(({ name, indices, range }) => {
      const [a, b, c] = indices.map(i => keypoints3D[i]);
      
      if (a?.score! > 0.3 && b?.score! > 0.3 && c?.score! > 0.3) {
        // Calculate 3D vectors
        const v1 = {
          x: a.x - b.x,
          y: a.y - b.y,
          z: a.z - b.z
        };
        
        const v2 = {
          x: c.x - b.x,
          y: c.y - b.y,
          z: c.z - b.z
        };
        
        // Calculate angle using dot product
        const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
        const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
        const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
        
        if (mag1 > 0 && mag2 > 0) {
          let angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
          angle = angle * 180 / Math.PI;
          
          // Clamp to anatomical range
          angle = Math.max(range[0], Math.min(range[1], angle));
          angles.set(name, angle);
        }
      }
    });
    
    return angles;
  }

  private estimateBodyOrientation(keypoints3D: Keypoint3D[]): { pitch: number; yaw: number; roll: number } {
    const leftShoulder = keypoints3D[5];
    const rightShoulder = keypoints3D[6];
    const leftHip = keypoints3D[11];
    const rightHip = keypoints3D[12];
    
    if (leftShoulder?.score! > 0.3 && rightShoulder?.score! > 0.3 &&
        leftHip?.score! > 0.3 && rightHip?.score! > 0.3) {
      
      // Calculate body coordinate system
      const shoulderVector = {
        x: rightShoulder.x - leftShoulder.x,
        y: rightShoulder.y - leftShoulder.y,
        z: rightShoulder.z - leftShoulder.z
      };
      
      const hipVector = {
        x: rightHip.x - leftHip.x,
        y: rightHip.y - leftHip.y,
        z: rightHip.z - leftHip.z
      };
      
      // Spine vector (approximate)
      const spineVector = {
        x: (leftShoulder.x + rightShoulder.x) / 2 - (leftHip.x + rightHip.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2 - (leftHip.y + rightHip.y) / 2,
        z: (leftShoulder.z + rightShoulder.z) / 2 - (leftHip.z + rightHip.z) / 2
      };
      
      // Calculate Euler angles
      const pitch = Math.atan2(-spineVector.z, spineVector.y) * 180 / Math.PI;
      const yaw = Math.atan2(shoulderVector.x, shoulderVector.z) * 180 / Math.PI;
      const roll = Math.atan2(shoulderVector.y, shoulderVector.x) * 180 / Math.PI;
      
      return { pitch, yaw, roll };
    }
    
    return { pitch: 0, yaw: 0, roll: 0 };
  }

  private calculate3DCenterOfMass(keypoints3D: Keypoint3D[]): { x: number; y: number; z: number } {
    const segmentWeights: Record<number, number> = {
      0: 0.08,  // head
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
    let weightedZ = 0;

    Object.entries(segmentWeights).forEach(([index, weight]) => {
      const kp = keypoints3D[parseInt(index)];
      if (kp && kp.score! > 0.3) {
        weightedX += kp.x * weight;
        weightedY += kp.y * weight;
        weightedZ += kp.z * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight > 0) {
      return {
        x: weightedX / totalWeight,
        y: weightedY / totalWeight,
        z: weightedZ / totalWeight
      };
    }

    return { x: 0, y: 0, z: 0 };
  }

  // Convert 3D point to 2D screen coordinates
  project3DTo2D(point3D: { x: number; y: number; z: number }): { x: number; y: number } {
    const { focalLength, principalPoint } = this.calibration;
    
    return {
      x: (point3D.x * focalLength) / point3D.z + principalPoint.x,
      y: (point3D.y * focalLength) / point3D.z + principalPoint.y
    };
  }

  // Update body model with detected height
  calibrateBodyModel(detectedHeight: number) {
    this.referenceBodyModel = this.createReferenceModel(detectedHeight);
  }
}