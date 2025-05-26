import { useRef, useEffect, useState, useCallback } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

export interface PersonPose {
  id: number;
  keypoints: poseDetection.Keypoint[];
  score: number;
  color: string;
  trackingId?: string;
}

interface UseMultiPersonPoseDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  maxPoses?: number;
  minPoseConfidence?: number;
  minPartConfidence?: number;
  smoothing?: boolean;
  onPosesDetected?: (poses: PersonPose[]) => void;
}

const PERSON_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#82E0AA', // Green
  '#F8B739', // Orange
  '#EC7063', // Pink
];

export const useMultiPersonPoseDetection = ({
  videoRef,
  maxPoses = 5,
  minPoseConfidence = 0.3,
  minPartConfidence = 0.3,
  smoothing = true,
  onPosesDetected
}: UseMultiPersonPoseDetectionProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [detectedPoseCount, setDetectedPoseCount] = useState(0);

  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTime = useRef(Date.now());
  const frameCount = useRef(0);
  const previousPoses = useRef<PersonPose[]>([]);
  const poseHistory = useRef<Map<string, PersonPose[]>>(new Map());

  // Generate tracking ID based on pose position
  const generateTrackingId = (pose: poseDetection.Pose): string => {
    const centerX = pose.keypoints.reduce((sum, kp) => sum + kp.x, 0) / pose.keypoints.length;
    const centerY = pose.keypoints.reduce((sum, kp) => sum + kp.y, 0) / pose.keypoints.length;
    return `${Math.round(centerX / 50)}_${Math.round(centerY / 50)}`;
  };

  // Calculate distance between two poses
  const calculatePoseDistance = (pose1: poseDetection.Pose, pose2: PersonPose): number => {
    const validKeypoints1 = pose1.keypoints.filter(kp => (kp.score || 0) > minPartConfidence);
    const validKeypoints2 = pose2.keypoints.filter(kp => (kp.score || 0) > minPartConfidence);
    
    if (validKeypoints1.length === 0 || validKeypoints2.length === 0) return Infinity;

    let totalDistance = 0;
    let matchCount = 0;

    validKeypoints1.forEach((kp1, idx) => {
      const kp2 = validKeypoints2[idx];
      if (kp2 && (kp2.score || 0) > minPartConfidence) {
        const distance = Math.sqrt(
          Math.pow(kp1.x - kp2.x, 2) + 
          Math.pow(kp1.y - kp2.y, 2)
        );
        totalDistance += distance;
        matchCount++;
      }
    });

    return matchCount > 0 ? totalDistance / matchCount : Infinity;
  };

  // Track poses across frames
  const trackPoses = (currentPoses: poseDetection.Pose[]): PersonPose[] => {
    const trackedPoses: PersonPose[] = [];
    const usedPreviousPoses = new Set<number>();

    // Match current poses with previous poses
    currentPoses.forEach((currentPose, index) => {
      let bestMatch: PersonPose | null = null;
      let bestDistance = Infinity;

      // Find the best matching previous pose
      previousPoses.current.forEach((prevPose, prevIndex) => {
        if (!usedPreviousPoses.has(prevIndex)) {
          const distance = calculatePoseDistance(currentPose, prevPose);
          if (distance < bestDistance && distance < 50) { // 50 pixel threshold
            bestDistance = distance;
            bestMatch = prevPose;
            usedPreviousPoses.add(prevIndex);
          }
        }
      });

      // Create tracked pose
      const trackedPose: PersonPose = {
        id: bestMatch ? bestMatch.id : Date.now() + index,
        keypoints: currentPose.keypoints,
        score: currentPose.score || 0,
        color: bestMatch ? bestMatch.color : PERSON_COLORS[index % PERSON_COLORS.length],
        trackingId: generateTrackingId(currentPose)
      };

      // Apply smoothing if enabled
      if (smoothing && bestMatch) {
        trackedPose.keypoints = trackedPose.keypoints.map((kp, kpIndex) => {
          const prevKp = bestMatch.keypoints[kpIndex];
          if (prevKp && (kp.score || 0) > minPartConfidence && (prevKp.score || 0) > minPartConfidence) {
            return {
              ...kp,
              x: kp.x * 0.7 + prevKp.x * 0.3,
              y: kp.y * 0.7 + prevKp.y * 0.3
            };
          }
          return kp;
        });
      }

      trackedPoses.push(trackedPose);
    });

    previousPoses.current = trackedPoses;
    return trackedPoses;
  };

  const detectPoses = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current || videoRef.current.readyState !== 4) {
      return;
    }

    try {
      // Detect poses
      const poses = await detectorRef.current.estimatePoses(videoRef.current, {
        maxPoses,
        flipHorizontal: false
      });

      // Filter poses by confidence
      const validPoses = poses.filter(pose => (pose.score || 0) > minPoseConfidence);

      // Track poses across frames
      const trackedPoses = trackPoses(validPoses);

      // Update detected count
      setDetectedPoseCount(trackedPoses.length);

      // Callback with tracked poses
      onPosesDetected?.(trackedPoses);

      // Calculate FPS
      frameCount.current++;
      const now = Date.now();
      const elapsed = now - lastFrameTime.current;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / elapsed));
        frameCount.current = 0;
        lastFrameTime.current = now;
      }
    } catch (err) {
      console.error('Error detecting poses:', err);
    }

    // Continue detection loop
    animationFrameRef.current = requestAnimationFrame(detectPoses);
  }, [videoRef, maxPoses, minPoseConfidence, onPosesDetected]);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize TensorFlow.js backend
      await tf.ready();

      // Create PoseNet detector for multi-person detection
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.PoseNet,
        {
          architecture: 'MobileNetV1',
          outputStride: 16,
          inputResolution: { width: 500, height: 500 },
          multiplier: 0.75,
          quantBytes: 2
        }
      );

      detectorRef.current = detector;
      setIsLoading(false);

      // Start detection loop
      detectPoses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize pose detector');
      setIsLoading(false);
    }
  }, [detectPoses]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (detectorRef.current) {
      detectorRef.current.dispose();
      detectorRef.current = null;
    }
    previousPoses.current = [];
    poseHistory.current.clear();
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      initialize();
    }

    return () => {
      stop();
    };
  }, [initialize, stop, videoRef]);

  return {
    isLoading,
    error,
    fps,
    detectedPoseCount,
    stop,
    restart: initialize
  };
};

// Utility function to draw multi-person poses
export const drawMultiPersonPoses = (
  ctx: CanvasRenderingContext2D,
  poses: PersonPose[],
  minConfidence: number = 0.3
) => {
  const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.PoseNet);

  poses.forEach((pose) => {
    // Draw keypoints
    pose.keypoints.forEach((keypoint) => {
      if ((keypoint.score || 0) > minConfidence) {
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = pose.color;
        ctx.fill();
        
        // Add white outline for visibility
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw skeleton
    adjacentKeyPoints.forEach(([i, j]) => {
      const kp1 = pose.keypoints[i];
      const kp2 = pose.keypoints[j];

      if ((kp1.score || 0) > minConfidence && (kp2.score || 0) > minConfidence) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.strokeStyle = pose.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    // Draw person ID
    const nose = pose.keypoints[0];
    if ((nose.score || 0) > minConfidence) {
      ctx.fillStyle = pose.color;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.font = 'bold 20px Arial';
      ctx.strokeText(`Person ${poses.indexOf(pose) + 1}`, nose.x - 30, nose.y - 20);
      ctx.fillText(`Person ${poses.indexOf(pose) + 1}`, nose.x - 30, nose.y - 20);
    }
  });
};