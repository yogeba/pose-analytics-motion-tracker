import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

    // Exclude MediaPipe modules that cause build issues
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('@mediapipe/pose');
      config.externals.push('@mediapipe/holistic');
    }

    // Resolve alias to avoid MediaPipe imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@mediapipe/pose': false,
      '@mediapipe/holistic': false,
    };

    // Add WebAssembly support for ONNX Runtime
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    
    // Add rule for .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

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
