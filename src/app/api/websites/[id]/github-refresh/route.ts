import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { refreshGitHubSnapshot } from '@/lib/server/githubSnapshot'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return apiSuccess(await refreshGitHubSnapshot((await params).id))
  }
  catch (error) { return apiError(error) }
}
