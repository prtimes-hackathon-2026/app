import 'server-only'

import { eq } from 'drizzle-orm'

import { appDb, appSchema } from '@/external/db/app'

import type { Agent } from '../domain/agent'
import type { AgentRepository } from '../domain/agent-repository'

/** DB の行をドメインモデルへ変換する。この変換はこのファイルの外に漏らさない */
function toAgent(row: appSchema.AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function drizzleAgentRepository(): AgentRepository {
  return {
    async list() {
      const rows = await appDb().select().from(appSchema.agents)
      return rows.map(toAgent)
    },

    async findById(id) {
      const rows = await appDb()
        .select()
        .from(appSchema.agents)
        .where(eq(appSchema.agents.id, id))
        .limit(1)
      const row = rows[0]
      return row ? toAgent(row) : null
    },
  }
}
