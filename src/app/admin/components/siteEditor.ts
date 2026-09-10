import type { Website } from '@/types'

export const inputClass = 'w-full rounded-xl border border-default-200 bg-background px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:opacity-50'
export const buttonClass = 'rounded-xl border border-default-200 px-3 py-2 text-sm font-medium transition hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50'
export const primaryClass = 'rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

export type EditGroup = 'intake' | 'content' | 'review'
export interface IntakeDraft { name: string, official_url: string, github_url: string, self_description: string, related_links: Array<{ name: string, url: string }> }
export interface Taxonomy { categories: Array<{ id: string, name: string }>, tag_options: string[] }

export function contentChanges(site: Website, next: { description: string, features: string[], category_id: string, tags: string[] }) {
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(site[key as keyof typeof next])))
}

/**
 Only changed fields cross the wire
missing related-link keys are explicit deletions.
 */
export function intakeChanges(site: Website, draft: IntakeDraft) {
  const next = intakePayload(draft)
  const changes: Record<string, unknown> = {}
  for (const key of ['name', 'official_url', 'github_url', 'self_description'] as const) {
    if (next[key] !== site[key])
      changes[key] = next[key]
  }
  const links: Record<string, string | null> = Object.fromEntries(
    Object.entries(next.related_links).filter(([key, value]) => site.related_links[key] !== value),
  )
  for (const key of Object.keys(site.related_links)) {
    if (!Object.hasOwn(next.related_links, key))
      links[key] = null
  }
  if (Object.keys(links).length)
    changes.related_links = links
  return changes
}

export function intakeDraft(site?: Website): IntakeDraft {
  return { name: site?.name || '', official_url: site?.official_url || '', github_url: site?.github_url || '', self_description: site?.self_description || '', related_links: Object.entries(site?.related_links || {}).map(([name, url]) => ({ name, url })) }
}

export function intakePayload(draft: IntakeDraft) {
  const name = draft.name.trim()
  if (!name)
    throw new Error('请填写站点名称')
  const official_url = checkedUrl(draft.official_url, '官网')
  const github_url = checkedUrl(draft.github_url, 'GitHub')
  if (!official_url && !github_url)
    throw new Error('官网与 GitHub 至少填写一个')
  if (github_url) {
    const url = new URL(github_url)
    if (url.hostname !== 'github.com' || !/^\/[^/]+\/[^/]+\/?$/.test(url.pathname) || url.search || url.hash)
      throw new Error('GitHub 请填写仓库根地址：https://github.com/owner/repo')
  }
  const links: Array<[string, string]> = []
  for (const row of draft.related_links) {
    const label = row.name.trim()
    if (!label && !row.url.trim())
      continue
    if (!label)
      throw new Error('请为相关链接填写名称')
    const url = checkedUrl(row.url, `“${label}”链接`)
    if (!url)
      throw new Error(`请填写“${label}”链接地址`)
    if (links.some(([key]) => key === label))
      throw new Error(`相关链接名称重复：${label}`)
    links.push([label, url])
  }
  return { name, official_url, github_url, self_description: draft.self_description, related_links: Object.fromEntries(links) }
}

export async function navRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  let result
  try {
    result = await response.json()
  }
  catch {
    throw new Error(`服务返回非 JSON 响应（HTTP ${response.status}）。若刚执行 AI，请先刷新检查结果，不要重复提交。`)
  }
  if (!response.ok || !result || typeof result.code !== 'number' || result.code < 200 || result.code >= 300)
    throw new Error(result?.msg || `请求失败（HTTP ${response.status}）`)
  return result.data as T
}

function checkedUrl(value: string, label: string) {
  const clean = value.trim()
  if (!clean)
    return null
  try {
    const url = new URL(clean)
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('Unsupported URL protocol')
    return clean
  }
  catch {
    throw new Error(`${label}必须是完整的 HTTP(S) 地址`)
  }
}
