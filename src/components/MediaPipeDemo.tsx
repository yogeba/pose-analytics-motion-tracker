'use client';

import React, { useRef, useState, useCallback } from 'react';
import { useMediaPipeHolistic, HolisticKeypoints } from '@/hooks/useMediaPipeHolistic';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, Sparkles, Brain, Hand, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface KeypointStats {
  pose: number;
  face: number;
  leftHand: number;
  rightHand: number;
  total: number;
}

export const MediaPipeDemo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [keypointStats, setKeypointStats] = useState<KeypointStats>({
    pose: 0,
    face: 0,
    leftHand: 0,
    rightHand: 0,
    total: 0
  });
  const [modelComplexity, setModelComplexity] = useState<0 | 1 | 2>(1);

  const handleResults = useCallback((keypoints: HolisticKeypoints) => {
    setKeypointStats({
      pose: keypoints.pose.length,
      face: keypoints.face.length,
      leftHand: keypoints.leftHand.length,
      rightHand: keypoints.rightHand.length,
      total: keypoints.pose.length + keypoints.face.length + 
             keypoints.leftHand.length + keypoints.rightHand.length
    });
  }, []);

  const { isLoading, error, fps, stop, restart } = useMediaPipeHolistic({
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    onResults: handleResults,
    modelComplexity
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="text-4xl font-bold text-white flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-400" />
            MediaPipe Holistic Demo
            <Sparkles className="w-8 h-8 text-purple-400" />
          </h1>
          <p className="text-gray-300">540+ keypoints: Body, Face, and Hands tracking</p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-black/20 backdrop-blur-xl border-white/10">
            <div className="p-4 grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center">
                <User className="w-6 h-6 mx-auto mb-1 text-green-400" />
                <Badge variant="outline" className="bg-green-400/10">
                  Pose: {keypointStats.pose}
                </Badge>
              </div>
              <div className="text-center">
                <Brain className="w-6 h-6 mx-auto mb-1 text-blue-400" />
                <Badge variant="outline" className="bg-blue-400/10">
                  Face: {keypointStats.face}
                </Badge>
              </div>
              <div className="text-center">
                <Hand className="w-6 h-6 mx-auto mb-1 text-red-400" />
                <Badge variant="outline" className="bg-red-400/10">
                  L Hand: {keypointStats.leftHand}
                </Badge>
              </div>
              <div className="text-center">
                <Hand className="w-6 h-6 mx-auto mb-1 text-orange-400" />
                <Badge variant="outline" className="bg-orange-400/10">
                  R Hand: {keypointStats.rightHand}
                </Badge>
              </div>
              <div className="text-center">
                <Sparkles className="w-6 h-6 mx-auto mb-1 text-purple-400" />
                <Badge variant="outline" className="bg-purple-400/10">
                  Total: {keypointStats.total}
                </Badge>
              </div>
              <div className="text-center">
                <Badge variant="outline" className={fps > 20 ? "bg-green-400/10" : "bg-yellow-400/10"}>
                  FPS: {fps}
                </Badge>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Video/Canvas Area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="md:col-span-2"
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
                  width={1280}
                  height={720}
                />
                
                {!isStarted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Button
                      size="lg"
                      onClick={startCamera}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Camera className="mr-2" />
                      Start Camera
                    </Button>
                  </div>
                )}
                
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                      <p>Loading MediaPipe Holistic...</p>
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
              <h3 className="text-white font-semibold">Model Settings</h3>
              
              <div className="space-y-2">
                <label className="text-sm text-gray-300">Model Complexity</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((complexity) => (
                    <Button
                      key={complexity}
                      variant={modelComplexity === complexity ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setModelComplexity(complexity as 0 | 1 | 2);
                        if (isStarted) restart();
                      }}
                      className={modelComplexity === complexity ? 
                        "bg-purple-600 hover:bg-purple-700" : 
                        "border-white/20 text-white hover:bg-white/10"
                      }
                    >
                      {complexity === 0 ? 'Lite' : complexity === 1 ? 'Full' : 'Heavy'}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {modelComplexity === 0 ? 'Fast but less accurate' :
                   modelComplexity === 1 ? 'Balanced performance' :
                   'Most accurate but slower'}
                </p>
              </div>
            </Card>

            <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-4 space-y-4">
              <h3 className="text-white font-semibold">Keypoint Details</h3>
              <div className="space-y-2 text-sm">
                <AnimatePresence>
                  {keypointStats.total > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1"
                    >
                      <p className="text-green-400">✓ 33 pose landmarks detected</p>
                      {keypointStats.face > 0 && (
                        <p className="text-blue-400">✓ 468 face landmarks detected</p>
                      )}
                      {keypointStats.leftHand > 0 && (
                        <p className="text-red-400">✓ 21 left hand landmarks detected</p>
                      )}
                      {keypointStats.rightHand > 0 && (
                        <p className="text-orange-400">✓ 21 right hand landmarks detected</p>
                      )}
                    </motion.div>
                  )}
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

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-6">
            <h3 className="text-white font-semibold mb-4">About MediaPipe Holistic</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
              <div>
                <h4 className="text-white font-medium mb-2">Key Features:</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>540+ total keypoints tracking</li>
                  <li>Real-time performance on web</li>
                  <li>Simultaneous body, face, and hand tracking</li>
                  <li>3 model complexity levels</li>
                  <li>Cross-platform browser support</li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2">Use Cases:</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Sign language recognition</li>
                  <li>Full-body motion capture</li>
                  <li>Facial expression analysis</li>
                  <li>Hand gesture control</li>
                  <li>Comprehensive fitness tracking</li>
                </ul>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};