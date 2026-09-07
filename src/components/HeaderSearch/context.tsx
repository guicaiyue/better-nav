'use client'

import { useCallback, useState } from 'react'

import { SearchContext } from './search-context'

import type { PropsWithChildren } from 'react'

export function SearchProvider({ children }: PropsWithChildren) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const openSearch = useCallback(() => setIsOpen(true), [])
  const closeSearch = useCallback(() => setIsOpen(false), [])

  return (
    <SearchContext value={{ query, setQuery, isOpen, openSearch, closeSearch }}>
      {children}
    </SearchContext>
  )
}
