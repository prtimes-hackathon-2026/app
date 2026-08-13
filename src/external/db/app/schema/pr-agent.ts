import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * 広報伴走エージェントの会話。
 *
 * company_id は PR TIMES 側の企業 ID。DB が別なので外部キーは張らない。
 * 会話の履歴は LLM ライブラリのアイテム形式ではなく、提示物そのものを保存する。
 * どんな関心が選ばれ何を提示したかを後から人間が読んで分析するため。
 */

export const prConversationStatusEnum = pgEnum('pr_conversation_status', [
  'in_progress',
  'completed',
  'abandoned',
])

export const prConversationTurnRoleEnum = pgEnum('pr_conversation_turn_role', [
  'agent',
  'user',
])

/** 裏で推定した 3 層。相手には質問せず、提示物にも出さない */
export type PrConversationProfile = {
  readonly top: string
  readonly middle: string
  readonly bottom: string
}

export const prConversations = pgTable('pr_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: integer('company_id').notNull(),
  status: prConversationStatusEnum('status').notNull().default('in_progress'),
  /** 0..2。会話は 3 ターンで終わる */
  turn: integer('turn').notNull().default(0),
  /** 4 つの関心のいずれか。ターン 1 で確定する */
  interest: text('interest'),
  profile: jsonb('profile').$type<PrConversationProfile>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const prConversationTurns = pgTable(
  'pr_conversation_turns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => prConversations.id, { onDelete: 'cascade' }),
    /** 会話内の通し番号。採番はリポジトリ側で閉じる */
    position: integer('position').notNull(),
    role: prConversationTurnRoleEnum('role').notNull(),
    /** ターンの提示物、または利用者の回答。日付は JSON では文字列になる */
    payload: jsonb('payload').$type<unknown>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // 採番が競合したら黙って上書きせず、ここで落とす
  (table) => [
    unique('pr_conversation_turns_conversation_id_position_unique').on(
      table.conversationId,
      table.position,
    ),
  ],
)

export type PrConversationRow = typeof prConversations.$inferSelect
export type NewPrConversationRow = typeof prConversations.$inferInsert
export type PrConversationTurnRow = typeof prConversationTurns.$inferSelect
export type NewPrConversationTurnRow = typeof prConversationTurns.$inferInsert
