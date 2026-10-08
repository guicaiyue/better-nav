import { afterEach, describe, expect, it, vi } from 'vitest'

import { analyzeWebsite } from './agentMaster'

vi.mock('./evaluation', () => ({ getWebsiteUpdateRules: vi.fn() }))

const input = {
  task: 'describe' as const,
  website: { id: 'site-test', name: '测试站', official_url: 'https://example.com', github_url: null, self_description: '站点介绍' },
  allowed_categories: [{ id: 'category-test', name: '工具' }],
  allowed_tags: ['免费'],
}

function stubResponse(body: unknown, status = 200) {
  vi.stubEnv('AGENT_MASTER_BASE_URL', 'http://agent.test/')
  vi.stubEnv('NAV_FIXED_AGENT_ID', 'original-describe-agent')
  const fetcher = vi.fn().mockResolvedValue(Response.json(body, { status }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('original fixed Agent integration', () => {
  it('uses input-only run body and maps flat Describe output to current category', async () => {
    const fetcher = stubResponse({ run: { status: 'SUCCEEDED' }, output: {
      description: '有效描述', features: ['功能'], category_name: '工具', tags: [],
    } })
    await expect(analyzeWebsite(input)).resolves.toEqual({ group: 'content', changes: {
      description: '有效描述', features: ['功能'], category_id: 'category-test', tags: [],
    } })
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('http://agent.test/api/v1/fixed-agents/original-describe-agent/run')
    const body = JSON.parse(options.body)
    expect(Object.keys(body)).toEqual(['input'])
    expect(body.input.product).toMatchObject({ id: 'site-test', github_url: null })
    expect(body.input.categories).toEqual(['工具'])
    expect(body.input.article.text).toBe('站点介绍')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('preserves HTTP validation detail rather than reporting a network failure', async () => {
    stubResponse({ detail: [{ loc: ['body', 'input'], msg: 'Invalid input' }] }, 422)
    await expect(analyzeWebsite(input)).rejects.toThrow('HTTP 422：body.input: Invalid input')
  })

  it('preserves failed run reason and run/version evidence without retrying', async () => {
    const fetcher = stubResponse({ run: {
      status: 'FAILED', error_message: 'Output contract mismatch', run_id: 'run-test', prompt_version_id: 'version-test',
    } })
    await expect(analyzeWebsite(input)).rejects.toThrow('Agent FAILED，未更新网站；Output contract mismatch (run_id=run-test, version=version-test)')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
