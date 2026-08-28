import { Buffer } from 'node:buffer'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { query } from '@/lib/server/db'
import { RESPONSE, responseMessage } from '@/lib/utils'

import type { NextRequest } from 'next/server'

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const file = (await request.formData()).get('file')
    if (!(file instanceof File))
      return NextResponse.json(responseMessage(null, '缺少 file 参数', RESPONSE.ERROR))
    if (!allowedTypes.has(file.type) || file.size > 2 * 1024 * 1024)
      return NextResponse.json(responseMessage(null, '仅支持 2MB 以内的 PNG、JPEG、WebP、GIF 或 SVG 图片', RESPONSE.ERROR))
    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]
    const name = `${id}-${crypto.randomUUID()}.${ext}`
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, name), Buffer.from(await file.arrayBuffer()))
    const logo = `/uploads/logos/${name}`
    const { rows } = await query('UPDATE ds_websites SET logo=$1 WHERE id=$2 RETURNING *', [logo, id])
    if (!rows[0]) {
      await rm(path.join(uploadDir, name), { force: true })
      return NextResponse.json(responseMessage(null, '网站不存在', RESPONSE.ERROR))
    }
    return NextResponse.json(responseMessage(rows[0]))
  }
  catch (err) { return NextResponse.json(responseMessage(null, (err as Error).message, RESPONSE.ERROR)) }
}
