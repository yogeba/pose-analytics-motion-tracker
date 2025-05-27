import { test, expect } from '@playwright/test'

test.describe('Debug Pages E2E Tests', () => {
  test('pose-test page should load and detect poses', async ({ page, context }) => {
    // Grant camera permissions
    await context.grantPermissions(['camera'])
    
    // Navigate to pose-test page
    await page.goto('/pose-test')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check initialization status
    await expect(page.getByText('Initialization:')).toBeVisible()
    
    // Wait for TensorFlow to load
    await expect(async () => {
      const statusText = await page.locator('text=/Status:.*TensorFlow loaded/').textContent()
      expect(statusText).toContain('TensorFlow loaded')
    }).toPass({ timeout: 15000 })
    
    // Check if start camera button is visible
    await expect(page.getByRole('button', { name: /Start Camera/i })).toBeVisible()
    
    // Click start camera
    await page.getByRole('button', { name: /Start Camera/i }).click()
    
    // Wait for camera to start
    await page.waitForTimeout(2000)
    
    // Check if video element is visible
    await expect(page.locator('video')).toBeVisible()
    
    // Check if start detection button appears
    await expect(page.getByRole('button', { name: /Start Detection/i })).toBeVisible({ timeout: 5000 })
    
    // Start detection
    await page.getByRole('button', { name: /Start Detection/i }).click()
    
    // Verify detection is running
    await expect(async () => {
      const detectingText = await page.locator('text=/Detecting:.*true/').textContent()
      expect(detectingText).toContain('true')
    }).toPass({ timeout: 10000 })
    
    // Check FPS is greater than 0
    await expect(async () => {
      const fpsText = await page.locator('text=/FPS:.*\\d+/').textContent()
      const fps = parseInt(fpsText?.match(/FPS:\s*(\d+)/)?.[1] || '0')
      expect(fps).toBeGreaterThan(0)
    }).toPass({ timeout: 10000 })
  })

  test('pose-debug page should show detailed debug information', async ({ page, context }) => {
    // Grant camera permissions
    await context.grantPermissions(['camera'])
    
    // Navigate to pose-debug page
    await page.goto('/pose-debug')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check debug interface elements
    await expect(page.getByText('Pose Detection Debug')).toBeVisible()
    
    // Check status indicators
    await expect(page.getByText(/TensorFlow.js:/)).toBeVisible()
    await expect(page.getByText(/Camera:/)).toBeVisible()
    await expect(page.getByText(/Detector:/)).toBeVisible()
    
    // Take screenshot for documentation
    await page.screenshot({ path: 'tests/screenshots/debug-page.png' })
  })
})