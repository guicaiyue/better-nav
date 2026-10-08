import { validateEvaluation } from '../keyword-contract'
import {
  CATEGORY_NAMES,
  requireId,
  requireObject,
  validateChanges,
  WEBSITE_GROUPS,
  WebsiteError,
} from '../website-contract'
import { evaluateWebsite } from './agentMaster'
import { query } from './db'
import { replaceKeywords, transaction } from './evaluation'
import { sortWebsites } from './sort'

import type { Category, Website } from '../../types'

/** Parameterized, group-scoped SQL. No read/merge/write of an entire website. */
export function buildWebsitePatch(id: string, changes: Record<string, unknown>) {
  if ('ai_review' in changes || 'ai_reviewed_at' in changes)
    throw new WebsiteError('评价必须使用 evaluation 原子接口')
  const sets: string[] = []
  const values: unknown[] = []
  const bind = (value: unknown) => {
    values.push(value)
    return `$${values.length}`
  }
  for (const [field, value] of Object.entries(changes)) {
    if (field === 'related_links') {
      if (!Object.keys(value as object).length)
        continue
      // JSONB merge and null deletion run against the current row, not a stale JS copy.
      sets.push(`related_links = jsonb_strip_nulls(related_links || ${bind(JSON.stringify(value))}::jsonb)`)
    }
    else if (field === 'archived') {
      sets.push(`archived_at = ${value ? 'COALESCE(archived_at, NOW())' : 'NULL'}`)
    }
    else if (field === 'github_url') {
      const placeholder = bind(value)
      sets.push(`github_url = ${placeholder}`)
      sets.push(`github_snapshot = CASE WHEN github_url IS DISTINCT FROM ${placeholder} THEN NULL ELSE github_snapshot END`)
      sets.push(`github_fetched_at = CASE WHEN github_url IS DISTINCT FROM ${placeholder} THEN NULL ELSE github_fetched_at END`)
    }
    else {
      sets.push(`"${field}" = ${bind(value)}`)
    }
  }
  if (!sets.length)
    return null
  return { text: `UPDATE ds_websites SET ${sets.join(', ')} WHERE id = ${bind(id)} RETURNING *`, values }
}

export async function createWebsite(input: unknown): Promise<Website> {
  const body = requireObject(input)
  const allowed: readonly string[] = [...WEBSITE_GROUPS.intake, ...WEBSITE_GROUPS.content, 'evaluation']
  if (Object.keys(body).some(key => !allowed.includes(key)))
    throw new WebsiteError('创建站点含未允许的字段')
  const pick = (fields: readonly string[]) => Object.fromEntries(Object.entries(body).filter(([key]) => fields.includes(key)))
  const intake = validateChanges('intake', pick(WEBSITE_GROUPS.intake))
  const content = validateChanges('content', pick(WEBSITE_GROUPS.content))
  if (!intake.name || (!intake.official_url && !intake.github_url))
    throw new WebsiteError('名称必填，官方网站和 GitHub 至少填写一个')
  const categories = await getCategories()
  const category = content.category_id
    ? categories.find(item => item.id === content.category_id)
    : categories.find(item => item.name === '其它')
  if (!category)
    throw new WebsiteError('分类必须来自受控词表')
  const draft = {
    name: intake.name as string,
    official_url: intake.official_url ?? null,
    github_url: intake.github_url ?? null,
    self_description: intake.self_description ?? '',
    description: content.description ?? '',
    features: content.features ?? [],
    category_id: category.id,
    tags: content.tags ?? [],
  }
  // Slow external work happens before BEGIN. Failure cannot leave a partial website.
  const evaluation = validateEvaluation(Object.hasOwn(body, 'evaluation')
    ? body.evaluation
    : await evaluateWebsite(draft), draft.name)
  const links = Object.fromEntries(Object.entries((intake.related_links ?? {}) as Record<string, string | null>).filter(([, value]) => value !== null))
  return transaction(async (client) => {
    const { rows } = await client.query<Website>(`INSERT INTO ds_websites
      (name, official_url, github_url, related_links, self_description, category_id,
       description, features, tags, ai_review, ai_reviewed_at)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::text[],$9::text[],$10,clock_timestamp()) RETURNING *`, [draft.name, draft.official_url, draft.github_url, JSON.stringify(links), draft.self_description, draft.category_id, draft.description, draft.features, draft.tags, evaluation.ai_review])
    const keywords = await replaceKeywords(client, rows[0].id, evaluation)
    return { ...rows[0], search_keywords: keywords.map(({ id, keyword, sort_order }) => ({ id, keyword, sort_order })) }
  })
}

