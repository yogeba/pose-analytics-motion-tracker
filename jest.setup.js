// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Polyfill ImageData for Node.js environment
if (typeof ImageData === 'undefined') {
  global.ImageData = class ImageData {
    constructor(data, width, height) {
      if (data instanceof Uint8ClampedArray) {
        if (data.length !== width * height * 4) {
          throw new Error('Invalid data length');
        }
        this.data = data;
      } else {
        // Handle the case where width and height are passed as first two args
        this.data = new Uint8ClampedArray(data * width * 4);
        this.width = data;
        this.height = width;
        return;
      }
      this.width = width;
      this.height = height;
    }
  };
}

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === 'webgl2' || contextType === 'webgl') {
    return {
      getParameter: jest.fn(),
      getExtension: jest.fn(),
      getShaderPrecisionFormat: jest.fn(() => ({
        precision: 23,
        rangeMin: 127,
        rangeMax: 127,
      })),
      createBuffer: jest.fn(),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
      createProgram: jest.fn(),
      createShader: jest.fn(),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      useProgram: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      clear: jest.fn(),
      drawArrays: jest.fn(),
      viewport: jest.fn(),
    }
  }
  return null
})

// Mock navigator.hardwareConcurrency
Object.defineProperty(navigator, 'hardwareConcurrency', {
  writable: true,
  configurable: true,
  value: 4
})

// Mock performance.now if not available
if (!global.performance) {
  global.performance = {
    now: () => Date.now()
  }
}

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs-core', () => ({
  ...jest.requireActual('@tensorflow/tfjs-core'),
  browser: {
    fromPixels: jest.fn((pixels) => ({
      shape: [pixels.height, pixels.width, 3],
      dtype: 'float32',
      dispose: jest.fn()
    }))
  },
  image: {
    resizeBilinear: jest.fn((tensor, size) => ({
      ...tensor,
      shape: [size[0], size[1], 3],
      div: jest.fn((val) => ({
        ...tensor,
        transpose: jest.fn((perm) => ({
          ...tensor,
          expandDims: jest.fn((axis) => ({
            ...tensor,
            shape: [1, ...tensor.shape],
            data: jest.fn(async () => new Float32Array(1 * 3 * size[0] * size[1])),
            dispose: jest.fn()
          })),
          dispose: jest.fn()
        })),
        dispose: jest.fn()
      })),
      dispose: jest.fn()
    }))
  },
  backend: jest.fn(() => 'webgl')
}))

// Mock @tensorflow/tfjs-backend-webgl
jest.mock('@tensorflow/tfjs-backend-webgl', () => ({
  setWebGLContext: jest.fn()
}))