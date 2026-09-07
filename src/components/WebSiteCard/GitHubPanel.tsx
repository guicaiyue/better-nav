'use client'

import { Chip, cn } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { GithubIcon } from '@/lib/icons'

import { createReadmeAssetUrl, getProxiedDownloadUrl, getProxiedReadmeUrl, isReadmeFile, readmeRehypePlugins } from './githubReadme'

type ApiState = 'checking' | 'available' | 'unavailable'

interface GitHubContent {
  name: string
  path: string
  type: 'dir' | 'file' | 'symlink' | 'submodule'
}

interface GitHubPanelProps {
  owner: string
  repository: string
}

interface GitHubRelease {
  assets: GitHubReleaseAsset[]
  html_url: string
  id: number
  name: string | null
  published_at: string | null
  tag_name: string
}

interface GitHubReleaseAsset {
  browser_download_url: string
  download_count: number
  id: number
  name: string
  size: number
}

interface GitHubRepository {
  default_branch: string
  description: string | null
  forks_count: number
  html_url: string
  language: string | null
  license: { spdx_id: string } | null
  open_issues_count: number
  stargazers_count: number
  subscribers_count: number
}
type PanelTab = { kind: 'download', key: 'download', label: '下载' } | { kind: 'readme', key: string, label: string, path: string }

const GITHUB_API_URL = '/api/github'
const GITHUB_API_TIMEOUT = 8000

