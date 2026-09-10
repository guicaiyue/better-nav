import { normalizeUrl, WebsiteError } from '../website-contract'
import { query } from './db'
import { getWebsite } from './websites'

import type { GitHubSnapshot, Website } from '../../types'

export function parseGitHubSnapshot(input: unknown): GitHubSnapshot {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new WebsiteError('GitHub 返回数据无效', 502)
  const data = input as Record<string, unknown>
  const text = (key: string, nullable = false): string | null => {
    const value = data[key]
    if (nullable && value === null)
      return null
    if (typeof value !== 'string' || (!nullable && !value))
      throw new WebsiteError(`GitHub 缺少有效字段 ${key}`, 502)
    return value
  }
  const count = (key: string): number => {
    const value = data[key]
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
      throw new WebsiteError(`GitHub 计数字段无效 ${key}`, 502)
    return value
  }
  if (typeof data.archived !== 'boolean')
    throw new WebsiteError('GitHub archived 字段无效', 502)
  const pushedAt = text('pushed_at', true)
  if (pushedAt !== null && !Number.isFinite(Date.parse(pushedAt)))
    throw new WebsiteError('GitHub pushed_at 字段无效', 502)
  let license: string | null = null
  if (data.license !== null) {
    if (!data.license || typeof data.license !== 'object' || !('spdx_id' in data.license) || typeof data.license.spdx_id !== 'string')
      throw new WebsiteError('GitHub license 字段无效', 502)
    license = data.license.spdx_id
  }
  return {
    full_name: text('full_name')!,
    html_url: text('html_url')!,
    description: text('description', true),
    homepage: text('homepage', true),
    stargazers_count: count('stargazers_count'),
    forks_count: count('forks_count'),
    open_issues_count: count('open_issues_count'),
    language: text('language', true),
    license_spdx_id: license,
    default_branch: text('default_branch')!,
    archived: data.archived,
    pushed_at: pushedAt,
  }
}

export async function refreshGitHubSnapshot(id: string): Promise<Website> {
  const website = await getWebsite(id)
  if (!website.github_url)
    throw new WebsiteError('网站未填写 GitHub 地址')
  const url = normalizeUrl(website.github_url, true)!
  const [owner, repo] = new URL(url).pathname.split('/').filter(Boolean)
  let response: Response
  try {
    response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'better-nav' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
  }
  catch { throw new WebsiteError('GitHub API 请求失败，保留已有快照', 502) }
  if (!response.ok)
    throw new WebsiteError(`GitHub API 返回 ${response.status}，保留已有快照`, response.status === 429 || response.status === 403 ? 503 : 502)
  let raw: unknown
  try {
    raw = await response.json()
  }
  catch { throw new WebsiteError('GitHub API 返回无效 JSON，保留已有快照', 502) }
  const snapshot = parseGitHubSnapshot(raw)
  const { rows } = await query<Website>(`UPDATE ds_websites
    SET github_snapshot = $1::jsonb, github_fetched_at = NOW()
    WHERE id = $2 AND github_url = $3 RETURNING *`, [JSON.stringify(snapshot), id, website.github_url])
  if (!rows[0])
    throw new WebsiteError('采集期间网站已删除或 GitHub 地址已变更，结果未写入', 409)
  return rows[0]
}
