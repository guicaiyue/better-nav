import { Pool } from 'pg'

const globalForDb = globalThis as unknown as { navPool?: Pool }

export const db = globalForDb.navPool ?? new Pool({
  host: process.env.NAV_DATABASE_HOST || '/var/run/postgresql',
  database: process.env.NAV_DATABASE_NAME || 'nav',
  user: process.env.NAV_DATABASE_USER || 'postgres',
  max: 10,
})

if (process.env.NODE_ENV !== 'production')
  globalForDb.navPool = db

export async function query<T extends import('pg').QueryResultRow = Record<string, unknown>>(text: string, values: unknown[] = []) {
  return db.query<T>(text, values)
}
