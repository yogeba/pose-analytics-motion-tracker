import { useEffect, useRef, useState, useCallback } from 'react';
import { Holistic, Results } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import type { MediaPipeLandmark } from '@/types/common';

export interface HolisticKeypoints {
  pose: MediaPipeLandmark[];
  face: MediaPipeLandmark[];
  leftHand: MediaPipeLandmark[];
  rightHand: MediaPipeLandmark[];
  timestamp: number;
}

interface UseMediaPipeHolisticProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onResults?: (keypoints: HolisticKeypoints) => void;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
  modelComplexity?: 0 | 1 | 2;
}

export const useMediaPipeHolistic = ({
  videoRef,
  canvasRef,
  onResults,
  minDetectionConfidence = 0.5,
  minTrackingConfidence = 0.5,
  modelComplexity = 1
}: UseMediaPipeHolisticProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  
  const holisticRef = useRef<Holistic | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const lastFrameTime = useRef(Date.now());
  const frameCount = useRef(0);

  const processResults = useCallback((results: Results) => {
    // Calculate FPS
    frameCount.current++;
    const now = Date.now();
    const elapsed = now - lastFrameTime.current;
    if (elapsed >= 1000) {
      setFps(Math.round((frameCount.current * 1000) / elapsed));
      frameCount.current = 0;
      lastFrameTime.current = now;
    }

    // Extract and format keypoints
    const keypoints: HolisticKeypoints = {
      pose: results.poseLandmarks || [],
      face: results.faceLandmarks || [],
      leftHand: results.leftHandLandmarks || [],
      rightHand: results.rightHandLandmarks || [],
      timestamp: now
    };

    // Draw results on canvas
    if (canvasRef.current && results) {
      const canvasCtx = canvasRef.current.getContext('2d');
      if (canvasCtx) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Draw the image
        canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Draw pose connections
        if (results.poseLandmarks) {
          drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 4
          });
          drawLandmarks(canvasCtx, results.poseLandmarks, {
            color: '#FF0000',
            lineWidth: 2,
            radius: 5
          });
        }
        
        // Draw face mesh
        if (results.faceLandmarks) {
          drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, {
            color: '#C0C0C070',
            lineWidth: 1
          });
          drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_RIGHT_EYE, {
            color: '#FF3030'
          });
          drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LEFT_EYE, {
            color: '#30FF30'
          });
          drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_FACE_OVAL, {
            color: '#E0E0E0'
          });
          drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LIPS, {
            color: '#E0E0E0'
          });
        }
        
        // Draw hand landmarks
        if (results.leftHandLandmarks) {
          drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {
            color: '#CC0000',
            lineWidth: 5
          });
          drawLandmarks(canvasCtx, results.leftHandLandmarks, {
            color: '#00FF00',
            lineWidth: 2,
            radius: 5
          });
        }
        
        if (results.rightHandLandmarks) {
          drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {
            color: '#00CC00',
            lineWidth: 5
          });
          drawLandmarks(canvasCtx, results.rightHandLandmarks, {
            color: '#FF0000',
            lineWidth: 2,
            radius: 5
          });
        }
        
        canvasCtx.restore();
      }
    }

    // Callback with processed keypoints
    onResults?.(keypoints);
  }, [canvasRef, onResults]);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize MediaPipe Holistic
      const holistic = new Holistic({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
        }
      });

      holistic.setOptions({
        modelComplexity,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        refineFaceLandmarks: true,
        minDetectionConfidence,
        minTrackingConfidence
      });

      holistic.onResults(processResults);
      holisticRef.current = holistic;

      // Initialize camera
      if (videoRef.current) {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (holisticRef.current && videoRef.current) {
              await holisticRef.current.send({ image: videoRef.current });
            }
          },
          width: 1280,
          height: 720
        });

        cameraRef.current = camera;
        await camera.start();
      }

      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize MediaPipe Holistic');
      setIsLoading(false);
    }
  }, [videoRef, minDetectionConfidence, minTrackingConfidence, modelComplexity, processResults]);

  const stop = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    if (holisticRef.current) {
      holisticRef.current.close();
      holisticRef.current = null;
    }
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
    stop,
    restart: initialize
  };
};

// MediaPipe drawing utilities (simplified versions)
const drawConnectors = (
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  connections: number[][],
  style: { color?: string; lineWidth?: number }
) => {
  ctx.strokeStyle = style.color || '#00FF00';
  ctx.lineWidth = style.lineWidth || 2;
  
  connections.forEach(([start, end]) => {
    const startPoint = landmarks[start];
    const endPoint = landmarks[end];
    if (startPoint && endPoint) {
      ctx.beginPath();
      ctx.moveTo(startPoint.x * ctx.canvas.width, startPoint.y * ctx.canvas.height);
      ctx.lineTo(endPoint.x * ctx.canvas.width, endPoint.y * ctx.canvas.height);
      ctx.stroke();
    }
  });
};

const drawLandmarks = (
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  style: { color?: string; lineWidth?: number; radius?: number }
) => {
  ctx.fillStyle = style.color || '#FF0000';
  const radius = style.radius || 3;
  
  landmarks.forEach(landmark => {
    if (landmark) {
      ctx.beginPath();
      ctx.arc(
        landmark.x * ctx.canvas.width,
        landmark.y * ctx.canvas.height,
        radius,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  });
};

// Connection definitions
const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]
];

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
];

const FACEMESH_TESSELATION: number[][] = []; // Simplified - would include full mesh
const FACEMESH_RIGHT_EYE = [[33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133], [133, 33]];
const FACEMESH_LEFT_EYE = [[362, 382], [382, 381], [381, 380], [380, 374], [374, 373], [373, 390], [390, 249], [249, 263], [263, 362]];
const FACEMESH_FACE_OVAL = [[10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454], [454, 323], [323, 361], [361, 340], [340, 346], [346, 347], [347, 348], [348, 349], [349, 350], [350, 451], [451, 452], [452, 453], [453, 464], [464, 435], [435, 410], [410, 287], [287, 273], [273, 335], [335, 406], [406, 313], [313, 18], [18, 83], [83, 182], [182, 106], [106, 43], [43, 57], [57, 186], [186, 92], [92, 165], [165, 167], [167, 164], [164, 393], [393, 391], [391, 322], [322, 270], [270, 269], [269, 267], [267, 271], [271, 272], [272, 278], [278, 279], [279, 280], [280, 281], [281, 282], [282, 283], [283, 295], [295, 285], [285, 336], [336, 337], [337, 334], [334, 333], [333, 332]];
const FACEMESH_LIPS = [[61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405], [405, 320], [320, 307], [307, 375], [375, 321], [321, 308], [308, 324], [324, 318], [318, 402], [402, 317], [317, 14], [14, 87], [87, 178], [178, 88], [88, 95], [95, 61]];