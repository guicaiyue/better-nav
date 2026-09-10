import { CATEGORY_NAMES, requireId, validateChanges, WebsiteError } from '../website-contract'
import { query } from './db'
import { sortWebsites } from './sort'

import type { Category, Website } from '../../types'

/** Parameterized, group-scoped SQL. No read/merge/write of an entire website. */
export function buildWebsitePatch(id: string, changes: Record<string, unknown>) {
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
      if (field === 'ai_review')
        sets.push(`ai_reviewed_at = ${value === null ? 'NULL' : 'NOW()'}`)
    }
  }
  if (!sets.length)
    return null
  return { text: `UPDATE ds_websites SET ${sets.join(', ')} WHERE id = ${bind(id)} RETURNING *`, values }
}

export async function createWebsite(input: unknown): Promise<Website> {
  const changes = validateChanges('intake', input)
  if (!changes.name || (!changes.official_url && !changes.github_url))
    throw new WebsiteError('名称必填，官方网站和 GitHub 至少填写一个')
  const categories = await getCategories()
  const category = categories.find(item => item.name === '其它')
  if (!category)
    throw new WebsiteError('缺少默认分类，请先执行迁移', 503)
  const links = Object.fromEntries(Object.entries((changes.related_links ?? {}) as Record<string, string | null>).filter(([, value]) => value !== null))
  const { rows } = await query<Website>(`INSERT INTO ds_websites
    (name, official_url, github_url, related_links, self_description, category_id)
    VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING *`, [changes.name, changes.official_url ?? null, changes.github_url ?? null, JSON.stringify(links), changes.self_description ?? '', category.id])
  return rows[0]
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

export async function getWebsite(id: string): Promise<Website> {
  requireId(id)
  const { rows } = await query<Website>(`SELECT w.*, c.name AS category_name FROM ds_websites w
    JOIN ds_categorys c ON c.id = w.category_id WHERE w.id = $1`, [id])
  if (!rows[0])
    throw new WebsiteError('网站不存在', 404)
  return rows[0]
}

export async function listCategoryWebsites(): Promise<Category[]> {
  const { rows } = await query<Category>(`SELECT c.*,
    COALESCE(json_agg(w.*) FILTER (WHERE w.id IS NOT NULL), '[]') AS websites
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
  const { rows } = await query<Website>(`SELECT w.*, c.name AS category_name FROM ds_websites w
    JOIN ds_categorys c ON c.id = w.category_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY w.created_at DESC, w.id`, values)
  return rows
}

export async function patchWebsite(id: string, group: unknown, input: unknown): Promise<Website> {
  requireId(id)
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
