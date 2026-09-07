'use client'

import { motion } from 'motion/react'

import { useWebsiteSearch } from './search-context'

export default function HeaderSearch() {
  const { query, setQuery, isOpen, openSearch } = useWebsiteSearch()

  return (
    <div className="justify-self-center w-full max-w-xl px-3 sm:px-6">
      {!isOpen && (
        <motion.div layoutId="website-search" className="relative">
          <label htmlFor="website-search" className="sr-only">搜索网站</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-default-400">⌕</span>
          <input
            id="website-search"
            type="search"
            autoComplete="off"
            data-testid="website-search"
            placeholder="搜索网站、网址、标签"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onFocus={openSearch}
            className="h-10 w-full rounded-xl border border-default-200 bg-background/80 py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-default-400 focus:border-accent"
          />
        </motion.div>
      )}
    </div>
  )
}
