import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { appDb, appSchema } from '@/external/db/app'

import type { Setting } from '../domain/setting'
import type { SettingRepository } from '../domain/setting-repository'

function toSetting(row: appSchema.SettingRow): Setting {
  return {
    key: row.key,
    value: row.value,
    updatedAt: row.updatedAt,
  }
}

export function drizzleSettingRepository(): SettingRepository {
  return {
    async list() {
      const rows = await appDb().select().from(appSchema.settings)
      return rows.map(toSetting)
    },

    async findByKey(key) {
      const rows = await appDb()
        .select()
        .from(appSchema.settings)
        .where(eq(appSchema.settings.key, key))
        .limit(1)
      const row = rows[0]
      return row ? toSetting(row) : null
    },

    async upsert(key, value) {
      const rows = await appDb()
        .insert(appSchema.settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: appSchema.settings.key,
          set: { value, updatedAt: sql`now()` },
        })
        .returning()
      const row = rows[0]
      if (!row) {
        throw new Error(`設定の保存に失敗しました: key=${key}`)
      }
      return toSetting(row)
    },
  }
}
