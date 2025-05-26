import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Pose visualization utilities
export interface Keypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export function drawKeypoints(
  ctx: CanvasRenderingContext2D,
  keypoints: Keypoint[],
  minConfidence = 0.3
) {
  keypoints.forEach((keypoint) => {
    if (keypoint.score && keypoint.score >= minConfidence) {
      ctx.beginPath();
      ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#00ff00';
      ctx.fill();
    }
  });
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  keypoints: Keypoint[],
  minConfidence = 0.3
) {
  // Define pose connections (simplified)
  const connections = [
    [5, 6], [5, 7], [6, 8], [7, 9], [8, 10],  // Arms
    [11, 12], [11, 13], [12, 14], [13, 15], [14, 16],  // Legs
    [5, 11], [6, 12]  // Torso
  ];

  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;

  connections.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    
    if (kp1 && kp2 && 
        kp1.score && kp1.score >= minConfidence &&
        kp2.score && kp2.score >= minConfidence) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  });
}