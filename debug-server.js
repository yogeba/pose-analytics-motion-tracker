const puppeteer = require('puppeteer');
const express = require('express');

// Create Express server for debugging API
const app = express();
app.use(express.json());

let browser = null;
let page = null;
let debugData = {
  canvasState: {},
  keypointData: [],
  renderCalls: [],
  errors: []
};

// Initialize Puppeteer
async function initPuppeteer() {
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream', 
        '--auto-accept-camera-and-microphone-capture',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      defaultViewport: {
        width: 1200,
        height: 800
      }
    });
    
    page = await browser.newPage();
    
    // Grant camera permissions
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('http://localhost:3001', ['camera']);
    
    // Inject debug hooks
    await page.evaluateOnNewDocument(() => {
      window.poseDebug = {
        canvasRenderCalls: [],
        keypointHistory: [],
        errors: [],
        canvasState: {}
      };

      // Hook into canvas rendering
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(...args) {
        const ctx = originalGetContext.apply(this, args);
        
        if (args[0] === '2d' && this.className?.includes('pose')) {
          console.log('[DEBUG] Canvas 2D context created for pose rendering');
          
          // Hook drawing methods
          const originalClearRect = ctx.clearRect.bind(ctx);
          const originalArc = ctx.arc.bind(ctx);
          const originalStroke = ctx.stroke.bind(ctx);
          const originalFill = ctx.fill.bind(ctx);
          
          ctx.clearRect = function(...args) {
            window.poseDebug.canvasRenderCalls.push({
              method: 'clearRect',
              args,
              timestamp: Date.now()
            });
            return originalClearRect(...args);
          };
          
          ctx.arc = function(...args) {
            window.poseDebug.canvasRenderCalls.push({
              method: 'arc',
              args,
              timestamp: Date.now()
            });
            return originalArc(...args);
          };
          
          ctx.stroke = function() {
            window.poseDebug.canvasRenderCalls.push({
              method: 'stroke',
              timestamp: Date.now()
            });
            return originalStroke();
          };
          
          ctx.fill = function() {
            window.poseDebug.canvasRenderCalls.push({
              method: 'fill',
              timestamp: Date.now()
            });
            return originalFill();
          };
        }
        
        return ctx;
      };
    });
    
    // Navigate to the app
    await page.goto('http://localhost:3001');
    
    // Wait for app to load and click start camera
    await page.waitForTimeout(3000);
    
    // Click the start camera button if it exists
    try {
      await page.click('button:has-text("Start Camera")', { timeout: 5000 });
      console.log('Clicked Start Camera button');
    } catch (e) {
      console.log('Start Camera button not found, camera might already be active');
    }
    
    // Listen for console messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('keypoints') || text.includes('render') || text.includes('canvas')) {
        console.log(`[BROWSER]: ${text}`);
      }
    });
    
    // Listen for errors
    page.on('pageerror', error => {
      console.error(`[PAGE ERROR]: ${error.message}`);
      debugData.errors.push(error.message);
    });
    
    console.log('Puppeteer initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize Puppeteer:', error);
  }
}

