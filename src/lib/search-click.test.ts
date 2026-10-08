import { afterEach, expect, it, vi } from 'vitest'

import { recordSearchClick } from './search-click'

afterEach(() => vi.unstubAllGlobals())

it('submits exactly one increment per invocation and allows repeated genuine clicks', () => {
  const fetcher = vi.fn().mockResolvedValue(new Response())
  vi.stubGlobal('fetch', fetcher)
  recordSearchClick('site', 'word')
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher).toHaveBeenCalledWith('/api/websites/site/search-click', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ keyword_id: 'word' }),
    keepalive: true,
  }))
  recordSearchClick('site', 'word')
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('never retries an ambiguous network failure', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('lost response'))
  vi.stubGlobal('fetch', fetcher)
  recordSearchClick('site', 'word')
  await Promise.resolve()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