export default function GitHubPanel({ owner, repository }: GitHubPanelProps) {
  const [repo, setRepo] = useState<GitHubRepository>()
  const [releases, setReleases] = useState<GitHubRelease[]>([])
  const [readmes, setReadmes] = useState<GitHubContent[]>([])
  const [activeTab, setActiveTab] = useState('download')
  const [markdownByPath, setMarkdownByPath] = useState<Record<string, string>>({})
  const [markdownError, setMarkdownError] = useState('')
  const [isMarkdownLoading, setIsMarkdownLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [apiState, setApiState] = useState<ApiState>('checking')
  const [retryKey, setRetryKey] = useState(0)
  const repositoryPath = `${owner}/${repository}`

  const tabs = useMemo<PanelTab[]>(() => [
    ...readmes.map(readme => ({ kind: 'readme' as const, key: readme.path, label: readme.name, path: readme.path })),
    { kind: 'download' as const, key: 'download' as const, label: '下载' as const },
  ], [readmes])
  const activeReadme = readmes.find(readme => readme.path === activeTab)
  const rewriteAssetUrl = repo && activeReadme
    ? createReadmeAssetUrl(repositoryPath, repo.default_branch, activeReadme.path)
    : (source?: string) => source || ''

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    let apiAvailable = false
    const timeoutId = window.setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT)

    async function loadGitHub() {
      setApiState('checking')
      setIsLoading(true)
      setError('')
      setMarkdownByPath({})
      setActiveTab('download')
      try {
        await fetch(GITHUB_API_URL, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: controller.signal,
        })
        apiAvailable = true
        window.clearTimeout(timeoutId)
        setApiState('available')

        const headers = { Accept: 'application/vnd.github+json' }
        const [repoResponse, releasesResponse, contentsResponse] = await Promise.all([
          fetch(`${GITHUB_API_URL}/repos/${repositoryPath}`, { headers, signal: controller.signal }),
          fetch(`${GITHUB_API_URL}/repos/${repositoryPath}/releases?per_page=10`, { headers, signal: controller.signal }),
          fetch(`${GITHUB_API_URL}/repos/${repositoryPath}/contents`, { headers, signal: controller.signal }),
        ])

        if (!repoResponse.ok)
          throw new Error(repoResponse.status === 404 ? '未找到公开 GitHub 仓库' : `GitHub 仓库请求失败（${repoResponse.status}）`)
        if (!releasesResponse.ok)
          throw new Error(`GitHub Release 请求失败（${releasesResponse.status}）`)
        if (!contentsResponse.ok)
          throw new Error(`GitHub 根目录请求失败（${contentsResponse.status}）`)

        const [repositoryData, releaseData, contentData] = await Promise.all([
          repoResponse.json() as Promise<GitHubRepository>,
          releasesResponse.json() as Promise<GitHubRelease[]>,
          contentsResponse.json() as Promise<GitHubContent[]>,
        ])
        const nextReadmes = contentData
          .filter(item => item.type === 'file' && isReadmeFile(item.name))
          .sort((a, b) => {
            if (a.name.toLowerCase() === 'readme.md')
              return -1
            if (b.name.toLowerCase() === 'readme.md')
              return 1
            return a.name.localeCompare(b.name)
          })

        setRepo(repositoryData)
        setReleases(releaseData)
        setReadmes(nextReadmes)
        setActiveTab(nextReadmes[0]?.path || 'download')
      }
      catch (caughtError) {
        if (!disposed) {
          if (!apiAvailable)
            setApiState('unavailable')
          else
            setError(caughtError instanceof Error ? caughtError.message : 'GitHub 数据加载失败')
        }
      }
      finally {
        if (!disposed)
          setIsLoading(false)
      }
    }

    loadGitHub()
    return () => {
      disposed = true
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [repositoryPath, retryKey])

  useEffect(() => {
    if (!repo || !activeReadme || markdownByPath[activeReadme.path])
      return

    const controller = new AbortController()
    async function loadMarkdown() {
      setIsMarkdownLoading(true)
      setMarkdownError('')
      try {
        const response = await fetch(getProxiedReadmeUrl(repositoryPath, repo!.default_branch, activeReadme!.path), { signal: controller.signal })
        if (!response.ok)
          throw new Error(`README 获取失败（${response.status}）`)
        const markdown = await response.text()
        setMarkdownByPath(current => ({ ...current, [activeReadme!.path]: markdown }))
      }
      catch (caughtError) {
        if (!controller.signal.aborted)
          setMarkdownError(caughtError instanceof Error ? caughtError.message : 'README 获取失败')
      }
      finally {
        if (!controller.signal.aborted)
          setIsMarkdownLoading(false)
      }
    }

    loadMarkdown()
    return () => controller.abort()
  }, [activeReadme, markdownByPath, repo, repositoryPath])

  if (apiState !== 'available') {
    const unavailable = apiState === 'unavailable'

    return (
      <div aria-live="polite" className="relative min-h-72 overflow-hidden rounded-xl">
        <div aria-hidden="true" className="space-y-3 opacity-40">
          <div className="h-24 rounded-xl bg-default-100" />
          <div className="h-52 rounded-xl bg-default-100" />
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
          <div className="max-w-sm text-center">
            <GithubIcon className="mx-auto size-9 text-default-500" />
            <p className="mt-3 font-semibold">
              {unavailable ? '无法访问 GitHub API' : '正在检测 GitHub API 网络…'}
            </p>
            <p className="mt-2 text-sm leading-6 text-default-500">
              {unavailable
                ? '当前网络无法访问 api.github.com，请检查网络或代理设置后重试。'
                : '正在确认当前网络能否访问 api.github.com。'}
            </p>
            {unavailable
              ? (
                  <button
                    type="button"
                    onClick={() => setRetryKey(current => current + 1)}
                    className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    重试
                  </button>
                )
              : null}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div aria-label="GitHub 数据加载中" className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-default-100" />
        <div className="h-52 animate-pulse rounded-xl bg-default-100" />
      </div>
    )
  }

  if (error || !repo) {
    return (
      <div className="rounded-xl border border-danger-200 bg-danger-50 p-5 text-sm text-danger-700">
        <p className="font-medium">无法加载 GitHub 信息</p>
        <p className="mt-1">{error || '未知错误'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-default-200 bg-default-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <a href={repo.html_url} rel="noreferrer" target="_blank" className="inline-flex items-center gap-2 font-semibold text-accent hover:underline">
              <GithubIcon className="size-5" />
              {repositoryPath}
            </a>
            <p className="mt-2 text-sm leading-6 text-default-600">{repo.description || '该仓库暂无简介'}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Chip variant="soft">
              ★
              {repo.stargazers_count}
            </Chip>
            <Chip variant="soft">
              Fork
              {repo.forks_count}
            </Chip>
            <Chip variant="soft">
              Issue
              {repo.open_issues_count}
            </Chip>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-default-500">
          {repo.language
            ? (
                <span>
                  语言：
                  {repo.language}
                </span>
              )
            : null}
          {repo.license
            ? (
                <span>
                  许可证：
                  {repo.license.spdx_id}
                </span>
              )
            : null}
          <span>
            关注：
            {repo.subscribers_count}
          </span>
          <span>
            默认分支：
            {repo.default_branch}
          </span>
        </div>
      </div>

      <div aria-label="GitHub 仓库内容" role="tablist" className="border-b border-default-200">
        <div className="flex gap-1 overflow-x-auto pb-px">
          {tabs.map(tab => (
            <button
              key={tab.key}
              aria-controls={`github-inner-panel-${tab.key}`}
              aria-selected={activeTab === tab.key}
              id={`github-inner-tab-${tab.key}`}
              role="tab"
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'shrink-0 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-transparent text-default-500 hover:bg-default-100 hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeReadme
        ? (
            <div aria-labelledby={`github-inner-tab-${activeReadme.path}`} id={`github-inner-panel-${activeReadme.path}`} role="tabpanel">
              {isMarkdownLoading && !markdownByPath[activeReadme.path]
                ? <div aria-label="README 加载中" className="h-52 animate-pulse rounded-xl bg-default-100" />
                : markdownError
                  ? <div className="rounded-xl border border-danger-200 bg-danger-50 p-5 text-sm text-danger-700">{markdownError}</div>
                  : (
                      <article className="overflow-hidden rounded-xl border border-default-200 bg-content1 p-5 text-sm leading-7 text-foreground break-words [&_a]:text-accent [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-default-300 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-default-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:mb-4 [&_h1]:border-b [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_hr]:my-6 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-default-100 [&_pre]:p-4 [&_table]:my-4 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-default-100 [&_th]:p-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6">
                        <ReactMarkdown
                          components={{
                            a: ({ children, ...props }) => <a {...props} rel="noreferrer" target={props.href?.startsWith('#') ? undefined : '_blank'}>{children}</a>,
                            img: ({ alt, ...props }) => <img {...props} alt={alt || ''} loading="lazy" />,
                          }}
                          rehypePlugins={readmeRehypePlugins}
                          remarkPlugins={[remarkGfm]}
                          urlTransform={rewriteAssetUrl}
                        >
                          {markdownByPath[activeReadme.path] || ''}
                        </ReactMarkdown>
                      </article>
                    )}
            </div>
          )
        : (
            <div aria-labelledby="github-inner-tab-download" id="github-inner-panel-download" role="tabpanel" className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
                <span className="size-2 rounded-full bg-accent" />
                <span>GitHub Release 资产始终通过代理下载</span>
              </div>

              {releases.length
                ? releases.map(release => (
                    <article key={release.id} className="rounded-xl border border-default-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a href={release.html_url} rel="noreferrer" target="_blank" className="font-medium text-accent hover:underline">{release.name || release.tag_name}</a>
                        <div className="flex items-center gap-2 text-xs text-default-500">
                          <Chip variant="soft">{release.tag_name}</Chip>
                          {release.published_at ? <time dateTime={release.published_at}>{new Date(release.published_at).toLocaleDateString('zh-CN')}</time> : null}
                        </div>
                      </div>
                      {release.assets.length
                        ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {release.assets.map(asset => (
                                <a
                                  key={asset.id}
                                  href={getProxiedDownloadUrl(asset.browser_download_url)}
                                  rel="noreferrer"
                                  target="_blank"
                                  className="rounded-lg border border-accent/40 px-3 py-2 text-xs text-accent transition-colors hover:bg-accent/10"
                                >
                                  代理下载
                                  {' '}
                                  {asset.name}
                                  {' '}
                                  ·
                                  {' '}
                                  {formatBytes(asset.size)}
                                </a>
                              ))}
                            </div>
                          )
                        : <p className="mt-3 text-xs text-default-500">此版本未提供独立安装包，请进入 Release 页面查看源码包。</p>}
                    </article>
                  ))
                : <div className="rounded-xl border border-dashed p-6 text-center text-sm text-default-500">该仓库暂未发布 Release</div>}
            </div>
          )}
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
