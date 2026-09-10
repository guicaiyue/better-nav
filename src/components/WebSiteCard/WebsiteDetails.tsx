import { displayDate, safeWebUrl } from './websiteView'

import type { Website } from '@/types'
import type { ReactNode } from 'react'

export function ExternalLink({ href, children }: { href?: string | null, children: ReactNode }) {
  const safe = safeWebUrl(href)
  return safe
    ? (
        <a href={safe} rel="noopener noreferrer" target="_blank" className="break-all text-accent underline-offset-4 hover:underline">
          {children}
          {' '}
          ↗
        </a>
      )
    : null
}

export default function WebsiteDetails({ site, categoryName }: { site: Website, categoryName?: string }) {
  const snapshot = site.github_snapshot
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-3">
        <ExternalLink href={site.official_url}>官方网站</ExternalLink>
        <ExternalLink href={site.github_url}>GitHub 仓库</ExternalLink>
        {Object.entries(site.related_links || {}).map(([name, url]) => <ExternalLink key={name} href={url}>{name}</ExternalLink>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {categoryName && <span className="rounded-full bg-accent/10 px-3 py-1 text-accent">{categoryName}</span>}
        {site.tags.map(tag => <span key={tag} className="rounded-full bg-default-100 px-3 py-1 text-xs">{tag}</span>)}
        {site.archived_at && <span className="rounded-full bg-warning/10 px-3 py-1 text-warning">已归档 · 不在首页展示</span>}
      </div>
      <Section title="描述与功能">
        <p className="whitespace-pre-wrap break-words leading-7 text-default-600">{site.description || '尚未整理描述，可在管理页手动编辑或生成 AI 描述。'}</p>
        {site.features.length > 0 && <ul className="list-disc space-y-2 pl-5 text-default-600">{site.features.map((feature, index) => <li key={`${index}-${feature}`} className="break-words">{feature}</li>)}</ul>}
      </Section>
      <Section title="AI 评价">
        <p className="whitespace-pre-wrap break-words leading-7 text-default-600">{site.ai_review || '暂无 AI 评价。'}</p>
        <p className="text-xs text-muted">
          评价时间：
          {displayDate(site.ai_reviewed_at)}
          {' '}
          · AI 内容仅供参考，请结合实际体验判断。
        </p>
      </Section>
      <Section title="自荐原文">
        <p className="whitespace-pre-wrap break-words leading-7 text-default-600">{site.self_description || '暂无自荐描述。'}</p>
        <p className="text-xs text-muted">由录入者提供，与 AI 描述、评价独立保存。</p>
      </Section>
      <Section title="GitHub 程序快照">
        {snapshot
          ? (
              <>
                <ExternalLink href={snapshot.html_url}>{snapshot.full_name}</ExternalLink>
                <p className="break-words leading-6 text-default-600">{snapshot.description || '仓库未提供简介'}</p>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    ['Stars', snapshot.stargazers_count],
                    ['Forks', snapshot.forks_count],
                    ['开放议题', snapshot.open_issues_count],
                    ['语言', snapshot.language || '未标注'],
                    ['许可证', snapshot.license_spdx_id || '未标注'],
                    ['默认分支', snapshot.default_branch],
                    ['仓库状态', snapshot.archived ? 'GitHub 已归档' : '活跃仓库'],
                    ['最近推送', displayDate(snapshot.pushed_at)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="mt-1 break-words font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                {snapshot.homepage && <ExternalLink href={snapshot.homepage}>仓库声明的主页</ExternalLink>}
              </>
            )
          : <p className="text-default-500">{site.github_url ? '尚未采集快照，请在管理页刷新 GitHub。' : '未填写 GitHub 仓库。'}</p>}
        <p className="text-xs text-muted">
          采集时间：
          {displayDate(site.github_fetched_at)}
          {' '}
          · 仓库归档状态不影响本站收录状态。
        </p>
      </Section>
      <dl className="grid gap-3 px-1 text-xs text-muted sm:grid-cols-2">
        <div>
          <dt>录入时间</dt>
          <dd className="mt-1">{displayDate(site.created_at)}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd className="mt-1">{displayDate(site.updated_at)}</dd>
        </div>
        {site.archived_at && (
          <div>
            <dt>归档时间</dt>
            <dd className="mt-1">{displayDate(site.archived_at)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

function Section({ title, children }: { title: string, children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-default-200 p-4 sm:p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}
