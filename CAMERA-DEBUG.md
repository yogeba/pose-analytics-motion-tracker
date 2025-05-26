# Camera Debugging Guide

This guide provides tools and strategies for debugging camera issues in the PoseAnalytics application.

## 🔧 Available Debugging Tools

### 1. Real-time Camera Debugger (Built-in)

A React component that provides real-time diagnostics during development.

**Features:**
- Live camera status monitoring
- WebGL support detection
- TensorFlow.js initialization tracking
- Video element and canvas overlay status
- Auto-fix functionality for common issues

**Usage:**
The debugger automatically appears in development mode. Look for the "Debug" button in the bottom-right corner.

**Location:** `src/components/CameraDebugger.tsx`

### 2. Automated Puppeteer Testing

A comprehensive automated testing script that validates all camera functionality.

**Features:**
- Camera permissions testing
- WebGL compatibility checks
- Video stream validation
- Canvas overlay verification
- Automatic screenshot capture
- Detailed JSON report generation

**Usage:**
```bash
# Start the Next.js development server first
npm run dev

# In another terminal, run the debug script
npm run debug:camera
```

**Files:**
- `debug-camera.js` - Main Puppeteer script
- `camera-debug.log` - Detailed execution log
- `camera-debug-report.json` - Summary report
- `*.png` - Screenshots at different stages

### 3. Robust Camera Hook

An enhanced camera initialization hook with progressive fallback strategies.

**Features:**
- Progressive quality fallback (1280p → 640p → 320p → basic)
- Automatic device detection and switching
- Comprehensive error handling
- Stream validation and health monitoring
- Camera restart functionality

**Location:** `src/hooks/useRobustCamera.ts`

## 🚨 Common Issues and Solutions

### Issue 1: Black Screen with Pose Points

**Symptoms:**
- Camera appears to initialize
- Pose detection works (keypoints visible)
- Video feed shows black screen

**Causes:**
- WebRTC constraints too restrictive
- Video element not properly configured
- Canvas overlay blocking video
- CSS styling issues

**Solutions:**
1. **Check camera constraints:**
   ```javascript
   // Use the robust camera hook for automatic fallback
   const { startCamera, status } = useRobustCamera()
   ```

2. **Verify video element styling:**
   ```css
   video {
     transform: scaleX(-1); /* Mirror effect */
     object-fit: cover;
     background: black; /* Shows if no stream */
   }
   ```

3. **Canvas overlay positioning:**
   ```css
   canvas {
     position: absolute;
     pointer-events: none;
     z-index: 10;
   }
   ```

### Issue 2: Camera Permissions Denied

**Symptoms:**
- "Permission denied" errors
- Camera never initializes
- getUserMedia fails

**Solutions:**
1. **Check browser permissions:**
   - Chrome: Settings → Privacy → Camera
   - Firefox: Preferences → Privacy → Permissions → Camera
   - Safari: Preferences → Websites → Camera

2. **HTTPS requirement:**
   ```bash
   # For local development with HTTPS
   npm run dev -- --experimental-https
   ```

3. **Programmatic permission request:**
   ```javascript
   try {
     const stream = await navigator.mediaDevices.getUserMedia({
       video: { facingMode: 'user' }
     })
     // Use stream...
   } catch (error) {
     if (error.name === 'NotAllowedError') {
       // Handle permission denied
     }
   }
   ```

### Issue 3: WebGL/TensorFlow.js Issues

**Symptoms:**
- Pose detection fails to initialize
- "WebGL not supported" errors
- TensorFlow.js backend errors

**Solutions:**
1. **WebGL fallback:**
   ```javascript
   import * as tf from '@tensorflow/tfjs'
   
   try {
     await tf.setBackend('webgl')
   } catch (e) {
     await tf.setBackend('cpu') // Fallback to CPU
   }
   ```

2. **Browser compatibility:**
   - Enable hardware acceleration
   - Update graphics drivers
   - Use Chrome/Firefox for best support

3. **Memory management:**
   ```javascript
   // Dispose tensors properly
   const predictions = await detector.estimatePoses(video)
   // Use predictions...
   predictions.forEach(p => p.dispose?.())
   ```

### Issue 4: Performance Issues

**Symptoms:**
- Low FPS
- Browser freezing
- High CPU usage

**Solutions:**
1. **Frame skipping:**
   ```javascript
   let frameCount = 0
   const processFrame = () => {
     frameCount++
     if (frameCount % 2 === 0) return // Skip every other frame
     
     // Process pose detection
   }
   ```

2. **Model optimization:**
   ```javascript
   // Use Lightning model for better performance
   const detector = await createDetector(SupportedModels.MoveNet, {
     modelType: movenet.modelType.SINGLEPOSE_LIGHTNING
   })
   ```

3. **Canvas optimization:**
   ```javascript
   // Clear only changed regions
   ctx.clearRect(0, 0, canvas.width, canvas.height)
   ```

## 🔍 Debug Workflow

### Step 1: Run Built-in Debugger
1. Start development server: `npm run dev`
2. Open app in browser
3. Click "Debug" button in bottom-right
4. Review real-time diagnostics

### Step 2: Automated Testing
1. Ensure app is running on localhost:3001
2. Run: `npm run debug:camera`
3. Review console output and generated files
4. Check screenshots for visual confirmation

### Step 3: Manual Testing
1. Test in different browsers (Chrome, Firefox, Safari)
2. Try different camera devices
3. Test with/without hardware acceleration
4. Verify HTTPS vs HTTP behavior

### Step 4: Code Analysis
1. Check browser console for errors
2. Review Network tab for failed requests
3. Examine TensorFlow.js model loading
4. Validate WebRTC stream properties

## 📊 Debug Output Files

After running the automated debugger, you'll find:

- `camera-debug.log` - Timestamped execution log
- `camera-debug-report.json` - Structured test results
- `01-app-loaded.png` - App initial state
- `02-camera-started.png` - After camera activation
- `03-final-state.png` - Final application state

## 🛠️ Advanced Debugging

### Network Analysis
```bash
# Check STUN/TURN server connectivity
curl -v https://stun.l.google.com:19302
```

### WebRTC Internals
Visit `chrome://webrtc-internals/` in Chrome to see detailed WebRTC diagnostics.

### TensorFlow.js Profiling
```javascript
// Enable TF.js profiling
tf.profile(() => {
  return detector.estimatePoses(video)
}).then(result => {
  console.log('Profile:', result)
})
```

## 📞 Support

If issues persist after trying these solutions:

1. Create an issue with:
   - Debug report JSON
   - Screenshots
   - Browser/OS information
   - Console error logs

2. Include environment details:
   - Node.js version
   - npm version
   - Browser version
   - Operating system

The debugging tools should help identify and resolve most camera-related issues in the PoseAnalytics application.