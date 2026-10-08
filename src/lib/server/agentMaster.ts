import { validateEvaluation } from '../keyword-contract'
import { WebsiteError } from '../website-contract'
import { getWebsiteUpdateRules } from './evaluation'

export interface AnalysisInput {
  task: AnalysisTask
  website: object
  allowed_categories: Category[]
  allowed_tags: readonly string[]
}
export type AnalysisTask = 'describe' | 'evaluate'
interface Category { id: string, name: string }

export async function analyzeWebsite(input: AnalysisInput) {
  if (input.task === 'evaluate')
    return { group: 'evaluation' as const, changes: await evaluateWebsite(input.website) }
  const site = object(input.website)
  const product = {
    id: String(site.id ?? ''), name: site.name,
    official_url: site.official_url || null, github_url: site.github_url || null,
    related_links: site.related_links || {}, self_description: site.self_description || '',
  }
  const article = {
    title: site.name, url: site.official_url || site.github_url,
    text: [site.self_description, site.description, ...(Array.isArray(site.features) ? site.features : [])]
      .filter(value => typeof value === 'string' && value.trim()).join('\n') || String(site.name),
  }
  const payload = { product, article, categories: input.allowed_categories.map(category => category.name), allowed_tags: input.allowed_tags }
  return parseAnalysisOutput(await runFixedAgent(process.env.NAV_FIXED_AGENT_ID ?? '', payload), input)
}

export async function evaluateWebsite(source: object) {
  const site = source as Record<string, unknown>
  const website = Object.fromEntries(['name', 'official_url', 'github_url', 'self_description', 'description', 'features', 'category_id', 'tags']
    .map(key => [key, site[key] ?? (['features', 'tags'].includes(key) ? [] : ['official_url', 'github_url'].includes(key) ? null : '')]))
  if (site.id !== undefined)
    website.id = site.id
  const rule = (await getWebsiteUpdateRules()).find(item => item.category === 'evaluate')
  if (!rule)
    throw new WebsiteError('缺少 Evaluate 更新规则', 503)
  const output = await runFixedAgent(rule.agent_id, { website })
  try {
    return validateEvaluation(output, String(website.name))
  }
  catch (error) { throw new WebsiteError(`Agent 评价契约无效：${error instanceof Error ? error.message : '未知错误'}`, 502) }
}

export function parseAnalysisOutput(value: unknown, input: AnalysisInput) {
  const output = object(value)
  const fields = ['description', 'features', 'category_name', 'tags']
  if (Object.keys(output).length !== fields.length || fields.some(field => !Object.hasOwn(output, field)))
    throw new WebsiteError('Agent 描述字段不符合契约', 502)
  const category = input.allowed_categories.find(category => category.name === output.category_name)
  if (typeof output.description !== 'string' || !output.description.trim()
    || (output.category_name !== '' && !category))
    throw new WebsiteError('Agent 描述或分类无效', 502)
  for (const field of ['features', 'tags']) {
    const items = output[field]
    if (!Array.isArray(items) || items.some(item => typeof item !== 'string' || !item.trim()) || new Set(items).size !== items.length)
      throw new WebsiteError(`Agent ${field} 必须是不重复的字符串数组`, 502)
    if (field === 'tags' && items.some(item => !input.allowed_tags.includes(item)))
      throw new WebsiteError('Agent 返回了词表外标签', 502)
  }
  return { group: 'content' as const, changes: {
    description: output.description, features: output.features,
    category_id: category?.id ?? '', tags: output.tags,
  } }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WebsiteError('Agent 返回的对象格式无效', 502)
  return value as Record<string, unknown>
}

async function runFixedAgent(id: string, input: unknown) {
  const base = process.env.AGENT_MASTER_BASE_URL?.replace(/\/$/, '')
  if (!base || !id)
    throw new WebsiteError('未配置固定 Agent 接入', 503)
  let response: Response
  try {
    // Never automatically retry a timed-out run.
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
    throw new WebsiteError(timeout ? 'Agent 请求超时；后台可能仍在运行，请勿立即重复提交' : '无法连接 Agent Master', timeout ? 504 : 502)
  }
  let result: Record<string, unknown>
  try {
    result = object(await response.json())
  }
  catch { throw new WebsiteError(`Agent Master 返回的 JSON 无效 (HTTP ${response.status})`, 502) }
  const detail = (value: unknown) => typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').slice(0, 400) : ''
  if (!response.ok) {
    const reason = typeof result.detail === 'string' ? detail(result.detail)
      : Array.isArray(result.detail) ? result.detail.map(item => {
          const error = object(item)
          return `${Array.isArray(error.loc) ? error.loc.join('.') : ''}: ${detail(error.msg)}`
        }).join('; ').slice(0, 400) : detail(result.message)
    throw new WebsiteError(`Agent Master HTTP ${response.status}${reason ? `：${reason}` : ''}`, 502)
  }
  const run = object(result.run)
  if (run.status !== 'SUCCEEDED') {
    const evidence = `run_id=${detail(run.run_id)}, version=${detail(run.prompt_version_id) || String(run.prompt_version ?? '')}`
    throw new WebsiteError(`Agent ${detail(run.status)}，未更新网站；${detail(run.error_message)} (${evidence})`, 502)
  }
  return result.output
}
