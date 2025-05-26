/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbopack: true,
  },
  webpack: (config, { dev, isServer }) => {
    // Handle TensorFlow.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Ignore worker-related modules that can cause build issues
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: { loader: 'worker-loader' },
    });

    // Exclude problematic modules
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('@mediapipe/pose');
      config.externals.push('@mediapipe/holistic');
      // Exclude ONNX runtime in production build
      if (!dev) {
        config.externals.push('onnxruntime-web');
      }
    }

    // Resolve alias to avoid MediaPipe imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@mediapipe/pose': false,
      '@mediapipe/holistic': false,
    };

    // Add WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    
    // Handle .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // Ignore ONNX runtime web in production to avoid build issues
    if (!dev) {
      config.module = {
        ...config.module,
        noParse: [
          ...(config.module.noParse || []),
          /onnxruntime-web/,
        ],
      };
    }

    return config;
  },
  // Enable static optimization
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Handle large dependencies like TensorFlow.js
  transpilePackages: [
    '@tensorflow/tfjs',
    '@tensorflow/tfjs-core',
    '@tensorflow/tfjs-converter',
    '@tensorflow/tfjs-backend-webgl',
    '@tensorflow/tfjs-backend-webgpu',
    '@tensorflow-models/pose-detection',
  ],
};

export default nextConfig;