import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['nav.xirizhi.cn', '192.168.1.4', '192.168.8.44'],
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
}

export default nextConfig
