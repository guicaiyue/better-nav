import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { evaluateWebsite } from './agentMaster'
import { db, query } from './db'
import { getSearchKeywords, getWebsiteUpdateRules, putEvaluation, recordSearchClick } from './evaluation'
import { createWebsite, getWebsite, listCategoryWebsites, listWebsites, patchWebsite } from './websites'

vi.mock('./agentMaster', () => ({ evaluateWebsite: vi.fn() }))

// Opt-in only. Never allow this destructive fixture against any existing database.
const enabled = process.env.NAV_ISOLATED_DB_TEST === '1'
if (enabled && (process.env.NAV_DATABASE_NAME !== 'nav_keyword_test'
  || !/^\/tmp\/nav-keyword-pg-[^/]+\/socket$/.test(process.env.NAV_DATABASE_HOST ?? '')
  || process.env.PGPORT !== '55439')) {
  throw new Error('Refusing database tests outside the dedicated disposable cluster')
}

function create(name = 'Tool', extra = 'privacy') {
  return createWebsite({
    name,
    official_url: `https://${name.toLowerCase()}.example`,
    description: 'original description',
    features: ['feature'],
    tags: ['开源'],
    evaluation: evaluation(name, extra),
  })
}
function evaluation(name = 'Tool', extra = 'privacy') {
  return {
    ai_review: `review of ${name}`,
    search_keywords: [name, 'search', 'offline', 'developer', extra],
  }
}
const snapshot = async (id: string) => ({ site: await getWebsite(id), keywords: await getSearchKeywords(id) })
const counts = async () => (await query('SELECT (SELECT count(*) FROM ds_websites)::int AS sites, (SELECT count(*) FROM ds_website_search_keywords)::int AS keywords')).rows[0]

