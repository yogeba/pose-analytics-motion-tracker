#!/usr/bin/env node

/**
 * Industry-standard testing script for pose detection
 * Runs automated tests and provides real-time debugging information
 */

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const logFile = path.join(process.cwd(), 'pose-detection-test.log')

// Clear previous log
fs.writeFileSync(logFile, `Pose Detection Test Log - ${new Date().toISOString()}\n\n`)

function log(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  console.log(logMessage)
  fs.appendFileSync(logFile, logMessage)
}

async function runTests() {
  log('Starting pose detection tests...')
  
  // 1. Run unit tests
  log('\n=== Running Unit Tests ===')
  await runCommand('npm', ['test', '--', '--testPathPattern=unit'])
  
  // 2. Start dev server
  log('\n=== Starting Development Server ===')
  const devServer = spawn('npm', ['run', 'dev'], {
    detached: false,
    stdio: 'pipe'
  })
  
  // Wait for server to start
  await new Promise(resolve => {
    devServer.stdout?.on('data', (data) => {
      const output = data.toString()
      if (output.includes('Ready in') || output.includes('started server')) {
        log('Development server started successfully')
        resolve(true)
      }
    })
  })
  
  // Give it a bit more time to stabilize
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // 3. Run E2E tests
  log('\n=== Running E2E Tests ===')
  await runCommand('npx', ['playwright', 'test', '--reporter=list'])
  
  // 4. Run specific debug tests
  log('\n=== Running Debug Page Tests ===')
  await runCommand('npx', ['playwright', 'test', 'debug-pages.spec.ts', '--reporter=list'])
  
  // Cleanup
  log('\n=== Cleaning up ===')
  devServer.kill()
  
  log('\nTests completed! Check pose-detection-test.log for full output.')
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'pipe' })
    
    proc.stdout?.on('data', (data) => {
      const output = data.toString()
      log(`[${command}] ${output}`)
    })
    
    proc.stderr?.on('data', (data) => {
      const output = data.toString()
      log(`[${command} ERROR] ${output}`)
    })
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        log(`${command} exited with code ${code}`)
        resolve() // Continue even if tests fail
      }
    })
  })
}

// Run tests
runTests().catch(error => {
  log(`Test runner error: ${error}`)
  process.exit(1)
})