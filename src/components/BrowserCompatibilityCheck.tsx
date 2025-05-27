'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'

export interface BrowserCompatibility {
  mediaRecorder: boolean
  webRTC: boolean
  canvas: boolean
  captureStream: boolean
  webGL: boolean
  overall: boolean
  browser: string
  issues: string[]
}

export function checkBrowserCompatibility(): BrowserCompatibility {
  const issues: string[] = []
  
  // Detect browser
  const userAgent = navigator.userAgent
  let browser = 'Unknown'
  if (userAgent.includes('Chrome')) browser = 'Chrome'
  else if (userAgent.includes('Firefox')) browser = 'Firefox'
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari'
  else if (userAgent.includes('Edge')) browser = 'Edge'
  
  // Check MediaRecorder
  const mediaRecorder = typeof MediaRecorder !== 'undefined' && 
    typeof MediaRecorder.isTypeSupported === 'function' &&
    (MediaRecorder.isTypeSupported('video/webm') || MediaRecorder.isTypeSupported('video/mp4'))
  
  if (!mediaRecorder) {
    issues.push('Video recording not supported')
  }
  
  // Check WebRTC
  const webRTC = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  if (!webRTC) {
    issues.push('Camera access not supported')
  }
  
  // Check Canvas
  const canvas = typeof HTMLCanvasElement !== 'undefined'
  if (!canvas) {
    issues.push('Canvas rendering not supported')
  }
  
  // Check captureStream
  const captureStream = canvas && typeof HTMLCanvasElement.prototype.captureStream === 'function'
  if (!captureStream) {
    issues.push('Canvas recording with overlay not supported')
  }
  
  // Check WebGL
  let webGL = false
  try {
    const testCanvas = document.createElement('canvas')
    webGL = !!(testCanvas.getContext('webgl') || testCanvas.getContext('webgl2'))
  } catch (e) {
    webGL = false
  }
  if (!webGL) {
    issues.push('WebGL not supported - pose detection may be slow')
  }
  
  const overall = mediaRecorder && webRTC && canvas && webGL
  
  return {
    mediaRecorder,
    webRTC,
    canvas,
    captureStream,
    webGL,
    overall,
    browser,
    issues
  }
}

export function BrowserCompatibilityCheck() {
  const [compatibility, setCompatibility] = useState<BrowserCompatibility | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    setCompatibility(checkBrowserCompatibility())
  }, [])

  if (!compatibility || compatibility.overall) {
    return null
  }

  return (
    <Card className="fixed top-4 right-4 p-4 bg-yellow-900/90 backdrop-blur-md border-yellow-600 text-white max-w-sm z-50">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Browser Compatibility Warning</h3>
          <p className="text-sm text-yellow-200 mb-2">
            Some features may not work properly in {compatibility.browser}.
          </p>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-yellow-300 hover:text-white underline"
          >
            {showDetails ? 'Hide' : 'Show'} details
          </button>
          
          {showDetails && (
            <div className="mt-3 space-y-2 text-xs">
              <div className="space-y-1">
                <CompatibilityItem 
                  label="Camera Access" 
                  supported={compatibility.webRTC} 
                />
                <CompatibilityItem 
                  label="Video Recording" 
                  supported={compatibility.mediaRecorder} 
                />
                <CompatibilityItem 
                  label="Pose Detection" 
                  supported={compatibility.webGL} 
                />
                <CompatibilityItem 
                  label="Recording with Overlay" 
                  supported={compatibility.captureStream} 
                />
              </div>
              
              {compatibility.issues.length > 0 && (
                <div className="mt-2 pt-2 border-t border-yellow-700">
                  <p className="font-medium mb-1">Issues:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-yellow-200">
                    {compatibility.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="mt-3 pt-2 border-t border-yellow-700">
                <p className="text-yellow-200">
                  For best experience, use Chrome or Edge browser.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function CompatibilityItem({ label, supported }: { label: string; supported: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      {supported ? (
        <CheckCircle className="w-3 h-3 text-green-400" />
      ) : (
        <XCircle className="w-3 h-3 text-red-400" />
      )}
    </div>
  )
}