'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, XCircle, Activity, Cpu, Database } from 'lucide-react'
import { PoseDetectionMonitor, PerformanceMetrics } from '@/lib/monitoring/PoseDetectionMonitor'

interface PoseDetectionDebugPanelProps {
  monitor: PoseDetectionMonitor
  isVisible?: boolean
}

export function PoseDetectionDebugPanel({ monitor, isVisible = true }: PoseDetectionDebugPanelProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(monitor.getMetrics())
      setSummary(monitor.getPerformanceSummary())
    }, 100)

    return () => clearInterval(interval)
  }, [monitor])

  if (!isVisible || !metrics) return null

  const getFPSColor = (fps: number) => {
    if (fps >= 25) return 'text-green-500'
    if (fps >= 15) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getStatusIcon = () => {
    if (summary?.isDegraded) {
      return <XCircle className="w-4 h-4 text-red-500" />
    }
    if (metrics.fps > 0) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }
    return <AlertCircle className="w-4 h-4 text-yellow-500" />
  }

  return (
    <Card className="fixed bottom-4 right-4 p-4 bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md z-50">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <h3 className="font-semibold">Pose Detection Monitor</h3>
        </div>
        <Badge variant={summary?.isDegraded ? 'destructive' : 'default'}>
          {summary?.isDegraded ? 'DEGRADED' : 'HEALTHY'}
        </Badge>
      </div>

      <div className="mt-4 space-y-3">
        {/* Primary Metrics */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <div>
              <div className={`font-mono font-bold ${getFPSColor(metrics.fps)}`}>
                {metrics.fps} FPS
              </div>
              <div className="text-xs text-white/60">Frame Rate</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            <div>
              <div className="font-mono">
                {metrics.frameTime.toFixed(1)}ms
              </div>
              <div className="text-xs text-white/60">Frame Time</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <div>
              <div className="font-mono">
                {metrics.memoryUsage?.toFixed(1) || '---'} MB
              </div>
              <div className="text-xs text-white/60">Memory</div>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <>
            <div className="border-t border-white/20 pt-3 space-y-2">
              <h4 className="text-sm font-semibold">Performance Breakdown</h4>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Detection Time:</span>
                  <span className="font-mono">{metrics.detectionTime.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Render Time:</span>
                  <span className="font-mono">{metrics.renderTime.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Frames:</span>
                  <span className="font-mono">{metrics.totalFrames}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dropped Frames:</span>
                  <span className={`font-mono ${metrics.droppedFrames > 0 ? 'text-red-500' : ''}`}>
                    {metrics.droppedFrames} ({((metrics.droppedFrames / metrics.totalFrames) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Detection Stats */}
            {summary?.detection && (
              <div className="border-t border-white/20 pt-3 space-y-2">
                <h4 className="text-sm font-semibold">Detection Quality</h4>
                
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Avg Keypoints:</span>
                    <span className="font-mono">{summary.detection.avgKeypointsDetected.toFixed(1)}/17</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Confidence:</span>
                    <span className="font-mono">{(summary.detection.avgConfidence * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Errors */}
            {summary?.recentErrors?.length > 0 && (
              <div className="border-t border-white/20 pt-3 space-y-2">
                <h4 className="text-sm font-semibold text-red-400">Recent Errors</h4>
                
                <div className="space-y-1 text-xs">
                  {summary.recentErrors.slice(-3).map((error: any, i: number) => (
                    <div key={i} className="text-red-300">
                      [{error.type}] {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-white/20 pt-3 flex gap-2">
              <button
                onClick={() => {
                  const data = monitor.exportData()
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `pose-detection-debug-${Date.now()}.json`
                  a.click()
                }}
                className="text-xs px-3 py-1 bg-white/10 rounded hover:bg-white/20 transition-colors"
              >
                Export Debug Data
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="text-xs px-3 py-1 bg-white/10 rounded hover:bg-white/20 transition-colors"
              >
                Reload App
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}