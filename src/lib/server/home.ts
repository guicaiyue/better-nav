import { cache } from 'react'

import { query } from '@/lib/server/db'
import { sortWebsites } from '@/lib/server/sort'

import type { Category, Website } from '@/types'

export const fetchHomeData = cache(async (): Promise<Category[]> => {
  const { rows } = await query<Category & { websites: Website[] }>(`
    SELECT c.*, COALESCE(json_agg(w.*) FILTER (WHERE w.id IS NOT NULL), '[]') AS websites
    FROM ds_categorys c
    LEFT JOIN ds_websites w ON w.category_id = c.id AND w.archived_at IS NULL
    GROUP BY c.id
    ORDER BY c.sort DESC, c.created_at DESC
  `)
  rows.forEach(category => sortWebsites(category.websites))
  return rows
})
