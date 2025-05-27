import { VideoRecordingOptions, RecordingState } from './types'

export class VideoRecorderEnhanced {
  private mediaRecorder?: MediaRecorder
  private recordedChunks: Blob[] = []
  private state: RecordingState = {
    isRecording: false,
    duration: 0
  }
  private overlayCanvas?: HTMLCanvasElement
  private compositeCanvas?: HTMLCanvasElement
  private compositeStream?: MediaStream
  private startTime?: number
  private durationInterval?: NodeJS.Timeout
  private recordingAttempts = 0
  private maxAttempts = 3

  async initialize(
    videoElement: HTMLVideoElement,
    overlayCanvas?: HTMLCanvasElement
  ): Promise<boolean> {
    try {
      this.overlayCanvas = overlayCanvas
      
      // Check browser support
      if (!this.isSupported()) {
        throw new Error('MediaRecorder is not supported in this browser')
      }
      
      return true
    } catch (error) {
      console.error('Failed to initialize video recorder:', error)
      return false
    }
  }

  async startRecording(
    videoElement: HTMLVideoElement,
    options: VideoRecordingOptions = {
      quality: 'medium',
      frameRate: 30,
      includeOverlay: true,
      format: 'webm'
    }
  ): Promise<boolean> {
    try {
      if (this.state.isRecording) {
        console.warn('Recording already in progress')
        return false
      }

      // Reset state
      this.recordedChunks = []
      this.state = {
        isRecording: false,
        duration: 0
      }
      this.recordingAttempts++

      // Enhanced validation
      const validationResult = await this.validateRecordingSetup(videoElement)
      if (!validationResult.isValid) {
        throw new Error(validationResult.error || 'Recording setup validation failed')
      }

      // Get the video stream with fallback
      const videoStream = await this.getVideoStream(videoElement)
      
      let recordingStream: MediaStream

      // Try composite stream if overlay requested
      if (options.includeOverlay && this.overlayCanvas) {
        try {
          recordingStream = await this.createCompositeStream(
            videoElement,
            this.overlayCanvas,
            options
          )
        } catch (compositeError) {
          console.warn('Composite stream failed, falling back to direct recording:', compositeError)
          recordingStream = videoStream
          options.includeOverlay = false
        }
      } else {
        recordingStream = videoStream
      }

      // Try different MIME types
      const { mimeType, recorder } = await this.createMediaRecorder(recordingStream, options)
      this.mediaRecorder = recorder

      // Set up event listeners with better error handling
      this.setupRecorderEvents()

      // Start recording with smaller chunks for better compatibility
      this.mediaRecorder.start(100) // Capture data every 100ms
      this.startTime = Date.now()
      this.state.isRecording = true

      // Start duration tracking
      this.durationInterval = setInterval(() => {
        if (this.startTime) {
          this.state.duration = Date.now() - this.startTime
        }
      }, 100)

      console.log('Video recording started successfully with:', mimeType)
      this.recordingAttempts = 0 // Reset on success
      return true

    } catch (error) {
      console.error('Failed to start recording:', error)
      
      // Try fallback approach
      if (this.recordingAttempts < this.maxAttempts) {
        console.log(`Retrying recording (attempt ${this.recordingAttempts}/${this.maxAttempts})...`)
        
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Try with simpler options
        const fallbackOptions = {
          ...options,
          includeOverlay: false,
          quality: 'low',
          frameRate: 15
        }
        
        return this.startRecording(videoElement, fallbackOptions)
      }
      
      this.cleanup()
      this.recordingAttempts = 0
      throw error
    }
  }

  private async validateRecordingSetup(videoElement: HTMLVideoElement): Promise<{
    isValid: boolean
    error?: string
  }> {
    // Check video element
    if (!videoElement) {
      return { isValid: false, error: 'Video element not provided' }
    }

    // Check if video is ready
    if (videoElement.readyState < 2) {
      return { isValid: false, error: 'Video is not ready. Please wait for camera to initialize.' }
    }

    // Check video dimensions
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      return { isValid: false, error: 'Video dimensions not available' }
    }

    // Check stream
    const stream = videoElement.srcObject as MediaStream
    if (!stream || !(stream instanceof MediaStream)) {
      return { isValid: false, error: 'No video stream available' }
    }

    // Check tracks
    const videoTracks = stream.getVideoTracks()
    if (videoTracks.length === 0) {
      return { isValid: false, error: 'No video tracks in stream' }
    }

    const activeTrack = videoTracks.find(track => track.enabled && track.readyState === 'live')
    if (!activeTrack) {
      return { isValid: false, error: 'No active video tracks' }
    }

