import { test, expect } from '@playwright/test'

test.describe('Pose Detection E2E Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant camera permissions
    await context.grantPermissions(['camera'])
    
    // Navigate to the app
    await page.goto('/')
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle')
  })

  test('should load the pose detection interface', async ({ page }) => {
    // Check if camera interface is visible
    await expect(page.locator('[data-testid="camera-view"]')).toBeVisible({ timeout: 10000 })
    
    // Check if mode selector is visible
    await expect(page.getByText('POSE')).toBeVisible()
    
    // Check if record button is visible
    await expect(page.locator('[data-testid="record-button"]')).toBeVisible()
  })

  test('should show FPS counter when pose detection starts', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(3000)
    
    // Check FPS counter
    const fpsText = await page.locator('text=/FPS:.*/')
    await expect(fpsText).toBeVisible()
    
    // FPS should be greater than 0 after initialization
    await expect(async () => {
      const text = await fpsText.textContent()
      const fps = parseInt(text?.match(/FPS:\s*(\d+)/)?.[1] || '0')
      expect(fps).toBeGreaterThan(0)
    }).toPass({ timeout: 10000 })
  })

  test('should detect pose keypoints', async ({ page }) => {
    // Wait for pose detection to initialize
    await page.waitForTimeout(5000)
    
    // Check if canvas is rendering
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'tests/screenshots/pose-detection.png' })
    
    // Check if pose data is being processed
    await expect(async () => {
      const hasPoseData = await page.evaluate(() => {
        // Check if TensorFlow.js is loaded
        return window.tf !== undefined
      })
      expect(hasPoseData).toBeTruthy()
    }).toPass({ timeout: 10000 })
  })

  test('should switch between camera modes', async ({ page }) => {
    // Test mode switching
    const modes = ['VIDEO', 'PHOTO', 'POSE', 'ANALYSIS']
    
    for (const mode of modes) {
      await page.getByText(mode, { exact: true }).click()
      await page.waitForTimeout(500)
      
      // Verify mode is selected (you may need to add data-testid to track selected state)
      // await expect(page.locator(`[data-mode="${mode.toLowerCase()}"][data-selected="true"]`)).toBeVisible()
    }
  })

  test('should handle pose detection errors gracefully', async ({ page }) => {
    // Monitor console for errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    // Wait for app to stabilize
    await page.waitForTimeout(5000)
    
    // Check that no critical errors occurred
    const criticalErrors = errors.filter(err => 
      err.includes('TypeError') || 
      err.includes('ReferenceError') ||
      err.includes('Failed to load')
    )
    
    expect(criticalErrors).toHaveLength(0)
  })

  test('should display metrics when reference pose is selected', async ({ page }) => {
    // Wait for initialization
    await page.waitForTimeout(3000)
    
    // Check if metrics are displayed
    await expect(page.getByText('Pose Match')).toBeVisible()
    await expect(page.getByText('Symmetry')).toBeVisible()
    await expect(page.getByText('Stability')).toBeVisible()
    await expect(page.getByText('Balance')).toBeVisible()
  })
})