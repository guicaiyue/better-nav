import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { getWebsiteUpdateRules } from '@/lib/server/evaluation'

export async function GET() {
  try {
    return apiSuccess(await getWebsiteUpdateRules())
  }
  catch (error) { return apiError(error) }
}
