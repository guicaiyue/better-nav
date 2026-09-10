import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { listCategoryWebsites } from '@/lib/server/websites'

export async function GET() {
  try {
    return apiSuccess(await listCategoryWebsites())
  }
  catch (error) { return apiError(error) }
}
