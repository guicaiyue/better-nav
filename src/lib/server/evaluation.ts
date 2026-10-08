import { normalizeKeyword, validateEvaluation } from '../keyword-contract'
import { requireId, requireObject, WebsiteError } from '../website-contract'
import { db, query } from './db'

import type { Website } from '../../types'
import type { Evaluation, StoredKeyword } from '../keyword-contract'
import type { PoolClient } from 'pg'

export interface WebsiteUpdateRule {
  category: 'evaluate'
  interval_days: number
  agent_id: string
  enabled: boolean
}

export async function getSearchKeywords(id: string): Promise<StoredKeyword[]> {
  requireId(id)
  const website = await query('SELECT id FROM ds_websites WHERE id = $1', [id])
  if (!website.rows[0])
    throw new WebsiteError('网站不存在', 404)
  return (await query<StoredKeyword>('SELECT * FROM ds_website_search_keywords WHERE website_id = $1 ORDER BY sort_order, id', [id])).rows
}

export async function getWebsiteUpdateRules(): Promise<WebsiteUpdateRule[]> {
  return (await query<WebsiteUpdateRule>('SELECT category, interval_days, agent_id, enabled FROM ds_website_update_rules ORDER BY category')).rows
}

export async function putEvaluation(id: string, input: unknown) {
  requireId(id)
  const evaluation = validateEvaluation(input)
  return transaction(async (client) => {
    const current = await client.query<Website>('SELECT * FROM ds_websites WHERE id = $1 FOR UPDATE', [id])
    if (!current.rows[0])
      throw new WebsiteError('网站不存在', 404)
    // Validate against the locked current name, never an earlier JS snapshot.
    validateEvaluation(evaluation, current.rows[0].name)
    const { rows } = await client.query<Website>(`UPDATE ds_websites SET ai_review = $1, ai_reviewed_at = clock_timestamp()
      WHERE id = $2 RETURNING *`, [evaluation.ai_review, id])
    const search_keywords = await replaceKeywords(client, id, evaluation)
    return { id, ai_review: rows[0].ai_review, ai_reviewed_at: rows[0].ai_reviewed_at, search_keywords }
  })
}

export async function recordSearchClick(id: string, input: unknown) {
  requireId(id)
  const value = requireObject(input)
  if (Object.keys(value).length !== 1 || !Object.hasOwn(value, 'keyword_id'))
    throw new WebsiteError('仅接受 keyword_id')
  const keywordId = requireId(value.keyword_id)
  return transaction(async (client) => {
    // Same lock order as evaluation; archive/delete cannot race with this increment.
    const site = await client.query('SELECT id FROM ds_websites WHERE id = $1 AND archived_at IS NULL FOR UPDATE', [id])
    if (!site.rows[0])
      throw new WebsiteError('网站不存在或已归档', 404)
    const { rows } = await client.query<StoredKeyword>(`UPDATE ds_website_search_keywords SET click_count = click_count + 1
      WHERE website_id = $1 AND id = $2 RETURNING *`, [id, keywordId])
    if (!rows[0])
      throw new WebsiteError('关键词不属于该网站或已移除', 404)
    return { website_id: id, keyword_id: keywordId, click_count: rows[0].click_count }
  })
}

/** Caller holds the website row lock, or has just inserted it in this transaction. */
export async function replaceKeywords(client: PoolClient, id: string, evaluation: Evaluation): Promise<StoredKeyword[]> {
  const normalized = evaluation.search_keywords.map(normalizeKeyword)
  await client.query('DELETE FROM ds_website_search_keywords WHERE website_id = $1 AND NOT (normalized_keyword = ANY($2::text[]))', [id, normalized])
  for (const [index, keyword] of evaluation.search_keywords.entries()) {
    await client.query(`INSERT INTO ds_website_search_keywords(website_id, keyword, normalized_keyword, sort_order)
      VALUES ($1,$2,$3,$4) ON CONFLICT (website_id, normalized_keyword)
      DO UPDATE SET keyword = EXCLUDED.keyword, sort_order = EXCLUDED.sort_order`, [id, keyword, normalized[index], index])
  }
  const { rows } = await client.query<StoredKeyword>('SELECT * FROM ds_website_search_keywords WHERE website_id = $1 ORDER BY sort_order, id', [id])
  return rows
}
export async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  }
  catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
  finally { client.release() }
}
