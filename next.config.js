/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Improve production output
  output: 'standalone',
  // Enable image optimization
  images: {
    domains: [],
  },
  // Configure webpack to optimize cache strategy and reduce large string serialization
  webpack: (config, { dev, isServer }) => {
    // Optimize webpack cache to reduce large string serialization
    if (config.cache && config.cache.type === 'filesystem') {
      config.cache.compression = 'gzip';
      config.cache.maxMemoryGenerations = 1;
      config.cache.maxAge = 1000 * 60 * 60 * 24; // 24 hours
      config.cache.allowCollectingMemory = true;
    }
    
    // Optimize module concatenation to reduce bundle size
    if (dev) {
      config.optimization = {
        ...config.optimization,
        concatenateModules: false, // Disable in dev for faster builds
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
              maxSize: 244000, // Limit chunk size to ~244KB
            },
          },
        },
      };
    }
    
    // Reduce memory usage for large modules
    config.module.parser = {
      ...config.module.parser,
      javascript: {
        ...config.module.parser?.javascript,
        commonjsMagicComments: false,
      },
    };
    
    return config;
  },
  // Configure API routes
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  }
}

module.exports = nextConfig 
