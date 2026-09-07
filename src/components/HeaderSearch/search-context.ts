'use client'

import { createContext, use } from 'react'

interface SearchContextValue {
  query: string
  setQuery: (query: string) => void
  isOpen: boolean
  openSearch: () => void
  closeSearch: () => void
}

export const SearchContext = createContext<SearchContextValue | null>(null)

export function useWebsiteSearch() {
  const context = use(SearchContext)
  if (!context)
    throw new Error('useWebsiteSearch 必须在 SearchProvider 内使用')
  return context
}
