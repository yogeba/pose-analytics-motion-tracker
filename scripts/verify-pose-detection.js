#!/usr/bin/env node

/**
 * Quick verification script to test pose detection locally
 * Run with: node scripts/verify-pose-detection.js
 */

const puppeteer = require('puppeteer');

async function verifyPoseDetection() {
  console.log('🔍 Starting pose detection verification...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ]
  });
  
  const page = await browser.newPage();
  
  // Grant camera permissions
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:3001', ['camera']);
  
  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.error('❌ Browser Error:', text);
    } else if (text.includes('TensorFlow') || text.includes('pose') || text.includes('FPS')) {
      console.log(`✓ ${text}`);
    }
  });
  
  console.log('📱 Opening http://localhost:3001...');
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });
  
  // Wait for app to load
  await page.waitForTimeout(3000);
  
  // Check if video element exists
  const hasVideo = await page.evaluate(() => {
    const video = document.querySelector('video');
    return video !== null;
  });
  console.log(`📹 Video element: ${hasVideo ? '✓ Found' : '❌ Not found'}`);
  
  // Check if canvas exists
  const hasCanvas = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas !== null;
  });
  console.log(`🎨 Canvas element: ${hasCanvas ? '✓ Found' : '❌ Not found'}`);
  
  // Check TensorFlow.js
  const tfLoaded = await page.evaluate(() => {
    return typeof window.tf !== 'undefined';
  });
  console.log(`🤖 TensorFlow.js: ${tfLoaded ? '✓ Loaded' : '❌ Not loaded'}`);
  
  if (tfLoaded) {
    const tfVersion = await page.evaluate(() => window.tf.version.tfjs);
    console.log(`   Version: ${tfVersion}`);
  }
  
  // Wait for pose detection to start
  console.log('\n⏳ Waiting for pose detection to initialize...');
  await page.waitForTimeout(5000);
  
  // Check FPS
  const fpsText = await page.evaluate(() => {
    const fpsElements = Array.from(document.querySelectorAll('*')).filter(el => 
      el.textContent?.includes('FPS:')
    );
    return fpsElements[0]?.textContent || null;
  });
  
  if (fpsText) {
    const fps = parseInt(fpsText.match(/FPS:\s*(\d+)/)?.[1] || '0');
    console.log(`\n📊 FPS: ${fps}`);
    if (fps > 0) {
      console.log('✅ Pose detection is working!');
    } else {
      console.log('⚠️  FPS is 0 - pose detection may not be running');
    }
  } else {
    console.log('❌ Could not find FPS counter');
  }
  
  // Check for errors
  const errors = await page.evaluate(() => {
    return window.__poseDetectionErrors || [];
  });
  
  if (errors.length > 0) {
    console.log('\n❌ Errors detected:');
    errors.forEach(err => console.log(`   - ${err}`));
  }
  
  // Take screenshot
  await page.screenshot({ path: 'pose-detection-test.png' });
  console.log('\n📸 Screenshot saved to pose-detection-test.png');
  
  // Test debug pages
  console.log('\n🔧 Testing debug pages...');
  
  // Test pose-test page
  await page.goto('http://localhost:3001/pose-test', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(3000);
  const poseTestStatus = await page.evaluate(() => {
    return document.body.textContent || '';
  });
  console.log(`/pose-test: ${poseTestStatus.includes('true') ? '✓ Working' : '❌ Issues detected'}`);
  
  // Test pose-debug page
  await page.goto('http://localhost:3001/pose-debug', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);
  console.log('/pose-debug: ✓ Loaded');
  
  console.log('\n✨ Verification complete!');
  
  // Keep browser open for manual inspection
  console.log('\n👀 Browser will stay open for manual inspection.');
  console.log('Press Ctrl+C to close.');
}

verifyPoseDetection().catch(console.error);