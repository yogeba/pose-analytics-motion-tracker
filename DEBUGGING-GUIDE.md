# Pose Detection Debugging Guide

## Overview
This guide provides industry-standard approaches to debugging pose detection issues in the PoseAnalytics application.

## Common Issues and Solutions

### 1. FPS Shows 0 / Pose Detection Not Working

**Symptoms:**
- FPS counter shows 0
- No skeleton overlay on video
- Console shows TensorFlow.js loading errors

**Debugging Steps:**

1. **Check Browser Console:**
   ```javascript
   // Open DevTools (F12) and check for:
   - TensorFlow.js loading errors
   - CORS errors
   - WebGL context errors
   ```

2. **Verify TensorFlow.js Loading:**
   ```javascript
   // In browser console:
   console.log('TF loaded:', typeof window.tf !== 'undefined')
   console.log('TF version:', window.tf?.version)
   ```

3. **Test Debug Pages:**
   - Navigate to `http://localhost:3001/pose-test` - Simple test page
   - Navigate to `http://localhost:3001/pose-debug` - Detailed debug info

### 2. Camera Permission Issues

**Debugging Steps:**

1. **Check Browser Permissions:**
   - Click camera icon in URL bar
   - Ensure camera access is allowed
   - Try incognito mode to rule out extensions

2. **Test Camera Access:**
   ```javascript
   // In console:
   navigator.mediaDevices.getUserMedia({ video: true })
     .then(stream => console.log('Camera OK:', stream))
     .catch(err => console.error('Camera Error:', err))
   ```

### 3. Performance Issues

**Debugging Steps:**

1. **Check Device Performance:**
   ```javascript
   // In console:
   console.log('Hardware Concurrency:', navigator.hardwareConcurrency)
   console.log('Device Memory:', navigator.deviceMemory || 'Unknown')
   ```

2. **Monitor WebGL Context:**
   ```javascript
   const canvas = document.createElement('canvas')
   const gl = canvas.getContext('webgl2')
   console.log('WebGL2 Support:', !!gl)
   console.log('Max Texture Size:', gl?.getParameter(gl.MAX_TEXTURE_SIZE))
   ```

## Running Tests

### 1. Unit Tests
```bash
npm test
```

### 2. E2E Tests with Playwright
```bash
# Install Playwright browsers first
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run with UI mode for debugging
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/pose-detection.spec.ts
```

### 3. Automated Test Suite
```bash
# Run comprehensive test suite
npx ts-node scripts/test-pose-detection.ts
```

## Monitoring Production Issues

### 1. Enable Debug Panel
The debug panel shows real-time metrics in development mode. To enable in production:

```javascript
// Add to URL: ?debug=true
http://localhost:3001/?debug=true
```

### 2. Export Debug Data
1. Open debug panel (click to expand)
2. Click "Export Debug Data"
3. Share the JSON file for analysis

### 3. Performance Profiling
```javascript
// Start profiling in console:
performance.mark('pose-detection-start')

// After detection:
performance.mark('pose-detection-end')
performance.measure('pose-detection', 'pose-detection-start', 'pose-detection-end')

// View results:
performance.getEntriesByName('pose-detection')
```

## Remote Debugging

### 1. Using Browser DevTools
- Chrome: `chrome://inspect`
- Edge: `edge://inspect`
- Connect to remote device

### 2. Using Logging Service
```javascript
// Add to your code:
const DEBUG = true
if (DEBUG) {
  console.log('[PoseDetection]', {
    timestamp: Date.now(),
    fps: currentFPS,
    keypoints: detectedKeypoints,
    errors: errorList
  })
}
```

### 3. Network Analysis
1. Open Network tab in DevTools
2. Check for failed model loads
3. Verify CDN accessibility
4. Check response times

## Best Practices

1. **Always test on target devices** - Performance varies significantly
2. **Use production builds for testing** - Dev mode has overhead
3. **Monitor memory usage** - TensorFlow.js can leak memory
4. **Test with different lighting** - Affects pose detection accuracy
5. **Check browser compatibility** - Some features need specific versions

## Troubleshooting Checklist

- [ ] Browser console checked for errors
- [ ] Camera permissions granted
- [ ] TensorFlow.js loaded successfully
- [ ] WebGL context available
- [ ] Sufficient device performance
- [ ] Network connectivity stable
- [ ] Latest browser version
- [ ] No conflicting browser extensions
- [ ] Debug pages tested
- [ ] Performance metrics reviewed

## Getting Help

1. Export debug data using debug panel
2. Check browser console logs
3. Run automated test suite
4. Include device/browser info
5. Provide screenshot of issue
6. Share minimal reproduction steps