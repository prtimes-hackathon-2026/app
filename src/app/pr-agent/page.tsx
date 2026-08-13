import Link from 'next/link'
import type { Metadata } from 'next'

import {
  prAgentFeature,
  type Question,
  type Turn,
  type UserAnswer,
} from '@/feature/pr-agent'
import { prMetricsFeature } from '@/feature/pr-metrics'

import { AnswerBubble, answerLabel } from './answer'
import { ConversationRunner } from './conversation-runner'
import { DemoCompanyPicker } from './demo-company-picker'
import styles from './pr-agent.module.css'
import { findHitCurve, TurnView, type HitCurveBlock } from './turn-view'

/**
 * 広報伴走エージェントの画面。
 *
 * 会話 ID が URL に無ければデモ用の企業選択、あればその会話を最初から表示する。
 * `searchParams` は request 時にしか決まらないので、これを読んだ時点で
 * 動的レンダリングになる。`dynamic = 'force-dynamic'` は書かない
 * (このバージョンでは旧モデル扱いで、将来 cacheComponents を入れると外す対象になる)。
 *
 * 画面が触れるのは feature の公開 API だけ。DB も LLM もここからは見えない。
 */

export const metadata: Metadata = {
  title: '広報伴走エージェント',
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

export default async function Page(props: PageProps<'/pr-agent'>) {
  const searchParams = await props.searchParams
  const raw = searchParams.conversation
  const conversationId = Array.isArray(raw) ? raw[0] : raw

  if (conversationId === undefined || conversationId === '') {
    return <DemoStart />
  }

  const found = await prAgentFeature.get(conversationId)
  if (found === null) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>広報伴走エージェント</h1>
        <p className={styles.error}>この会話は見つかりませんでした。</p>
        <p>
          <Link href="/pr-agent">最初からやり直す</Link>
        </p>
      </main>
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
    <main className={styles.page}>
      <h1 className={styles.title}>広報伴走エージェント</h1>
      <DemoNotice />

      {entries.map((entry) =>
        entry.kind === 'turn' ? (
          <TurnView
            key={entry.key}
            turn={entry.turn}
            hitCurveFallback={entry.hitCurveFallback}
          />
        ) : (
          <AnswerBubble key={entry.key} label={entry.label} />
        ),
      )}

      <ConversationRunner
        conversationId={conversation.id}
        question={question}
      />

      <p className={styles.footer}>
        <Link href="/pr-agent">別の企業で試す</Link>
      </p>
    </main>
  )
}

async function DemoStart() {
  const companies = await prMetricsFeature.findStoppedCompanies()

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>広報伴走エージェント</h1>
      <DemoNotice />
      <p>
        配信が止まっている企業の一覧です。1
        社選ぶと、その企業のデータで対話を始めます。
      </p>
      <DemoCompanyPicker companies={companies} />
    </main>
  )
}

/**
 * 認証がまだ無いことによる暫定措置であることを、利用者にも分かる形で出しておく
 * (設計 §11(a))。認証が入ったらこの表示ごと消える。
 */
function DemoNotice() {
  return (
    <p className={styles.demoNotice}>
      <strong>デモ用の画面です。</strong>
      ログインの仕組みがまだ無いため、対象の企業を一覧から選ぶ形にしています。
    </p>
  )
}

/**
 * 履歴の payload は `Turn | UserAnswer`。
 * `blocks` を持つのはエージェントのターンだけなので、そこで見分ける。
 */
function isTurn(payload: Turn | UserAnswer): payload is Turn {
  return 'blocks' in payload
}
