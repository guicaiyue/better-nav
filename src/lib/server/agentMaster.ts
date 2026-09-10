import { WebsiteError } from '@/lib/website-contract'

export type AnalysisTask = 'describe' | 'evaluate'
type Category = { id: string, name: string }
export interface AnalysisInput {
  task: AnalysisTask
  website: object
  allowed_categories: Category[]
  allowed_tags: readonly string[]
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WebsiteError('Agent 返回的对象格式无效', 502)
  return value as Record<string, unknown>
}

export function parseAnalysisOutput(value: unknown, input: AnalysisInput) {
  const output = object(value)
  const key = input.task === 'describe' ? 'description_group' : 'evaluation_group'
  if (Object.keys(output).length !== 1 || !Object.hasOwn(output, key))
    throw new WebsiteError('Agent 必须只返回请求的职责组', 502)
  const changes = object(output[key])
  const fields = input.task === 'describe' ? ['description', 'features', 'category_id', 'tags'] : ['ai_review']
  if (Object.keys(changes).length !== fields.length || fields.some(field => !Object.hasOwn(changes, field)))
    throw new WebsiteError('Agent 职责组字段不符合契约', 502)
  if (input.task === 'evaluate') {
    if (typeof changes.ai_review !== 'string' || !changes.ai_review.trim())
      throw new WebsiteError('Agent 评价必须是非空字符串', 502)
  }
  else {
    if (typeof changes.description !== 'string' || !changes.description.trim()
      || !input.allowed_categories.some(category => category.id === changes.category_id))
      throw new WebsiteError('Agent 描述或分类无效', 502)
    for (const field of ['features', 'tags']) {
      const items = changes[field]
      if (!Array.isArray(items) || items.some(item => typeof item !== 'string' || !item.trim()))
        throw new WebsiteError(`Agent ${field} 必须是字符串数组`, 502)
      if (field === 'tags' && items.some(item => !input.allowed_tags.includes(item)))
        throw new WebsiteError('Agent 返回了词表外标签', 502)
    }
  }
  return { group: input.task === 'describe' ? 'content' as const : 'review' as const, changes }
}

export async function analyzeWebsite(input: AnalysisInput) {
  const base = process.env.AGENT_MASTER_BASE_URL?.replace(/\/$/, '')
  const id = process.env.NAV_FIXED_AGENT_ID
  if (!base || !id)
    throw new WebsiteError('未配置生产固定 Agent', 503)
  let response: Response
  try {
    // One synchronous request only: a timeout must never trigger an automatic duplicate run.
    response = await fetch(`${base}/api/v1/fixed-agents/${encodeURIComponent(id)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
      cache: 'no-store',
      signal: AbortSignal.timeout(600_000),
    })
  }
  catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
    throw new WebsiteError(timeout ? 'Agent 请求超时；后台可能仍在运行，请勿立即重复提交' : '无法连接生产 Agent Master', timeout ? 504 : 502)
  }
  if (!response.ok)
    throw new WebsiteError(`Agent Master 请求失败 (${response.status})`, 502)
  let result: Record<string, unknown>
  try { result = object(await response.json()) }
  catch { throw new WebsiteError('Agent Master 返回的 JSON 无效', 502) }
  const run = object(result.run)
  if (run.status !== 'SUCCEEDED')
    throw new WebsiteError('Agent 运行未成功，未更新网站', 502)
  return parseAnalysisOutput(result.output, input)
}
