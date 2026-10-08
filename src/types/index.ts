export type Category = Columns & {
  name: string
  sort: number
  websites: Website[]
}

export interface Columns {
  id: string
  created_at: string
  updated_at: string
}

export interface GitHubSnapshot {
  full_name: string
  html_url: string
  description: string | null
  homepage: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  language: string | null
  license_spdx_id: string | null
  default_branch: string
  archived: boolean
  pushed_at: string | null
}

export interface IResponse<T = unknown> {
  code: number
  data: T
  msg: string
  timestamp: number
}

export type Website = Columns & {
  name: string
  official_url: string | null
  github_url: string | null
  related_links: Record<string, string>
  self_description: string
  description: string
  features: string[]
  category_id: string
  tags: string[]
  ai_review: string | null
  ai_reviewed_at: string | null
  archived_at: string | null
  github_snapshot: GitHubSnapshot | null
  github_fetched_at: string | null
  category_name?: string
  search_keywords?: import('../lib/keyword-contract').SearchKeyword[]
}