    return { isValid: true }
  }

  private async getVideoStream(videoElement: HTMLVideoElement): Promise<MediaStream> {
    const stream = videoElement.srcObject as MediaStream
    
    // Clone the stream to avoid conflicts
    try {
      return stream.clone()
    } catch (cloneError) {
      console.warn('Could not clone stream, using original:', cloneError)
      return stream
    }
  }

  private async createMediaRecorder(
    stream: MediaStream,
    options: VideoRecordingOptions
  ): Promise<{ mimeType: string; recorder: MediaRecorder }> {
    // Try different MIME types in order of preference
    const mimeTypesToTry = this.getMimeTypesToTry(options.format)
    
    for (const mimeType of mimeTypesToTry) {
      try {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          const recordingOptions: MediaRecorderOptions = {
            mimeType,
            videoBitsPerSecond: this.getVideoBitrate(options.quality),
          }
          
          const recorder = new MediaRecorder(stream, recordingOptions)
          
          // Test if recorder can start
          recorder.start()
          recorder.stop()
          
          // Create new recorder if test passed
          return {
            mimeType,
            recorder: new MediaRecorder(stream, recordingOptions)
          }
        }
      } catch (error) {
        console.warn(`Failed to create recorder with ${mimeType}:`, error)
      }
    }
    
    // Final fallback - no options
    console.warn('Using MediaRecorder with no options as fallback')
    return {
      mimeType: 'video/webm',
      recorder: new MediaRecorder(stream)
    }
  }

  private getMimeTypesToTry(format: string): string[] {
    const types: string[] = []
    
    if (format === 'mp4') {
      types.push(
        'video/mp4;codecs=h264',
        'video/mp4;codecs=avc1',
        'video/mp4'
      )
    }
    
    // Always try WebM variants
    types.push(
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    )
    
    return types
  }

  private setupRecorderEvents(): void {
    if (!this.mediaRecorder) return

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = () => {
      this.handleRecordingStop()
    }

    this.mediaRecorder.onerror = (event: Event) => {
      const error = event as ErrorEvent
      console.error('MediaRecorder error:', error)
      
      // Try to recover
      if (this.state.isRecording && this.recordingAttempts < this.maxAttempts) {
        console.log('Attempting to recover recording...')
        // Recording will be retried by startRecording
      } else {
        this.stopRecording()
      }
    }

    this.mediaRecorder.onstart = () => {
      console.log('MediaRecorder started successfully')
    }
  }

  async stopRecording(): Promise<Blob | null> {
    try {
      if (!this.state.isRecording || !this.mediaRecorder) {
        console.warn('No recording in progress')
        return null
      }

      return new Promise((resolve) => {
        if (!this.mediaRecorder) {
          resolve(null)
          return
        }

        const timeoutId = setTimeout(() => {
          console.warn('Recording stop timeout, forcing stop')
          this.handleRecordingStop()
          resolve(this.state.data || null)
        }, 5000)

        this.mediaRecorder.onstop = () => {
          clearTimeout(timeoutId)
          const blob = this.handleRecordingStop()
          resolve(blob)
        }

        // Stop recording
        if (this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop()
        }
        
        this.state.isRecording = false

        // Stop duration tracking
        if (this.durationInterval) {
          clearInterval(this.durationInterval)
          this.durationInterval = undefined
        }

        // Stop composite stream if it exists
        if (this.compositeStream) {
          this.compositeStream.getTracks().forEach(track => track.stop())
          this.compositeStream = undefined
        }
      })

    } catch (error) {
      console.error('Failed to stop recording:', error)
      this.cleanup()
      return null
    }
  }

  private async createCompositeStream(
    videoElement: HTMLVideoElement,
    overlayCanvas: HTMLCanvasElement,
    options: VideoRecordingOptions
  ): Promise<MediaStream> {
    // Create composite canvas
    this.compositeCanvas = document.createElement('canvas')
    this.compositeCanvas.width = videoElement.videoWidth || 640
    this.compositeCanvas.height = videoElement.videoHeight || 480

    const ctx = this.compositeCanvas.getContext('2d', { 
      alpha: true,
      desynchronized: true 
    })
    
    if (!ctx) {
      throw new Error('Could not get canvas context')
    }

    // Check if captureStream is supported
    if (typeof this.compositeCanvas.captureStream !== 'function') {
      throw new Error('Canvas captureStream not supported')
    }

    // Animate the composite
    let animationActive = true
    const animate = () => {
      if (!animationActive || !this.state.isRecording || !this.compositeCanvas) return

      try {
        // Clear canvas
        ctx.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height)

        // Draw video frame
        ctx.drawImage(
          videoElement,
          0, 0,
          this.compositeCanvas.width,
          this.compositeCanvas.height
        )

        // Draw overlay
        ctx.drawImage(
          overlayCanvas,
          0, 0,
          this.compositeCanvas.width,
          this.compositeCanvas.height
        )

        // Add recording indicator
        this.drawRecordingIndicator(ctx)
      } catch (error) {
        console.error('Composite animation error:', error)
      }

      // Continue animation
      if (animationActive && this.state.isRecording) {
        requestAnimationFrame(animate)
      }
    }

    // Start animation
    animate()

    // Create stream from composite canvas
    const stream = this.compositeCanvas.captureStream(options.frameRate || 30)
    
    // Add audio from original video stream if available
    try {
      const originalStream = videoElement.srcObject as MediaStream
      const audioTracks = originalStream.getAudioTracks()
      audioTracks.forEach(track => stream.addTrack(track.clone()))
    } catch (audioError) {
      console.warn('Could not add audio tracks:', audioError)
    }

    // Store cleanup function
    (stream as any).cleanup = () => {
      animationActive = false
    }

    this.compositeStream = stream
    return stream
  }

  private drawRecordingIndicator(ctx: CanvasRenderingContext2D): void {
    if (!this.startTime) return

    const elapsed = (Date.now() - this.startTime) / 1000
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4)

    // Save context state
    ctx.save()

    // Recording dot
    ctx.fillStyle = `rgba(255, 68, 68, ${pulse})`
    ctx.shadowColor = '#ff4444'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(30, 30, 8, 0, 2 * Math.PI)
    ctx.fill()

    // Reset shadow
    ctx.shadowBlur = 0

    // Recording text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = 'bold 16px Arial'
    ctx.fillText('REC', 50, 38)

    // Duration
    const minutes = Math.floor(elapsed / 60)
    const seconds = Math.floor(elapsed % 60)
    const duration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.font = '14px monospace'
    ctx.fillText(duration, 100, 38)

    // Restore context state
    ctx.restore()
  }

  private handleRecordingStop(): Blob | null {
    if (this.recordedChunks.length === 0) {
      console.warn('No recorded data available')
      return null
    }

    try {
      const blob = new Blob(this.recordedChunks, {
        type: this.recordedChunks[0].type || 'video/webm'
      })

      this.state.data = blob
      this.state.url = URL.createObjectURL(blob)
      this.state.size = blob.size

      console.log('Recording stopped:', {
        duration: this.state.duration,
        size: blob.size,
        type: blob.type
      })

      this.cleanup()
      return blob
    } catch (error) {
      console.error('Failed to create blob:', error)
      this.cleanup()
      return null
    }
  }

  private getVideoBitrate(quality: string): number {
    const bitrates = {
      low: 500000,     // 0.5 Mbps
      medium: 1000000, // 1 Mbps
      high: 2500000,   // 2.5 Mbps
      ultra: 5000000   // 5 Mbps
    }

    return bitrates[quality as keyof typeof bitrates] || bitrates.medium
  }

  private cleanup(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval)
      this.durationInterval = undefined
    }

    if (this.compositeStream) {
      // Call custom cleanup if available
      const cleanup = (this.compositeStream as any).cleanup
      if (cleanup) cleanup()
      
      this.compositeStream.getTracks().forEach(track => {
        try {
          track.stop()
        } catch (e) {
          // Ignore errors during cleanup
        }
      })
      this.compositeStream = undefined
    }

    if (this.compositeCanvas) {
      this.compositeCanvas = undefined
    }

    this.mediaRecorder = undefined
    this.startTime = undefined
  }

  async downloadRecording(filename?: string): Promise<void> {
    if (!this.state.data || !this.state.url) {
      throw new Error('No recording data available')
    }

    const link = document.createElement('a')
    link.href = this.state.url
    link.download = filename || `pose-recording-${new Date().toISOString().slice(0, 19)}.webm`
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  getState(): RecordingState {
    return { ...this.state }
  }

  isRecording(): boolean {
    return this.state.isRecording
  }

  isSupported(): boolean {
    // Check basic requirements
    if (typeof MediaRecorder === 'undefined') {
      console.warn('MediaRecorder not supported')
      return false
    }

    // Check if any video format is supported
    const formats = ['video/webm', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9']
    const hasSupport = formats.some(format => {
      try {
        return MediaRecorder.isTypeSupported(format)
      } catch (e) {
        return false
      }
    })

    if (!hasSupport) {
      console.warn('No video formats supported')
      return false
    }

    // Check canvas capture support
    if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
      console.warn('Canvas captureStream not supported')
      // Still return true as we can record without overlay
    }

    return true
  }

  getSupportedFormats(): string[] {
    const formats: string[] = []
    
    const typesToCheck = [
      'video/webm',
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp9',
      'video/mp4',
      'video/mp4;codecs=h264'
    ]

    typesToCheck.forEach(type => {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          const baseFormat = type.split(';')[0].split('/')[1]
          if (!formats.includes(baseFormat)) {
            formats.push(baseFormat)
          }
        }
      } catch (e) {
        // Ignore errors
      }
    })

    return formats
  }

  dispose(): void {
    if (this.state.isRecording) {
      this.stopRecording()
    }

    if (this.state.url) {
      URL.revokeObjectURL(this.state.url)
    }

    this.cleanup()
    this.recordedChunks = []
    this.state = {
      isRecording: false,
      duration: 0
    }
    this.recordingAttempts = 0
  }
}