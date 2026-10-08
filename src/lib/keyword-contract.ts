import { requireObject, WebsiteError } from './website-contract'

export interface Evaluation {
  ai_review: string
  search_keywords: string[]
}
export interface KeywordSearchResult<T> {
  website: T
  keyword: SearchKeyword
  rank: number
}
export interface SearchKeyword {
  id: string
  keyword: string
  sort_order: number
}

export interface StoredKeyword extends SearchKeyword {
  website_id: string
  normalized_keyword: string
  // PostgreSQL bigint stays a string to avoid precision loss.
  click_count: string
}

export function normalizeKeyword(value: string): string {
  return value.trim().normalize('NFKC').replace(/\s+/gu, ' ').toLowerCase()
}

/** Input website order is the existing home order; it breaks cross-site ties. */
export function searchByKeywords<T extends { search_keywords?: SearchKeyword[] }>(websites: T[], query: string): KeywordSearchResult<T>[] {
  const normalized = normalizeKeyword(query)
  if (!normalized)
    return []
  const matches: (KeywordSearchResult<T> & { index: number })[] = []
  websites.forEach((website, index) => {
    const keywords = (website.search_keywords ?? []).flatMap((keyword) => {
      const word = normalizeKeyword(keyword.keyword)
      const rank = word === normalized ? 0 : word.startsWith(normalized) ? 1 : word.includes(normalized) ? 2 : -1
      return rank < 0 ? [] : [{ keyword, rank }]
    }).sort((a, b) => a.rank - b.rank || a.keyword.sort_order - b.keyword.sort_order
      || (a.keyword.id < b.keyword.id ? -1 : a.keyword.id > b.keyword.id ? 1 : 0))
    if (keywords[0])
      matches.push({ website, index, ...keywords[0] })
  })
  return matches.sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, 10).map(({ website, keyword, rank }) => ({ website, keyword, rank }))
}

export function validateEvaluation(input: unknown, name?: string): Evaluation {
  const value = requireObject(input)
  if (Object.keys(value).length !== 2 || !Object.hasOwn(value, 'ai_review') || !Object.hasOwn(value, 'search_keywords'))
    throw new WebsiteError('评价仅接受 ai_review 与 search_keywords')
  if (typeof value.ai_review !== 'string' || !value.ai_review.trim())
    throw new WebsiteError('ai_review 必须是非空字符串')
  const keywords = value.search_keywords
  if (!Array.isArray(keywords) || keywords.length < 5 || keywords.length > 10
    || keywords.some(item => typeof item !== 'string' || !normalizeKeyword(item))) {
    throw new WebsiteError('search_keywords 必须含 5 到 10 个非空关键词')
  }
  const normalized = (keywords as string[]).map(normalizeKeyword)
  if (new Set(normalized).size !== normalized.length)
    throw new WebsiteError('关键词归一化后不能重复')
  if (name !== undefined && !normalized.includes(normalizeKeyword(name)))
    throw new WebsiteError('关键词必须包含当前网站名称')
  return { ai_review: value.ai_review.trim(), search_keywords: (keywords as string[]).map(item => item.trim()) }
}
