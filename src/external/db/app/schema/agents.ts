import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const agentStatusEnum = pgEnum('agent_status', [
  'active',
  'inactive',
  'archived',
])

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  status: agentStatusEnum('status').notNull().default('inactive'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type AgentRow = typeof agents.$inferSelect
export type NewAgentRow = typeof agents.$inferInsert
