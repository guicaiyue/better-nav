import type { Website } from '@/types'

/** Stable order shared by the homepage and category API; no removed display-control fields. */
export function sortWebsites(websites: Website[]) {
  return websites.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.id.localeCompare(b.id))
}
