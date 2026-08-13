import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type SettingRow = typeof settings.$inferSelect
export type NewSettingRow = typeof settings.$inferInsert
