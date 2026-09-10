import { cache } from 'react'

import { listCategoryWebsites } from './websites'

export const fetchHomeData = cache(listCategoryWebsites)
