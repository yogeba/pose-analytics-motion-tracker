import { useEffect, useRef, useState, useCallback } from 'react';
import { Pose } from '@tensorflow-models/pose-detection';
import { YOLOv8PoseDetector } from '@/lib/inference/YOLOv8PoseDetector';
import { EnhancedMotionCalculator, SpeedMetrics, DistanceMetrics, AccelerationMetrics, VelocityData } from '@/lib/analytics/EnhancedMotionCalculator';
import { useRobustCamera } from './useRobustCamera';

export interface MotionAnalyticsState {
  isLoading: boolean;
  isProcessing: boolean;
  currentPose: Pose | null;
  speedMetrics: SpeedMetrics | null;
  distanceMetrics: DistanceMetrics | null;
  accelerationMetrics: AccelerationMetrics | null;
  fps: number;
  error: string | null;
  speedZone: string;
  sessionStartTime: number | null;
  sessionDuration: number;
}

export interface MotionAnalyticsConfig {
  modelPath?: string;
  targetFPS?: number;
  enableYOLOv8?: boolean;
  athleteHeight?: number; // meters
  athleteMass?: number; // kg
  minConfidence?: number;
  maxPoses?: number;
}

export function useMotionAnalytics(config?: MotionAnalyticsConfig) {
  const [state, setState] = useState<MotionAnalyticsState>({
    isLoading: true,
    isProcessing: false,
    currentPose: null,
    speedMetrics: null,
    distanceMetrics: null,
    accelerationMetrics: null,
    fps: 0,
    error: null,
    speedZone: 'stationary',
    sessionStartTime: null,
    sessionDuration: 0
  });

  const detectorRef = useRef<YOLOv8PoseDetector | null>(null);
  const motionCalculatorRef = useRef<EnhancedMotionCalculator | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsUpdateTimeRef = useRef<number>(0);
  
  // Pose and motion history
  const poseHistoryRef = useRef<{ pose: Pose; timestamp: number }[]>([]);
  const velocityHistoryRef = useRef<VelocityData[]>([]);
  const sessionActiveRef = useRef<boolean>(false);

  const { stream, error: cameraError } = useRobustCamera();

  // Initialize detector and calculator
  useEffect(() => {
    async function initialize() {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Initialize YOLOv8 detector
        const detector = new YOLOv8PoseDetector({
          modelPath: config?.modelPath
        });
        await detector.loadModel();
        detectorRef.current = detector;

        // Initialize motion calculator
        const calculator = new EnhancedMotionCalculator({
          minConfidence: config?.minConfidence || 0.5,
          smoothingFactor: 0.3
        });
        motionCalculatorRef.current = calculator;

        setState(prev => ({ ...prev, isLoading: false }));
      } catch (error) {
        console.error('Failed to initialize motion analytics:', error);
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Failed to initialize pose detection'
        }));
      }
    }

    initialize();

    return () => {
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [config?.modelPath, config?.minConfidence]);

  // Process video frames
  const processFrame = useCallback(async (video: HTMLVideoElement) => {
    if (!detectorRef.current || !motionCalculatorRef.current || !sessionActiveRef.current) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000; // Convert to seconds
    
    // Skip frame if too soon (target FPS)
    const targetFPS = config?.targetFPS || 30;
    if (deltaTime < 1 / targetFPS) {
      animationFrameRef.current = requestAnimationFrame(() => processFrame(video));
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      // Create ImageData from video
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Detect poses
      const poses = await detectorRef.current.detectPoses(imageData, {
        maxPoses: config?.maxPoses || 1,
        format: 'COCO'
      });

      if (poses.length > 0) {
        const currentPose = poses[0];
        const timestamp = Date.now();

        // Update pose history
        poseHistoryRef.current.push({ pose: currentPose, timestamp });
        if (poseHistoryRef.current.length > 300) { // Keep last 10 seconds at 30fps
          poseHistoryRef.current.shift();
        }

        // Calculate motion metrics if we have previous pose
        if (poseHistoryRef.current.length >= 2) {
          const previousPoseData = poseHistoryRef.current[poseHistoryRef.current.length - 2];
          
          // Calculate speed
          const speedMetrics = motionCalculatorRef.current.calculateSpeed(
            { keypoints: currentPose.keypoints },
            { keypoints: previousPoseData.pose.keypoints },
            deltaTime
          );

          // Update velocity history
          velocityHistoryRef.current.push({
            x: speedMetrics.centerOfMass.x,
            y: speedMetrics.centerOfMass.y,
            magnitude: speedMetrics.instantaneous,
            timestamp
          });
          if (velocityHistoryRef.current.length > 60) { // Keep last 2 seconds
            velocityHistoryRef.current.shift();
          }

          // Calculate distance
          const poseHistory = poseHistoryRef.current.map(p => ({ keypoints: p.pose.keypoints }));
          const distanceMetrics = motionCalculatorRef.current.calculateDistance(poseHistory);

          // Calculate acceleration
          const accelerationMetrics = motionCalculatorRef.current.calculateAcceleration(
            velocityHistoryRef.current,
            deltaTime
          );

          // Get speed zone
          const speedZone = motionCalculatorRef.current.getSpeedZone(speedMetrics.instantaneous);

          // Update session duration
          const sessionDuration = state.sessionStartTime 
            ? (Date.now() - state.sessionStartTime) / 1000 
            : 0;

          setState(prev => ({
            ...prev,
            currentPose,
            speedMetrics,
            distanceMetrics,
            accelerationMetrics,
            speedZone,
            sessionDuration,
            isProcessing: false
          }));
        } else {
          setState(prev => ({
            ...prev,
            currentPose,
            isProcessing: false
          }));
        }
      }

      // Update FPS
      frameCountRef.current++;
      if (currentTime - fpsUpdateTimeRef.current > 1000) {
        const fps = frameCountRef.current;
        setState(prev => ({ ...prev, fps }));
        frameCountRef.current = 0;
        fpsUpdateTimeRef.current = currentTime;
      }

      lastFrameTimeRef.current = currentTime;
    } catch (error) {
      console.error('Error processing frame:', error);
      setState(prev => ({ ...prev, isProcessing: false }));
    }

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(() => processFrame(video));
  }, [config?.targetFPS, config?.maxPoses, state.sessionStartTime]);

  // Start/stop session
  const startSession = useCallback((video: HTMLVideoElement) => {
    if (!video || sessionActiveRef.current) return;

    // Reset session data
    poseHistoryRef.current = [];
    velocityHistoryRef.current = [];
    motionCalculatorRef.current?.reset();
    sessionActiveRef.current = true;

    setState(prev => ({
      ...prev,
      sessionStartTime: Date.now(),
      sessionDuration: 0,
      speedMetrics: null,
      distanceMetrics: null,
      accelerationMetrics: null
    }));

    // Start processing
    lastFrameTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(() => processFrame(video));
  }, [processFrame]);

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Calibrate from athlete height
  const calibrateFromPose = useCallback(() => {
    if (!state.currentPose || !motionCalculatorRef.current) return;

    const keypoints = state.currentPose.keypoints;
    const nose = keypoints.find(kp => kp.name === 'nose');
    const leftAnkle = keypoints.find(kp => kp.name === 'left_ankle');
    const rightAnkle = keypoints.find(kp => kp.name === 'right_ankle');

    if (nose && leftAnkle && rightAnkle && 
        nose.score! > 0.5 && leftAnkle.score! > 0.5 && rightAnkle.score! > 0.5) {
      const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
      const heightPixels = Math.abs(ankleY - nose.y);
      const athleteHeight = config?.athleteHeight || 1.75; // Default 1.75m
      
      motionCalculatorRef.current.calibrateFromHeight(heightPixels, athleteHeight);
    }
  }, [state.currentPose, config?.athleteHeight]);

  // Get performance metrics from detector
  const getPerformanceMetrics = useCallback(() => {
    return detectorRef.current?.getPerformanceMetrics();
  }, []);

  return {
    ...state,
    stream,
    cameraError,
    startSession,
    stopSession,
    calibrateFromPose,
    getPerformanceMetrics,
    isSessionActive: sessionActiveRef.current
  };
}