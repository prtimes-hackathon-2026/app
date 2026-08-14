import 'server-only'

import { sql } from 'drizzle-orm'

import { statsDb } from '@/external/db/stats'

import type {
  CompanyDirectory,
  StoppedCompany,
} from '../domain/company-directory'

type StoppedCompanyRow = {
  readonly company_id: number
  readonly company_name: string | null
  readonly industry_name: string | null
  readonly releases: number
  /**
   * 生の SQL の戻り値はドライバの型パーサを通らず
   * '2025-11-13 16:50:16' のような文字列で来ることがある。
   */
  readonly last_at: Date | string | number | null
}

/**
 * 時刻を必ず Date にして境界の外へ出す。
 *
 * 文字列のまま通すと domain の Date という宣言が嘘になる。
 * Intl.DateTimeFormat#format は引数を ToNumber するため、文字列だと NaN になって
 * RangeError で落ちる。値が無いときではなく「値があるとき必ず」落ちる壊れ方をする。
 * 読めない値は null に倒す。時刻が読めないことより画面が 500 になるほうが困る。
 */
function toDate(value: StoppedCompanyRow['last_at']): Date | null {
  if (value === null) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function drizzleCompanyDirectory(): CompanyDirectory {
  return {
    async findStoppedCompanies(limit) {
      // 内側で件数を絞ってから company / industry に繋ぐ。
      // release 全体を先に結合すると件数が跳ねて返ってこない
      const result: unknown = await statsDb().execute(sql`
        SELECT c.company_id, c.company_name, i.industry_name,
               t.n::int AS releases, t.last_at
          FROM (SELECT company_id, COUNT(*) AS n, MAX(created_at) AS last_at
                  FROM release GROUP BY company_id
                 HAVING COUNT(*) BETWEEN 1 AND 3
                 LIMIT 20000) t
          JOIN company c ON c.company_id = t.company_id
          LEFT JOIN industry i ON i.industry_id = c.industry_id
         WHERE t.last_at < NOW() - INTERVAL '9 months'
         ORDER BY t.last_at DESC
         LIMIT ${limit}
      `)

      const list = Array.isArray(result)
        ? (result as StoppedCompanyRow[])
        : ((result as { rows?: unknown }).rows as StoppedCompanyRow[]) || []

      return list.map((row): StoppedCompany => ({
        companyId: row.company_id,
        companyName: row.company_name,
        industryName: row.industry_name,
        releases: row.releases,
        lastReleasedAt: toDate(row.last_at),
      }))
    },
  }
}
