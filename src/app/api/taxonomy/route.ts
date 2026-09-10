import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { getCategories } from '@/lib/server/websites'
import { TAG_OPTIONS } from '@/lib/website-contract'

export async function GET() {
  try {
    return apiSuccess({ categories: await getCategories(), tag_options: TAG_OPTIONS })
  }
  catch (error) { return apiError(error) }
}
