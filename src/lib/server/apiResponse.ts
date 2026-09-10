import { NextResponse } from 'next/server'

import { WebsiteError } from '../website-contract'

export function apiError(error: unknown) {
  let status = 500
  let message = '服务器错误'
  if (error instanceof WebsiteError) {
    status = error.status
    message = error.message
  }
  else if (error instanceof SyntaxError) {
    status = 400
    message = '请求 JSON 无效'
  }
  else if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code)
    if (code === '23505') {
      status = 409
      message = '官方网站或 GitHub 地址已存在'
    }
    else if (['23514', '23502', '23503', '22P02'].includes(code)) {
      status = 400
      message = '字段不符合约束：请检查地址、分类和受控标签'
    }
  }
  if (status === 500)
    console.error('[nav-api]', error)
  return NextResponse.json({ code: status, data: null, msg: message, timestamp: Date.now() }, { status })
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ code: status, data, msg: '操作成功', timestamp: Date.now() }, { status })
}
