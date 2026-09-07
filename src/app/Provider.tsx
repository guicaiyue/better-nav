/*
 * @Author: 白雾茫茫丶<baiwumm.com>
 * @Date: 2026-01-22 09:42:15
 * @LastEditors: 白雾茫茫丶<baiwumm.com>
 * @LastEditTime: 2026-08-04 17:51:27
 * @Description: 上下文提供者
 */
'use client'
import { AppProgressProvider as ProgressProvider } from '@bprogress/next'
import { LayoutGroup } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useEffect, ViewTransition } from 'react'
import { SWRConfig } from 'swr'

import BackTop from '@/components/BackTop'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { SearchProvider } from '@/components/HeaderSearch/context'
import { swrConfig } from '@/lib/swr'

import type { FC, PropsWithChildren } from 'react'

/** 后退方向标记保留时间，动画结束后清除，避免影响后续前进导航 */
const NAV_DIR_RESET_DELAY = 1000

const Providers: FC<PropsWithChildren> = ({ children }) => {
  const isAdmin = usePathname() === '/admin'

  // 浏览器前进/后退会触发 popstate，此时标记「后退」让路由转场反向滑动；
  // 普通链接跳转（pushState）不触发 popstate，默认按「前进」处理
  useEffect(() => {
    const root = document.documentElement
    let timer: number | undefined
    const markBackward = () => {
      root.dataset.navDir = 'backward'
      window.clearTimeout(timer)
      timer = window.setTimeout(() => delete root.dataset.navDir, NAV_DIR_RESET_DELAY)
    }
    window.addEventListener('popstate', markBackward)
    return () => {
      window.removeEventListener('popstate', markBackward)
      window.clearTimeout(timer)
    }
  }, [])
  return (
    <ProgressProvider color="var(--accent)" options={{ showSpinner: true }} shallowRouting>
      <SWRConfig value={swrConfig}>
        <SearchProvider>
          <LayoutGroup>
            <div className={isAdmin ? 'flex h-dvh min-h-0 flex-col overflow-hidden' : 'contents'}>
              {/* 顶部 */}
              <Header />
              {/* 主体内容 */}
              <ViewTransition name="blur-slide">
                <main className={`container mx-auto flex flex-1 flex-col gap-4 p-4 ${isAdmin ? 'min-h-0 overflow-hidden' : 'min-h-0'}`}>
                  {children}
                </main>
              </ViewTransition>
              {/* 管理工作台使用固定视口，避免页脚占用面板高度。 */}
              {!isAdmin && <Footer />}
            </div>
            <BackTop />
          </LayoutGroup>
        </SearchProvider>
      </SWRConfig>
    </ProgressProvider>
  )
}
export default Providers
