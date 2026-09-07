import { proxyGitHubApi } from '@/lib/server/githubApi'

import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  return proxyGitHubApi([], request.nextUrl.searchParams)
}
