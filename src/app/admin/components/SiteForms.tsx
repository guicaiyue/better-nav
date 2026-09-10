'use client'

import { useState } from 'react'

import {
  buttonClass,
  contentChanges,
  inputClass,
  intakeChanges,
  intakeDraft,
  intakePayload,
  primaryClass,
} from './siteEditor'

import type { EditGroup, IntakeDraft, Taxonomy } from './siteEditor'
import type { Website } from '@/types'
import type { ReactNode } from 'react'

export default function SiteForm({ site, group, taxonomy, busy, onSave, onCancel }: {
  site?: Website
  group: EditGroup
  taxonomy: Taxonomy
  busy: boolean
  onSave: (changes: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(() => intakeDraft(site))
  const [description, setDescription] = useState(site?.description || '')
  const [features, setFeatures] = useState(site?.features.join('\n') || '')
  const [categoryId, setCategoryId] = useState(site?.category_id || '')
  const [tags, setTags] = useState(site?.tags || [])
  const [review, setReview] = useState(site?.ai_review || '')
  const [error, setError] = useState('')
  const submit = async () => {
    setError('')
    try {
      let changes: Record<string, unknown>
      if (group === 'intake') {
        changes = site ? intakeChanges(site, draft) : intakePayload(draft)
      }
      else if (group === 'content' && site) {
        if (!taxonomy.categories.some(category => category.id === categoryId))
          throw new Error('请选择有效分类')
        if (tags.some(tag => !taxonomy.tag_options.includes(tag)))
          throw new Error('包含词表外标签，请重新选择')
        changes = contentChanges(site, { description, features: features.split('\n').map(item => item.trim()).filter(Boolean), category_id: categoryId, tags })
      }
      else {
        changes = review === (site?.ai_review || '') ? {} : { ai_review: review.trim() ? review : null }
      }
      if (site && !Object.keys(changes).length) {
        setError('没有需要保存的修改')
        return
      }
      await onSave(changes)
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }} className="space-y-6"
    >
      <fieldset disabled={busy} className="space-y-5">
        {group === 'intake' && <IntakeFields draft={draft} setDraft={setDraft} />}
        {group === 'content' && (
          <>
            <Field label="站点描述"><textarea placeholder="简洁、客观地描述站点用途" rows={6} value={description} onChange={event => setDescription(event.target.value)} className={inputClass} /></Field>
            <Field hint="每行一项，留空可清空功能列表。" label="主要功能"><textarea placeholder="每行填写一项主要功能" rows={5} value={features} onChange={event => setFeatures(event.target.value)} className={inputClass} /></Field>
            <Field label="分类">
              <select value={categoryId} onChange={event => setCategoryId(event.target.value)} className={inputClass}>
                <option disabled value="">请选择分类</option>
                {taxonomy.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-3 text-sm font-medium">受控标签</legend>
              <div className="flex flex-wrap gap-2">
                {taxonomy.tag_options.map(tag => (
                  <label key={tag} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${tags.includes(tag) ? 'border-accent/40 bg-accent/10 text-accent' : 'border-default-200'}`}>
                    <input type="checkbox" checked={tags.includes(tag)} onChange={event => setTags(event.target.checked ? [...tags, tag] : tags.filter(value => value !== tag))} className="accent-current" />
                    {tag}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">不选标签即清空；分类和词表由服务端统一维护。</p>
            </fieldset>
          </>
        )}
        {group === 'review' && <Field hint="可人工修订，留空保存会清除评价。评价时间由服务端维护。" label="AI 评价"><textarea placeholder="暂无评价，可手动补充或先运行 AI 评价" rows={12} value={review} onChange={event => setReview(event.target.value)} className={inputClass} /></Field>}
      </fieldset>
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-default-200 bg-background py-4">
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? '正在保存…' : site ? '保存当前分组' : '创建站点'}</button>
        <button type="button" disabled={busy} onClick={onCancel} className={buttonClass}>取消</button>
        <p className="basis-full text-xs text-muted">{site ? '仅提交本次修改的字段，不覆盖其他分组。' : '仅提交基础信息，默认归入“其它”，描述与评价可创建后生成。'}</p>
      </div>
    </form>
  )
}

function Field({ label, children, hint }: { label: string, children: ReactNode, hint?: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  )
}

function IntakeFields({ draft, setDraft }: { draft: IntakeDraft, setDraft: (draft: IntakeDraft) => void }) {
  const update = (key: keyof Omit<IntakeDraft, 'related_links'>, value: string) => setDraft({ ...draft, [key]: value })
  return (
    <div className="space-y-5">
      <Field label="站点名称 *"><input placeholder="给站点一个清晰的名称" required value={draft.name} onChange={event => update('name', event.target.value)} className={inputClass} /></Field>
      <div className="grid gap-5 xl:grid-cols-2">
        <Field hint="官网与 GitHub 至少填写一个。" label="官方网站"><input type="url" placeholder="https://example.com" value={draft.official_url} onChange={event => update('official_url', event.target.value)} className={inputClass} /></Field>
        <Field hint="修改仓库会清除旧快照，保存后请重新采集。" label="GitHub 仓库"><input type="url" placeholder="https://github.com/owner/repo" value={draft.github_url} onChange={event => update('github_url', event.target.value)} className={inputClass} /></Field>
      </div>
      <Field hint="保留录入者原文，AI 不会修改此字段。" label="自荐描述"><textarea placeholder="它解决什么问题？为什么值得收录？" rows={5} value={draft.self_description} onChange={event => update('self_description', event.target.value)} className={inputClass} /></Field>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">相关链接</legend>
        {!draft.related_links.length && <p className="text-sm text-muted">暂无相关链接，可添加文档、演示或教程。</p>}
        {draft.related_links.map((row, index) => (
          <div key={index} className="flex flex-wrap gap-2 rounded-xl bg-default-100/50 p-2">
            <input aria-label={`链接 ${index + 1} 名称`} placeholder="名称，如文档" value={row.name} onChange={event => setDraft({ ...draft, related_links: draft.related_links.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} className={`${inputClass} min-w-0 flex-[1_1_8rem]`} />
            <input
              aria-label={`链接 ${index + 1} 地址`}
              type="url"
              placeholder="https://"
              value={row.url}
              onChange={event => setDraft({ ...draft, related_links: draft.related_links.map((item, i) => i === index ? { ...item, url: event.target.value } : item) })}
              className={`${inputClass} min-w-0 flex-[3_1_14rem]`}
            />
            <button aria-label={`移除链接 ${index + 1}`} type="button" onClick={() => setDraft({ ...draft, related_links: draft.related_links.filter((_, i) => i !== index) })} className={buttonClass}>移除</button>
          </div>
        ))}
        <button type="button" onClick={() => setDraft({ ...draft, related_links: [...draft.related_links, { name: '', url: '' }] })} className={buttonClass}>＋ 添加链接</button>
      </fieldset>
    </div>
  )
}
