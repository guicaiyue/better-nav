import type { Website } from '@/types'

export function displayDate(value?: string | null) {
  if (!value)
    return '尚无记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '时间不可用' : date.toLocaleString('zh-CN', { hour12: false })
}

export function githubRepository(value?: string | null) {
  const safe = safeWebUrl(value)
  if (!safe)
    return null
  const url = new URL(safe)
  const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
  if (url.hostname !== 'github.com' || parts.length !== 2)
    return null
  return { owner: parts[0], repository: parts[1].replace(/\.git$/, '') }
}

export function safeWebUrl(value?: string | null) {
  if (!value)
    return null
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  }
  catch {
    return null
  }
}

export function websiteSearchText(site: Website) {
  return [site.name, site.official_url, site.github_url, site.description, site.self_description, ...(site.features || []), ...(site.tags || []), ...Object.keys(site.related_links || {})]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
}
