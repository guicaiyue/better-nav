'use client'

import Image from 'next/image'
import { memo, useEffect, useRef, useState } from 'react'

import GitHubPanel from './GitHubPanel'
import WebsiteDetails, { ExternalLink } from './WebsiteDetails'
import { githubRepository, safeWebUrl } from './websiteView'

import type { Website } from '@/types'

interface WebsiteCardProps { data: Website, priority?: boolean, onOpen?: () => void }

const WebsiteCard = memo(({ data, priority = false, onOpen }: WebsiteCardProps) => {
  const [tab, setTab] = useState<'detail' | 'github'>('detail')
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const official = safeWebUrl(data.official_url)
  const repository = githubRepository(data.github_url)
  const [iconFailed, setIconFailed] = useState(false)
  const icon = official ? `https://favicon.im/${new URL(official).hostname}` : null

  useEffect(() => {
    if (!open)
      return
    const dialog = dialogRef.current
    dialog?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <>
      <article className="group flex h-full flex-col rounded-2xl border border-default-200 bg-background p-5 transition duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-md">
        <button
          aria-label={`查看 ${data.name} 详情`} type="button" onClick={() => {
            setTab('detail')
            setOpen(true)
            onOpen?.()
          }} className="flex flex-1 flex-col text-left outline-offset-4"
        >
          <div className="flex w-full items-center gap-3">
            <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg font-bold text-accent">
              {icon && !iconFailed
                ? (
                    <Image
                      alt=""
                      fill
                      priority={priority}
                      src={icon}
                      onError={() => setIconFailed(true)}
                      className="rounded-xl object-contain p-1.5"
                    />
                  )
                : data.name.slice(0, 1)}
            </div>
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{data.name}</h2>
            <span aria-hidden="true" className="text-muted transition group-hover:text-accent">↗</span>
          </div>
          <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-default-500">{data.description || data.self_description || '新收录站点，描述待整理。'}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">{data.tags.slice(0, 4).map(tag => <span key={tag} className="rounded-md bg-default-100 px-2 py-1 text-xs text-default-600">{tag}</span>)}</div>
        </button>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-default-100 pt-3 text-xs">
          <ExternalLink href={data.official_url} onClick={onOpen}>官网</ExternalLink>
          <ExternalLink href={data.github_url} onClick={onOpen}>GitHub</ExternalLink>
        </div>
      </article>
      {open && (
        <dialog
          ref={dialogRef} aria-labelledby={`detail-${data.id}`} onClick={(event) => {
            if (event.target === event.currentTarget)
              setOpen(false)
          }} onClose={() => setOpen(false)} className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-2xl border border-default-200 bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
        >
          <div className="flex max-h-[88dvh] flex-col">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-default-200 p-5">
              <h2 id={`detail-${data.id}`} className="truncate text-xl font-bold">{data.name}</h2>
              <button aria-label="关闭详情" type="button" autoFocus onClick={() => setOpen(false)} className="rounded-lg border border-default-200 px-3 py-1.5 text-sm">关闭 ×</button>
            </header>
            <nav aria-label="详情内容" className="flex shrink-0 gap-2 border-b border-default-200 px-5 py-3">
              <button aria-pressed={tab === 'detail'} type="button" onClick={() => setTab('detail')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'detail' ? 'bg-accent/10 text-accent' : 'text-muted'}`}>站点详情</button>
              {repository && <button aria-pressed={tab === 'github'} type="button" onClick={() => setTab('github')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'github' ? 'bg-accent/10 text-accent' : 'text-muted'}`}>README / 下载 · 实时</button>}
            </nav>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
              {tab === 'detail'
                ? <WebsiteDetails categoryName={data.category_name} site={data} />
                : repository && (
                  <>
                    <p className="mb-4 text-xs text-muted">以下为实时 GitHub 内容，不会更新已保存的程序快照。</p>
                    <GitHubPanel {...repository} />
                  </>
                )}
            </div>
          </div>
        </dialog>
      )}
    </>
  )
})

export default WebsiteCard
