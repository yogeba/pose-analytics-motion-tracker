'use client'

import { useCallback, useRef, useState } from 'react'

export interface CameraConstraints {
  video: {
    facingMode?: string
    width?: { ideal?: number; min?: number; max?: number }
    height?: { ideal?: number; min?: number; max?: number }
    frameRate?: { ideal?: number; min?: number; max?: number }
    aspectRatio?: number
  }
}

export interface CameraStatus {
  isActive: boolean
  stream: MediaStream | null
  error: string | null
  constraints: CameraConstraints | null
  deviceInfo: {
    label: string
    deviceId: string
    kind: string
  } | null
}

export const useRobustCamera = () => {
  const [status, setStatus] = useState<CameraStatus>({
    isActive: false,
    stream: null,
    error: null,
    constraints: null,
    deviceInfo: null
  })

  const currentStreamRef = useRef<MediaStream | null>(null)

  // Progressive fallback constraints - try best quality first, then fallback
  const getFallbackConstraints = (): CameraConstraints[] => [
    // High quality (ideal for desktop)
    {
      video: {
        facingMode: 'user',
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30, min: 15 }
      }
    },
    // Medium quality (good for most devices)
    {
      video: {
        facingMode: 'user',
        width: { ideal: 640, min: 320 },
        height: { ideal: 480, min: 240 },
        frameRate: { ideal: 30, min: 15 }
      }
    },
    // Low quality (for older devices)
    {
      video: {
        facingMode: 'user',
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 15, min: 10 }
      }
    },
    // Basic constraint (last resort)
    {
      video: {
        facingMode: 'user'
      }
    },
    // Minimal constraint (absolute fallback)
    {
      video: true as any
    }
  ]

  const checkCameraAvailability = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false
      }

      // Check if any video input devices are available
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      return videoDevices.length > 0
    } catch (error) {
      console.warn('Camera availability check failed:', error)
      return false
    }
  }, [])

  const startCamera = useCallback(async (videoElement: HTMLVideoElement): Promise<boolean> => {
    try {
      // Stop any existing stream first
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop())
        currentStreamRef.current = null
      }

      // Check camera availability
      const isAvailable = await checkCameraAvailability()
      if (!isAvailable) {
        throw new Error('No camera devices found or camera API not supported')
      }

      // Try progressive fallback constraints
      const constraintsList = getFallbackConstraints()
      let lastError: Error | null = null

      for (let i = 0; i < constraintsList.length; i++) {
        const constraints = constraintsList[i]
        
        try {
          console.log(`Trying camera constraint ${i + 1}/${constraintsList.length}:`, constraints)
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          
          // Validate stream
          const videoTracks = stream.getVideoTracks()
          if (videoTracks.length === 0) {
            stream.getTracks().forEach(track => track.stop())
            throw new Error('No video tracks in stream')
          }

          const videoTrack = videoTracks[0]
          const settings = videoTrack.getSettings()
          
          console.log('Camera started successfully with settings:', settings)

          // Set video source
          videoElement.srcObject = stream
          
          // Wait for video to be ready
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Video load timeout'))
            }, 10000) // 10 second timeout

            const handleLoadedData = () => {
              clearTimeout(timeout)
              videoElement.removeEventListener('loadeddata', handleLoadedData)
              videoElement.removeEventListener('error', handleError)
              resolve()
            }

            const handleError = () => {
              clearTimeout(timeout)
              videoElement.removeEventListener('loadeddata', handleLoadedData)
              videoElement.removeEventListener('error', handleError)
              reject(new Error('Video element error'))
            }

            videoElement.addEventListener('loadeddata', handleLoadedData)
            videoElement.addEventListener('error', handleError)

            // Also resolve if video is already ready
            if (videoElement.readyState >= 2) {
              handleLoadedData()
            }
          })

          // Try to play the video
          try {
            await videoElement.play()
          } catch (playError) {
            console.warn('Video autoplay failed (this is normal):', playError)
            // Don't throw here - autoplay restrictions are common
          }

          // Store successful stream and update status
          currentStreamRef.current = stream
          
          setStatus({
            isActive: true,
            stream,
            error: null,
            constraints,
            deviceInfo: {
              label: videoTrack.label || 'Camera',
              deviceId: videoTrack.getSettings().deviceId || 'unknown',
              kind: videoTrack.kind
            }
          })

          return true

        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown camera error')
          console.warn(`Camera constraint ${i + 1} failed:`, lastError.message)
          
          // Continue to next constraint unless this is the last one
          if (i === constraintsList.length - 1) {
            throw lastError
          }
        }
      }

      throw lastError || new Error('All camera constraints failed')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown camera error'
      console.error('Camera initialization failed:', errorMessage)
      
      setStatus({
        isActive: false,
        stream: null,
        error: errorMessage,
        constraints: null,
        deviceInfo: null
      })

      return false
    }
  }, [checkCameraAvailability])

  const stopCamera = useCallback(() => {
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach(track => {
        track.stop()
        console.log('Stopped camera track:', track.kind, track.label)
      })
      currentStreamRef.current = null
    }

    setStatus({
      isActive: false,
      stream: null,
      error: null,
      constraints: null,
      deviceInfo: null
    })
  }, [])

  const switchCamera = useCallback(async (videoElement: HTMLVideoElement): Promise<boolean> => {
    try {
      // Get available video devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      if (videoDevices.length < 2) {
        throw new Error('Only one camera available')
      }

      // Find current device
      const currentDeviceId = status.deviceInfo?.deviceId
      const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId)
      const nextIndex = (currentIndex + 1) % videoDevices.length
      const nextDevice = videoDevices[nextIndex]

      // Stop current camera
      stopCamera()

      // Start camera with specific device
      const constraints: CameraConstraints = {
        video: {
          deviceId: { exact: nextDevice.deviceId } as any,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      videoElement.srcObject = stream
      await videoElement.play()

      currentStreamRef.current = stream
      const videoTrack = stream.getVideoTracks()[0]
      
      setStatus({
        isActive: true,
        stream,
        error: null,
        constraints,
        deviceInfo: {
          label: videoTrack.label || nextDevice.label || 'Camera',
          deviceId: nextDevice.deviceId,
          kind: videoTrack.kind
        }
      })

      return true

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Camera switch failed'
      console.error('Camera switch failed:', errorMessage)
      
      setStatus(prev => ({
        ...prev,
        error: errorMessage
      }))

      return false
    }
  }, [status.deviceInfo?.deviceId, stopCamera])

  const restartCamera = useCallback(async (videoElement: HTMLVideoElement): Promise<boolean> => {
    console.log('Restarting camera...')
    stopCamera()
    await new Promise(resolve => setTimeout(resolve, 100)) // Brief delay
    return startCamera(videoElement)
  }, [startCamera, stopCamera])

  return {
    status,
    startCamera,
    stopCamera,
    switchCamera,
    restartCamera,
    checkCameraAvailability
  }
}