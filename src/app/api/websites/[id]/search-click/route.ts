import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { recordSearchClick } from '@/lib/server/evaluation'

interface Context { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Context) {
  try {
    return apiSuccess(await recordSearchClick((await params).id, await request.json()))
  }
  catch (error) { return apiError(error) }
}
