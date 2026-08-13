import 'server-only'

import { asc, eq, sql } from 'drizzle-orm'

import { appDb, appSchema } from '@/external/db/app'

import type {
  Conversation,
  ConversationTurn,
  UserAnswer,
} from '../domain/conversation'
import type { ConversationRepository } from '../domain/conversation-repository'
import { isInterestId } from '../domain/interest'
import type { Turn, TurnNumber } from '../domain/turn'

/** DB は 0..2 を知らないので、読み出しでドメインの型に閉じ直す */
function toTurnNumber(value: number): TurnNumber {
  if (value === 0 || value === 1 || value === 2) return value
  throw new Error(`会話のターン番号が範囲外です: ${value}`)
}

function toConversation(row: appSchema.PrConversationRow): Conversation {
  return {
    id: row.id,
    companyId: row.companyId,
    status: row.status,
    turn: toTurnNumber(row.turn),
    // 4 分類は増減しうる。知らない値が入っていたら未選択として扱う
    interest: row.interest && isInterestId(row.interest) ? row.interest : null,
    profile: row.profile ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value !== 'string' && typeof value !== 'number') return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * 保存した提示物の Date を戻す。
 *
 * payload は jsonb なので、書き込むときに Date が文字列へ潰れる。
 * 画面は描画の正をこの読み戻しに置いている (POST の応答で描き直すと同じ理由で
 * 型が崩れるため) ので、文字列のまま返すと Turn の型が嘘になる。
 * 実際それで Intl.DateTimeFormat が RangeError で落ち、画面が 500 になった。
 *
 * Date を持つのは診断ブロックだけなので、その 2 か所だけを戻す。
 * turn.ts の Block に Date を増やしたらここも足すこと。
 */
function reviveTurn(turn: Turn): Turn {
  return {
    ...turn,
    blocks: turn.blocks.map((block) =>
      block.kind === 'diagnosis'
        ? {
            ...block,
            lastReleasedAt: toDate(block.lastReleasedAt),
            recent: block.recent.map((release) => ({
              ...release,
              releasedAt: toDate(release.releasedAt),
            })),
          }
        : block,
    ),
  }
}

function isTurn(payload: unknown): payload is Turn {
  return typeof payload === 'object' && payload !== null && 'turn' in payload
}

function toConversationTurn(
  row: appSchema.PrConversationTurnRow,
): ConversationTurn {
  return {
    position: row.position,
    role: row.role,
    payload: isTurn(row.payload)
      ? reviveTurn(row.payload)
      : (row.payload as UserAnswer),
  }
}

export function drizzleConversationRepository(): ConversationRepository {
  return {
    async create(companyId) {
      const rows = await appDb()
        .insert(appSchema.prConversations)
        .values({ companyId })
        .returning()
      const row = rows[0]
      if (!row) {
        throw new Error(`会話の作成に失敗しました: companyId=${companyId}`)
      }
      return toConversation(row)
    },

    async find(id) {
      const rows = await appDb()
        .select()
        .from(appSchema.prConversations)
        .where(eq(appSchema.prConversations.id, id))
        .limit(1)
      const row = rows[0]
      return row ? toConversation(row) : null
    },

    async findTurns(id) {
      const rows = await appDb()
        .select()
        .from(appSchema.prConversationTurns)
        .where(eq(appSchema.prConversationTurns.conversationId, id))
        .orderBy(asc(appSchema.prConversationTurns.position))
      return rows.map(toConversationTurn)
    },

    async appendTurn(id, turn) {
      // 採番を呼び出し側に持たせない。同じ会話を同時に進めた場合は
      // (conversation_id, position) の unique 制約で落ちる
      await appDb()
        .insert(appSchema.prConversationTurns)
        .values({
          conversationId: id,
          position: sql`(select coalesce(max(${appSchema.prConversationTurns.position}), -1) + 1 from ${appSchema.prConversationTurns} where ${eq(appSchema.prConversationTurns.conversationId, id)})`,
          role: turn.role,
          payload: turn.payload,
        })
    },

    async update(id, patch) {
      await appDb()
        .update(appSchema.prConversations)
        .set({
          ...(patch.turn !== undefined ? { turn: patch.turn } : {}),
          ...(patch.interest !== undefined ? { interest: patch.interest } : {}),
          ...(patch.profile !== undefined ? { profile: patch.profile } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(appSchema.prConversations.id, id))
    },
  }
}
