# Pose Detection Debugging Instructions

## Issue: Skeleton Connections Not Rendering

The pose detection keypoints are visible but the skeleton connections between them are not rendering.

## Debugging Setup

1. **Start the Next.js app** (if not already running):
   ```bash
   npm run dev
   ```

2. **In a new terminal, start the debug server**:
   ```bash
   npm run debug:server
   ```
   This will:
   - Launch Puppeteer with a visible browser window
   - Navigate to http://localhost:3001
   - Inject debugging hooks into the canvas rendering
   - Start an API server on port 4000

3. **In another terminal, run debug commands**:
   ```bash
   # Run full debug sequence
   npm run debug:run
   
   # Or run individual commands:
   npm run debug:client status    # Check current status
   npm run debug:client fix       # Apply canvas fixes
   npm run debug:client test      # Draw test skeleton
   npm run debug:client loop      # Check detection loop
   ```

## Fix Applied

The issue was in the `renderPose` function in `useSimplePoseDetection.ts`. The skeleton connections were not being drawn properly. 

**Root Cause**: The connections array was defined but the drawing logic wasn't executing properly due to:
1. Shadow blur effects interfering with line rendering
2. Incorrect drawing order (keypoints were drawn before lines)
3. Missing stroke style configuration

**Solution**: Created `useSimplePoseDetectionFixed.ts` with:
- Proper connection definitions for MoveNet's 17 keypoints
- Drawing connections BEFORE keypoints (so lines appear behind)
- Proper shadow and stroke configuration
- Enhanced visual feedback with glow effects

## Testing the Fix

1. The component now uses `useSimplePoseDetectionFixed` hook
2. Start the app and click "Start Camera"
3. You should see:
   - Cyan-colored keypoints with glow effects
   - Connecting lines between keypoints forming a skeleton
   - Confidence score and keypoint count in top-left
   - Smooth animation with proper mirroring

## Debug Server API Endpoints

- `GET /debug/status` - Get canvas and rendering state
- `POST /debug/fix-canvas` - Force canvas visibility
- `POST /debug/test-skeleton-render` - Draw test skeleton
- `POST /debug/inject-render-hook` - Add render logging
- `POST /debug/check-pose-loop` - Check detection loop

## Next Steps

1. ✅ Skeleton rendering fixed
2. 🔄 Make native UI default (remove glassmorphism intro)
3. 🔄 Implement mode switching functionality
4. 🔄 Add camera controls (exposure, focus, zoom)
5. 🔄 Optimize performance for 30+ FPS

## Cleanup

After debugging, you can remove these files:
- `debug-server.js`
- `debug-client.js`
- `DEBUG-INSTRUCTIONS.md`

Keep `useSimplePoseDetectionFixed.ts` as the production implementation.