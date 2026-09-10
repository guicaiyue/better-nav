import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { createWebsite, listWebsites } from '@/lib/server/websites'

import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    return apiSuccess(await listWebsites({
      categoryId: request.nextUrl.searchParams.get('category_id'),
      includeArchived: request.nextUrl.searchParams.get('include_archived') === '1',
    }))
  }
  catch (error) { return apiError(error) }
}

export async function POST(request: Request) {
  try {
    return apiSuccess(await createWebsite(await request.json()), 201)
  }
  catch (error) { return apiError(error) }
}