// API Endpoints
app.get('/debug/status', async (req, res) => {
  if (!page) {
    return res.json({ error: 'Page not initialized' });
  }
  
  try {
    const data = await page.evaluate(() => {
      return {
        canvasRenderCalls: window.poseDebug?.canvasRenderCalls || [],
        keypointHistory: window.poseDebug?.keypointHistory || [],
        canvasElements: Array.from(document.querySelectorAll('canvas')).map(canvas => ({
          className: canvas.className,
          id: canvas.id,
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          offsetParent: canvas.offsetParent?.tagName,
          style: {
            position: window.getComputedStyle(canvas).position,
            zIndex: window.getComputedStyle(canvas).zIndex,
            display: window.getComputedStyle(canvas).display,
            visibility: window.getComputedStyle(canvas).visibility
          }
        }))
      };
    });
    
    res.json(data);
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.post('/debug/fix-canvas', async (req, res) => {
  if (!page) {
    return res.json({ error: 'Page not initialized' });
  }
  
  try {
    const result = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const fixes = [];
      
      canvases.forEach((canvas, index) => {
        // Force canvas to be visible
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '1000';
        canvas.style.pointerEvents = 'none';
        
        // Draw test pattern
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 3;
          ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
          
          ctx.fillStyle = 'yellow';
          ctx.font = '20px Arial';
          ctx.fillText(`Canvas ${index} - ${canvas.width}x${canvas.height}`, 20, 40);
          
          fixes.push({
            index,
            width: canvas.width,
            height: canvas.height,
            testPatternDrawn: true
          });
        }
      });
      
      return fixes;
    });
    
    res.json({ success: true, fixes: result });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.post('/debug/inject-render-hook', async (req, res) => {
  if (!page) {
    return res.json({ error: 'Page not initialized' });
  }
  
  try {
    await page.evaluate(() => {
      // Find the pose detection hook and inject logging
      const scripts = Array.from(document.querySelectorAll('script'));
      
      // Override the renderPose function
      if (window.renderPoseOriginal === undefined) {
        window.renderPoseOriginal = window.renderPose;
        window.renderPose = function(canvas, poseData) {
          console.log('[RENDER] renderPose called with:', {
            canvas: canvas?.tagName,
            canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'null',
            keypointCount: poseData?.keypoints?.length || 0,
            timestamp: Date.now()
          });
          
          if (window.renderPoseOriginal) {
            window.renderPoseOriginal(canvas, poseData);
          }
          
          // Force a visible test render
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.save();
              ctx.strokeStyle = '#00FF00';
              ctx.lineWidth = 5;
              ctx.strokeRect(0, 0, canvas.width, canvas.height);
              ctx.restore();
            }
          }
        };
      }
    });
    
    res.json({ success: true, message: 'Render hook injected' });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.post('/debug/test-skeleton-render', async (req, res) => {
  if (!page) {
    return res.json({ error: 'Page not initialized' });
  }
  
  try {
    const result = await page.evaluate(() => {
      // Find canvas element
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'No 2D context' };
      
      // Clear and draw test skeleton
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Test keypoints
      const testKeypoints = [
        { x: 320, y: 100, confidence: 0.9 }, // nose
        { x: 300, y: 120, confidence: 0.8 }, // left eye
        { x: 340, y: 120, confidence: 0.8 }, // right eye
        { x: 280, y: 200, confidence: 0.9 }, // left shoulder
        { x: 360, y: 200, confidence: 0.9 }, // right shoulder
        { x: 250, y: 300, confidence: 0.7 }, // left elbow
        { x: 390, y: 300, confidence: 0.7 }, // right elbow
      ];
      
      // Draw keypoints
      testKeypoints.forEach((kp, i) => {
        ctx.fillStyle = `rgba(0, 255, 255, ${kp.confidence})`;
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Label
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(`${i}`, kp.x + 10, kp.y);
      });
      
      // Draw connections
      const connections = [[0,1], [0,2], [3,4], [3,5], [4,6]];
      connections.forEach(([start, end]) => {
        const p1 = testKeypoints[start];
        const p2 = testKeypoints[end];
        
        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });
      
      return {
        success: true,
        canvasSize: `${canvas.width}x${canvas.height}`,
        keypointsDrawn: testKeypoints.length,
        connectionsDrawn: connections.length
      };
    });
    
    res.json(result);
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.post('/debug/check-pose-loop', async (req, res) => {
  if (!page) {
    return res.json({ error: 'Page not initialized' });
  }
  
  try {
    const result = await page.evaluate(() => {
      // Check if detection loop is running
      let detectionActive = false;
      let loopInfo = {};
      
      // Look for animation frame IDs
      if (window.animationRef?.current) {
        detectionActive = true;
        loopInfo.animationFrameId = window.animationRef.current;
      }
      
      // Check for pose data
      const lastRenderCalls = window.poseDebug?.canvasRenderCalls?.slice(-10) || [];
      
      return {
        detectionActive,
        loopInfo,
        recentRenderCalls: lastRenderCalls,
        renderCallCount: window.poseDebug?.canvasRenderCalls?.length || 0
      };
    });
    
    res.json(result);
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Start servers
const PORT = 4000;
app.listen(PORT, async () => {
  console.log(`Debug server running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('  GET  /debug/status - Get current debug state');
  console.log('  POST /debug/fix-canvas - Apply canvas visibility fixes');
  console.log('  POST /debug/inject-render-hook - Inject render debugging');
  console.log('  POST /debug/test-skeleton-render - Draw test skeleton');
  console.log('  POST /debug/check-pose-loop - Check detection loop status');
  
  await initPuppeteer();
});

// Cleanup on exit
process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit();
});