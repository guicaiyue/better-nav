import { beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizeUrl, validateChanges } from '../website-contract'
import { evaluateWebsite } from './agentMaster'
import { db as pool, query } from './db'
import { refreshGitHubSnapshot } from './githubSnapshot'
import { buildWebsitePatch, createWebsite, getWebsite, listCategoryWebsites, patchWebsite } from './websites'

vi.mock('./db', () => ({ query: vi.fn(), db: { connect: vi.fn() } }))
vi.mock('./agentMaster', () => ({ evaluateWebsite: vi.fn() }))
const db = vi.mocked(query)
const id = '11111111-1111-4111-8111-111111111111'
const categoryId = '22222222-2222-4222-8222-222222222222'
const site = { id, github_url: 'https://github.com/acme/tool', official_url: null }
function rows(value: unknown[]) {
  return { rows: value } as Awaited<ReturnType<typeof query>>
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

describe('minimal website contract and scoped updates', () => {
  it('normalizes URLs and rejects cross-group/null/unknown tags', () => {
    expect(normalizeUrl('https://GitHub.com/Acme/Tool.git/', true)).toBe(site.github_url)
    expect(() => normalizeUrl('https://github.com/acme/tool/issues', true)).toThrow()
    expect(() => validateChanges('content', { ai_review: 'wrong group' })).toThrow()
    expect(() => validateChanges('intake', { created_at: 'today' })).toThrow()
    expect(() => validateChanges('content', { tags: ['免费'] })).toThrow()
    expect(() => validateChanges('content', { description: null })).toThrow()
    expect(validateChanges('content', { features: [], tags: ['提供API', '提供API'] })).toEqual({ features: [], tags: ['提供API'] })
  })

  it('rejects the old review PATCH without touching the database', async () => {
    await expect(patchWebsite(id, 'review', { ai_review: '评价' })).rejects.toThrow('evaluation')
    expect(db).not.toHaveBeenCalled()
  })

  it('atomically merges link keys; null removes, empty object is no-op', async () => {
    const changes = validateChanges('intake', { related_links: { 文档: 'https://example.org/docs', 旧链接: null } })
    const patch = buildWebsitePatch(id, changes)!
    expect(patch.text).toContain('jsonb_strip_nulls(related_links || $1::jsonb)')
    expect(JSON.parse(patch.values[0] as string)).toEqual({ 文档: 'https://example.org/docs', 旧链接: null })
    db.mockResolvedValue(rows([site]))
    await patchWebsite(id, 'intake', { related_links: {} })
    expect(db.mock.calls[0][0]).toMatch(/^SELECT/)
  })

  it('clears a stale snapshot only when github_url actually changes', () => {
    const patch = buildWebsitePatch(id, validateChanges('intake', { github_url: null }))!
    expect(patch.text).toContain('github_url IS DISTINCT FROM $1 THEN NULL ELSE github_snapshot END')
    expect(patch.text).toContain('THEN NULL ELSE github_fetched_at END')
    expect(patch.text).not.toContain('ai_review')
    expect(patch.values).toEqual([null, id])
  })

  it('validates URLs/category and cannot create a website after Agent failure', async () => {
    await expect(createWebsite({ name: 'missing URLs' })).rejects.toThrow()
    expect(db).not.toHaveBeenCalled()
    db.mockResolvedValueOnce(rows([{ id: categoryId, name: '其它' }]))
    vi.mocked(evaluateWebsite).mockRejectedValueOnce(new Error('Agent failed'))
    await expect(createWebsite({ name: 'tool', github_url: site.github_url })).rejects.toThrow('Agent failed')
    expect(pool.connect).not.toHaveBeenCalled()
    expect(db).toHaveBeenCalledTimes(1)
    db.mockResolvedValueOnce(rows([{ id: categoryId, name: '其它' }]))
    await expect(patchWebsite(id, 'content', { category_id: id })).rejects.toThrow('受控词表')
  })

  it('shares archived filtering and stable ordering in category/home query', async () => {
    db.mockResolvedValueOnce(rows([]))
    await listCategoryWebsites()
    expect(db.mock.calls[0][0]).toContain('w.archived_at IS NULL')
    expect(db.mock.calls[0][0]).not.toContain('w.sort')
    db.mockResolvedValueOnce(rows([]))
    await expect(getWebsite(id)).rejects.toMatchObject({ status: 404 })
  })
})

const repo = {
  full_name: 'acme/tool',
  html_url: site.github_url,
  description: 'repo text',
  homepage: '',
  stargazers_count: 2,
  forks_count: 1,
  open_issues_count: 0,
  language: null,
  license: { spdx_id: 'MIT' },
  default_branch: 'main',
  archived: true,
  pushed_at: null,
}

describe('pure GitHub snapshots', () => {
  it('makes one repo request and writes only snapshot/time with URL guard', async () => {
    db.mockResolvedValueOnce(rows([site])).mockResolvedValueOnce(rows([site]))
    const fetcher = vi.fn().mockResolvedValue(Response.json(repo))
    vi.stubGlobal('fetch', fetcher)
    await refreshGitHubSnapshot(id)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('https://api.github.com/repos/acme/tool')
    const [sql, values] = db.mock.calls[1]
    expect(sql).toContain('WHERE id = $2 AND github_url = $3')
    expect(sql).not.toContain('archived_at')
    expect(JSON.parse(values![0] as string)).toMatchObject({ license_spdx_id: 'MIT', archived: true })
  })

  it('does not write on upstream failure, or accept stale URL results', async () => {
    db.mockResolvedValueOnce(rows([site]))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })))
    await expect(refreshGitHubSnapshot(id)).rejects.toMatchObject({ status: 503 })
    expect(db).toHaveBeenCalledTimes(1)
    db.mockResolvedValueOnce(rows([site])).mockResolvedValueOnce(rows([]))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(repo)))
    await expect(refreshGitHubSnapshot(id)).rejects.toMatchObject({ status: 409 })
  })
})
