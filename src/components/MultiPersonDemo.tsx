'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useMultiPersonPoseDetection, PersonPose, drawMultiPersonPoses } from '@/hooks/useMultiPersonPoseDetection';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, Users, Zap, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PoseMetrics {
  personId: number;
  avgConfidence: number;
  detectedKeypoints: number;
  isActive: boolean;
}

export const MultiPersonDemo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null as any);
  const canvasRef = useRef<HTMLCanvasElement>(null as any);
  const [isStarted, setIsStarted] = useState(false);
  const [maxPoses, setMaxPoses] = useState(3);
  const [poseMetrics, setPoseMetrics] = useState<PoseMetrics[]>([]);
  const [showSkeletons, setShowSkeletons] = useState(true);
  const [minConfidence, setMinConfidence] = useState(0.3);

  const handlePosesDetected = useCallback((poses: PersonPose[]) => {
    // Draw on canvas
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        if (showSkeletons) {
          drawMultiPersonPoses(ctx, poses, minConfidence);
        }
      }
    }

    // Calculate metrics for each person
    const metrics: PoseMetrics[] = poses.map((pose, index) => {
      const validKeypoints = pose.keypoints.filter(kp => (kp.score || 0) > minConfidence);
      const avgConfidence = validKeypoints.length > 0
        ? validKeypoints.reduce((sum, kp) => sum + (kp.score || 0), 0) / validKeypoints.length
        : 0;

      return {
        personId: index + 1,
        avgConfidence: avgConfidence,
        detectedKeypoints: validKeypoints.length,
        isActive: avgConfidence > 0.5
      };
    });

    setPoseMetrics(metrics);
  }, [showSkeletons, minConfidence]);

  const { isLoading, error, fps, detectedPoseCount, stop, restart } = useMultiPersonPoseDetection({
    videoRef,
    maxPoses,
    minPoseConfidence: minConfidence,
    minPartConfidence: minConfidence,
    smoothing: true,
    onPosesDetected: handlePosesDetected
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStarted(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    stop();
    setIsStarted(false);
    setPoseMetrics([]);
  };

  // Update canvas size when video loads
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      const updateCanvasSize = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      };
      
      video.addEventListener('loadedmetadata', updateCanvasSize);
      return () => video.removeEventListener('loadedmetadata', updateCanvasSize);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-black to-purple-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="text-4xl font-bold text-white flex items-center justify-center gap-2">
            <Users className="w-8 h-8 text-blue-400" />
            Multi-Person Pose Tracking
            <Users className="w-8 h-8 text-blue-400" />
          </h1>
          <p className="text-gray-300">Track up to {maxPoses} people simultaneously with unique IDs</p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-black/20 backdrop-blur-xl border-white/10">
            <div className="p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="bg-blue-400/10">
                  <Users className="w-4 h-4 mr-1" />
                  People: {detectedPoseCount}
                </Badge>
                <Badge variant="outline" className={fps > 20 ? "bg-green-400/10" : "bg-yellow-400/10"}>
                  <Zap className="w-4 h-4 mr-1" />
                  FPS: {fps}
                </Badge>
              </div>
              
              <div className="flex gap-2">
                {poseMetrics.map((metric) => (
                  <Badge 
                    key={metric.personId} 
                    variant="outline" 
                    className={metric.isActive ? "bg-green-400/10" : "bg-gray-400/10"}
                  >
                    Person {metric.personId}: {metric.detectedKeypoints} pts
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video/Canvas Area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="bg-black/20 backdrop-blur-xl border-white/10 overflow-hidden">
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />
                
                {!isStarted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Button
                      size="lg"
                      onClick={startCamera}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Camera className="mr-2" />
                      Start Camera
                    </Button>
                  </div>
                )}
                
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p>Loading Multi-Person Detector...</p>
                    </div>
                  </div>
                )}
                
                {error && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <Badge variant="destructive" className="w-full text-center py-2">
                      {error}
                    </Badge>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-4 space-y-4">
              <h3 className="text-white font-semibold">Detection Settings</h3>
              
              <div className="space-y-2">
                <label className="text-sm text-gray-300">Max People</label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((count) => (
                    <Button
                      key={count}
                      variant={maxPoses === count ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setMaxPoses(count);
                        if (isStarted) restart();
                      }}
                      className={maxPoses === count ? 
                        "bg-blue-600 hover:bg-blue-700" : 
                        "border-white/20 text-white hover:bg-white/10"
                      }
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-300">Min Confidence: {minConfidence.toFixed(1)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSkeletons(!showSkeletons)}
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                {showSkeletons ? 'Hide' : 'Show'} Skeletons
              </Button>
            </Card>

            <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-4 space-y-4">
              <h3 className="text-white font-semibold">Person Details</h3>
              <div className="space-y-2">
                <AnimatePresence>
                  {poseMetrics.map((metric) => (
                    <motion.div
                      key={metric.personId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-white/5 rounded-lg p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">Person {metric.personId}</span>
                        <Activity className={`w-4 h-4 ${metric.isActive ? 'text-green-400' : 'text-gray-400'}`} />
                      </div>
                      <div className="text-xs text-gray-400">
                        <p>Confidence: {(metric.avgConfidence * 100).toFixed(1)}%</p>
                        <p>Keypoints: {metric.detectedKeypoints}/17</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Card>

            <Button
              variant="outline"
              size="lg"
              onClick={isStarted ? stopCamera : startCamera}
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              {isStarted ? (
                <>
                  <CameraOff className="mr-2" />
                  Stop Camera
                </>
              ) : (
                <>
                  <Camera className="mr-2" />
                  Start Camera
                </>
              )}
            </Button>
          </motion.div>
        </div>

        {/* Use Cases */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-6">
            <h3 className="text-white font-semibold mb-4">Multi-Person Tracking Use Cases</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
              <div>
                <h4 className="text-blue-400 font-medium mb-2">Fitness & Training</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Group fitness classes</li>
                  <li>Dance choreography</li>
                  <li>Team sports analysis</li>
                  <li>Partner workouts</li>
                </ul>
              </div>
              <div>
                <h4 className="text-purple-400 font-medium mb-2">Healthcare</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Group therapy sessions</li>
                  <li>Gait comparison studies</li>
                  <li>Family movement screening</li>
                  <li>Clinical research</li>
                </ul>
              </div>
              <div>
                <h4 className="text-green-400 font-medium mb-2">Entertainment</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Motion capture for animation</li>
                  <li>Interactive gaming</li>
                  <li>Virtual reality experiences</li>
                  <li>Performance analysis</li>
                </ul>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};