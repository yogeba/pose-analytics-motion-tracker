'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SessionManager } from '@/lib/domain/SessionManager'
import { MovementAnalytics } from '@/lib/analytics/MovementAnalytics'
import { 
  Activity, 
  TrendingUp, 
  Timer, 
  Zap, 
  Target,
  BarChart3,
  Calendar,
  Download,
  Play,
  Users,
  Medal,
  Gauge
} from 'lucide-react'

interface SessionSummary {
  sessionId: string
  startTime: number
  endTime: number
  duration: number
  sport: string
  metrics: {
    averageSpeed: number
    maxSpeed: number
    totalDistance: number
    averagePower: number
    maxPower: number
    cadence?: number
    jumpHeight?: number
    performanceLevel: string
    avgConfidence: number
  }
}

interface AggregatedMetrics {
  totalSessions: number
  totalDuration: number
  totalDistance: number
  averageSpeed: number
  averagePower: number
  bestSpeed: number
  bestPower: number
  bestJumpHeight: number
  favoriteActivity: string
  performanceTrend: 'improving' | 'stable' | 'declining'
  weeklyProgress: number[]
}

export default function DashboardPage() {
  const [sessionManager] = useState(() => new SessionManager())
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([])
  const [aggregatedMetrics, setAggregatedMetrics] = useState<AggregatedMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | 'all'>('week')

  useEffect(() => {
    loadDashboardData()
  }, [selectedTimeRange])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const sessions = await sessionManager.getAllSessions()
      
      // Filter sessions based on time range
      const now = Date.now()
      const timeRanges = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        all: Infinity
      }
      
      const filteredSessions = sessions.filter(session => {
        return now - session.startTime <= timeRanges[selectedTimeRange]
      })

      // Process recent sessions
      const summaries: SessionSummary[] = filteredSessions.slice(-10).reverse().map(session => {
        const frames = session.frames || []
        const metrics = frames.reduce((acc, frame) => {
          if (frame.performanceMetrics) {
            acc.speeds.push(frame.performanceMetrics.speed.current)
            acc.distances.push(frame.performanceMetrics.distance.total)
            acc.powers.push(frame.performanceMetrics.power.current)
            if (frame.performanceMetrics.cadence) acc.cadences.push(frame.performanceMetrics.cadence)
            if (frame.performanceMetrics.jumpHeight) acc.jumpHeights.push(frame.performanceMetrics.jumpHeight)
            acc.performanceLevel = frame.performanceMetrics.performanceLevel
          }
          if (frame.movementMetrics?.confidence) {
            acc.confidences.push(frame.movementMetrics.confidence)
          }
          return acc
        }, {
          speeds: [] as number[],
          distances: [] as number[],
          powers: [] as number[],
          cadences: [] as number[],
          jumpHeights: [] as number[],
          confidences: [] as number[],
          performanceLevel: 'beginner'
        })

        const avgSpeed = metrics.speeds.length > 0 ? metrics.speeds.reduce((a, b) => a + b, 0) / metrics.speeds.length : 0
        const maxSpeed = metrics.speeds.length > 0 ? Math.max(...metrics.speeds) : 0
        const totalDistance = metrics.distances.length > 0 ? Math.max(...metrics.distances) : 0
        const avgPower = metrics.powers.length > 0 ? metrics.powers.reduce((a, b) => a + b, 0) / metrics.powers.length : 0
        const maxPower = metrics.powers.length > 0 ? Math.max(...metrics.powers) : 0
        const avgCadence = metrics.cadences.length > 0 ? metrics.cadences.reduce((a, b) => a + b, 0) / metrics.cadences.length : undefined
        const maxJumpHeight = metrics.jumpHeights.length > 0 ? Math.max(...metrics.jumpHeights) : undefined
        const avgConfidence = metrics.confidences.length > 0 ? metrics.confidences.reduce((a, b) => a + b, 0) / metrics.confidences.length : 0

        return {
          sessionId: session.sessionId,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.endTime - session.startTime,
          sport: session.metadata?.sport || 'general',
          metrics: {
            averageSpeed: avgSpeed,
            maxSpeed: maxSpeed,
            totalDistance: totalDistance,
            averagePower: avgPower,
            maxPower: maxPower,
            cadence: avgCadence,
            jumpHeight: maxJumpHeight,
            performanceLevel: metrics.performanceLevel,
            avgConfidence: avgConfidence
          }
        }
      })

      setRecentSessions(summaries)

      // Calculate aggregated metrics
      if (filteredSessions.length > 0) {
        const sportCounts: Record<string, number> = {}
        let totalDuration = 0
        let totalDistance = 0
        const allSpeeds: number[] = []
        const allPowers: number[] = []
        const allJumpHeights: number[] = []

        filteredSessions.forEach(session => {
          const sport = session.metadata?.sport || 'general'
          sportCounts[sport] = (sportCounts[sport] || 0) + 1
          totalDuration += session.endTime - session.startTime

          const frames = session.frames || []
          frames.forEach(frame => {
            if (frame.performanceMetrics) {
              allSpeeds.push(frame.performanceMetrics.speed.current)
              allPowers.push(frame.performanceMetrics.power.current)
              if (frame.performanceMetrics.jumpHeight) {
                allJumpHeights.push(frame.performanceMetrics.jumpHeight)
              }
              if (frame.performanceMetrics.distance.total > totalDistance) {
                totalDistance = frame.performanceMetrics.distance.total
              }
            }
          })
        })

        // Calculate weekly progress (simplified - last 7 data points)
        const weeklyProgress = Array(7).fill(0)
        const sessionsPerDay: Record<number, number> = {}
        
        filteredSessions.forEach(session => {
          const dayIndex = Math.floor((now - session.startTime) / (24 * 60 * 60 * 1000))
          if (dayIndex < 7) {
            sessionsPerDay[dayIndex] = (sessionsPerDay[dayIndex] || 0) + 1
          }
        })

        for (let i = 0; i < 7; i++) {
          weeklyProgress[6 - i] = sessionsPerDay[i] || 0
        }

        // Determine performance trend
        const recentAvgSpeed = summaries.slice(0, 3).reduce((sum, s) => sum + s.metrics.averageSpeed, 0) / Math.min(3, summaries.length)
        const olderAvgSpeed = summaries.slice(-3).reduce((sum, s) => sum + s.metrics.averageSpeed, 0) / Math.min(3, summaries.length)
        const performanceTrend = recentAvgSpeed > olderAvgSpeed * 1.05 ? 'improving' : 
                                recentAvgSpeed < olderAvgSpeed * 0.95 ? 'declining' : 'stable'

        const favoriteActivity = Object.entries(sportCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0]

        setAggregatedMetrics({
          totalSessions: filteredSessions.length,
          totalDuration,
          totalDistance,
          averageSpeed: allSpeeds.length > 0 ? allSpeeds.reduce((a, b) => a + b, 0) / allSpeeds.length : 0,
          averagePower: allPowers.length > 0 ? allPowers.reduce((a, b) => a + b, 0) / allPowers.length : 0,
          bestSpeed: allSpeeds.length > 0 ? Math.max(...allSpeeds) : 0,
          bestPower: allPowers.length > 0 ? Math.max(...allPowers) : 0,
          bestJumpHeight: allJumpHeights.length > 0 ? Math.max(...allJumpHeights) : 0,
          favoriteActivity,
          performanceTrend,
          weeklyProgress
        })
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const exportData = async () => {
    try {
      const sessions = await sessionManager.getAllSessions()
      const dataStr = JSON.stringify(sessions, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pose-analytics-export-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPerformanceBadgeColor = (level: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-blue-500',
      intermediate: 'bg-green-500',
      advanced: 'bg-purple-500',
      elite: 'bg-red-500'
    }
    return colors[level] || 'bg-gray-500'
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-500" />
    if (trend === 'declining') return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
    return <Activity className="h-4 w-4 text-yellow-500" />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold">Performance Dashboard</h1>
            <p className="text-muted-foreground mt-2">Track your athletic progress and achievements</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedTimeRange === 'week' ? 'default' : 'outline'}
              onClick={() => setSelectedTimeRange('week')}
              size="sm"
            >
              Week
            </Button>
            <Button
              variant={selectedTimeRange === 'month' ? 'default' : 'outline'}
              onClick={() => setSelectedTimeRange('month')}
              size="sm"
            >
              Month
            </Button>
            <Button
              variant={selectedTimeRange === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedTimeRange('all')}
              size="sm"
            >
              All Time
            </Button>
            <Button variant="outline" onClick={exportData} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {aggregatedMetrics && (
          <>
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{aggregatedMetrics.totalSessions}</div>
                  <div className="flex items-center mt-2">
                    {getTrendIcon(aggregatedMetrics.performanceTrend)}
                    <span className="text-xs text-muted-foreground ml-2">
                      {aggregatedMetrics.performanceTrend}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
                  <Timer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatDuration(aggregatedMetrics.totalDuration)}</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Avg: {formatDuration(aggregatedMetrics.totalDuration / aggregatedMetrics.totalSessions)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Best Speed</CardTitle>
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{aggregatedMetrics.bestSpeed.toFixed(1)} m/s</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Avg: {aggregatedMetrics.averageSpeed.toFixed(1)} m/s
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Peak Power</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{aggregatedMetrics.bestPower.toFixed(0)} W</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Avg: {aggregatedMetrics.averagePower.toFixed(0)} W
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Favorite Activity</CardTitle>
                  <Medal className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize">{aggregatedMetrics.favoriteActivity}</div>
                  <p className="text-xs text-muted-foreground mt-2">Most practiced sport</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(aggregatedMetrics.totalDistance / 1000).toFixed(2)} km</div>
                  <p className="text-xs text-muted-foreground mt-2">Cumulative distance</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Best Jump</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {aggregatedMetrics.bestJumpHeight > 0 ? `${aggregatedMetrics.bestJumpHeight.toFixed(2)} m` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Personal record</p>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Weekly Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between h-32 gap-1">
                  {aggregatedMetrics.weeklyProgress.map((sessions, index) => {
                    const height = sessions > 0 ? Math.max(20, (sessions / Math.max(...aggregatedMetrics.weeklyProgress)) * 100) : 5
                    return (
                      <div
                        key={index}
                        className="flex-1 bg-primary/20 hover:bg-primary/30 transition-colors rounded-t"
                        style={{ height: `${height}%` }}
                        title={`${sessions} sessions`}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>7d ago</span>
                  <span>Today</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No sessions recorded yet</p>
                <Button className="mt-4" onClick={() => window.location.href = '/'}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Training
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentSessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border rounded-lg gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="capitalize">
                          {session.sport}
                        </Badge>
                        <Badge className={getPerformanceBadgeColor(session.metrics.performanceLevel)}>
                          {session.metrics.performanceLevel}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(session.startTime)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="ml-2 font-medium">{formatDuration(session.duration)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Speed:</span>
                          <span className="ml-2 font-medium">{session.metrics.averageSpeed.toFixed(1)} m/s</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Distance:</span>
                          <span className="ml-2 font-medium">{session.metrics.totalDistance.toFixed(1)} m</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Power:</span>
                          <span className="ml-2 font-medium">{session.metrics.averagePower.toFixed(0)} W</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        // Navigate to session details (to be implemented)
                        console.log('View session:', session.sessionId)
                      }}>
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}