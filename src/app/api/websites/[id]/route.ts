import { NextResponse } from 'next/server'

import { query } from '@/lib/server/db'
import { RESPONSE, responseMessage } from '@/lib/utils'

import type { Website } from '@/types'
import type { NextRequest } from 'next/server'

const fields = ['category_id', 'name', 'url', 'desc', 'logo', 'tags', 'metadata', 'sort', 'pinned', 'recommend', 'vpn', 'commonlyUsed', 'archived_at'] as const

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { rows } = await query<Website>('DELETE FROM ds_websites WHERE id = $1 RETURNING *', [id])
    return NextResponse.json(rows[0] ? responseMessage(rows[0]) : responseMessage(null, '网站不存在', RESPONSE.ERROR))
  }
  catch (err) {
    return NextResponse.json(responseMessage(null, (err as Error).message, RESPONSE.ERROR))
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json() as Record<string, unknown>
    const entries = fields.filter(field => field in body)
    if (!entries.length)
      return NextResponse.json(responseMessage(null, '没有可更新字段', RESPONSE.ERROR))
    const sets = entries.map((field, index) => `"${field}" = $${index + 1}`).join(', ')
    const { rows } = await query<Website>(
      `UPDATE ds_websites SET ${sets} WHERE id = $${entries.length + 1} RETURNING *`,
      [...entries.map(field => body[field]), id],
    )
    return NextResponse.json(rows[0] ? responseMessage(rows[0]) : responseMessage(null, '网站不存在', RESPONSE.ERROR))
  }
  catch (err) {
    const error = err as { code?: string, message: string }
    return NextResponse.json(responseMessage(null, error.code === '23505' ? '网站名称已存在！' : error.message, RESPONSE.ERROR))
  }
}
