import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { putEvaluation } from '@/lib/server/evaluation'

interface Context { params: Promise<{ id: string }> }
export async function PUT(request: Request, { params }: Context) {
  try {
    return apiSuccess(await putEvaluation((await params).id, await request.json()))
  }
  catch (error) { return apiError(error) }
}
