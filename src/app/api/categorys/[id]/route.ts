import { NextResponse } from 'next/server'

import { query } from '@/lib/server/db'
import { RESPONSE, responseMessage } from '@/lib/utils'

import type { Category } from '@/types'
import type { NextRequest } from 'next/server'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { rows } = await query<Category>('DELETE FROM ds_categorys WHERE id = $1 RETURNING *', [id])
    return NextResponse.json(rows[0] ? responseMessage(rows[0]) : responseMessage(null, '分类不存在', RESPONSE.ERROR))
  }
  catch (err) {
    return NextResponse.json(responseMessage(null, (err as Error).message, RESPONSE.ERROR))
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json() as { name?: string, sort?: number }
    const { rows } = await query<Category>(
      'UPDATE ds_categorys SET name = COALESCE($1, name), sort = COALESCE($2, sort) WHERE id = $3 RETURNING *',
      [body.name?.trim() || null, typeof body.sort === 'number' ? body.sort : null, id],
    )
    return NextResponse.json(rows[0] ? responseMessage(rows[0]) : responseMessage(null, '分类不存在', RESPONSE.ERROR))
  }
  catch (err) {
    const error = err as { code?: string, message: string }
    return NextResponse.json(responseMessage(null, error.code === '23505' ? '分类名称已存在！' : error.message, RESPONSE.ERROR))
  }
}
