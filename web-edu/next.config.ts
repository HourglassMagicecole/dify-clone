import type { NextConfig } from 'next'

// Use API_HOST from environment, fallback to localhost for local development
const API_HOST = process.env.API_HOST || 'localhost:5001'

// Parse API_HOST to extract hostname for image remote patterns
const apiHostname = new URL(`http://${API_HOST}`).hostname

// Additional allowed image hosts (comma-separated) from environment
const extraHosts = (process.env.ALLOWED_IMAGE_HOSTS || '')
  .split(',')
  .map(h => h.trim())
  .filter(Boolean)

const nextConfig: NextConfig = {
  /* config options here */

  // Disable compression to allow SSE streaming without buffering
  // Production deployments typically use Nginx for compression instead
  compress: false,

  // Enable standalone output for Docker builds
  output: 'standalone',

  // Image configuration — only allow known hosts (SSRF prevention)
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: apiHostname,
      },
      {
        protocol: 'https',
        hostname: apiHostname,
      },
      ...extraHosts.flatMap(host => [
        { protocol: 'http' as const, hostname: host },
        { protocol: 'https' as const, hostname: host },
      ]),
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
