import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow requests from dentplus.ca subdomains
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
