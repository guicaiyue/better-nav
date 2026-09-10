/* eslint-disable no-alert -- Explicit confirmation prevents accidental AI overwrite, archive and draft loss. */
'use client'

import { useEffect, useMemo, useState } from 'react'

import WebsiteDetails from '@/components/WebSiteCard/WebsiteDetails'
import { websiteSearchText } from '@/components/WebSiteCard/websiteView'

import { buttonClass, inputClass, navRequest, primaryClass } from './siteEditor'
import SiteForm from './SiteForms'

import type { EditGroup, Taxonomy } from './siteEditor'
import type { Website } from '@/types'

type Filter = 'active' | 'archived' | 'all'
type Mode = 'detail' | EditGroup | 'create'
const filterLabels: Record<Filter, string> = { active: '收录中', archived: '已归档', all: '全部' }
const modeLabels: Record<Exclude<Mode, 'create'>, string> = { detail: '详情', intake: '基础信息', content: '描述与分类', review: '评价' }

export default function AdminSites() {
  const [sites, setSites] = useState<Website[]>([])
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({ categories: [], tag_options: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  const [keyword, setKeyword] = useState('')
  const [mode, setMode] = useState<Mode>('detail')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [mobileDetail, setMobileDetail] = useState(false)
  const selected = sites.find(site => site.id === selectedId)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [rows, terms] = await Promise.all([
        navRequest<Website[]>('/api/websites?include_archived=1'),
        navRequest<Taxonomy>('/api/taxonomy'),
      ])
      setSites(rows)
      setTaxonomy(terms)
      setSelectedId(current => rows.some(site => site.id === current) ? current : rows.find(site => !site.archived_at)?.id || rows[0]?.id || null)
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : '加载失败') }
    finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const counts = useMemo(() => ({ active: sites.filter(site => !site.archived_at).length, archived: sites.filter(site => !!site.archived_at).length, all: sites.length }), [sites])
  const visible = useMemo(() => sites.filter((site) => {
    if (filter === 'active' && site.archived_at)
      return false
    if (filter === 'archived' && !site.archived_at)
      return false
    const category = taxonomy.categories.find(item => item.id === site.category_id)?.name || ''
    return `${websiteSearchText(site)} ${category}`.includes(keyword.trim().toLocaleLowerCase())
  }), [sites, filter, keyword, taxonomy])

  // Editing is explicit: navigation asks before discarding an open draft.
  const mayNavigate = () => mode === 'detail' || window.confirm('离开编辑会丢弃当前未保存内容，继续吗？')
  const select = (site: Website) => {
    if (busy || !mayNavigate())
      return
    setSelectedId(site.id)
    setMode('detail')
    setMobileDetail(true)
    setMessage('')
    setError('')
  }
  const startCreate = () => {
    if (!mayNavigate())
      return
    setMode('create')
    setMobileDetail(true)
    setMessage('')
    setError('')
  }
  const upsert = (site: Website) => {
    setSites(rows => rows.some(row => row.id === site.id) ? rows.map(row => row.id === site.id ? site : row) : [site, ...rows])
    setSelectedId(site.id)
  }
  const save = async (changes: Record<string, unknown>) => {
    if (busy)
      return
    setBusy('保存')
    setError('')
    setMessage('')
    try {
      const creating = mode === 'create'
      const site = await navRequest<Website>(creating ? '/api/websites' : `/api/websites/${selected!.id}`, {
        method: creating ? 'POST' : 'PATCH',
        body: JSON.stringify(creating ? changes : { group: mode, changes }),
      })
      upsert(site)
      if (creating) {
        setFilter('active')
        setKeyword('')
      }
      setMode('detail')
      setMessage(creating ? '站点已创建，可继续生成描述、评价或采集 GitHub。' : '当前分组已保存。')
    }
    finally {
      setBusy('')
    }
  }
  const action = async (kind: 'describe' | 'evaluate' | 'github' | 'archive') => {
    if (!selected || busy)
      return
    const label = kind === 'describe' ? 'AI 描述' : kind === 'evaluate' ? 'AI 评价' : kind === 'github' ? 'GitHub 快照采集' : selected.archived_at ? '恢复收录' : '归档'
    if ((kind === 'describe' || kind === 'evaluate') && !window.confirm(`${label}将替换${kind === 'describe' ? '描述、功能、分类与标签' : '评价'}分组，其他字段保持不变。继续吗？`))
      return
    if (kind === 'archive' && !window.confirm(`确认${label}“${selected.name}”？${selected.archived_at ? '恢复后将重新显示在首页。' : '归档后首页不再展示，仍可随时恢复。'}`))
      return
    const id = selected.id
    setBusy(label)
    setError('')
    setMessage('')
    try {
      if (kind === 'archive') {
        const row = await navRequest<Website>(`/api/websites/${id}`, { method: 'PATCH', body: JSON.stringify({ group: 'lifecycle', changes: { archived: !selected.archived_at } }) })
        upsert(row)
      }
      else {
        await navRequest<unknown>(`/api/websites/${id}/${kind === 'github' ? 'github-refresh' : 'analyze'}`, {
          method: 'POST',
          body: JSON.stringify(kind === 'github' ? {} : { task: kind }),
        })
        // Analyze response may contain run metadata; authoritative item GET is the display source.
        upsert(await navRequest<Website>(`/api/websites/${id}`))
      }
      setMessage(`${label}已完成。`)
    }
    catch (cause) { setError(`${cause instanceof Error ? cause.message : '操作失败'}${kind === 'describe' || kind === 'evaluate' ? ' 若连接中断，远端可能仍在运行，请稍后刷新核实，勿直接重复生成。' : ''}`) }
    finally {
      setBusy('')
    }
  }

  return (
    <section data-admin-sites className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Curated directory</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">站点管理</h1>
          <p className="mt-1 text-xs text-muted">认真收录，清晰整理。基础信息、AI 内容与程序快照各自独立。</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button" disabled={!!busy || loading} onClick={() => {
              if (mayNavigate()) {
                setMode('detail')
                void load()
              }
            }} className={buttonClass}
          >
            刷新列表
          </button>
          <button type="button" disabled={!!busy || loading || !taxonomy.categories.length} onClick={startCreate} className={primaryClass}>＋ 新建站点</button>
        </div>
      </header>
      {(error || message || busy) && (
        <div aria-live="polite" role={error ? 'alert' : 'status'} className={`shrink-0 rounded-xl border px-4 py-3 text-sm ${error ? 'border-danger/30 bg-danger/10 text-danger' : 'border-accent/20 bg-accent/5 text-accent'}`}>
          {error || (busy ? `${busy}进行中…${busy.startsWith('AI') ? '同步请求可能需要数分钟，请保持页面打开，不要重复提交。' : ''}` : message)}
        </div>
      )}
      {loading
        ? <div role="status" className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-default-200 text-sm text-muted">正在加载站点与分类词表…</div>
        : (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[minmax(15rem,0.85fr)_minmax(0,2fr)]">
              <aside aria-label="站点列表" className={`${mobileDetail ? 'hidden md:flex' : 'flex'} min-h-0 flex-col overflow-hidden rounded-2xl border border-default-200 bg-background`}>
                <div className="shrink-0 space-y-3 border-b border-default-200 p-4">
                  <label className="block">
                    <span className="sr-only">搜索站点</span>
                    <input type="search" placeholder="搜索名称、链接、描述、标签…" value={keyword} onChange={event => setKeyword(event.target.value)} className={inputClass} />
                  </label>
                  <div className="flex gap-1 rounded-xl bg-default-100 p-1">
                    {(Object.keys(filterLabels) as Filter[]).map(value => (
                      <button key={value} aria-pressed={filter === value} type="button" onClick={() => setFilter(value)} className={`flex-1 rounded-lg px-2 py-2 text-xs transition ${filter === value ? 'bg-background font-semibold text-accent shadow-sm' : 'text-muted'}`}>
                        {filterLabels[value]}
                        {' '}
                        {counts[value]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                  {visible.length
                    ? visible.map(site => (
                        <button
                          key={site.id}
                          aria-current={site.id === selectedId && mode !== 'create' ? 'true' : undefined}
                          type="button"
                          disabled={!!busy}
                          onClick={() => select(site)}
                          className={`mb-1 w-full rounded-xl border p-3 text-left transition disabled:opacity-60 ${site.id === selectedId && mode !== 'create' ? 'border-accent/25 bg-accent/5' : 'border-transparent hover:bg-default-100'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{site.name}</span>
                            <span className={`shrink-0 text-[10px] ${site.archived_at ? 'text-muted' : 'text-accent'}`}>{site.archived_at ? '归档' : '收录'}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted">{site.official_url || site.github_url}</p>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-default-500">{site.description || '描述待整理'}</p>
                        </button>
                      ))
                    : <div className="p-6 text-center text-sm leading-7 text-muted">{sites.length ? '没有匹配站点，试试其他关键词或筛选。' : '还没有收录站点。点击“新建站点”开始。'}</div>}
                </div>
                <div className="shrink-0 border-t border-default-200 px-4 py-3 text-xs text-muted">
                  当前显示
                  {visible.length}
                  {' '}
                  个 · 共
                  {sites.length}
                  {' '}
                  个
                </div>
              </aside>
              <section aria-busy={!!busy} aria-label="站点工作区" className={`${mobileDetail ? 'flex' : 'hidden md:flex'} min-h-0 flex-col overflow-hidden rounded-2xl border border-default-200 bg-background`}>
                <div className="shrink-0 border-b border-default-200 p-4 sm:p-5">
                  <button
                    type="button" disabled={!!busy} onClick={() => {
                      if (mayNavigate()) {
                        setMode('detail')
                        setMobileDetail(false)
                      }
                    }} className="mb-3 text-sm text-accent md:hidden"
                  >
                    ← 返回列表
                  </button>
                  <h2 className="truncate text-lg font-bold">{mode === 'create' ? '新建站点' : selected?.name || '选择一个站点'}</h2>
                  <p className="mt-1 text-xs text-muted">{mode === 'create' ? '先保存基础信息，再逐步完善内容。' : selected?.archived_at ? '已归档 · 可查看、编辑或恢复收录' : '收录中的站点会显示在首页'}</p>
                  {selected && mode !== 'create' && (
                    <>
                      <nav aria-label="编辑分组" className="mt-4 flex flex-wrap gap-1">
                        {(Object.keys(modeLabels) as Exclude<Mode, 'create'>[]).map(value => (
                          <button
                            key={value} aria-pressed={mode === value} type="button" disabled={!!busy} onClick={() => {
                              if (mode !== value && mayNavigate())
                                setMode(value)
                            }}
                            className={`rounded-lg px-3 py-2 text-sm disabled:opacity-50 ${mode === value ? 'bg-accent/10 font-medium text-accent' : 'text-muted hover:bg-default-100'}`}
                          >
                            {modeLabels[value]}
                          </button>
                        ))}
                      </nav>
                      {mode === 'detail' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" disabled={!!busy} onClick={() => void action('describe')} className={buttonClass}>✦ AI 描述</button>
                          <button type="button" disabled={!!busy} onClick={() => void action('evaluate')} className={buttonClass}>✦ AI 评价</button>
                          <button title={selected.github_url ? '程序采集，不调用 AI' : '请先填写 GitHub 仓库'} type="button" disabled={!!busy || !selected.github_url} onClick={() => void action('github')} className={buttonClass}>刷新 GitHub</button>
                          <button type="button" disabled={!!busy} onClick={() => void action('archive')} className={`${buttonClass} ml-auto`}>{selected.archived_at ? '恢复收录' : '归档站点'}</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                  {mode === 'create'
                    ? (
                        <SiteForm
                          key="create"
                          busy={!!busy}
                          group="intake"
                          taxonomy={taxonomy}
                          onCancel={() => setMode('detail')}
                          onSave={save}
                        />
                      )
                    : selected
                      ? mode === 'detail'
                        ? <WebsiteDetails categoryName={taxonomy.categories.find(category => category.id === selected.category_id)?.name} site={selected} />
                        : (
                            <SiteForm
                              key={`${selected.id}-${mode}`}
                              busy={!!busy}
                              group={mode}
                              site={selected}
                              taxonomy={taxonomy}
                              onCancel={() => setMode('detail')}
                              onSave={save}
                            />
                          )
                      : <div className="flex h-full min-h-40 items-center justify-center text-center text-sm text-muted">从左侧选择站点，或新建一条收录。</div>}
                </div>
              </section>
            </div>
          )}
    </section>
  )
}
