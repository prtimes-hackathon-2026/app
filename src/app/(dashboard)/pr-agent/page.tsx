import type { Metadata } from 'next'

import {
  prAgentFeature,
  type Question,
  type Turn,
  type UserAnswer,
} from '@/feature/pr-agent'
import { prMetricsFeature } from '@/feature/pr-metrics'
import { CollapsibleCard, LinkButton, PageHeader, Stack } from '@/shared/ui'

import { Alert } from './alert'
import { AnswerBubble, answerLabel } from './answer'
import { ConversationRunner } from './conversation-runner'
import { DemoCompanyPicker } from './demo-company-picker'
import { findHitCurve, TurnView, type HitCurveBlock } from './turn-view'

/**
 * 広報伴走エージェントの画面。
 *
 * 会話 ID が URL に無ければデモ用の企業選択、あればその会話を最初から表示する。
 * `searchParams` は request 時にしか決まらないので、これを読んだ時点で
 * 動的レンダリングになる。`dynamic = 'force-dynamic'` は書かない
 * (このバージョンでは旧モデル扱いで、将来 cacheComponents を入れると外す対象になる)。
 *
 * ヘッダー・サイドバーは (dashboard) の共通レイアウトが持つので、ここは中身だけ書く。
 * 画面が触れるのは feature の公開 API だけ。DB も LLM もここからは見えない。
 */

export const metadata: Metadata = {
  title: '広報伴走エージェント',
}

const title = '広報伴走エージェント'
const description =
  '配信が止まっている企業の「次の 1 本」を、データを見ながら決めます。'

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
      <>
        <PageHeader title={title} description={description} />
        <Stack gap={4}>
          <DemoNotice />
          <Alert message="この会話は見つかりませんでした。" />
          <div>
            <LinkButton href="/pr-agent" variant="accent">
              最初からやり直す
            </LinkButton>
          </div>
        </Stack>
      </>
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
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <LinkButton href="/pr-agent" variant="outline">
            別の企業で試す
          </LinkButton>
        }
      />

      {/* ターンと回答が交互に積まれる。ターンの中はさらに Stack で組む */}
      <Stack gap={6}>
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
      </Stack>
    </>
  )
}

async function DemoStart() {
  const companies = await prMetricsFeature.findStoppedCompanies()

  return (
    <>
      <PageHeader title={title} description={description} />
      <Stack gap={4}>
        <DemoNotice />
        <DemoCompanyPicker companies={companies} />
      </Stack>
    </>
  )
}

/**
 * 認証がまだ無いことによる暫定措置であることを、利用者にも分かる形で出しておく
 * (設計 §11(a))。認証が入ったらこの表示ごと消える。
 * 消されると前提が伝わらなくなるので、閉じられても消せない形にしている。
 */
function DemoNotice() {
  return (
    <CollapsibleCard title="デモ用の画面です" dismissible={false}>
      <p>
        ログインの仕組みがまだ無いため、対象の企業を一覧から選ぶ形にしています。
      </p>
    </CollapsibleCard>
  )
}

/**
 * 履歴の payload は `Turn | UserAnswer`。
 * `blocks` を持つのはエージェントのターンだけなので、そこで見分ける。
 */
function isTurn(payload: Turn | UserAnswer): payload is Turn {
  return 'blocks' in payload
}
