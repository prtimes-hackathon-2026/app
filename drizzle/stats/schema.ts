import { pgTable, primaryKey, uuid, date, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const agentDailyStats = pgTable("agent_daily_stats", {
	agentId: uuid("agent_id").notNull(),
	date: date().notNull(),
	runCount: integer("run_count").default(0).notNull(),
	successCount: integer("success_count").default(0).notNull(),
}, (table) => [
	primaryKey({ columns: [table.agentId, table.date], name: "agent_daily_stats_pkey"}),
]);
