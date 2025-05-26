'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useSimplePoseDetection } from '@/hooks/useSimplePoseDetection';
import { useAthleticPerformance } from '@/hooks/useAthleticPerformance';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Camera, CameraOff, Activity, Zap, TrendingUp, 
  Footprints, BarChart3, Gauge, Play, Pause, RotateCcw 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { drawKeypoints, drawSkeleton } from '@/lib/utils';

type SportType = 'running' | 'jumping' | 'cycling' | 'weightlifting' | 'general';

interface SportConfig {
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const SPORT_CONFIGS: Record<SportType, SportConfig> = {
  running: {
    name: 'Running',
    icon: Footprints,
    color: 'bg-green-500',
    description: 'Track pace, cadence, and stride'
  },
  jumping: {
    name: 'Jumping',
    icon: TrendingUp,
    color: 'bg-orange-500',
    description: 'Measure jump height and power'
  },
  cycling: {
    name: 'Cycling',
    icon: Activity,
    color: 'bg-blue-500',
    description: 'Monitor speed and power output'
  },
  weightlifting: {
    name: 'Weightlifting',
    icon: BarChart3,
    color: 'bg-purple-500',
    description: 'Analyze bar velocity and power'
  },
  general: {
    name: 'General Fitness',
    icon: Zap,
    color: 'bg-gray-500',
    description: 'Overall movement tracking'
  }
};

export const AthleticPerformanceDemo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedSport, setSelectedSport] = useState<SportType>('running');
  const [athleteHeight, setAthleteHeight] = useState(1.75); // meters
  const [athleteMass, setAthleteMass] = useState(70); // kg

  const {
    isDetecting: _isDetecting,
    currentPose: detectedPose,
    fps: _fps,
    startCamera,
    startDetection,
    stopDetection,
    isInitialized
  } = useSimplePoseDetection();

  const {
    metrics,
    sportMetrics: _sportMetrics,
    isCalibrated,
    performanceLevel,
    processKeypoints,
    reset,
    getFormattedMetrics
  } = useAthleticPerformance({
    athleteHeight,
    athleteMass,
    sport: selectedSport,
    autoCalibrate: true
  });

  // Process detected poses
  useEffect(() => {
    if (detectedPose && detectedPose.keypoints && !isPaused) {
      processKeypoints(detectedPose.keypoints);
    }
  }, [detectedPose, processKeypoints, isPaused]);

  // Draw pose and performance visualization
  useEffect(() => {
    if (!canvasRef.current || !detectedPose || !videoRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw keypoints and skeleton
    drawKeypoints(ctx, detectedPose.keypoints, 0.3);
    drawSkeleton(ctx, detectedPose.keypoints, 0.3);

    // Draw performance indicators
    drawPerformanceOverlay(ctx, metrics, selectedSport);
  }, [detectedPose, metrics, selectedSport]);

  const drawPerformanceOverlay = (
    ctx: CanvasRenderingContext2D,
    metrics: any,
    sport: SportType
  ) => {
    // Speed indicator
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Speed: ${(metrics.speed.instantaneous * 3.6).toFixed(1)} km/h`, 20, 40);

    // Sport-specific overlay
    switch (sport) {
      case 'running':
        // Draw stride path
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.lineWidth = 3;
        // Visualize cadence with pulsing effect
        const pulseSize = 5 + Math.sin(Date.now() / 100) * 2;
        ctx.beginPath();
        ctx.arc(canvasRef.current!.width - 50, 50, pulseSize, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case 'jumping':
        // Jump height indicator
        if (metrics.jumpHeight > 0) {
          ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
          ctx.fillText(`Jump: ${metrics.jumpHeight.toFixed(1)} cm`, 20, 80);
        }
        break;

      case 'weightlifting':
        // Bar path visualization
        ctx.strokeStyle = 'rgba(147, 51, 234, 0.8)';
        ctx.lineWidth = 5;
        // Draw vertical line showing bar path
        break;
    }

    // Performance level indicator
    const levelColors = {
      beginner: 'rgba(156, 163, 175, 0.8)',
      intermediate: 'rgba(59, 130, 246, 0.8)',
      advanced: 'rgba(34, 197, 94, 0.8)',
      elite: 'rgba(168, 85, 247, 0.8)'
    };
    ctx.fillStyle = levelColors[performanceLevel];
    ctx.fillText(performanceLevel.toUpperCase(), canvasRef.current!.width - 150, 40);
  };

  const startCameraAndDetection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        await startCamera(videoRef.current);
        setIsStarted(true);
        if (canvasRef.current) {
          await startDetection(canvasRef.current);
        }
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
    stopDetection();
    setIsStarted(false);
    setIsPaused(false);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    reset();
  };

  const formattedMetrics = getFormattedMetrics();

  // Update canvas size
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="text-4xl font-bold text-white flex items-center justify-center gap-2">
            <Gauge className="w-8 h-8 text-orange-400" />
            Athletic Performance Tracker
            <Gauge className="w-8 h-8 text-orange-400" />
          </h1>
          <p className="text-gray-300">Edge-optimized real-time performance analysis</p>
        </motion.div>

        {/* Sport Selection */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(Object.entries(SPORT_CONFIGS) as [SportType, SportConfig][]).map(([sport, config]) => {
                const Icon = config.icon;
                return (
                  <Button
                    key={sport}
                    variant={selectedSport === sport ? "default" : "outline"}
                    onClick={() => setSelectedSport(sport)}
                    className={selectedSport === sport ? 
                      `${config.color} text-white` : 
                      "border-white/20 text-white hover:bg-white/10"
                    }
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {config.name}
                  </Button>
                );
              })}
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
                
                {/* Calibration indicator */}
                {isStarted && !isCalibrated && (
                  <div className="absolute top-4 left-4 bg-yellow-500/80 text-black px-3 py-1 rounded-lg text-sm font-medium">
                    Calibrating... Stand upright
                  </div>
                )}
                
                {/* Control buttons */}
                {!isStarted ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Button
                      size="lg"
                      onClick={startCameraAndDetection}
                      disabled={!isInitialized}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <Camera className="mr-2" />
                      Start Tracking
                    </Button>
                  </div>
                ) : (
                  <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={togglePause}
                      className="bg-black/50 backdrop-blur border-white/20 text-white"
                    >
                      {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReset}
                      className="bg-black/50 backdrop-blur border-white/20 text-white"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={stopCamera}
                      className="bg-black/50 backdrop-blur border-white/20 text-white"
                    >
                      <CameraOff className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Metrics Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            {/* Real-time Metrics */}
            <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-4">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Real-time Metrics
              </h3>
              <div className="space-y-3">
                <MetricRow label="Speed" value={formattedMetrics.speed} />
                <MetricRow label="Distance" value={formattedMetrics.distance} />
                <MetricRow label="Power" value={formattedMetrics.power} />
                <MetricRow label="Cadence" value={formattedMetrics.cadence} />
                
                {selectedSport === 'running' && (
                  <>
                    <MetricRow label="Stride Length" value={formattedMetrics.strideLength || '0m'} />
                    <MetricRow label="Vertical Osc." value={formattedMetrics.verticalOscillation || '0cm'} />
                  </>
                )}
                
                {selectedSport === 'jumping' && (
                  <>
                    <MetricRow label="Jump Height" value={formattedMetrics.jumpHeight || '0cm'} />
                    <MetricRow label="Flight Time" value={formattedMetrics.flightTime || '0ms'} />
                  </>
                )}
              </div>
            </Card>

            {/* Performance Level */}
            <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-4">
              <h3 className="text-white font-semibold mb-4">Performance Level</h3>
              <div className="flex items-center justify-center">
                <Badge 
                  className={`text-lg py-2 px-4 ${
                    performanceLevel === 'elite' ? 'bg-purple-600' :
                    performanceLevel === 'advanced' ? 'bg-green-600' :
                    performanceLevel === 'intermediate' ? 'bg-blue-600' :
                    'bg-gray-600'
                  }`}
                >
                  {performanceLevel.toUpperCase()}
                </Badge>
              </div>
            </Card>

            {/* Peak Values */}
            <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-4">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Peak Performance
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Max Speed</span>
                  <span className="text-white font-medium">
                    {(metrics.speed.max * 3.6).toFixed(1)} km/h
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Peak Power</span>
                  <span className="text-white font-medium">
                    {metrics.power.peak.toFixed(0)}W
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Max Acceleration</span>
                  <span className="text-white font-medium">
                    {metrics.acceleration.max.toFixed(1)} m/s²
                  </span>
                </div>
              </div>
            </Card>

            {/* Settings */}
            <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-4">
              <h3 className="text-white font-semibold mb-4">Athlete Profile</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-300">Height (m)</label>
                  <input
                    type="number"
                    value={athleteHeight}
                    onChange={(e) => setAthleteHeight(parseFloat(e.target.value))}
                    step="0.01"
                    className="w-full mt-1 px-3 py-1 bg-white/10 border border-white/20 rounded text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300">Weight (kg)</label>
                  <input
                    type="number"
                    value={athleteMass}
                    onChange={(e) => setAthleteMass(parseFloat(e.target.value))}
                    step="0.1"
                    className="w-full mt-1 px-3 py-1 bg-white/10 border border-white/20 rounded text-white"
                  />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-black/20 backdrop-blur-xl border-white/10 p-6">
            <h3 className="text-white font-semibold mb-4">Edge-Optimized Performance Tracking</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
              <div>
                <h4 className="text-orange-400 font-medium mb-2">Real-time Analysis</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>30+ FPS processing on device</li>
                  <li>No cloud dependency</li>
                  <li>Instant metric calculation</li>
                  <li>Auto-calibration system</li>
                </ul>
              </div>
              <div>
                <h4 className="text-blue-400 font-medium mb-2">Advanced Metrics</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Speed & acceleration tracking</li>
                  <li>Power output estimation</li>
                  <li>Gait analysis for runners</li>
                  <li>Jump height detection</li>
                </ul>
              </div>
              <div>
                <h4 className="text-green-400 font-medium mb-2">Sport-Specific</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Running pace & cadence</li>
                  <li>Jump flight time</li>
                  <li>Weightlifting velocity</li>
                  <li>Cycling power zones</li>
                </ul>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-400 text-sm">{label}</span>
    <span className="text-white font-medium">{value}</span>
  </div>
);