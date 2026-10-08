import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { getSearchKeywords } from '@/lib/server/evaluation'

interface Context { params: Promise<{ id: string }> }
export async function GET(_: Request, { params }: Context) {
  try {
    return apiSuccess(await getSearchKeywords((await params).id))
  }
  catch (error) { return apiError(error) }
}
