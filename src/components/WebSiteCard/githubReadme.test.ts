import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { describe, expect, it } from 'vitest'

import { createReadmeAssetUrl, getProxiedDownloadUrl, isReadmeFile, readmeRehypePlugins } from './githubReadme'

describe('isReadmeFile', () => {
  it('仅匹配根目录 README 开头且以 .md 结尾的文件名', () => {
    expect(isReadmeFile('README.md')).toBe(true)
    expect(isReadmeFile('README.zh-CN.md')).toBe(true)
    expect(isReadmeFile('readme.en.md')).toBe(true)
    expect(isReadmeFile('README')).toBe(false)
    expect(isReadmeFile('docs/README.md')).toBe(false)
    expect(isReadmeFile('NOTREADME.md')).toBe(false)
  })
})

describe('getProxiedDownloadUrl', () => {
  it('所有 GitHub Release 资产都无条件使用代理', () => {
    expect(getProxiedDownloadUrl('https://github.com/octo/demo/releases/download/v1/demo.zip'))
      .toBe('https://gh-proxy.com/https://github.com/octo/demo/releases/download/v1/demo.zip')
  })
})

describe('readme HTML 渲染', () => {
  it('保留 HumanSystemOptimization README 中的 HTML 链接和图片', () => {
    const markdown = '<a href="https://trendshift.io/repositories/8319" target="_blank"><img src="https://trendshift.io/api/badge/repositories/8319" alt="zijie0%2FHumanSystemOptimization | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>'
    const html = renderToStaticMarkup(
      createElement(ReactMarkdown, { rehypePlugins: readmeRehypePlugins }, markdown),
    )

    expect(html).toContain('<a href="https://trendshift.io/repositories/8319" target="_blank">')
    expect(html).toContain('<img src="https://trendshift.io/api/badge/repositories/8319"')
    expect(html).toContain('width="250"')
  })
})

describe('createReadmeAssetUrl', () => {
  const rewrite = createReadmeAssetUrl('octo/demo', 'main', 'README.zh-CN.md')

  it('将相对资源改写为 raw GitHub 的代理网络地址', () => {
    expect(rewrite('./images/logo.png')).toBe('https://gh-proxy.com/https://raw.githubusercontent.com/octo/demo/main/images/logo.png')
    expect(rewrite('docs/guide.md#install')).toBe('https://gh-proxy.com/https://raw.githubusercontent.com/octo/demo/main/docs/guide.md#install')
    expect(rewrite('../LICENSE')).toBe('https://gh-proxy.com/https://raw.githubusercontent.com/octo/demo/main/LICENSE')
    expect(rewrite('/assets/cover.png')).toBe('https://gh-proxy.com/https://raw.githubusercontent.com/octo/demo/main/assets/cover.png')
  })

  it('保留页内锚点、绝对链接和特殊协议', () => {
    expect(rewrite('#usage')).toBe('#usage')
    expect(rewrite('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(rewrite('mailto:hi@example.com')).toBe('mailto:hi@example.com')
  })
})
