#!/usr/bin/env node

/**
 * Camera Debug Script for PoseAnalytics
 * 
 * This script uses Puppeteer to automatically test and debug camera issues
 * in the Next.js application. It provides iterative testing with detailed logging.
 */

const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

class CameraDebugger {
  constructor() {
    this.browser = null
    this.page = null
    this.logFile = path.join(__dirname, 'camera-debug.log')
    this.testResults = []
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${level}: ${message}\n`
    
    console.log(logEntry.trim())
    fs.appendFileSync(this.logFile, logEntry)
  }

  async initialize() {
    this.log('Initializing Puppeteer browser...')
    
    this.browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      devtools: true,
      args: [
        '--use-fake-ui-for-media-stream', // Auto-grant camera permissions
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-video-capture=/dev/null', // Provide fake video
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-features=VizDisplayCompositor' // Better for headless
      ]
    })

    this.page = await this.browser.newPage()
    
    // Set up console logging from the page
    this.page.on('console', (msg) => {
      this.log(`BROWSER: ${msg.text()}`, 'BROWSER')
    })

    // Set up error logging
    this.page.on('pageerror', (error) => {
      this.log(`PAGE ERROR: ${error.message}`, 'ERROR')
    })

    // Grant camera permissions
    const context = this.browser.defaultBrowserContext()
    await context.overridePermissions('http://localhost:3001', ['camera'])
    
    this.log('Browser initialized successfully')
  }

  async testCameraPermissions() {
    this.log('Testing camera permissions...')
    
    try {
      const hasCamera = await this.page.evaluate(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return { success: false, error: 'MediaDevices API not available' }
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          const tracks = stream.getVideoTracks()
          
          // Clean up
          tracks.forEach(track => track.stop())
          
          return { 
            success: true, 
            trackCount: tracks.length,
            capabilities: tracks[0]?.getCapabilities?.() || {}
          }
        } catch (error) {
          return { success: false, error: error.message }
        }
      })

      this.testResults.push({
        test: 'Camera Permissions',
        success: hasCamera.success,
        details: hasCamera
      })

      this.log(`Camera permissions: ${hasCamera.success ? 'GRANTED' : 'DENIED'}`)
      if (hasCamera.success) {
        this.log(`Camera tracks: ${hasCamera.trackCount}`)
        this.log(`Camera capabilities: ${JSON.stringify(hasCamera.capabilities, null, 2)}`)
      } else {
        this.log(`Camera error: ${hasCamera.error}`, 'ERROR')
      }

      return hasCamera.success
    } catch (error) {
      this.log(`Camera permission test failed: ${error.message}`, 'ERROR')
      return false
    }
  }

  async testWebGLSupport() {
    this.log('Testing WebGL support...')

    try {
      const webglInfo = await this.page.evaluate(() => {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        
        if (!gl) {
          return { supported: false, error: 'WebGL context not available' }
        }

        return {
          supported: true,
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          version: gl.getParameter(gl.VERSION),
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
        }
      })

      this.testResults.push({
        test: 'WebGL Support',
        success: webglInfo.supported,
        details: webglInfo
      })

      this.log(`WebGL support: ${webglInfo.supported ? 'YES' : 'NO'}`)
      if (webglInfo.supported) {
        this.log(`WebGL vendor: ${webglInfo.vendor}`)
        this.log(`WebGL renderer: ${webglInfo.renderer}`)
      }

      return webglInfo.supported
    } catch (error) {
      this.log(`WebGL test failed: ${error.message}`, 'ERROR')
      return false
    }
  }

  async navigateToApp() {
    this.log('Navigating to PoseAnalytics app...')
    
    try {
      await this.page.goto('http://localhost:3001', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      })
      
      // Wait for the main component to load
      await this.page.waitForSelector('[data-testid="pose-camera"], video, .min-h-screen', { 
        timeout: 10000 
      })
      
      this.log('App loaded successfully')
      return true
    } catch (error) {
      this.log(`Failed to load app: ${error.message}`, 'ERROR')
      return false
    }
  }

  async testCameraInitialization() {
    this.log('Testing camera initialization...')

    try {
      // Wait for and click the start camera button
      await this.page.waitForSelector('button', { timeout: 5000 })
      
      // Find the camera button (blue button with camera icon)
      const cameraButton = await this.page.$('button[class*="bg-blue"], button:has([data-lucide="camera"])')
      
      if (!cameraButton) {
        this.log('Camera start button not found', 'ERROR')
        return false
      }

      this.log('Clicking start camera button...')
      await cameraButton.click()

      // Wait for video element to appear
      await this.page.waitForSelector('video', { timeout: 10000 })
      
      // Wait a bit for video to load
      await this.page.waitForTimeout(3000)

      // Check video element properties
      const videoInfo = await this.page.evaluate(() => {
        const video = document.querySelector('video')
        if (!video) return { found: false }

        return {
          found: true,
          src: video.src,
          srcObject: !!video.srcObject,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          paused: video.paused,
          currentTime: video.currentTime,
          duration: video.duration
        }
      })

      this.testResults.push({
        test: 'Camera Initialization',
        success: videoInfo.found && videoInfo.srcObject && videoInfo.videoWidth > 0,
        details: videoInfo
      })

      this.log(`Video element found: ${videoInfo.found}`)
      if (videoInfo.found) {
        this.log(`Video has stream: ${videoInfo.srcObject}`)
        this.log(`Video dimensions: ${videoInfo.videoWidth}x${videoInfo.videoHeight}`)
        this.log(`Video ready state: ${videoInfo.readyState}`)
        this.log(`Video paused: ${videoInfo.paused}`)
      }

      return videoInfo.found && videoInfo.srcObject
    } catch (error) {
      this.log(`Camera initialization test failed: ${error.message}`, 'ERROR')
      return false
    }
  }

  async testCanvasOverlay() {
    this.log('Testing canvas overlay...')

    try {
      // Wait for canvas element
      await this.page.waitForSelector('canvas', { timeout: 5000 })

      const canvasInfo = await this.page.evaluate(() => {
        const canvas = document.querySelector('canvas')
        if (!canvas) return { found: false }

        const ctx = canvas.getContext('2d')
        const rect = canvas.getBoundingClientRect()

        return {
          found: true,
          width: canvas.width,
          height: canvas.height,
          displayWidth: rect.width,
          displayHeight: rect.height,
          hasContext: !!ctx,
          style: {
            position: canvas.style.position,
            zIndex: canvas.style.zIndex,
            top: canvas.style.top,
            left: canvas.style.left
          }
        }
      })

      this.testResults.push({
        test: 'Canvas Overlay',
        success: canvasInfo.found && canvasInfo.hasContext,
        details: canvasInfo
      })

      this.log(`Canvas found: ${canvasInfo.found}`)
      if (canvasInfo.found) {
        this.log(`Canvas dimensions: ${canvasInfo.width}x${canvasInfo.height}`)
        this.log(`Canvas display size: ${canvasInfo.displayWidth}x${canvasInfo.displayHeight}`)
        this.log(`Canvas position: ${canvasInfo.style.position}`)
      }

      return canvasInfo.found && canvasInfo.hasContext
    } catch (error) {
      this.log(`Canvas overlay test failed: ${error.message}`, 'ERROR')
      return false
    }
  }

  async testTensorFlowInitialization() {
    this.log('Testing TensorFlow.js initialization...')

    try {
      const tfInfo = await this.page.evaluate(async () => {
        try {
          // Check if TensorFlow is loaded
          if (typeof window.tf === 'undefined') {
            // Try to import it
            const tf = await import('@tensorflow/tfjs')
            await import('@tensorflow/tfjs-backend-webgl')
            await tf.ready()
            window.tf = tf
          }

          const tf = window.tf
          
          return {
            success: true,
            version: tf.version,
            backend: tf.getBackend(),
            memory: tf.memory(),
            env: tf.env()
          }
        } catch (error) {
          return {
            success: false,
            error: error.message
          }
        }
      })

      this.testResults.push({
        test: 'TensorFlow Initialization',
        success: tfInfo.success,
        details: tfInfo
      })

      this.log(`TensorFlow loaded: ${tfInfo.success}`)
      if (tfInfo.success) {
        this.log(`TensorFlow version: ${tfInfo.version}`)
        this.log(`TensorFlow backend: ${tfInfo.backend}`)
        this.log(`TensorFlow memory: ${JSON.stringify(tfInfo.memory)}`)
      } else {
        this.log(`TensorFlow error: ${tfInfo.error}`, 'ERROR')
      }

      return tfInfo.success
    } catch (error) {
      this.log(`TensorFlow test failed: ${error.message}`, 'ERROR')
      return false
    }
  }

  async takeScreenshot(filename) {
    this.log(`Taking screenshot: ${filename}`)
    
    try {
      await this.page.screenshot({ 
        path: path.join(__dirname, filename),
        fullPage: true
      })
      this.log(`Screenshot saved: ${filename}`)
    } catch (error) {
      this.log(`Screenshot failed: ${error.message}`, 'ERROR')
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.success).length,
        failed: this.testResults.filter(r => !r.success).length
      },
      tests: this.testResults
    }

    const reportPath = path.join(__dirname, 'camera-debug-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    this.log('=== DEBUG REPORT ===')
    this.log(`Total tests: ${report.summary.total}`)
    this.log(`Passed: ${report.summary.passed}`)
    this.log(`Failed: ${report.summary.failed}`)
    this.log(`Report saved: ${reportPath}`)

    return report
  }

  async runAllTests() {
    this.log('Starting comprehensive camera debugging...')
    
    try {
      // Clear previous log
      if (fs.existsSync(this.logFile)) {
        fs.unlinkSync(this.logFile)
      }

      await this.initialize()
      
      // Run tests in sequence
      await this.testCameraPermissions()
      await this.testWebGLSupport()
      await this.navigateToApp()
      await this.takeScreenshot('01-app-loaded.png')
      
      await this.testTensorFlowInitialization()
      await this.testCameraInitialization()
      await this.takeScreenshot('02-camera-started.png')
      
      await this.testCanvasOverlay()
      await this.takeScreenshot('03-final-state.png')

      // Generate final report
      return await this.generateReport()
      
    } catch (error) {
      this.log(`Debug session failed: ${error.message}`, 'ERROR')
      return null
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close()
      this.log('Browser closed')
    }
  }
}

// CLI execution
async function main() {
  const cameraDebugger = new CameraDebugger()
  
  try {
    const report = await cameraDebugger.runAllTests()
    
    if (report && report.summary.failed > 0) {
      console.log('\n🚨 Issues found! Check the debug report for details.')
      process.exit(1)
    } else {
      console.log('\n✅ All tests passed!')
      process.exit(0)
    }
  } catch (error) {
    console.error('Debug script failed:', error)
    process.exit(1)
  } finally {
    await cameraDebugger.cleanup()
  }
}

if (require.main === module) {
  main()
}

module.exports = CameraDebugger