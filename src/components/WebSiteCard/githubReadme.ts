import rehypeRaw from 'rehype-raw'

const GITHUB_PROXY = 'https://gh-proxy.com/'

export const readmeRehypePlugins = [rehypeRaw]

export function createReadmeAssetUrl(repositoryPath: string, branch: string, readmePath: string) {
  const baseDirectory = readmePath.split('/').slice(0, -1)

  return (source?: string) => {
    if (!source || source.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(source) || source.startsWith('//'))
      return source || ''

    const [pathWithQuery, hash = ''] = source.split('#', 2)
    const [assetPath, query = ''] = pathWithQuery.split('?', 2)
    const segments = assetPath.startsWith('/') ? [] : [...baseDirectory]

    for (const segment of assetPath.split('/')) {
      if (!segment || segment === '.')
        continue
      if (segment === '..') {
        segments.pop()
        continue
      }
      segments.push(segment)
    }

    const encodedPath = segments.map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/')
    const suffix = `${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`
    return `${GITHUB_PROXY}https://raw.githubusercontent.com/${repositoryPath}/${encodeURIComponent(branch)}/${encodedPath}${suffix}`
  }
}

export function getProxiedDownloadUrl(downloadUrl: string) {
  return `${GITHUB_PROXY}${downloadUrl}`
}

export function getProxiedReadmeUrl(repositoryPath: string, branch: string, path: string) {
  return `${GITHUB_PROXY}https://raw.githubusercontent.com/${repositoryPath}/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function isReadmeFile(name: string) {
  return !name.includes('/') && /^readme.*\.md$/i.test(name)
}
