import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import {
  prAgentFeature,
  type Question,
  type Turn,
  type TurnNumber,
  type UserAnswer,
} from '@/feature/pr-agent'
import { LinkButton } from '@/shared/ui'

import { Alert } from './alert'
import { AgentBubble, answerLabel, UserBubble } from './bubble'
import { ChatPanel } from './chat-panel'
import { ConversationStarter } from './conversation-starter'
import { buildMemo, type MemoItem } from './memo'
import { MemoPanel } from './memo-panel'
import styles from './page.module.css'
import { findHitCurve, type HitCurveBlock } from './turn-view'
import { requireSignedIn } from '../../session'

/**
 * PR 羅針盤 — 配信が止まっている企業の「次の 1 本」を、データを見ながら決める画面。
 *
 * 左が聞き取りメモ、右がチャットの 2 ペイン。どちらもサーバが会話を読み直して描く。
 * 会話 ID が URL に無ければ対話の入り口、あればその会話を最初から表示する。
 * `searchParams` は request 時にしか決まらないので、これを読んだ時点で
 * 動的レンダリングになる。`dynamic = 'force-dynamic'` は書かない
 * (このバージョンでは旧モデル扱いで、将来 cacheComponents を入れると外す対象になる)。
 *
 * どの企業のデータを見るかはログインしたセッションが決める (設計 §11(a))。
 * 共通レイアウトもログインを確かめているが、企業のデータを読む画面なので
 * ここでも自分で確かめ、他社の会話 ID を渡されても開かないようにする。
 *
 * ヘッダー・サイドバーは (dashboard) の共通レイアウトが持つので、ここは中身だけ書く。
 * 画面が触れるのは feature の公開 API だけ。DB も LLM もここからは見えない。
 */

export const metadata: Metadata = {
  title: 'PR羅針盤',
}

/** 会話の履歴を、そのまま上から描ける形に均したもの */
type Entry =
  | {
      readonly key: number
      readonly kind: 'turn'
      readonly turn: Turn
      readonly hitCurveFallback: HitCurveBlock | undefined
    }
  | { readonly key: number; readonly kind: 'answer'; readonly label: string }

export default async function Page(props: PageProps<'/pr-compass'>) {
  const session = await requireSignedIn()
  const searchParams = await props.searchParams
  const raw = searchParams.conversation
  const conversationId = Array.isArray(raw) ? raw[0] : raw

  if (conversationId === undefined || conversationId === '') {
    return (
      <TwoPane
        memo={buildMemo(null)}
        turn={0}
        completed={false}
        started={false}
      >
        <div className={styles.messages}>
          <ConversationStarter
            companyName={session.company.name ?? `企業ID ${session.company.id}`}
          />
        </div>
      </TwoPane>
    )
  }

  const found = await prAgentFeature.get(conversationId)
  // 他社の会話は「無い」ものとして扱う。存在の有無すら分からないようにする
  if (found === null || found.conversation.companyId !== session.company.id) {
    return (
      <TwoPane
        memo={buildMemo(null)}
        turn={0}
        completed={false}
        started={false}
      >
        <div className={styles.messages}>
          <Alert message="この会話は見つかりませんでした。" />
          <div>
            <LinkButton href="/pr-compass" variant="accent">
              最初からやり直す
            </LinkButton>
          </div>
        </div>
      </TwoPane>
    )
  }

  const { conversation, turns } = found

  const entries: Entry[] = []
  // 選択肢のラベルは質問側にしか無いので、通りがけに拾っておく
  const questions = new Map<string, Question>()
  // 当たり率カーブはターン 0、期間カーブはターン 1 に出る。並べて見せるために持ち回す
  let hitCurveFallback: HitCurveBlock | undefined
  let lastTurn: Turn | null = null

  for (const entry of turns) {
    if (isTurn(entry.payload)) {
      const turn = entry.payload
      entries.push({
        key: entry.position,
        kind: 'turn',
        turn,
        hitCurveFallback,
      })
      hitCurveFallback = findHitCurve(turn) ?? hitCurveFallback
      if (turn.question !== null) questions.set(turn.question.id, turn.question)
      lastTurn = turn
    } else {
      entries.push({
        key: entry.position,
        kind: 'answer',
        label: answerLabel(
          entry.payload,
          questions.get(entry.payload.questionId),
        ),
      })
    }
  }

  // 終了した会話では質問を出さない。終端 (ターン 2) は question が null になる
  const question =
    conversation.status === 'in_progress' ? (lastTurn?.question ?? null) : null

  return (
    <TwoPane
      memo={buildMemo(found)}
      turn={conversation.turn}
      completed={conversation.status === 'completed'}
      started
    >
      <ChatPanel
        conversationId={conversation.id}
        question={question}
        completed={conversation.status === 'completed'}
      >
        {entries.map((entry) =>
          entry.kind === 'turn' ? (
            <AgentBubble
              key={entry.key}
              turn={entry.turn}
              hitCurveFallback={entry.hitCurveFallback}
            />
          ) : (
            <UserBubble key={entry.key} label={entry.label} />
          ),
        )}
      </ChatPanel>
    </TwoPane>
  )
}

/** 左のメモと右のチャットという骨格。会話の有無にかかわらず同じ形で出す */
function TwoPane({
  memo,
  turn,
  completed,
  started,
  children,
}: {
  memo: readonly MemoItem[]
  turn: TurnNumber
  completed: boolean
  started: boolean
  children: ReactNode
}) {
  return (
    <div className={styles.page}>
      <MemoPanel
        items={memo}
        turn={turn}
        completed={completed}
        started={started}
      />
      <section className={styles.chat}>{children}</section>
    </div>
  )
}

/**
 * 履歴の payload は `Turn | UserAnswer`。
 * `blocks` を持つのはエージェントのターンだけなので、そこで見分ける。
 */
function isTurn(payload: Turn | UserAnswer): payload is Turn {
  return 'blocks' in payload
}
