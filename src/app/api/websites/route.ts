import { NextResponse } from 'next/server'

import { query } from '@/lib/server/db'
import { RESPONSE, responseMessage } from '@/lib/utils'

import type { Website } from '@/types'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const categoryId = request.nextUrl.searchParams.get('category_id')
    const result = await query<Website>(
      `SELECT * FROM ds_websites ${categoryId ? 'WHERE category_id = $1' : ''} ORDER BY sort DESC, created_at DESC`,
      categoryId ? [categoryId] : [],
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
      'INSERT INTO ds_websites(name, url, "desc", logo, tags, sort, pinned, recommend, vpn, "commonlyUsed", category_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [body.name.trim(), body.url.trim(), body.desc || '', body.logo || null, body.tags || [], Number(body.sort) || 0, !!body.pinned, !!body.recommend, !!body.vpn, !!body.commonlyUsed, body.category_id],
    )
    return NextResponse.json(responseMessage(rows[0]))
  }
  catch (err) {
    const error = err as { code?: string, message: string }
    return NextResponse.json(responseMessage(null, error.code === '23505' ? '网站名称已存在！' : error.message, RESPONSE.ERROR))
  }
}
