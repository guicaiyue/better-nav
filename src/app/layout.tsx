import './globals.css'

import { Toast } from '@heroui/react'
import { Analytics } from '@vercel/analytics/next'
import { MotionConfig } from 'motion/react'
import { ThemeProvider } from 'next-themes'

import { GoogleUtilities, MicrosoftClarity } from '@/components/Analytics'
import FullLoading from '@/components/FullLoading'
import MapleMonoFont from '@/components/MapleMonoFont'
import pkg from '#/package.json'

import Provider from './Provider'

import type { Metadata } from 'next'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Better Nav'
const APP_TITLE = process.env.NEXT_PUBLIC_APP_TITLE || '个人导航'
const APP_DESC = process.env.NEXT_PUBLIC_APP_DESC || '把常用网址放在一起，打开就能用。'
const APP_KEYWORDS = process.env.NEXT_PUBLIC_APP_KEYWORDS || '导航,常用网站,网站入口,工具入口'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nav.xirizhi.cn'
const OG_IMAGE_URL = `${APP_URL}/opengraph-image`
const AUTHOR_NAME = process.env.NEXT_PUBLIC_AUTHOR_NAME || 'Better Nav'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: `${APP_TITLE} | ${APP_NAME}`,
  description: APP_DESC,
  keywords: APP_KEYWORDS,
  authors: [{ name: AUTHOR_NAME, url: pkg.author.url }],
  creator: AUTHOR_NAME,
  publisher: AUTHOR_NAME,
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: APP_NAME,
    description: APP_DESC,
    url: APP_URL,
    siteName: APP_NAME,
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
      },
    ],
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESC,
    creator: 'baiwumm',
    images: [OG_IMAGE_URL],
  },
  manifest: `${APP_URL}/manifest.json`,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="version" content={pkg.version} />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        {/* Google 统计 */}
        <GoogleUtilities />
        {/* 微软统计 */}
        <MicrosoftClarity />
        {/* Vercel 分析 */}
        <Analytics />
      </head>
      <body className="bg-background text-foreground flex min-h-screen flex-col">
        {/* 远程字体非阻塞加载（水合后注入，避免阻塞首屏渲染） */}
        <MapleMonoFont />
        <ThemeProvider attribute="class" enableSystem={false}>
          <MotionConfig reducedMotion="user">
            <FullLoading>
              <Provider>
                {children}
              </Provider>
            </FullLoading>
            <Toast.Provider placement="top" />
          </MotionConfig>
        </ThemeProvider>
      </body>
    </html>
  )
}
