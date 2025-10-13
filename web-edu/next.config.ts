import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */

  // API rewrites to bypass CORS issues (TECH-002 risk mitigation)
  async rewrites() {
    return [
      {
        source: '/console/api/:path*',
        destination: 'http://localhost:5001/console/api/:path*',
      },
    ]
  },
}

export default nextConfig
