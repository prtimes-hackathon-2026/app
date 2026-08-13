import pg from 'pg'
import 'dotenv/config'

function buildUrl() {
  const direct = (process.env.DATABASE_URL || '').trim()
  if (direct) return direct

  const host = (process.env.DB_HOST || '').trim()
  if (!host) return null

  const port = (process.env.DB_PORT || '5432').trim()
  const name = (process.env.DB_NAME || '').trim()
  const user = (process.env.DATABASE_USER || process.env.DB_USER || '').trim()
  const pass = (process.env.DATABASE_PASS || process.env.DB_PASS || '').trim()
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}`
}

const url = buildUrl()

export const USING_MOCK = !url

export const pool = url
  ? new pg.Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 8000,
      ssl:
        process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  : null

export function maskedUrl() {
  if (!url) return '(モックデータ)'
  return url.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:****@')
}

export async function query(sql, params = []) {
  if (!pool) throw new Error('DB not configured')
  const res = await pool.query(sql, params)
  return res.rows
}

export async function ping() {
  if (!pool) return { ok: true, message: 'モックデータで動作中' }
  try {
    await pool.query('SELECT 1')
    return { ok: true, message: `接続OK ${maskedUrl()}` }
  } catch (e) {
    return { ok: false, message: `${e.code || ''} ${e.message}` }
  }
}
