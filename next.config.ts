import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['nav.xirizhi.cn'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
}

export default nextConfig
