export const CATEGORY_NAMES = ['AI 与智能', '开发与开源', '创作与设计', '学习与知识', '媒体与内容', '隐私与安全', '其它'] as const
export const TAG_OPTIONS = ['开源', '可自部署', '无需注册', '离线可用', '本地处理', '中文支持', '提供API', '浏览器扩展', '命令行', '需付费'] as const
export const WEBSITE_GROUPS = {
  intake: ['name', 'official_url', 'github_url', 'related_links', 'self_description'],
  content: ['description', 'features', 'category_id', 'tags'],
  review: ['ai_review'],
  lifecycle: ['archived'],
} as const
export type WebsiteGroup = keyof typeof WEBSITE_GROUPS

export class WebsiteError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'WebsiteError'
  }
}

export function normalizeUrl(value: unknown, github = false): string | null {
  if (value === null)
    return null
  if (typeof value !== 'string')
    throw new WebsiteError('链接必须是 URL 字符串或 null')
  if (!value.trim())
    return null
  let url: URL
  try {
    url = new URL(value.trim())
  }
  catch { throw new WebsiteError('无效的 URL') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new WebsiteError('链接仅支持无凭据的 HTTP(S) URL')
  if (github) {
    const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    if (url.hostname.toLowerCase() !== 'github.com' || url.port || parts.length !== 2 || parts.some(part => !/^[\w.-]+$/.test(part)) || url.search || url.hash)
      throw new WebsiteError('GitHub 地址必须是仓库根地址')
    const repo = parts[1].replace(/\.git$/i, '')
    if (!repo || ['.', '..'].includes(repo))
      throw new WebsiteError('无效的 GitHub 仓库')
    return `https://github.com/${parts[0].toLowerCase()}/${repo.toLowerCase()}`
  }
  return url.href
}

export function requireId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))
    throw new WebsiteError('无效的 ID')
  return value
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WebsiteError('请求必须是对象')
  return value as Record<string, unknown>
}

export function validateChanges(group: unknown, input: unknown): Record<string, unknown> {
  if (typeof group !== 'string' || !Object.hasOwn(WEBSITE_GROUPS, group))
    throw new WebsiteError('无效的字段组')
  const allowed: readonly string[] = WEBSITE_GROUPS[group as WebsiteGroup]
  const source = requireObject(input)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (!allowed.includes(key))
      throw new WebsiteError(`不允许更新字段: ${key}`)
    if (key === 'official_url' || key === 'github_url') {
      result[key] = normalizeUrl(value, key === 'github_url')
    }
    else if (key === 'related_links') {
      const links = requireObject(value)
      const normalized: Record<string, string | null> = Object.create(null)
      for (const [name, url] of Object.entries(links)) {
        if (!name.trim())
          throw new WebsiteError('相关链接名称不能为空')
        const normalizedUrl = normalizeUrl(url)
        if (url !== null && normalizedUrl === null)
          throw new WebsiteError('删除相关链接请传 null')
        normalized[name] = normalizedUrl
      }
      result[key] = normalized
    }
    else if (key === 'features' || key === 'tags') {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim()))
        throw new WebsiteError(`${key} 必须是非空字符串数组`)
      const items = [...new Set((value as string[]).map(item => item.trim()))]
      if (key === 'tags' && items.some(item => !(TAG_OPTIONS as readonly string[]).includes(item)))
        throw new WebsiteError('标签必须来自受控词表')
      result[key] = items
    }
    else if (key === 'category_id') {
      result[key] = requireId(value)
    }
    else if (key === 'archived') {
      if (typeof value !== 'boolean')
        throw new WebsiteError('archived 必须是布尔值')
      result[key] = value
    }
    else if (key === 'ai_review' && value === null) {
      result[key] = null
    }
    else {
      if (typeof value !== 'string' || (key === 'name' && !value.trim()))
        throw new WebsiteError(`${key} 必须是${key === 'name' ? '非空' : ''}字符串`)
      result[key] = value.trim()
    }
  }
  return result
}
