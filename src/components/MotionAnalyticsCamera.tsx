'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useMotionAnalytics } from '@/hooks/useMotionAnalytics';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  Activity, 
  TrendingUp,
  Timer,
  Route
} from 'lucide-react';

export default function MotionAnalyticsCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);

  const {
    stream,
    isLoading,
    isProcessing,
    currentPose,
    speedMetrics,
    distanceMetrics,
    accelerationMetrics,
    speedZone,
    fps,
    error,
    cameraError,
    sessionDuration,
    startSession,
    stopSession,
    calibrateFromPose,
    isSessionActive
  } = useMotionAnalytics({
    enableYOLOv8: true,
    targetFPS: 30,
    athleteHeight: 1.75, // Default 1.75m
    minConfidence: 0.5
  });

  // Set up video stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Draw pose overlay
  useEffect(() => {
    if (!currentPose || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw skeleton
    drawSkeleton(ctx, currentPose.keypoints);

    // Draw speed vectors if available
    if (speedMetrics) {
      drawSpeedVector(ctx, speedMetrics);
    }
  }, [currentPose, speedMetrics]);

  const handleStartStop = () => {
    if (!videoRef.current) return;

    if (isSessionActive) {
      stopSession();
    } else {
      startSession(videoRef.current);
    }
  };

  const handleCalibrate = () => {
    calibrateFromPose();
    setIsCalibrated(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error || cameraError) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-500">
          <p className="text-lg font-semibold">Error</p>
          <p className="mt-2">{error || cameraError}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video and Canvas */}
      <Card className="relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
              <p>Loading YOLOv8 Pose Detector...</p>
            </div>
          </div>
        )}

        {/* FPS Badge */}
        <Badge className="absolute top-4 right-4 bg-black/70 text-white">
          {fps} FPS
        </Badge>

        {/* Speed Zone Badge */}
        {speedZone && (
          <Badge 
            className={`absolute top-4 left-4 ${getSpeedZoneColor(speedZone)}`}
          >
            {speedZone.toUpperCase()}
          </Badge>
        )}
      </Card>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              onClick={handleStartStop}
              disabled={isLoading || !stream}
              size="lg"
              className={isSessionActive ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {isSessionActive ? (
                <>
                  <Pause className="w-5 h-5 mr-2" />
                  Stop Session
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Start Session
                </>
              )}
            </Button>

            <Button
              onClick={handleCalibrate}
              disabled={!currentPose || isCalibrated}
              variant="outline"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Calibrate
            </Button>
          </div>

          {isSessionActive && (
            <div className="flex items-center gap-2 text-lg font-mono">
              <Timer className="w-5 h-5" />
              {formatTime(sessionDuration)}
            </div>
          )}
        </div>
      </Card>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Speed Metrics */}
        <Card className="p-4">
          <div className="flex items-center mb-2">
            <Zap className="w-5 h-5 mr-2 text-yellow-500" />
            <h3 className="font-semibold">Speed</h3>
          </div>
          {speedMetrics ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Current:</span>
                <span className="font-mono">{speedMetrics.instantaneous.toFixed(2)} m/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average:</span>
                <span className="font-mono">{speedMetrics.average.toFixed(2)} m/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max:</span>
                <span className="font-mono">{speedMetrics.max.toFixed(2)} m/s</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{speedMetrics.kilometersPerHour.toFixed(1)} km/h</span>
                <span>{speedMetrics.milesPerHour.toFixed(1)} mph</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Start moving to see metrics</p>
          )}
        </Card>

        {/* Distance Metrics */}
        <Card className="p-4">
          <div className="flex items-center mb-2">
            <Route className="w-5 h-5 mr-2 text-blue-500" />
            <h3 className="font-semibold">Distance</h3>
          </div>
          {distanceMetrics ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-mono">{distanceMetrics.total.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Horizontal:</span>
                <span className="font-mono">{distanceMetrics.horizontal.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vertical:</span>
                <span className="font-mono">{distanceMetrics.vertical.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{distanceMetrics.feet.toFixed(1)} ft</span>
                <span>{(distanceMetrics.miles * 1000).toFixed(1)} yd</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No distance data yet</p>
          )}
        </Card>

        {/* Acceleration Metrics */}
        <Card className="p-4">
          <div className="flex items-center mb-2">
            <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
            <h3 className="font-semibold">Acceleration</h3>
          </div>
          {accelerationMetrics ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Current:</span>
                <span className="font-mono">
                  {accelerationMetrics.current.toFixed(2)} m/s²
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Peak:</span>
                <span className="font-mono">
                  {accelerationMetrics.peak.toFixed(2)} m/s²
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-semibold ${
                  accelerationMetrics.isExplosive ? 'text-red-500' :
                  accelerationMetrics.isDecelerating ? 'text-yellow-500' :
                  'text-green-500'
                }`}>
                  {accelerationMetrics.isExplosive ? 'Explosive' :
                   accelerationMetrics.isDecelerating ? 'Decelerating' :
                   'Accelerating'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No acceleration data yet</p>
          )}
        </Card>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="fixed bottom-4 right-4">
          <Badge className="bg-blue-600 text-white animate-pulse">
            <Activity className="w-4 h-4 mr-1" />
            Processing...
          </Badge>
        </div>
      )}
    </div>
  );
}

// Helper functions
function drawSkeleton(ctx: CanvasRenderingContext2D, keypoints: Array<{x: number; y: number; score?: number; name?: string}>) {
  // COCO skeleton connections
  const connections = [
    [0, 1], [0, 2], [1, 3], [2, 4], // Head
    [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], // Arms
    [5, 11], [6, 12], [11, 12], // Torso
    [11, 13], [13, 15], [12, 14], [14, 16] // Legs
  ];

  // Draw connections
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;
  connections.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    if (kp1?.score > 0.3 && kp2?.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  });

  // Draw keypoints
  keypoints.forEach(kp => {
    if (kp.score > 0.3) {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

function drawSpeedVector(ctx: CanvasRenderingContext2D, speedMetrics: { centerOfMass?: { x: number; y: number }; instantaneous: number }) {
  const { centerOfMass } = speedMetrics;
  if (!centerOfMass) return;

  // Draw center of mass
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(centerOfMass.x, centerOfMass.y, 6, 0, 2 * Math.PI);
  ctx.fill();

  // Draw speed indicator
  const speedScale = speedMetrics.instantaneous * 50; // Scale for visibility
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerOfMass.x, centerOfMass.y);
  ctx.lineTo(centerOfMass.x + speedScale, centerOfMass.y);
  ctx.stroke();
}

function getSpeedZoneColor(zone: string): string {
  switch (zone) {
    case 'stationary': return 'bg-gray-600';
    case 'walking': return 'bg-blue-600';
    case 'jogging': return 'bg-green-600';
    case 'running': return 'bg-yellow-600';
    case 'sprinting': return 'bg-red-600';
    default: return 'bg-gray-600';
  }
}