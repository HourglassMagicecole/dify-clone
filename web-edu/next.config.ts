import type { NextConfig } from 'next'

// Use API_HOST from environment, fallback to localhost for local development
const API_HOST = process.env.API_HOST || 'localhost:5001'

const nextConfig: NextConfig = {
  /* config options here */

  // Disable compression to allow SSE streaming without buffering
  // Production deployments typically use Nginx for compression instead
  compress: false,

  // Enable standalone output for Docker builds
  output: 'standalone',

  // Image configuration for external sources
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '*',
      },
      {
        protocol: 'https',
        hostname: '*',
      },
    ],
  },

  // API rewrites to bypass CORS issues (TECH-002 risk mitigation)
  async rewrites() {
    return [
      {
        source: '/console/api/:path*',
        destination: `http://${API_HOST}/console/api/:path*`,
      },
      {
        source: '/files/:path*',
        destination: `http://${API_HOST}/files/:path*`,
      },
      {
        source: '/v1/:path*',
        destination: `http://${API_HOST}/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
