/*
 * @Author: 白雾茫茫丶<baiwumm.com>
 * @Date: 2026-02-05 14:08:41
 * @LastEditors: 白雾茫茫丶<baiwumm.com>
 * @LastEditTime: 2026-08-31 18:20:00
 * @Description: 站点卡片
 */
'use client'
import { ArrowUpRightFromSquare, BookOpen, Globe } from '@gravity-ui/icons'
import { Button, Card, Chip, cn } from '@heroui/react'
import Image from 'next/image'
import Link from 'next/link'
import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import GitHubPanel from './GitHubPanel'
import { uniqueTags } from './tags'

import type { Website } from '@/types'
import type { FC } from 'react'

interface WebsiteCardProps {
  data: Website
  /** 首屏图片预加载：首页视口内的卡片传 true */
  priority?: boolean
}

const WebsiteCard: FC<WebsiteCardProps> = memo(({ data, priority = false }) => {
  const { id, name, desc, tags, url } = data || {}
  const displayTags = uniqueTags(tags)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'detail' | 'github'>('detail')
  const [isZreadLinkOpen, setIsZreadLinkOpen] = useState(false)
  const [drawerPosition, setDrawerPosition] = useState<{ left: number, top: number, width: number }>()
  const cardWrapperRef = useRef<HTMLDivElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const zreadHoverTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const zreadCloseTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const faviconUrl = `https://favicon.im/${new URL(url).hostname}`
  const githubRepository = getGitHubRepository(url)
  const zreadUrl = githubRepository ? `https://zread.ai/${githubRepository.owner}/${githubRepository.repository}` : null
  const directOpenLabel = `直接打开 ${name}`
  const zreadLabel = `在 Zread 阅读 ${name}（GitHub 仓库智能阅读）`

  const clearZreadTimers = () => {
    if (zreadHoverTimerRef.current)
      clearTimeout(zreadHoverTimerRef.current)
    if (zreadCloseTimerRef.current)
      clearTimeout(zreadCloseTimerRef.current)
  }

  useEffect(() => clearZreadTimers, [])

  const recordVisit = () => {
    void fetch(`/api/websites/${id}/visit`, { method: 'POST', keepalive: true }).catch(() => {})
  }

  const updateDrawerPosition = () => {
    const rect = cardWrapperRef.current?.getBoundingClientRect()
    if (!rect)
      return

    setDrawerPosition({ left: rect.left, top: rect.top, width: rect.width })
  }

  useEffect(() => {
    if (!isDrawerOpen)
      return

    window.addEventListener('resize', updateDrawerPosition)
    window.addEventListener('scroll', updateDrawerPosition, true)
    return () => {
      window.removeEventListener('resize', updateDrawerPosition)
      window.removeEventListener('scroll', updateDrawerPosition, true)
    }
  }, [isDrawerOpen])

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      updateDrawerPosition()
      setIsDrawerOpen(true)
    }, 500)
  }

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
    }
    setIsDrawerOpen(false)
  }

  const handleZreadMouseEnter = () => {
    if (!zreadUrl)
      return

    clearZreadTimers()
    if (!isZreadLinkOpen)
      zreadHoverTimerRef.current = setTimeout(setIsZreadLinkOpen, 500, true)
  }

  const handleZreadMouseLeave = () => {
    if (!zreadUrl)
      return

    if (zreadHoverTimerRef.current)
      clearTimeout(zreadHoverTimerRef.current)

    // 留出跨越按钮和上方 Zread 入口的缓冲，慢速移动不会使入口提前消失。
    zreadCloseTimerRef.current = setTimeout(setIsZreadLinkOpen, 300, false)
  }

  const handleOpenDetail = () => {
    setActiveTab('detail')
    setIsDetailOpen(true)
  }

  const handleOpenWebsite = () => {
    recordVisit()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <div ref={cardWrapperRef} onClick={handleOpenDetail} className="group relative block">
        <Card
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="relative z-20 h-full cursor-pointer transition-transform duration-150 hover:-translate-y-1"
        >
          <Card.Header className="block space-y-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative size-10 shrink-0">
                <Image
                  alt={`${name} 图标`}
                  fill
                  priority={priority}
                  src={faviconUrl}
                  className="rounded-lg object-contain"
                />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Card.Title className="min-w-0 flex-1 truncate text-base font-bold">{name}</Card.Title>
                <div
                  onMouseEnter={handleZreadMouseEnter}
                  onMouseLeave={handleZreadMouseLeave}
                  className="relative z-40 shrink-0"
                >
                  {zreadUrl
                    ? (
                        <a
                          aria-hidden={!isZreadLinkOpen}
                          aria-label={zreadLabel}
                          href={zreadUrl}
                          rel="noreferrer"
                          tabIndex={isZreadLinkOpen ? 0 : -1}
                          target="_blank"
                          onClick={event => event.stopPropagation()}
                          className={cn(
                            // 入口紧贴直连按钮，整个操作区为连续 hover 域，且始终位于描述抽屉之上。
                            'absolute bottom-full right-0 z-50 inline-flex size-8 items-center justify-center rounded-t-lg border border-b-0 bg-white text-accent shadow-lg transition-all duration-150 ease-out hover:bg-accent hover:text-accent-foreground dark:bg-zinc-900',
                            isZreadLinkOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
                          )}
                        >
                          <BookOpen aria-hidden="true" className="size-4" />
                        </a>
                      )
                    : null}
                  <Button
                    aria-label={directOpenLabel}
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onClick={(event) => {
                      event.stopPropagation()
                      handleOpenWebsite()
                    }}
                    className="size-7"
                  >
                    <ArrowUpRightFromSquare aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            {displayTags.length
              ? (
                  <div className="flex flex-nowrap gap-1 overflow-hidden whitespace-nowrap">
                    {displayTags.map(tag => (
                      <Chip key={tag} variant="soft" className="shrink-0 text-[10px]/4">{tag}</Chip>
                    ))}
                  </div>
                )
              : null}
          </Card.Header>
        </Card>
      </div>

      {desc && drawerPosition
        ? createPortal(
            (
              <div
                aria-hidden={!isDrawerOpen}
                className={cn(
                  'pointer-events-none fixed z-[60] rounded-xl border bg-white px-3 py-2 text-sm text-foreground shadow-lg dark:bg-zinc-900 transition-opacity duration-150 ease-out',
                  isDrawerOpen ? 'opacity-100' : 'opacity-0',
                )}
                style={{ left: drawerPosition.left, top: drawerPosition.top, width: drawerPosition.width, transform: 'translateY(calc(-100% - 0.5rem))' }}
              >
                <p className="line-clamp-2">{desc}</p>
              </div>
            ),
            document.body,
          )
        : null}

      {isDetailOpen
        ? createPortal(
            (
              <div
                aria-label="关闭网站详情"
                role="presentation"
                onClick={() => setIsDetailOpen(false)}
                className="fixed inset-0 z-50 flex items-start justify-center bg-white/30 p-4 pt-[10vh]"
              >
                <section
                  aria-labelledby={`website-detail-${id}`}
                  aria-modal="true"
                  role="dialog"
                  onClick={event => event.stopPropagation()}
                  className="relative w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
                >
                  <button
                    aria-label="关闭"
                    type="button"
                    onClick={() => setIsDetailOpen(false)}
                    className="absolute right-4 top-4 rounded-md px-2 py-1 text-xl text-default-500 hover:bg-default-100"
                  >
                    ×
                  </button>
                  <div className="mb-4 flex items-center gap-3 pr-8">
                    <Globe className="size-5 text-accent" />
                    <h2 id={`website-detail-${id}`} className="text-lg font-bold">{name}</h2>
                  </div>
                  <div aria-label="网站信息" role="tablist" className="mb-5 flex border-b border-default-200">
                    <button
                      aria-controls={`website-detail-panel-${id}`}
                      aria-selected={activeTab === 'detail'}
                      id={`website-detail-tab-${id}`}
                      role="tab"
                      type="button"
                      onClick={() => setActiveTab('detail')}
                      className={cn(
                        '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                        activeTab === 'detail' ? 'border-accent text-accent' : 'border-transparent text-default-500 hover:text-foreground',
                      )}
                    >
                      详情
                    </button>
                    {githubRepository
                      ? (
                          <button
                            aria-controls={`website-github-panel-${id}`}
                            aria-selected={activeTab === 'github'}
                            id={`website-github-tab-${id}`}
                            role="tab"
                            type="button"
                            onClick={() => setActiveTab('github')}
                            className={cn(
                              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                              activeTab === 'github' ? 'border-accent text-accent' : 'border-transparent text-default-500 hover:text-foreground',
                            )}
                          >
                            GitHub
                          </button>
                        )
                      : null}
                  </div>
                  {activeTab === 'github' && githubRepository
                    ? (
                        <div
                          aria-labelledby={`website-github-tab-${id}`}
                          id={`website-github-panel-${id}`}
                          role="tabpanel"
                          className="max-h-[65vh] overflow-y-auto pr-1"
                        >
                          <GitHubPanel owner={githubRepository.owner} repository={githubRepository.repository} />
                        </div>
                      )
                    : (
                        <div
                          aria-labelledby={`website-detail-tab-${id}`}
                          id={`website-detail-panel-${id}`}
                          role="tabpanel"
                        >
                          <div className="space-y-5">
                            <div className="flex items-center gap-3">
                              <div className="relative size-12 shrink-0">
                                <Image alt={`${name} 图标`} fill src={faviconUrl} className="rounded-xl object-contain" />
                              </div>
                              <Link href={url} target="_blank" className="min-w-0 truncate text-sm text-accent hover:underline">
                                {url}
                              </Link>
                            </div>
                            {desc ? <p className="text-sm leading-6 text-default-600">{desc}</p> : <p className="text-sm text-default-500">暂无网站简介</p>}
                            {displayTags.length
                              ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {displayTags.map(tag => (
                                      <Chip key={tag} variant="soft">{tag}</Chip>
                                    ))}
                                  </div>
                                )
                              : null}
                          </div>
                          <div className="mt-6 flex justify-end gap-2">
                            <Button variant="outline" onPress={() => setIsDetailOpen(false)}>关闭</Button>
                            {zreadUrl
                              ? (
                                  <a
                                    href={zreadUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                    onClick={event => event.stopPropagation()}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-accent px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
                                  >
                                    在 Zread 阅读
                                    <BookOpen className="size-4" />
                                  </a>
                                )
                              : null}
                            <a
                              href={url}
                              rel="noreferrer"
                              target="_blank"
                              onClick={(event) => {
                                event.stopPropagation()
                                recordVisit()
                              }}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                            >
                              访问网站
                              <ArrowUpRightFromSquare className="size-4" />
                            </a>
                          </div>
                        </div>
                      )}
                </section>
              </div>
            ),
            document.body,
          )
        : null}
    </>
  )
})

function getGitHubRepository(url: string) {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname !== 'github.com')
      return null

    const [owner, rawRepository] = parsedUrl.pathname.split('/').filter(Boolean)
    if (!owner || !rawRepository)
      return null

    return { owner, repository: rawRepository.replace(/\.git$/, '') }
  }
  catch {
    return null
  }
}

export default WebsiteCard
