import { VideoRecordingOptions, RecordingState } from './types'

export class VideoRecorder {
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

  async initialize(
    videoElement: HTMLVideoElement,
    overlayCanvas?: HTMLCanvasElement
  ): Promise<boolean> {
    try {
      this.overlayCanvas = overlayCanvas
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

      // Validate video element
      if (!videoElement) {
        throw new Error('Video element not provided')
      }

      // Check if video is playing
      if (videoElement.paused || videoElement.readyState < 2) {
        throw new Error('Video element is not ready. Please ensure camera is active.')
      }

      // Get the video stream
      const videoStream = videoElement.srcObject as MediaStream
      if (!videoStream || !(videoStream instanceof MediaStream)) {
        throw new Error('No video stream available. Please start the camera first.')
      }

      // Verify stream has video tracks
      const videoTracks = videoStream.getVideoTracks()
      if (videoTracks.length === 0) {
        throw new Error('No video tracks in stream')
      }

      // Check if tracks are enabled and not ended
      const activeTrack = videoTracks.find(track => track.enabled && track.readyState === 'live')
      if (!activeTrack) {
        throw new Error('No active video tracks found. Camera may have been stopped.')
      }

      let recordingStream: MediaStream

      if (options.includeOverlay && this.overlayCanvas) {
        // Create composite stream with overlay
        recordingStream = await this.createCompositeStream(
          videoElement,
          this.overlayCanvas,
          options
        )
      } else {
        // Use original video stream
        recordingStream = videoStream
      }

      // Configure MediaRecorder
      const mimeType = this.getSupportedMimeType(options.format)
      const recordingOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: this.getVideoBitrate(options.quality),
      }

      this.mediaRecorder = new MediaRecorder(recordingStream, recordingOptions)

      // Set up event listeners
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStop()
      }

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        this.stopRecording()
      }

      // Start recording
      this.mediaRecorder.start(1000) // Capture data every second
      this.startTime = Date.now()
      this.state.isRecording = true

      // Start duration tracking
      this.durationInterval = setInterval(() => {
        if (this.startTime) {
          this.state.duration = Date.now() - this.startTime
        }
      }, 100)

      console.log('Video recording started')
      return true

    } catch (error) {
      console.error('Failed to start recording:', error)
      this.cleanup()
      return false
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

        this.mediaRecorder.onstop = () => {
          const blob = this.handleRecordingStop()
          resolve(blob)
        }

        this.mediaRecorder.stop()
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

    const ctx = this.compositeCanvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Animate the composite
    const animate = () => {
      if (!this.state.isRecording || !this.compositeCanvas) return

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

      // Continue animation
      if (this.state.isRecording) {
        requestAnimationFrame(animate)
      }
    }

    // Start animation
    animate()

    // Create stream from composite canvas
    const stream = this.compositeCanvas.captureStream(options.frameRate)
    
    // Add audio from original video stream if available
    const originalStream = videoElement.srcObject as MediaStream
    const audioTracks = originalStream.getAudioTracks()
    audioTracks.forEach(track => stream.addTrack(track))

    this.compositeStream = stream
    return stream
  }

  private drawRecordingIndicator(ctx: CanvasRenderingContext2D): void {
    if (!this.startTime) return

    const elapsed = (Date.now() - this.startTime) / 1000
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4) // Pulse every 0.5 seconds

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
  }

  private handleRecordingStop(): Blob | null {
    if (this.recordedChunks.length === 0) {
      console.warn('No recorded data available')
      return null
    }

    const blob = new Blob(this.recordedChunks, {
      type: this.recordedChunks[0].type
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
  }

  private getSupportedMimeType(format: string): string {
    const mimeTypes = {
      webm: [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ],
      mp4: [
        'video/mp4;codecs=h264',
        'video/mp4'
      ]
    }

    const types = mimeTypes[format as keyof typeof mimeTypes] || mimeTypes.webm

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    // Fallback
    return 'video/webm'
  }

  private getVideoBitrate(quality: string): number {
    const bitrates = {
      low: 1000000,    // 1 Mbps
      medium: 2500000, // 2.5 Mbps
      high: 5000000,   // 5 Mbps
      ultra: 8000000   // 8 Mbps
    }

    return bitrates[quality as keyof typeof bitrates] || bitrates.medium
  }

  private cleanup(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval)
      this.durationInterval = undefined
    }

    if (this.compositeStream) {
      this.compositeStream.getTracks().forEach(track => track.stop())
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

  async uploadRecording(uploadUrl: string): Promise<Response> {
    if (!this.state.data) {
      throw new Error('No recording data available')
    }

    const formData = new FormData()
    formData.append('video', this.state.data, 'recording.webm')

    return fetch(uploadUrl, {
      method: 'POST',
      body: formData
    })
  }

  getState(): RecordingState {
    return { ...this.state }
  }

  isRecording(): boolean {
    return this.state.isRecording
  }

  isSupported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/webm') &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function'
    )
  }

  getSupportedFormats(): string[] {
    const formats: string[] = []
    
    if (MediaRecorder.isTypeSupported('video/webm')) {
      formats.push('webm')
    }
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      formats.push('mp4')
    }

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
  }
}