export async function deleteWebsite(id: string): Promise<Website> {
  requireId(id)
  const { rows } = await query<Website>('DELETE FROM ds_websites WHERE id = $1 RETURNING *', [id])
  if (!rows[0])
    throw new WebsiteError('网站不存在', 404)
  return rows[0]
}

export async function getCategories(): Promise<Omit<Category, 'websites'>[]> {
  const { rows } = await query<Omit<Category, 'websites'>>(
    'SELECT * FROM ds_categorys WHERE name = ANY($1::text[]) ORDER BY sort DESC, created_at DESC, id',
    [CATEGORY_NAMES],
  )
  return rows
}

const keywordProjection = `(SELECT COALESCE(jsonb_agg(jsonb_build_object('id', k.id, 'keyword', k.keyword, 'sort_order', k.sort_order) ORDER BY k.sort_order, k.id), '[]'::jsonb) FROM ds_website_search_keywords k WHERE k.website_id = w.id)`

export async function getWebsite(id: string): Promise<Website> {
  requireId(id)
  const { rows } = await query<Website>(`SELECT w.*, c.name AS category_name, ${keywordProjection} AS search_keywords FROM ds_websites w
    JOIN ds_categorys c ON c.id = w.category_id WHERE w.id = $1`, [id])
  if (!rows[0])
    throw new WebsiteError('网站不存在', 404)
  return rows[0]
}

export async function listCategoryWebsites(): Promise<Category[]> {
  const { rows } = await query<Category>(`SELECT c.*,
    COALESCE(jsonb_agg(to_jsonb(w) || jsonb_build_object('search_keywords', ${keywordProjection})) FILTER (WHERE w.id IS NOT NULL), '[]'::jsonb) AS websites
    FROM ds_categorys c LEFT JOIN ds_websites w ON w.category_id = c.id AND w.archived_at IS NULL
    WHERE c.name = ANY($1::text[])
    GROUP BY c.id ORDER BY c.sort DESC, c.created_at DESC, c.id`, [CATEGORY_NAMES])
  rows.forEach(category => sortWebsites(category.websites))
  return rows
}

export async function listWebsites(options: { categoryId?: string | null, includeArchived?: boolean } = {}): Promise<Website[]> {
  const conditions = options.includeArchived ? [] : ['w.archived_at IS NULL']
  const values: unknown[] = []
  if (options.categoryId) {
    values.push(requireId(options.categoryId))
    conditions.push(`w.category_id = $${values.length}`)
  }
  const { rows } = await query<Website>(`SELECT w.*, c.name AS category_name, ${keywordProjection} AS search_keywords FROM ds_websites w
    JOIN ds_categorys c ON c.id = w.category_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY w.created_at DESC, w.id`, values)
  return rows
}

export async function patchWebsite(id: string, group: unknown, input: unknown): Promise<Website> {
  requireId(id)
  if (group === 'review')
    throw new WebsiteError('评价与关键词必须通过 PUT /api/websites/:id/evaluation 一起更新')
  const changes = validateChanges(group, input)
  if ('category_id' in changes) {
    const categories = await getCategories()
    if (!categories.some(category => category.id === changes.category_id))
      throw new WebsiteError('分类必须来自受控词表')
  }
  const statement = buildWebsitePatch(id, changes)
  if (!statement)
    return getWebsite(id)
  // The DB address CHECK guarantees the at-least-one-URL rule even under concurrent PATCH.
  const { rows } = await query<Website>(statement.text, statement.values)
  if (!rows[0])
    throw new WebsiteError('网站不存在', 404)
  return rows[0]
}
