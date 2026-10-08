import { analyzeWebsite, evaluateWebsite } from '@/lib/server/agentMaster'
import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { putEvaluation } from '@/lib/server/evaluation'
import { getCategories, getWebsite, patchWebsite } from '@/lib/server/websites'
import { requireObject, TAG_OPTIONS, WebsiteError } from '@/lib/website-contract'

export const runtime = 'nodejs'
export const maxDuration = 660

interface Context { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Context) {
  try {
    const body = requireObject(await request.json())
    if (Object.keys(body).length !== 1 || !['describe', 'evaluate'].includes(body.task as string))
      throw new WebsiteError('仅接受 task: describe 或 evaluate')
    const { id } = await params
    const website = await getWebsite(id)
    if (body.task === 'evaluate') {
      await putEvaluation(id, await evaluateWebsite(website))
      return apiSuccess(await getWebsite(id))
    }
    const categories = await getCategories()
    const result = await analyzeWebsite({
      task: body.task as 'describe' | 'evaluate',
      website,
      allowed_categories: categories,
      allowed_tags: TAG_OPTIONS,
    })
    return apiSuccess(await patchWebsite(id, result.group, result.changes))
  }
  catch (error) { return apiError(error) }
}
