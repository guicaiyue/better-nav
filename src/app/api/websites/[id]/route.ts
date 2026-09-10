import { apiError, apiSuccess } from '@/lib/server/apiResponse'
import { deleteWebsite, getWebsite, patchWebsite } from '@/lib/server/websites'
import { requireObject, WebsiteError } from '@/lib/website-contract'

interface Context { params: Promise<{ id: string }> }

export async function DELETE(_: Request, { params }: Context) {
  try {
    return apiSuccess(await deleteWebsite((await params).id))
  }
  catch (error) { return apiError(error) }
}

export async function GET(_: Request, { params }: Context) {
  try {
    return apiSuccess(await getWebsite((await params).id))
  }
  catch (error) { return apiError(error) }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const body = requireObject(await request.json())
    if (Object.keys(body).some(key => key !== 'group' && key !== 'changes'))
      throw new WebsiteError('PATCH 仅接受 group 与 changes')
    return apiSuccess(await patchWebsite((await params).id, body.group, body.changes))
  }
  catch (error) { return apiError(error) }
}
