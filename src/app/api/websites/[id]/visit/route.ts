import { NextResponse } from 'next/server'

import { query } from '@/lib/server/db'
import { responseMessage } from '@/lib/utils'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { rows } = await query('UPDATE ds_websites SET \"visitCount\" = \"visitCount\" + 1 WHERE id = $1 RETURNING \"visitCount\"', [id])
    return NextResponse.json(responseMessage(rows[0] || null))
  }
  catch (err) {
    return NextResponse.json(responseMessage(null, (err as Error).message, -1))
  }
}
