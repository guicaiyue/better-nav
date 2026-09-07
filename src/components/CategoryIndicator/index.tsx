/*
 * @Author: 白雾茫茫丶<baiwumm.com>
 * @Date: 2026-08-10 10:00:00
 * @Description: 响应式分类目录（可见分类名、站点数量、锚点跳转与 scroll-spy 高亮）
 */
'use client'
import { cn } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'

import styles from './index.module.css'

import type { Category } from '@/types'

interface CategoryIndicatorProps {
  categories: Category[]
}

/** 分类标题进入顶部导航下方后，切换当前分类 */
const ACTIVE_LINE_MAX_OFFSET = 160

export default function CategoryIndicator({ categories }: CategoryIndicatorProps) {
  const [activeId, setActiveId] = useState('')
  const pendingTargetRef = useRef<string | null>(null)
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const getActiveId = () => {
      if (!categories.length)
        return ''

      // 页面到底时强制选中最后一项，避免末尾分类因内容较短永远无法越过判定线。
      const root = document.documentElement
      const isAtBottom = window.scrollY + window.innerHeight >= root.scrollHeight - 4
      if (isAtBottom)
        return categories.at(-1)?.id ?? ''

      const threshold = Math.min(window.innerHeight * 0.25, ACTIVE_LINE_MAX_OFFSET)
      let current = categories[0].id

      // 选择最后一个越过判定线的标题，首屏不会提前高亮下一分类。
      for (const { id } of categories) {
        const el = document.getElementById(`cat-${id}`)
        if (!el)
          continue
        if (el.getBoundingClientRect().top > threshold)
          break
        current = id
      }
      return current
    }

    const commitCurrent = () => {
      pendingTargetRef.current = null
      if (scrollIdleTimerRef.current)
        clearTimeout(scrollIdleTimerRef.current)
      scrollIdleTimerRef.current = undefined
      const current = getActiveId()
      setActiveId(previous => (previous === current ? previous : current))
    }

    const update = () => {
      if (pendingTargetRef.current) {
        if (scrollIdleTimerRef.current)
          clearTimeout(scrollIdleTimerRef.current)
        scrollIdleTimerRef.current = setTimeout(commitCurrent, 140)
        return
      }
      const current = getActiveId()
      setActiveId(previous => (previous === current ? previous : current))
    }

    const initialUpdateTimer = setTimeout(update, 0)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('scrollend', commitCurrent)
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(initialUpdateTimer)
      window.removeEventListener('scroll', update)
      window.removeEventListener('scrollend', commitCurrent)
      window.removeEventListener('resize', update)
      if (scrollIdleTimerRef.current)
        clearTimeout(scrollIdleTimerRef.current)
      if (animationFrameRef.current !== undefined)
        cancelAnimationFrame(animationFrameRef.current)
      if (animationTimerRef.current !== undefined)
        clearTimeout(animationTimerRef.current)
    }
  }, [categories])

  // 移动端分类较多时，仅横向滚动导航，避免 item.scrollIntoView 取消正文的平滑滚动。
  useEffect(() => {
    if (!activeId || window.matchMedia('(min-width: 1024px)').matches)
      return
    const item = document.getElementById(`cat-bar-${activeId}`)
    const navigation = item?.closest('nav')
    if (!item || !navigation)
      return

    const itemRect = item.getBoundingClientRect()
    const navigationRect = navigation.getBoundingClientRect()
    if (itemRect.left < navigationRect.left)
      navigation.scrollBy({ left: itemRect.left - navigationRect.left - 16 })
    else if (itemRect.right > navigationRect.right)
      navigation.scrollBy({ left: itemRect.right - navigationRect.right + 16 })
  }, [activeId])

  // 首次以分类 hash 进入时，在水合和首屏遮罩完成后恢复锚点位置。
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#cat-'))
      return
    const el = document.getElementById(`cat-${hash.slice('#cat-'.length)}`)
    if (!el)
      return
    requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
  }, [])

  const scrollToCategory = (id: string) => {
    const el = document.getElementById(`cat-${id}`)
    if (!el)
      return

    if (animationFrameRef.current !== undefined)
      cancelAnimationFrame(animationFrameRef.current)
    if (animationTimerRef.current !== undefined)
      clearTimeout(animationTimerRef.current)
    animationFrameRef.current = undefined
    animationTimerRef.current = undefined

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startY = window.scrollY
    const scrollMarginTop = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const targetY = Math.max(0, Math.min(startY + el.getBoundingClientRect().top - scrollMarginTop, maxScrollY))
    const distance = targetY - startY

    pendingTargetRef.current = id
    if (scrollIdleTimerRef.current)
      clearTimeout(scrollIdleTimerRef.current)

    const finish = () => {
      if (animationFrameRef.current !== undefined)
        cancelAnimationFrame(animationFrameRef.current)
      if (animationTimerRef.current !== undefined)
        clearTimeout(animationTimerRef.current)
      animationFrameRef.current = undefined
      animationTimerRef.current = undefined
      window.scrollTo({ top: targetY, behavior: 'auto' })
      window.dispatchEvent(new Event('scrollend'))
    }

    if (prefersReducedMotion || Math.abs(distance) < 2) {
      finish()
    }
    else {
      const duration = Math.min(650, Math.max(280, Math.abs(distance) * 0.22))
      const startedAt = performance.now()

      const animate = (now: number) => {
        if (animationFrameRef.current !== undefined)
          cancelAnimationFrame(animationFrameRef.current)
        if (animationTimerRef.current !== undefined)
          clearTimeout(animationTimerRef.current)
        animationFrameRef.current = undefined
        animationTimerRef.current = undefined

        const progress = Math.min((now - startedAt) / duration, 1)
        const eased = 1 - (1 - progress) ** 3
        window.scrollTo({ top: startY + distance * eased, behavior: 'auto' })
        if (progress >= 1) {
          finish()
          return
        }
        animationFrameRef.current = requestAnimationFrame(animate)
        animationTimerRef.current = setTimeout(() => animate(performance.now()), 34)
      }

      animationFrameRef.current = requestAnimationFrame(animate)
      animationTimerRef.current = setTimeout(() => animate(performance.now()), 34)
    }
    // replaceState 保留可分享锚点，同时不为每次目录跳转制造历史记录。
    history.replaceState(null, '', `#cat-${id}`)
  }

  if (!categories.length)
    return null

  return (
    <nav
      aria-label="分类导航"
      className={cn(
        styles.navigation,
        'sticky top-[4.5rem] z-30 -mx-4 overflow-x-auto border-y border-default-200 bg-background/90 px-4 py-2 backdrop-blur-xl',
        'lg:top-[5.5rem] lg:z-10 lg:m-0 lg:max-h-[calc(100dvh-6.5rem)] lg:w-44 lg:self-start lg:overflow-y-auto lg:overflow-x-hidden lg:rounded-2xl lg:border lg:p-2 lg:shadow-sm',
      )}
    >
      <div className="mb-2 hidden items-center justify-between border-b border-default-200 px-2 pb-2 lg:flex">
        <p className="text-sm font-black tracking-tight">分类目录</p>
        <span className="text-[11px] tabular-nums text-default-500">
          {categories.length}
          {' '}
          组
        </span>
      </div>

      <ol className="flex min-w-max items-center gap-2 lg:min-w-0 lg:flex-col lg:items-stretch lg:gap-1">
        {categories.map(({ id, name, websites }, index) => {
          const isActive = id === activeId
          const websiteCount = websites?.length ?? 0

          return (
            <li key={id} className="shrink-0 lg:w-full">
              <button
                aria-current={isActive ? 'location' : undefined}
                aria-label={`跳转到分类：${name}，${websiteCount} 个站点`}
                id={`cat-bar-${id}`}
                type="button"
                onClick={() => scrollToCategory(id)}
                className={cn(
                  'group flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left outline-none transition-colors lg:gap-1.5',
                  'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  isActive
                    ? 'border-accent/30 bg-accent/10 text-foreground'
                    : 'border-transparent text-default-500 hover:border-default-200 hover:bg-default-100 hover:text-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tabular-nums transition-colors',
                    isActive
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-default-100 text-default-500 group-hover:bg-default-200 group-hover:text-foreground',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span className="max-w-32 truncate text-sm font-medium lg:max-w-none lg:min-w-0 lg:flex-1">
                  {name}
                </span>

                <span className="hidden shrink-0 text-[10px] tabular-nums text-default-500 lg:block">
                  {websiteCount}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
