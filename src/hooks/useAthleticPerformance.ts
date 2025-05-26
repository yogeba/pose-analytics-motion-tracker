import { useRef, useState, useCallback, useEffect } from 'react';
import { Keypoint } from '@tensorflow-models/pose-detection';
import { AthleticPerformanceTracker, PerformanceMetrics } from '@/lib/analytics/AthleticPerformanceTracker';

export interface UseAthleticPerformanceProps {
  athleteHeight?: number; // meters
  athleteMass?: number; // kg
  sport?: 'running' | 'jumping' | 'cycling' | 'weightlifting' | 'general';
  autoCalibrate?: boolean;
}

export interface AthleticPerformanceState {
  metrics: PerformanceMetrics;
  sportMetrics: any;
  isCalibrated: boolean;
  performanceLevel: 'beginner' | 'intermediate' | 'advanced' | 'elite';
}

export const useAthleticPerformance = ({
  athleteHeight = 1.75,
  athleteMass = 70,
  sport = 'general',
  autoCalibrate = true
}: UseAthleticPerformanceProps = {}) => {
  const trackerRef = useRef<AthleticPerformanceTracker | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(!autoCalibrate);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    speed: { instantaneous: 0, average: 0, max: 0 },
    distance: { total: 0, horizontal: 0, vertical: 0 },
    acceleration: { current: 0, max: 0 },
    power: { current: 0, average: 0, peak: 0 },
    cadence: 0,
    strideLength: 0,
    verticalOscillation: 0,
    groundContactTime: 0,
    flightTime: 0,
    jumpHeight: 0
  });
  const [sportMetrics, setSportMetrics] = useState<any>({});
  const [performanceLevel, setPerformanceLevel] = useState<'beginner' | 'intermediate' | 'advanced' | 'elite'>('beginner');

  // Initialize tracker
  useEffect(() => {
    trackerRef.current = new AthleticPerformanceTracker({
      athleteHeight,
      athleteMass,
      pixelsPerMeter: autoCalibrate ? undefined : 500
    });
  }, [athleteHeight, athleteMass, autoCalibrate]);

  // Process keypoints
  const processKeypoints = useCallback((keypoints: Keypoint[], timestamp?: number) => {
    if (!trackerRef.current || keypoints.length === 0) return;

    const ts = timestamp || Date.now();

    // Auto-calibrate on first frame with good pose
    if (autoCalibrate && !isCalibrated) {
      const noseConfidence = keypoints[0]?.score || 0;
      const leftAnkleConfidence = keypoints[15]?.score || 0;
      const rightAnkleConfidence = keypoints[16]?.score || 0;
      
      if (noseConfidence > 0.7 && leftAnkleConfidence > 0.7 && rightAnkleConfidence > 0.7) {
        trackerRef.current.calibrateFromPose(keypoints);
        setIsCalibrated(true);
      }
    }

    // Get performance metrics
    const newMetrics = trackerRef.current.addFrame(keypoints, ts);
    setMetrics(newMetrics);

    // Get sport-specific metrics
    if (sport !== 'general') {
      const sportSpecific = trackerRef.current.getSportMetrics(sport);
      setSportMetrics(sportSpecific);
    }

    // Determine performance level
    updatePerformanceLevel(newMetrics, sport);
  }, [autoCalibrate, isCalibrated, sport]);

  // Update performance level based on metrics
  const updatePerformanceLevel = (metrics: PerformanceMetrics, sport: string) => {
    let level: 'beginner' | 'intermediate' | 'advanced' | 'elite' = 'beginner';

    switch (sport) {
      case 'running':
        // Based on running speed (m/s)
        if (metrics.speed.average > 5.5) level = 'elite'; // Sub 3:00 min/km
        else if (metrics.speed.average > 4.5) level = 'advanced'; // Sub 3:40 min/km
        else if (metrics.speed.average > 3.5) level = 'intermediate'; // Sub 4:45 min/km
        break;

      case 'jumping':
        // Based on jump height (cm)
        if (metrics.jumpHeight > 60) level = 'elite';
        else if (metrics.jumpHeight > 45) level = 'advanced';
        else if (metrics.jumpHeight > 30) level = 'intermediate';
        break;

      case 'weightlifting':
        // Based on bar velocity (m/s)
        if (metrics.speed.instantaneous > 1.0) level = 'elite';
        else if (metrics.speed.instantaneous > 0.7) level = 'advanced';
        else if (metrics.speed.instantaneous > 0.4) level = 'intermediate';
        break;

      case 'cycling':
        // Based on power output (W/kg)
        const powerPerKg = metrics.power.average / athleteMass;
        if (powerPerKg > 5) level = 'elite';
        else if (powerPerKg > 3.5) level = 'advanced';
        else if (powerPerKg > 2.5) level = 'intermediate';
        break;

      default:
        // General fitness based on sustained speed
        if (metrics.speed.average > 3.0) level = 'advanced';
        else if (metrics.speed.average > 2.0) level = 'intermediate';
    }

    setPerformanceLevel(level);
  };

  // Reset tracking
  const reset = useCallback(() => {
    trackerRef.current?.reset();
    setMetrics({
      speed: { instantaneous: 0, average: 0, max: 0 },
      distance: { total: 0, horizontal: 0, vertical: 0 },
      acceleration: { current: 0, max: 0 },
      power: { current: 0, average: 0, peak: 0 },
      cadence: 0,
      strideLength: 0,
      verticalOscillation: 0,
      groundContactTime: 0,
      flightTime: 0,
      jumpHeight: 0
    });
    setSportMetrics({});
    if (autoCalibrate) {
      setIsCalibrated(false);
    }
  }, [autoCalibrate]);

  // Get formatted metrics for display
  const getFormattedMetrics = useCallback(() => {
    const formatSpeed = (speed: number) => {
      if (sport === 'running') {
        const pace = speed > 0 ? 1000 / speed / 60 : 0;
        const minutes = Math.floor(pace);
        const seconds = Math.round((pace - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
      }
      return `${(speed * 3.6).toFixed(1)} km/h`;
    };

    const formatPower = (power: number) => {
      const powerPerKg = power / athleteMass;
      return `${power.toFixed(0)}W (${powerPerKg.toFixed(1)}W/kg)`;
    };

    return {
      speed: formatSpeed(metrics.speed.average),
      distance: `${metrics.distance.total.toFixed(1)}m`,
      power: formatPower(metrics.power.average),
      cadence: `${Math.round(metrics.cadence)} spm`,
      ...(sport === 'running' && {
        strideLength: `${metrics.strideLength.toFixed(2)}m`,
        verticalOscillation: `${metrics.verticalOscillation.toFixed(1)}cm`
      }),
      ...(sport === 'jumping' && {
        jumpHeight: `${metrics.jumpHeight.toFixed(1)}cm`,
        flightTime: `${metrics.flightTime.toFixed(0)}ms`
      })
    };
  }, [metrics, sport, athleteMass]);

  return {
    metrics,
    sportMetrics,
    isCalibrated,
    performanceLevel,
    processKeypoints,
    reset,
    getFormattedMetrics
  };
};