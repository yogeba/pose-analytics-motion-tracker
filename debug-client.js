const axios = require('axios');

const API_URL = 'http://localhost:4000';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function checkStatus() {
  try {
    console.log(`\n${colors.cyan}=== Checking Debug Status ===${colors.reset}`);
    const response = await axios.get(`${API_URL}/debug/status`);
    const data = response.data;
    
    console.log(`\n${colors.yellow}Canvas Elements:${colors.reset}`);
    if (data.canvasElements && data.canvasElements.length > 0) {
      data.canvasElements.forEach((canvas, i) => {
        console.log(`  Canvas ${i}:`);
        console.log(`    Size: ${canvas.width}x${canvas.height}`);
        console.log(`    Client Size: ${canvas.clientWidth}x${canvas.clientHeight}`);
        console.log(`    Position: ${canvas.style.position}`);
        console.log(`    Z-Index: ${canvas.style.zIndex}`);
        console.log(`    Display: ${canvas.style.display}`);
        console.log(`    Visibility: ${canvas.style.visibility}`);
      });
    } else {
      console.log(`  ${colors.red}No canvas elements found${colors.reset}`);
    }
    
    console.log(`\n${colors.yellow}Render Calls:${colors.reset}`);
    console.log(`  Total: ${data.canvasRenderCalls?.length || 0}`);
    if (data.canvasRenderCalls && data.canvasRenderCalls.length > 0) {
      const recentCalls = data.canvasRenderCalls.slice(-5);
      recentCalls.forEach(call => {
        console.log(`    ${call.method} at ${new Date(call.timestamp).toLocaleTimeString()}`);
      });
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}Error checking status:${colors.reset}`, error.message);
  }
}

async function fixCanvas() {
  try {
    console.log(`\n${colors.cyan}=== Applying Canvas Fixes ===${colors.reset}`);
    const response = await axios.post(`${API_URL}/debug/fix-canvas`);
    const data = response.data;
    
    if (data.success) {
      console.log(`${colors.green}✓ Canvas fixes applied${colors.reset}`);
      data.fixes.forEach(fix => {
        console.log(`  Canvas ${fix.index}: ${fix.width}x${fix.height} - Test pattern drawn`);
      });
    } else {
      console.log(`${colors.red}✗ Failed to apply fixes${colors.reset}`);
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}Error applying fixes:${colors.reset}`, error.message);
  }
}

async function injectRenderHook() {
  try {
    console.log(`\n${colors.cyan}=== Injecting Render Hook ===${colors.reset}`);
    const response = await axios.post(`${API_URL}/debug/inject-render-hook`);
    const data = response.data;
    
    if (data.success) {
      console.log(`${colors.green}✓ Render hook injected${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to inject hook${colors.reset}`);
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}Error injecting hook:${colors.reset}`, error.message);
  }
}

async function testSkeletonRender() {
  try {
    console.log(`\n${colors.cyan}=== Testing Skeleton Render ===${colors.reset}`);
    const response = await axios.post(`${API_URL}/debug/test-skeleton-render`);
    const data = response.data;
    
    if (data.success) {
      console.log(`${colors.green}✓ Test skeleton rendered${colors.reset}`);
      console.log(`  Canvas: ${data.canvasSize}`);
      console.log(`  Keypoints: ${data.keypointsDrawn}`);
      console.log(`  Connections: ${data.connectionsDrawn}`);
    } else {
      console.log(`${colors.red}✗ Failed to render test skeleton: ${data.error}${colors.reset}`);
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}Error testing render:${colors.reset}`, error.message);
  }
}

async function checkPoseLoop() {
  try {
    console.log(`\n${colors.cyan}=== Checking Pose Detection Loop ===${colors.reset}`);
    const response = await axios.post(`${API_URL}/debug/check-pose-loop`);
    const data = response.data;
    
    console.log(`  Detection Active: ${data.detectionActive ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
    console.log(`  Render Call Count: ${data.renderCallCount}`);
    
    if (data.recentRenderCalls && data.recentRenderCalls.length > 0) {
      console.log(`  Recent Render Calls:`);
      data.recentRenderCalls.forEach(call => {
        console.log(`    - ${call.method}`);
      });
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}Error checking loop:${colors.reset}`, error.message);
  }
}

async function runDebugSequence() {
  console.log(`${colors.bright}${colors.blue}Starting Pose Detection Debug Sequence${colors.reset}`);
  console.log('Make sure the debug server is running and the app is loaded\n');
  
  // Wait a bit for the app to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 1: Check initial status
  await checkStatus();
  
  // Step 2: Inject render hook
  await injectRenderHook();
  
  // Step 3: Wait and check if detection is running
  await new Promise(resolve => setTimeout(resolve, 2000));
  await checkPoseLoop();
  
  // Step 4: Try canvas fixes
  await fixCanvas();
  
  // Step 5: Test skeleton render
  await testSkeletonRender();
  
  // Step 6: Final status check
  await new Promise(resolve => setTimeout(resolve, 1000));
  await checkStatus();
  
  console.log(`\n${colors.bright}${colors.green}Debug sequence complete!${colors.reset}`);
  console.log('Check the browser window to see the results');
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'status':
    checkStatus();
    break;
  case 'fix':
    fixCanvas();
    break;
  case 'hook':
    injectRenderHook();
    break;
  case 'test':
    testSkeletonRender();
    break;
  case 'loop':
    checkPoseLoop();
    break;
  case 'run':
    runDebugSequence();
    break;
  default:
    console.log(`${colors.bright}Pose Detection Debug Client${colors.reset}`);
    console.log('\nUsage: node debug-client.js [command]');
    console.log('\nCommands:');
    console.log('  status - Check current debug status');
    console.log('  fix    - Apply canvas visibility fixes');
    console.log('  hook   - Inject render debugging hooks');
    console.log('  test   - Draw test skeleton on canvas');
    console.log('  loop   - Check if detection loop is running');
    console.log('  run    - Run full debug sequence');
}