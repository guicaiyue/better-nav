import { NextResponse } from 'next/server'

const GITHUB_API_ORIGIN = 'https://api.github.com'
const GITHUB_HEADERS = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'better-nav',
}
const VALID_REPOSITORY_SEGMENT = /^[\w.-]+$/
const VALID_RELEASES_PAGE_SIZE = /^[1-9]\d*$/

export async function proxyGitHubApi(pathSegments: string[], searchParams = new URLSearchParams()) {
  const target = createGitHubApiUrl(pathSegments, searchParams)
  if (!target)
    return NextResponse.json({ message: '不支持的 GitHub API 路径' }, { status: 400 })

  try {
    const response = await fetch(target, {
      cache: 'no-store',
      headers: GITHUB_HEADERS,
    })
    const body = new Uint8Array(await response.arrayBuffer())
    const headers = new Headers()
    const contentType = response.headers.get('content-type')
    if (contentType)
      headers.set('content-type', contentType)
    headers.set('cache-control', response.ok ? 'public, max-age=60, stale-while-revalidate=300' : 'no-store')
    return new NextResponse(body, { headers, status: response.status })
  }
  catch (error) {
    console.error('[github-api-proxy]', error)
    return NextResponse.json({ message: 'GitHub API 请求失败' }, { status: 502 })
  }
}

function buildUrl(owner: string, repository: string, rest: string[]) {
  const path = [
    'repos',
    encodeURIComponent(owner),
    encodeURIComponent(repository),
    ...rest.map(segment => encodeURIComponent(segment)),
  ].join('/')
  return new URL(`/${path}`, GITHUB_API_ORIGIN)
}

function createGitHubApiUrl(pathSegments: string[], searchParams: URLSearchParams) {
  if (!pathSegments.length)
    return searchParams.size ? null : new URL('/', GITHUB_API_ORIGIN)

  const [resource, owner, repository, ...rest] = pathSegments
  if (
    resource !== 'repos'
    || !owner
    || !repository
    || !VALID_REPOSITORY_SEGMENT.test(owner)
    || !VALID_REPOSITORY_SEGMENT.test(repository)
    || (rest.length !== 0 && rest.length !== 1)
    || (rest.length === 1 && rest[0] !== 'releases' && rest[0] !== 'contents')
  ) {
    return null
  }

  if (rest[0] !== 'releases')
    return searchParams.size ? null : buildUrl(owner, repository, rest)

  const pageSizes = searchParams.getAll('per_page')
  const hasOnlyPageSize = [...searchParams.keys()].every(key => key === 'per_page')
  if (!hasOnlyPageSize || pageSizes.length > 1 || (pageSizes[0] && (!VALID_RELEASES_PAGE_SIZE.test(pageSizes[0]) || Number(pageSizes[0]) > 100)))
    return null

  const target = buildUrl(owner, repository, rest)
  if (pageSizes[0])
    target.searchParams.set('per_page', pageSizes[0])
  return target
}
