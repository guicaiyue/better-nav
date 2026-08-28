import { NextResponse } from 'next/server'

import { query } from '@/lib/server/db'
import { sortWebsites } from '@/lib/server/sort'
import { RESPONSE, responseMessage } from '@/lib/utils'

import type { Category, Website } from '@/types'
import type { NextRequest } from 'next/server'

export async function GET() {
  try {
    const { rows } = await query<Category & { websites: Website[] }>(`
      SELECT c.*, COALESCE(json_agg(w.*) FILTER (WHERE w.id IS NOT NULL), '[]') AS websites
      FROM ds_categorys c LEFT JOIN ds_websites w ON w.category_id = c.id
      GROUP BY c.id ORDER BY c.sort DESC, c.created_at DESC`)
    rows.forEach(row => sortWebsites(row.websites))
    return NextResponse.json(responseMessage(rows))
  }
  catch (err) { return NextResponse.json(responseMessage(null, (err as Error).message, RESPONSE.ERROR)) }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name?: string, sort?: number }
    if (!body.name?.trim())
      return NextResponse.json(responseMessage(null, '分类名称不能为空', RESPONSE.ERROR))
    const { rows } = await query<Category>('INSERT INTO ds_categorys(name, sort) VALUES($1,$2) RETURNING *', [body.name.trim(), Number(body.sort) || 0])
    return NextResponse.json(responseMessage(rows[0]))
  }
  catch (err) {
    const message = (err as { code?: string, message: string }).code === '23505' ? '分类名称已存在！' : (err as Error).message
    return NextResponse.json(responseMessage(null, message, RESPONSE.ERROR))
  }
}
