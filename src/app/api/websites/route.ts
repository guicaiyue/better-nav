import { NextResponse } from 'next/server'

import { query } from '@/lib/server/db'
import { RESPONSE, responseMessage } from '@/lib/utils'

import type { Website } from '@/types'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const categoryId = request.nextUrl.searchParams.get('category_id')
    const includeArchived = request.nextUrl.searchParams.get('include_archived') === '1'
    const conditions: string[] = []
    const values: unknown[] = []
    if (categoryId) {
      values.push(categoryId)
      conditions.push(`w.category_id = $${values.length}`)
    }
    if (!includeArchived)
      conditions.push('w.archived_at IS NULL')

    const result = await query<Website>(
      `SELECT w.*, c.name AS category_name
       FROM ds_websites w
       LEFT JOIN ds_categorys c ON c.id = w.category_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY w.archived_at DESC NULLS FIRST, w.sort DESC, w.created_at DESC`,
      values,
    )
    return NextResponse.json(responseMessage(result.rows))
  }
  catch (err) {
    return NextResponse.json(responseMessage(null, (err as Error).message, RESPONSE.ERROR))
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Website>
    if (!body.name?.trim() || !body.url?.trim() || !body.category_id)
      return NextResponse.json(responseMessage(null, '名称、地址和分类不能为空', RESPONSE.ERROR))
    const { rows } = await query<Website>(
      'INSERT INTO ds_websites(name, url, "desc", logo, tags, sort, pinned, recommend, vpn, "commonlyUsed", category_id, metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [body.name.trim(), body.url.trim(), body.desc || '', body.logo || null, body.tags || [], Number(body.sort) || 0, !!body.pinned, !!body.recommend, !!body.vpn, !!body.commonlyUsed, body.category_id, body.metadata || {}],
    )
    return NextResponse.json(responseMessage(rows[0]))
  }
  catch (err) {
    const error = err as { code?: string, message: string }
    return NextResponse.json(responseMessage(null, error.code === '23505' ? '网站名称已存在！' : error.message, RESPONSE.ERROR))
  }
}
