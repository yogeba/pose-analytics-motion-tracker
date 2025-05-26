import { useRef, useState, useCallback, useEffect } from 'react';
import { Keypoint } from '@tensorflow-models/pose-detection';
import { Pose3DEstimator, Pose3D, CalibrationData } from '@/lib/pose3d/Pose3DEstimator';
import { Pose3DVisualizer, VisualizationOptions } from '@/lib/pose3d/Pose3DVisualizer';

export interface Use3DPoseEstimationProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  calibration?: CalibrationData;
  visualizationOptions?: Partial<VisualizationOptions>;
  athleteHeight?: number; // meters
}

export interface Pose3DMetrics {
  centerOfMassDepth: number; // meters
  bodyLean: {
    forward: number; // degrees
    lateral: number; // degrees
  };
  jointRangeOfMotion: Map<string, { min: number; max: number; current: number }>;
  postureScore: number; // 0-100
  symmetryScore: number; // 0-100
}

export const use3DPoseEstimation = ({
  canvasRef,
  calibration,
  visualizationOptions,
  athleteHeight = 1.75
}: Use3DPoseEstimationProps) => {
  const estimatorRef = useRef<Pose3DEstimator | null>(null);
  const visualizerRef = useRef<Pose3DVisualizer | null>(null);
  const [pose3D, setPose3D] = useState<Pose3D | null>(null);
  const [metrics, setMetrics] = useState<Pose3DMetrics>({
    centerOfMassDepth: 0,
    bodyLean: { forward: 0, lateral: 0 },
    jointRangeOfMotion: new Map(),
    postureScore: 100,
    symmetryScore: 100
  });
  const [isVisualizerReady, setIsVisualizerReady] = useState(false);
  
  // Joint range of motion tracking
  const romHistoryRef = useRef<Map<string, number[]>>(new Map());

  // Initialize estimator and visualizer
  useEffect(() => {
    estimatorRef.current = new Pose3DEstimator(calibration);
    estimatorRef.current.calibrateBodyModel(athleteHeight);
    
    if (canvasRef.current) {
      visualizerRef.current = new Pose3DVisualizer(canvasRef.current, visualizationOptions);
      setIsVisualizerReady(true);
    }
    
    return () => {
      estimatorRef.current = null;
      visualizerRef.current = null;
    };
  }, [calibration, athleteHeight, canvasRef, visualizationOptions]);

  // Process 2D keypoints to 3D
  const process2DPose = useCallback((keypoints: Keypoint[], imageWidth: number, imageHeight: number) => {
    if (!estimatorRef.current) return;
    
    const estimated3D = estimatorRef.current.estimatePose3D(keypoints, imageWidth, imageHeight);
    setPose3D(estimated3D);
    
    // Update metrics
    updateMetrics(estimated3D);
    
    // Visualize if canvas is available
    if (visualizerRef.current && isVisualizerReady) {
      visualizerRef.current.draw(estimated3D);
    }
  }, [isVisualizerReady]);

  // Update 3D metrics
  const updateMetrics = (pose: Pose3D) => {
    // Update ROM history
    pose.jointAngles3D.forEach((angle, jointName) => {
      const history = romHistoryRef.current.get(jointName) || [];
      history.push(angle);
      if (history.length > 300) history.shift(); // Keep last 10 seconds at 30fps
      romHistoryRef.current.set(jointName, history);
    });
    
    // Calculate metrics
    const centerOfMassDepth = pose.centerOfMass3D.z;
    
    // Body lean calculation
    const bodyLean = {
      forward: pose.bodyOrientation.pitch,
      lateral: pose.bodyOrientation.roll
    };
    
    // ROM calculation
    const jointRangeOfMotion = new Map<string, { min: number; max: number; current: number }>();
    romHistoryRef.current.forEach((history, jointName) => {
      if (history.length > 0) {
        jointRangeOfMotion.set(jointName, {
          min: Math.min(...history),
          max: Math.max(...history),
          current: history[history.length - 1]
        });
      }
    });
    
    // Posture score (based on body alignment)
    const postureScore = calculatePostureScore(pose);
    
    // Symmetry score (left vs right comparison)
    const symmetryScore = calculateSymmetryScore(pose);
    
    setMetrics({
      centerOfMassDepth,
      bodyLean,
      jointRangeOfMotion,
      postureScore,
      symmetryScore
    });
  };

  // Calculate posture score based on ideal alignment
  const calculatePostureScore = (pose: Pose3D): number => {
    let score = 100;
    
    // Penalize excessive forward lean
    const forwardLean = Math.abs(pose.bodyOrientation.pitch);
    if (forwardLean > 15) {
      score -= Math.min(30, (forwardLean - 15) * 2);
    }
    
    // Penalize lateral lean
    const lateralLean = Math.abs(pose.bodyOrientation.roll);
    if (lateralLean > 10) {
      score -= Math.min(20, (lateralLean - 10) * 2);
    }
    
    // Check knee angles (should not be hyperextended)
    const leftKnee = pose.jointAngles3D.get('left_knee');
    const rightKnee = pose.jointAngles3D.get('right_knee');
    if (leftKnee && leftKnee > 170) score -= 10;
    if (rightKnee && rightKnee > 170) score -= 10;
    
    return Math.max(0, score);
  };

  // Calculate symmetry between left and right sides
  const calculateSymmetryScore = (pose: Pose3D): number => {
    let totalDifference = 0;
    let comparisonCount = 0;
    
    const symmetricPairs = [
      ['left_elbow', 'right_elbow'],
      ['left_shoulder', 'right_shoulder'],
      ['left_hip', 'right_hip'],
      ['left_knee', 'right_knee']
    ];
    
    symmetricPairs.forEach(([left, right]) => {
      const leftAngle = pose.jointAngles3D.get(left);
      const rightAngle = pose.jointAngles3D.get(right);
      
      if (leftAngle !== undefined && rightAngle !== undefined) {
        const difference = Math.abs(leftAngle - rightAngle);
        totalDifference += difference;
        comparisonCount++;
      }
    });
    
    if (comparisonCount === 0) return 100;
    
    const avgDifference = totalDifference / comparisonCount;
    // Map average difference to score (0° = 100, 30° = 0)
    return Math.max(0, Math.min(100, 100 - (avgDifference * 100 / 30)));
  };

  // Update visualization options
  const updateVisualization = useCallback((options: Partial<VisualizationOptions>) => {
    if (visualizerRef.current) {
      visualizerRef.current.updateOptions(options);
      // Redraw with new options
      if (pose3D) {
        visualizerRef.current.draw(pose3D);
      }
    }
  }, [pose3D]);

  // Get biomechanical insights
  const getBiomechanicalInsights = useCallback((): string[] => {
    const insights: string[] = [];
    
    if (metrics.bodyLean.forward > 20) {
      insights.push('⚠️ Excessive forward lean detected - engage core');
    }
    
    if (metrics.symmetryScore < 70) {
      insights.push('⚠️ Left-right imbalance detected - focus on symmetry');
    }
    
    if (metrics.postureScore < 80) {
      insights.push('💡 Posture can be improved - maintain neutral spine');
    }
    
    // Check for hyperextension
    metrics.jointRangeOfMotion.forEach((rom, joint) => {
      if (joint.includes('knee') && rom.current > 170) {
        insights.push(`⚠️ ${joint} hyperextension - slightly bend knee`);
      }
      if (joint.includes('elbow') && rom.current > 175) {
        insights.push(`⚠️ ${joint} locked out - maintain slight bend`);
      }
    });
    
    return insights;
  }, [metrics]);

  // Reset tracking
  const reset = useCallback(() => {
    romHistoryRef.current.clear();
    setPose3D(null);
    setMetrics({
      centerOfMassDepth: 0,
      bodyLean: { forward: 0, lateral: 0 },
      jointRangeOfMotion: new Map(),
      postureScore: 100,
      symmetryScore: 100
    });
  }, []);

  return {
    pose3D,
    metrics,
    process2DPose,
    updateVisualization,
    getBiomechanicalInsights,
    reset,
    isReady: isVisualizerReady
  };
};