// PostgreSQL types and constraints mirror the current website contract, without
// ever executing the old destructive migration or importing production data.
describe.skipIf(!enabled)('isolated PostgreSQL: evaluation and keyword transactions', () => {
  beforeAll(async () => {
    const actual = (await query('SELECT current_database() AS name, inet_server_addr() AS address')).rows[0]
    expect(actual).toEqual({ name: 'nav_keyword_test', address: null })
    await query(`
      CREATE TABLE ds_categorys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE,
        sort integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE ds_websites (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(btrim(name)) > 0),
        official_url text UNIQUE, github_url text UNIQUE,
        related_links jsonb NOT NULL DEFAULT '{}', self_description text NOT NULL DEFAULT '',
        description text NOT NULL DEFAULT '', features text[] NOT NULL DEFAULT '{}',
        category_id uuid NOT NULL REFERENCES ds_categorys(id), tags text[] NOT NULL DEFAULT '{}',
        ai_review text, ai_reviewed_at timestamptz, github_snapshot jsonb, github_fetched_at timestamptz,
        archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK(official_url IS NOT NULL OR github_url IS NOT NULL),
        CHECK((ai_review IS NULL) = (ai_reviewed_at IS NULL)),
        CHECK((github_snapshot IS NULL) = (github_fetched_at IS NULL))
      );
      INSERT INTO ds_categorys(name) VALUES ('其它');
    `)
    const migration = readFileSync(resolve('db/migrations/20261007_website_search_keywords.sql'), 'utf8')
    await query(migration)
    await query(migration) // additive migration must be rerunnable
    await query(`CREATE FUNCTION reject_test_keyword() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.keyword = 'tripwire' THEN RAISE EXCEPTION 'injected keyword failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_keyword_failure BEFORE INSERT OR UPDATE ON ds_website_search_keywords
      FOR EACH ROW EXECUTE FUNCTION reject_test_keyword();`)
  })
  beforeEach(async () => {
    vi.resetAllMocks()
    await query('TRUNCATE ds_websites CASCADE')
  })
  afterAll(async () => {
    // The guarded fixture owns these tables; leave the cluster reusable for a second run.
    await query('DROP TABLE IF EXISTS ds_website_search_keywords, ds_website_update_rules, ds_websites, ds_categorys CASCADE; DROP FUNCTION IF EXISTS reject_test_keyword()')
    await db.end()
  })

  it('creates website, evaluation, keywords and success time atomically; homepage omits counts', async () => {
    const site = await create()
    expect(site.features).toEqual(['feature'])
    expect(site.tags).toEqual(['开源'])
    expect(site.ai_reviewed_at).toBeTruthy()
    const keywords = await getSearchKeywords(site.id)
    expect(keywords).toHaveLength(5)
    expect(keywords.every(word => word.click_count === '0')).toBe(true)
    expect(await counts()).toEqual({ sites: 1, keywords: 5 })
    const home = await listCategoryWebsites()
    expect(home[0].websites).toHaveLength(1)
    expect(home[0].websites[0].search_keywords).toEqual(keywords.map(({ id, keyword, sort_order }) => ({ id, keyword, sort_order })))
    expect((await listWebsites())[0].ai_reviewed_at).toEqual(site.ai_reviewed_at)
  })

  it('keeps every persisted field unchanged for invalid inputs and old PATCH', async () => {
    const site = await create()
    const before = await snapshot(site.id)
    const invalid = [null, {}, { ai_review: 'only' }, { ...evaluation(), extra: true }, { ...evaluation(), search_keywords: ['Tool', 'ＴＯＯＬ', 'a', 'b', 'c'] }, { ...evaluation(), search_keywords: ['Tool', 'a', 'b', 'c'] }, evaluation('WrongName')]
    for (const input of invalid)
      await expect(putEvaluation(site.id, input)).rejects.toThrow()
    await expect(patchWebsite(site.id, 'review', { ai_review: 'bypass' })).rejects.toThrow('evaluation')
    expect(await snapshot(site.id)).toEqual(before)
  })

  it('rolls back earlier evaluation and keyword mutations when a later SQL statement fails', async () => {
    const site = await create()
    const before = await snapshot(site.id)
    await expect(putEvaluation(site.id, { ...evaluation('Tool', 'tripwire'), ai_review: 'must roll back' })).rejects.toThrow('injected keyword failure')
    expect(await snapshot(site.id)).toEqual(before)
    await expect(create('New', 'tripwire')).rejects.toThrow('injected keyword failure')
    expect(await counts()).toEqual({ sites: 1, keywords: 5 })
  })

  it('agent failure or malformed evaluation leaves no new website; success creates once', async () => {
    vi.mocked(evaluateWebsite).mockRejectedValueOnce(new Error('Agent failed'))
    await expect(createWebsite({ name: 'Tool', official_url: 'https://tool.example' })).rejects.toThrow('Agent failed')
    expect(await counts()).toEqual({ sites: 0, keywords: 0 })
    await expect(createWebsite({ name: 'Tool', official_url: 'https://tool.example', evaluation: { ai_review: 'bad' } })).rejects.toThrow()
    expect(await counts()).toEqual({ sites: 0, keywords: 0 })
    vi.mocked(evaluateWebsite).mockResolvedValueOnce(evaluation())
    const site = await createWebsite({ name: 'Tool', official_url: 'https://tool.example' })
    expect(await getSearchKeywords(site.id)).toHaveLength(5)
    expect(await counts()).toEqual({ sites: 1, keywords: 5 })
  })

  it('retains IDs/counts for normalized matches; removed words lose both permanently', async () => {
    const site = await create()
    const original = await getSearchKeywords(site.id)
    const name = original[0]
    const removed = original[4]
    await recordSearchClick(site.id, { keyword_id: name.id })
    await recordSearchClick(site.id, { keyword_id: removed.id })
    const result = await putEvaluation(site.id, { ai_review: 'new', search_keywords: ['ＴＯＯＬ', 'search', 'offline', 'developer', 'new word'] })
    expect(result.search_keywords[0]).toMatchObject({ id: name.id, click_count: '1', keyword: 'ＴＯＯＬ' })
    expect(result.search_keywords[4].click_count).toBe('0')
    expect(result.search_keywords.some(word => word.id === removed.id)).toBe(false)
    await expect(recordSearchClick(site.id, { keyword_id: removed.id })).rejects.toMatchObject({ status: 404 })
    const restored = (await putEvaluation(site.id, evaluation())).search_keywords[4]
    expect(restored.id).not.toBe(removed.id)
    expect(restored.click_count).toBe('0')
  })

  it('allows repeated successful updates and advances only evaluate success time', async () => {
    const site = await create()
    const before = await getWebsite(site.id)
    const first = await putEvaluation(site.id, evaluation())
    await query('SELECT pg_sleep(0.01)')
    const second = await putEvaluation(site.id, evaluation())
    expect(new Date(second.ai_reviewed_at!).getTime()).toBeGreaterThan(new Date(first.ai_reviewed_at!).getTime())
    expect(second.search_keywords).toEqual(first.search_keywords)
    const after = await getWebsite(site.id)
    const { ai_reviewed_at: _beforeTime, ...beforeOthers } = before
    const { ai_reviewed_at: _afterTime, ...afterOthers } = after
    expect(afterOthers).toEqual(beforeOthers)
    const rules = await getWebsiteUpdateRules()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({ category: 'evaluate', interval_days: 30, enabled: true })
  })

  it('serializes concurrent increments with concurrent successful keyword replacement', async () => {
    const site = await create()
    const word = (await getSearchKeywords(site.id))[0]
    await Promise.all([
      ...Array.from({ length: 40 }, () => recordSearchClick(site.id, { keyword_id: word.id })),
      ...Array.from({ length: 5 }, () => putEvaluation(site.id, evaluation())),
    ])
    expect((await getSearchKeywords(site.id))[0]).toMatchObject({ id: word.id, click_count: '40' })
  })

  it('rejects mismatched/unknown keywords; archived sites cannot receive clicks but can be evaluated', async () => {
    const a = await create('First')
    const b = await create('Second')
    const word = (await getSearchKeywords(a.id))[0]
    await expect(recordSearchClick(b.id, { keyword_id: word.id })).rejects.toMatchObject({ status: 404 })
    await expect(recordSearchClick(a.id, { keyword_id: b.id })).rejects.toMatchObject({ status: 404 })
    await expect(recordSearchClick(a.id, { keyword_id: word.id, click_count: 99 })).rejects.toThrow()
    await patchWebsite(a.id, 'lifecycle', { archived: true })
    await expect(recordSearchClick(a.id, { keyword_id: word.id })).rejects.toMatchObject({ status: 404 })
    await putEvaluation(a.id, evaluation('First'))
    expect((await getWebsite(a.id)).archived_at).toBeTruthy()
    expect((await listWebsites()).map(site => site.id)).toEqual([b.id])
    expect(await listWebsites({ includeArchived: true })).toHaveLength(2)
    expect((await getSearchKeywords(a.id))[0].click_count).toBe('0')
  })

  it('rechecks the locked current name and removes keywords on physical deletion', async () => {
    const site = await create()
    await patchWebsite(site.id, 'intake', { name: 'Renamed' })
    const before = await snapshot(site.id)
    await expect(putEvaluation(site.id, evaluation())).rejects.toThrow('当前网站名称')
    expect(await snapshot(site.id)).toEqual(before)
    await putEvaluation(site.id, evaluation('Renamed'))
    await query('DELETE FROM ds_websites WHERE id = $1', [site.id])
    expect(await counts()).toEqual({ sites: 0, keywords: 0 })
    await expect(putEvaluation(site.id, evaluation('Renamed'))).rejects.toMatchObject({ status: 404 })
    await expect(getSearchKeywords(site.id)).rejects.toMatchObject({ status: 404 })
  })
})
