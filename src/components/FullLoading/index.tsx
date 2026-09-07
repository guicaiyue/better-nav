/*
 * @Author: 白雾茫茫丶<baiwumm.com>
 * @Date: 2025-11-28 14:14:54
 * @LastEditors: 白雾茫茫丶<baiwumm.com>
 * @LastEditTime: 2026-07-22 15:54:46
 * @Description: 全局 Loading
 */
'use client'

import type { FC, ReactNode } from 'react'

interface FullLoadingProps {
  children: ReactNode
}

const FullLoading: FC<FullLoadingProps> = ({ children }) => children

export default FullLoading
