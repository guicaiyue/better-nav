/*
 * @Author: 白雾茫茫丶<baiwumm.com>
 * @Date: 2026-08-10 10:00:00
 * @Description: 首页内容（客户端展示层）
 */
'use client'
import { DatabaseFill } from '@gravity-ui/icons'
import { Typography } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'

import AlertContent from '@/components/AlertContent'
import BlurFade from '@/components/BlurFade'
import CategoryIndicator from '@/components/CategoryIndicator'
import { useWebsiteSearch } from '@/components/HeaderSearch/search-context'
import WebsiteCard from '@/components/WebSiteCard'
import { normalizeKeyword, searchByKeywords } from '@/lib/keyword-contract'
import { recordSearchClick } from '@/lib/search-click'

import type { SearchKeyword } from '@/lib/keyword-contract'
import type { Category, Website } from '@/types'
import type { Variants } from 'motion/react'

const FIRST_SCREEN_CARD_COUNT = 4

const cardVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
}

const cardGridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}

const cardTransition = { duration: 0.4, ease: 'easeOut' } as const

interface HomeContentProps {
  data: Category[]
}

export default function HomeContent({ data }: HomeContentProps) {
  const { query, setQuery, isOpen, closeSearch } = useWebsiteSearch()
  const inputRef = useRef<HTMLInputElement>(null)
  const normalizedQuery = normalizeKeyword(query)
  const categories = data.filter(category => category.websites.some(website => !website.archived_at))
    .map(category => ({ ...category, websites: category.websites.filter(website => !website.archived_at) }))
  const results = useMemo<Array<{ website: Website, keyword?: SearchKeyword }>>(() => {
    if (!normalizedQuery)
      return []

    return searchByKeywords(categories.flatMap(category => category.websites), normalizedQuery)
  }, [categories, normalizedQuery])

  useEffect(() => {
    if (!isOpen)
      return

    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        closeSearch()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeSearch, isOpen])

  if (!categories.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <AlertContent title="暂无网站数据" description="暂时没有可展示的网站。" status="accent" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 gap-4 min-h-0">
      <CategoryIndicator categories={categories} />
      <div className="min-w-0 flex-1 space-y-6">
        {categories.map(({ id, name, websites }, sectionIdx) => (
          <BlurFade key={id} id={`cat-${id}`} inView className="flex flex-col gap-2 scroll-mt-24">
            <Typography type="h1" className="text-lg font-black tracking-normal">{name}</Typography>
            {websites?.length
              ? (
                  <motion.div variants={cardGridVariants} className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
                    {websites.map((item, idx) => (
                      <motion.div key={item.id} transition={cardTransition} variants={cardVariants} className="h-full">
                        <WebsiteCard data={item} priority={sectionIdx === 0 && idx < FIRST_SCREEN_CARD_COUNT} />
                      </motion.div>
                    ))}
                  </motion.div>
                )
              : (
                  <div className="flex justify-center p-4">
                    <AlertContent title="暂无网站数据" description="该分类还没有任何网站。" status="accent" />
                  </div>
                )}
          </BlurFade>
        ))}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onMouseDown={event => event.target === event.currentTarget && closeSearch()}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-[10vh] backdrop-blur-sm sm:pt-[14vh]"
          >
            <motion.section
              aria-label="搜索网站"
              aria-modal="true"
              role="dialog"
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              className="flex max-h-[76vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-default-200 bg-background shadow-2xl"
            >
              <div className="border-b border-default-200 p-3 sm:p-4">
                <motion.div layoutId="website-search" className="relative">
                  <label htmlFor="website-search-modal" className="sr-only">搜索网站</label>
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-default-400">⌕</span>
                  <input
                    ref={inputRef}
                    id="website-search-modal"
                    type="search"
                    autoComplete="off"
                    data-testid="website-search-modal"
                    placeholder="搜索网站、网址、标签"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    className="h-11 w-full rounded-xl border border-default-200 bg-background py-2 pl-9 pr-11 text-sm outline-none transition-colors placeholder:text-default-400 focus:border-accent"
                  />
                  <button aria-label="关闭搜索" type="button" onClick={closeSearch} className="absolute right-2 top-1/2 size-7 -translate-y-1/2 rounded-lg text-default-500 transition-colors hover:bg-default hover:text-foreground">×</button>
                </motion.div>
              </div>
              <div className="overflow-y-auto p-4 sm:p-5">
                {normalizedQuery
                  ? (
                      <>
                        <div className="mb-4 flex items-center gap-2 text-sm text-default-500">
                          <DatabaseFill className="size-4" />
                          找到
                          {' '}
                          {results.length}
                          {' '}
                          个相关网站
                        </div>
                        {results.length
                          ? (
                              <motion.div animate="visible" initial="hidden" variants={cardGridVariants} className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]">
                                {results.map(item => (
                                  <motion.div key={item.website.id} transition={cardTransition} variants={cardVariants} className="h-full">
                                    <WebsiteCard data={item.website} onOpen={item.keyword ? () => recordSearchClick(item.website.id, item.keyword!.id) : undefined} />
                                  </motion.div>
                                ))}
                              </motion.div>
                            )
                          : <AlertContent title="没有匹配的网站" description="换个关键词试试。" status="accent" />}
                      </>
                    )
                  : <div className="py-16 text-center text-sm text-default-500">输入关键词搜索网站</div>}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
