'use client'

import { Archive, ArrowRotateLeft, CircleCheck, Globe, Magnifier } from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'

import { formatDate } from '@/lib/utils'

import type { IResponse, Website } from '@/types'

type SiteFilter = 'active' | 'archived' | 'all'

const filters: Array<{ id: SiteFilter, label: string }> = [
  { id: 'active', label: '在线' },
  { id: 'archived', label: '已归档' },
  { id: 'all', label: '全部' },
]

function AdminSites() {
  const [sites, setSites] = useState<Website[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<SiteFilter>('active')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadSites = async (preferredId?: string) => {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/websites?include_archived=1', { cache: 'no-store' })
      const result = await response.json() as IResponse<Website[]>
      if (!response.ok || result.code !== 200)
        throw new Error(result.msg || '站点加载失败')
      const nextSites = result.data || []
      setSites(nextSites)
      setSelectedId((current) => {
        const nextId = preferredId || current
        return nextSites.some(site => site.id === nextId) ? nextId : nextSites[0]?.id || null
      })
    }
    catch (error) {
      setMessage((error as Error).message)
    }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSites()
  }, [])

  const counts = useMemo(() => ({
    active: sites.filter(site => !site.archived_at).length,
    archived: sites.filter(site => site.archived_at).length,
    all: sites.length,
  }), [sites])

  const visibleSites = useMemo(() => {
    const term = keyword.trim().toLocaleLowerCase()
    return sites.filter((site) => {
      if (filter === 'active' && site.archived_at)
        return false
      if (filter === 'archived' && !site.archived_at)
        return false
      if (!term)
        return true
      return [site.name, site.url, site.desc, site.category_name, ...(site.tags || [])]
        .some(value => value?.toLocaleLowerCase().includes(term))
    })
  }, [filter, keyword, sites])

  const selected = sites.find(site => site.id === selectedId) || null

  const toggleArchived = async () => {
    if (!selected)
      return
    setSaving(true)
    setMessage('')
    const archivedAt = selected.archived_at ? null : new Date().toISOString()
    try {
      const response = await fetch(`/api/websites/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived_at: archivedAt }),
      })
      const result = await response.json() as IResponse<Website>
      if (!response.ok || result.code !== 200)
        throw new Error(result.msg || '操作失败')
      setMessage(archivedAt ? `“${selected.name}”已下线归档` : `“${selected.name}”已恢复上线`)
      await loadSites(selected.id)
    }
    catch (error) {
      setMessage((error as Error).message)
    }
    finally {
      setSaving(false)
    }
  }

  return (
    <section data-admin-sites className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Administration</p>
          <h1 className="text-2xl font-black tracking-tight">站点管理</h1>
          <p className="mt-1 text-sm text-muted">查看站点元数据，并管理站点的上线状态。</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="size-2 rounded-full bg-success" />
          {counts.active}
          {' '}
          个站点在线
        </div>
      </div>

      {message && (
        <div role="status" className="rounded-xl border border-border bg-default px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:grid-cols-[minmax(19rem,0.82fr)_minmax(0,1.18fr)] lg:grid-rows-1">
        <aside className="flex min-h-0 flex-col overflow-hidden border-b border-border lg:border-r lg:border-b-0">
          <div className="space-y-3 border-b border-border p-4">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-focus">
              <Magnifier className="shrink-0 text-muted" />
              <span className="sr-only">搜索站点</span>
              <input
                aria-label="搜索站点"
                placeholder="搜索名称、分类或标签"
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </label>
            <div aria-label="站点状态筛选" className="grid grid-cols-3 gap-1 rounded-xl bg-default p-1">
              {filters.map(item => (
                <button
                  key={item.id}
                  aria-pressed={filter === item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${filter === item.id ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
                >
                  {item.label}
                  <span className="ml-1 tabular-nums">{counts[item.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div data-site-list className="min-h-0 flex-1 overflow-y-scroll p-2">
            {loading && <p className="p-6 text-center text-sm text-muted">正在加载站点…</p>}
            {!loading && visibleSites.length === 0 && <p className="p-6 text-center text-sm text-muted">没有符合条件的站点</p>}
            {visibleSites.map(site => (
              <button
                key={site.id}
                aria-current={selectedId === site.id ? 'true' : undefined}
                type="button"
                data-site-id={site.id}
                onClick={() => setSelectedId(site.id)}
                className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selectedId === site.id ? 'bg-accent text-accent-foreground' : 'hover:bg-default'}`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg font-black ${selectedId === site.id ? 'bg-white/15' : 'bg-default'}`}>
                  {site.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">{site.name}</span>
                    {site.archived_at && <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">已归档</span>}
                  </span>
                  <span className={`block truncate text-xs ${selectedId === site.id ? 'text-accent-foreground/65' : 'text-muted'}`}>
                    {site.category_name || '未分类'}
                    {' '}
                    ·
                    {site.url}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <article data-site-detail className="min-w-0 overflow-y-scroll p-5 sm:p-7">
          {!selected && !loading && (
            <div className="grid h-full min-h-64 place-items-center text-sm text-muted">从左侧选择一个站点查看详情</div>
          )}
          {selected && (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${selected.archived_at ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>
                      {selected.archived_at ? <Archive /> : <CircleCheck />}
                      {selected.archived_at ? '已归档' : '在线'}
                    </span>
                    <span className="text-xs text-muted">{selected.category_name || '未分类'}</span>
                  </div>
                  <h2 className="truncate text-2xl font-black">{selected.name}</h2>
                  <a href={selected.url} rel="noreferrer" target="_blank" className="mt-1 flex items-center gap-1 truncate text-sm text-accent underline-offset-4 hover:underline">
                    <Globe className="shrink-0" />
                    {selected.url}
                  </a>
                </div>
                <Button
                  aria-label={selected.archived_at ? '恢复上线' : '下线归档'}
                  variant="outline"
                  isPending={saving}
                  onPress={toggleArchived}
                  className={selected.archived_at ? 'text-success' : 'text-danger'}
                >
                  {selected.archived_at ? <ArrowRotateLeft /> : <Archive />}
                  {selected.archived_at ? '恢复上线' : '下线归档'}
                </Button>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-bold tracking-[0.16em] text-muted uppercase">基础信息</h3>
                <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                  <Metadata label="描述" value={selected.desc || '—'} wide />
                  <Metadata label="分类" value={selected.category_name || selected.category_id} />
                  <Metadata label="排序" value={String(selected.sort)} />
                  <Metadata label="标签" value={selected.tags?.length ? selected.tags.join('、') : '—'} wide />
                  <Metadata label="Logo 地址" value={selected.logo || '—'} wide />
                </dl>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-bold tracking-[0.16em] text-muted uppercase">展示与访问</h3>
                <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
                  <Metadata label="置顶" value={readableBoolean(selected.pinned)} />
                  <Metadata label="推荐" value={readableBoolean(selected.recommend)} />
                  <Metadata label="常用" value={readableBoolean(selected.commonlyUsed)} />
                  <Metadata label="需要 VPN" value={readableBoolean(selected.vpn)} />
                  <Metadata label="访问次数" value={String(selected.visitCount)} />
                  <Metadata label="归档时间" value={selected.archived_at ? formatDate(selected.archived_at, 'datetime') : '—'} />
                </dl>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-bold tracking-[0.16em] text-muted uppercase">分析元数据</h3>
                {Object.keys(selected.metadata || {}).length
                  ? (
                      <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                        {sortedMetadataEntries(selected.metadata).map(([key, value]) => (
                          <MetadataValue key={key} name={key} value={value} />
                        ))}
                      </dl>
                    )
                  : (
                      <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-sm text-muted">
                        当前站点尚无分析元数据；新入库记录会保存 TT-RSS 分类工作流的完整输出。
                      </p>
                    )}
              </div>

              <div>
                <h3 className="mb-3 text-xs font-bold tracking-[0.16em] text-muted uppercase">系统元数据</h3>
                <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                  <Metadata label="站点 ID" mono value={selected.id} wide />
                  <Metadata label="分类 ID" mono value={selected.category_id} wide />
                  <Metadata label="创建时间" value={formatDate(selected.created_at, 'datetime')} />
                  <Metadata label="更新时间" value={formatDate(selected.updated_at, 'datetime')} />
                </dl>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  )
}

function Metadata({ label, value, wide = false, mono = false }: { label: string, value: string, wide?: boolean, mono?: boolean }) {
  return (
    <div className={`min-w-0 bg-surface p-3 ${wide ? 'sm:col-span-full' : ''}`}>
      <dt className="mb-1 text-[11px] font-semibold text-muted">{label}</dt>
      <dd className={`break-words text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

const metadataLabels: Record<string, string> = {
  language: '语言',
  content_type: '内容类型',
  category: '识别分类',
  site_title: '站点标题',
  official_url: '官方网站',
  free_status: '免费状态',
  pricing_note: '价格说明',
  open_source_status: '开源状态',
  github_url: 'GitHub 地址',
  license: '许可证',
  topics: '主题',
  tags: '分析标签',
  entities: '实体',
  summary: '内容摘要',
  key_points: '关键要点',
  facts: '事实信息',
  importance: '重要性',
  sentiment: '情感倾向',
  actionability: '可行动性',
  sources: '来源',
  uncertainties: '不确定项',
  confidence: '置信度',
  analysis_version: '分析版本',
  analysis_provider: '分析服务',
  analysis_model: '分析模型',
  analyzed_at: '分析时间',
  article_id: '文章 ID',
  article_title: '文章标题',
  article_url: '文章地址',
  source_article: '源文章',
  pipeline_meta: '处理链路',
}

const metadataOrder = Object.keys(metadataLabels)

function MetadataValue({ name, value }: { name: string, value: unknown }) {
  const label = metadataLabels[name] ? `${metadataLabels[name]} · ${name}` : name
  const wide = Array.isArray(value) || (typeof value === 'object' && value !== null)

  return (
    <div className={`min-w-0 bg-surface p-3 ${wide ? 'sm:col-span-full' : ''}`}>
      <dt className="mb-1 text-[11px] font-semibold text-muted">{label}</dt>
      <dd className="break-words text-sm">
        {renderMetadataValue(value)}
      </dd>
    </div>
  )
}

function readableBoolean(value: boolean) {
  return value ? '是' : '否'
}

function renderMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === '')
    return '—'
  if (typeof value === 'boolean')
    return readableBoolean(value)
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    return <a href={value} rel="noreferrer" target="_blank" className="text-accent underline-offset-4 hover:underline">{value}</a>
  }
  if (Array.isArray(value) && value.every(item => ['string', 'number', 'boolean'].includes(typeof item)))
    return value.length ? value.map(String).join('、') : '—'
  if (typeof value === 'object')
    return <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5">{JSON.stringify(value, null, 2)}</pre>
  return String(value)
}

function sortedMetadataEntries(metadata: Record<string, unknown>) {
  return Object.entries(metadata).sort(([a], [b]) => {
    const ai = metadataOrder.indexOf(a)
    const bi = metadataOrder.indexOf(b)
    if (ai === -1 && bi === -1)
      return a.localeCompare(b)
    if (ai === -1)
      return 1
    if (bi === -1)
      return -1
    return ai - bi
  })
}

export default AdminSites
