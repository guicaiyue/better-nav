import { describe, expect, it } from 'vitest'

import { normalizeKeyword, searchByKeywords, validateEvaluation } from './keyword-contract'

const valid = { ai_review: 'review', search_keywords: ['Tool', 'search', 'offline', 'developer', 'privacy'] }

describe('strict atomic evaluation contract', () => {
  it('normalizes in the same order for matching and validation', () => {
    expect(normalizeKeyword('  ＡＢＣ\t\nDEF  ')).toBe('abc def')
    expect(validateEvaluation(valid, 'ＴＯＯＬ')).toEqual(valid)
  })
  it.each([
    null,
    {},
    { ai_review: 'review' },
    { ...valid, evidence: [] },
    { ...valid, ai_review: '' },
    { ...valid, ai_review: null },
    { ...valid, search_keywords: ['a', 'b', 'c', 'd'] },
    { ...valid, search_keywords: Array.from({ length: 11 }, (_, i) => String(i)) },
    { ...valid, search_keywords: ['Tool', 'ＴＯＯＬ', 'c', 'd', 'e'] },
    { ...valid, search_keywords: ['Tool', '  ', 'c', 'd', 'e'] },
    { ...valid, search_keywords: ['Tool', 2, 'c', 'd', 'e'] },
  ])('rejects incomplete, extra, empty, duplicate, or invalid fields: %j', (input) => {
    expect(() => validateEvaluation(input, 'Tool')).toThrow()
  })
  it('requires the current site name, not an old one', () => {
    expect(() => validateEvaluation(valid, 'Renamed')).toThrow('当前网站名称')
  })
})

const kw = (id: string, keyword: string, sort_order = 0) => ({ id, keyword, sort_order })
describe('keyword-only search and stable representative', () => {
  it('ranks exact > prefix > contains, using input site order for equal rank', () => {
    const sites = [
      { id: 'contains', search_keywords: [kw('c', 'x tool y')] },
      { id: 'prefix', search_keywords: [kw('p', 'toolkit')] },
      { id: 'exact-first', search_keywords: [kw('e', 'Tool')] },
      { id: 'exact-second', search_keywords: [kw('e2', 'ＴＯＯＬ')] },
    ]
    expect(searchByKeywords(sites, ' tool ').map(row => row.website.id))
      .toEqual(['exact-first', 'exact-second', 'prefix', 'contains'])
  })
  it('chooses rank then sort_order then ID; each site contributes one result', () => {
    const site = { search_keywords: [kw('z', 'toolbox', 0), kw('c', 'tool', 9), kw('b', 'TOOL', 1), kw('a', 'ＴＯＯＬ', 1)] }
    const matches = searchByKeywords([site], 'tool')
    expect(matches).toHaveLength(1)
    expect(matches[0].keyword.id).toBe('a')
  })
  it('does not use site name, URL, descriptions, features, tags, or review', () => {
    const site = { name: 'needle', official_url: 'https://needle.example', description: 'needle', features: ['needle'], tags: ['needle'], ai_review: 'needle', search_keywords: [kw('a', 'other')] }
    expect(searchByKeywords([site], 'needle')).toEqual([])
    expect(searchByKeywords([site], '   ')).toEqual([])
    expect(searchByKeywords([{}], 'needle')).toEqual([])
  })
  it('limits to ten sites without changing tie order', () => {
    const sites = Array.from({ length: 12 }, (_, id) => ({ id, search_keywords: [kw(String(id), 'tool')] }))
    expect(searchByKeywords(sites, 'tool').map(row => row.website.id)).toEqual(Array.from({ length: 10 }, (_, i) => i))
  })
})
