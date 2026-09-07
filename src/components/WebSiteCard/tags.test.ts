import { describe, expect, it } from 'vitest'

import { uniqueTags } from './tags'

describe('uniqueTags', () => {
  it('按首次出现顺序移除重复标签', () => {
    expect(uniqueTags(['网站', '工具', '网站', '小红书', '小红书'])).toEqual(['网站', '工具', '小红书'])
  })

  it('接受空值和空数组', () => {
    expect(uniqueTags(undefined)).toEqual([])
    expect(uniqueTags(null)).toEqual([])
    expect(uniqueTags([])).toEqual([])
  })
})
