/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Improve production output
  output: 'standalone',
  // Enable image optimization
  images: {
    domains: [],
  },
  // Configure webpack to optimize cache strategy
  webpack: (config, { dev, isServer }) => {
    // Only optimize webpack cache, don't modify splitChunks in dev mode
    if (config.cache && config.cache.type === 'filesystem') {
      config.cache.compression = 'gzip';
      config.cache.maxMemoryGenerations = 1;
      config.cache.maxAge = 1000 * 60 * 60 * 24; // 24 hours
      config.cache.allowCollectingMemory = true;
    }
    
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
