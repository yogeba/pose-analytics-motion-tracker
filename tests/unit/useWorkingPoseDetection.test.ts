import { renderHook, act } from '@testing-library/react'
import { useWorkingPoseDetection } from '@/hooks/useWorkingPoseDetection'

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => ({
  loadGraphModel: jest.fn().mockResolvedValue({
    predict: jest.fn().mockReturnValue({
      arraySync: jest.fn().mockReturnValue([[
        // Mock keypoints data
        [0.5, 0.5, 0.9], // nose
        [0.45, 0.4, 0.8], // left_eye
        // ... other keypoints
      ]])
    })
  }),
  browser: {
    fromPixels: jest.fn().mockReturnValue({
      dispose: jest.fn()
    })
  }
}))

// Mock navigator.mediaDevices
global.navigator.mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue({
    getTracks: () => [{
      stop: jest.fn()
    }]
  })
} as any

describe('useWorkingPoseDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useWorkingPoseDetection())
    
    expect(result.current.isInitialized).toBe(false)
    expect(result.current.isDetecting).toBe(false)
    expect(result.current.currentPose).toBeNull()
    expect(result.current.fps).toBe(0)
    expect(result.current.error).toBeNull()
    expect(result.current.loadingStatus).toBe('Not started')
  })

  it('should start camera when startCamera is called', async () => {
    const { result } = renderHook(() => useWorkingPoseDetection())
    
    const mockVideoElement = {
      srcObject: null,
      play: jest.fn().mockResolvedValue(undefined)
    } as any

    await act(async () => {
      const success = await result.current.startCamera(mockVideoElement)
      expect(success).toBe(true)
    })

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      }
    })
    
    expect(mockVideoElement.play).toHaveBeenCalled()
  })

  it('should handle camera errors gracefully', async () => {
    const { result } = renderHook(() => useWorkingPoseDetection())
    
    // Mock getUserMedia to reject
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(
      new Error('Camera permission denied')
    )

    const mockVideoElement = {
      srcObject: null,
      play: jest.fn()
    } as any

    await act(async () => {
      const success = await result.current.startCamera(mockVideoElement)
      expect(success).toBe(false)
    })

    expect(result.current.error).toBe('Failed to access camera')
  })

  it('should update loading status during initialization', async () => {
    const { result, rerender } = renderHook(() => useWorkingPoseDetection())
    
    // Initial state
    expect(result.current.loadingStatus).toBe('Not started')
    
    // Mock window.tf to simulate TensorFlow loading
    (window as any).tf = {
      version: { tfjs: '4.22.0' }
    }
    
    // Trigger initialization
    rerender()
    
    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })
    
    expect(result.current.loadingStatus).toContain('loaded')
  })

  it('should stop detection when stopDetection is called', () => {
    const { result } = renderHook(() => useWorkingPoseDetection())
    
    act(() => {
      result.current.stopDetection()
    })
    
    expect(result.current.isDetecting).toBe(false)
  })
})