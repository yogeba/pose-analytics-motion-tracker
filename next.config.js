/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  transpilePackages: [
    '@tensorflow/tfjs',
    '@tensorflow/tfjs-core',
    '@tensorflow/tfjs-backend-webgl',
    '@tensorflow/tfjs-backend-webgpu',
    '@tensorflow/tfjs-converter',
    '@tensorflow-models/pose-detection',
    '@mediapipe/pose',
  ],
  webpack: (config, { isServer }) => {
    // Handle TensorFlow.js and prevent SSR issues
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
      
      // Handle WASM files for TensorFlow.js
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'webassembly/async',
      })

      // Handle MediaPipe modules
      config.module.rules.push({
        test: /node_modules\/@mediapipe\/.*\.js$/,
        type: 'javascript/auto',
      })
    }

    // Resolve MediaPipe modules as external dependencies in server-side rendering
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        '@mediapipe/pose': 'commonjs @mediapipe/pose',
      })
    }

    // Optimize for mobile and handle dynamic imports
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          tensorflow: {
            test: /[\\/]node_modules[\\/](@tensorflow|@tensorflow-models)[\\/]/,
            name: 'tensorflow',
            chunks: 'async', // Load TensorFlow chunks asynchronously
            enforce: true,
          },
          mediapipe: {
            test: /[\\/]node_modules[\\/]@mediapipe[\\/]/,
            name: 'mediapipe',
            chunks: 'async',
            enforce: true,
          },
        },
      },
    }

    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ]
  },
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig