import type { NextConfig } from 'next'

// Use API_HOST from environment, fallback to localhost for local development
const API_HOST = process.env.API_HOST || 'localhost:5001'

const nextConfig: NextConfig = {
  /* config options here */

  // Enable standalone output for Docker builds
  output: 'standalone',

  // API rewrites to bypass CORS issues (TECH-002 risk mitigation)
  async rewrites() {
    return [
      {
        source: '/console/api/:path*',
        destination: `http://${API_HOST}/console/api/:path*`,
      },
    ]
  },
}

export default nextConfig
