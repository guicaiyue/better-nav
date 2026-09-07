import { proxyGitHubApi } from '@/lib/server/githubApi'

import type { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  return proxyGitHubApi(path, request.nextUrl.searchParams)
}
