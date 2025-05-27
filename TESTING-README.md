# Pose Detection Testing & Debugging Guide

## Quick Start

### 1. Verify Pose Detection Locally
```bash
# Run the automated verification script
node scripts/verify-pose-detection.js
```

This will:
- Open the app in a browser
- Check if all components load
- Verify TensorFlow.js initialization
- Monitor FPS counter
- Take a screenshot
- Test debug pages

### 2. Run E2E Tests
```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run all tests
npm run test:e2e

# Run with UI (recommended for debugging)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug
```

### 3. Run Unit Tests
```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Debug Tools

### 1. Real-time Debug Panel
The app includes a debug panel that shows:
- Current FPS
- Frame processing time
- Memory usage
- Detection quality metrics
- Recent errors

**To enable:** 
- Development: Automatically shown
- Production: Add `?debug=true` to URL

### 2. Debug Pages

#### `/pose-test`
Simple test page with minimal UI:
- Shows initialization status
- Displays raw pose data
- Basic FPS counter
- Start/stop controls

#### `/pose-debug`
Comprehensive debug interface:
- Detailed system status
- TensorFlow.js info
- Camera permissions
- Performance metrics
- Error logs

### 3. Browser Console Commands
```javascript
// Check TensorFlow.js
console.log('TF loaded:', window.tf !== undefined)
console.log('TF version:', window.tf?.version)

// Check pose detection
console.log('Pose Detection:', window.poseDetection)

// Test camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => console.log('Camera OK'))
  .catch(err => console.error('Camera Error:', err))
```

## Common Issues & Solutions

### Issue: FPS Shows 0

**Symptoms:**
- FPS counter stays at 0
- No skeleton overlay visible
- Camera works but no pose detection

**Solutions:**
1. Check browser console for errors
2. Verify TensorFlow.js loaded: `window.tf !== undefined`
3. Try debug pages: `/pose-test` or `/pose-debug`
4. Clear browser cache and reload
5. Check camera permissions

### Issue: Camera Not Working

**Symptoms:**
- Black screen or no video
- Permission errors in console

**Solutions:**
1. Check browser camera permissions
2. Try incognito mode (disables extensions)
3. Test with fake camera: `--use-fake-device-for-media-stream`
4. Verify HTTPS (required for camera access)

### Issue: Poor Performance

**Symptoms:**
- Low FPS (< 15)
- Laggy detection
- High CPU usage

**Solutions:**
1. Check device capabilities in debug panel
2. Try different browser (Chrome recommended)
3. Close other tabs/applications
4. Check WebGL support: `const gl = canvas.getContext('webgl2')`

## Testing Workflows

### 1. Pre-deployment Testing
```bash
# 1. Run unit tests
npm test

# 2. Run E2E tests
npm run test:e2e

# 3. Build and test production
npm run build
npm run start
# Then run verification script
```

### 2. Post-deployment Testing
1. Visit production URL
2. Check debug panel metrics
3. Test all camera modes
4. Verify pose detection works
5. Export debug data if issues

### 3. Performance Testing
```bash
# Run performance-focused tests
npx playwright test tests/e2e/performance.spec.ts

# Monitor with debug panel
# - Target: 25+ FPS
# - Frame time: < 40ms
# - Memory: < 500MB
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Test Pose Detection
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npx playwright install
      - run: npm run test:e2e
```

### Vercel Deployment Checks
The app includes automatic checks:
- Build-time TypeScript validation
- ESLint checks
- Production build verification

## Monitoring Production

### 1. Client-side Monitoring
```javascript
// Add to your monitoring service
window.addEventListener('error', (event) => {
  if (event.message.includes('pose') || event.message.includes('tensorflow')) {
    // Log to monitoring service
    console.error('Pose Detection Error:', event);
  }
});
```

### 2. Performance Metrics
The debug panel exports data that can be sent to analytics:
```javascript
const monitor = window.__poseDetectionMonitor;
const data = monitor.exportData();
// Send to analytics service
```

### 3. User Feedback
Enable debug panel for select users:
```javascript
// Add to URL params
if (userIsBetatester) {
  window.location.href += '?debug=true';
}
```

## Troubleshooting Checklist

- [ ] Browser console checked for errors
- [ ] TensorFlow.js loaded successfully
- [ ] Camera permissions granted
- [ ] WebGL context available
- [ ] Debug panel shows healthy metrics
- [ ] FPS > 0 after initialization
- [ ] No critical errors in error log
- [ ] Debug pages `/pose-test` working
- [ ] Network tab shows no failed requests
- [ ] Device has sufficient performance

## Support

For issues:
1. Run verification script: `node scripts/verify-pose-detection.js`
2. Export debug data from debug panel
3. Take screenshot of issue
4. Check browser console for errors
5. Include device/browser information