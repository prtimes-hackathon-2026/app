import { assertCanAdvance, type UserAnswer } from '../domain/conversation'
import type { ConversationRepository } from '../domain/conversation-repository'
import type {
  CompanyFactsPort,
  FactsHistory,
  FactsTrends,
} from '../domain/facts'
import {
  fallbackInterest,
  isInterestId,
  type InterestId,
} from '../domain/interest'
import type { ClassifierPort, FactSheet, NarratorPort } from '../domain/llm'
import type { Block, OutlookStep, Question, Turn } from '../domain/turn'

import {
  articlesOf,
  featuresOf,
  interestLabel,
  type ConversationCatalog,
} from './catalog'
import { count, elapsedLabel, percent, unknownFact } from './format'
import { narrateWithGuard } from './narrate-with-guard'

/**
 * ターン 1 — 選ばれた関心に沿って、目標本数・時間では上がらないこと・種別の傾向・
 * 使うとよい機能と記事を「同じターンで」返す。
 *
 * 分けて出すと往復が増える。4 往復を超えたら設計として失敗なので、
 * voice-agent/src/turns.js の buildTurn1 と同じく 1 ターンにまとめる。
 */

export type AnswerInterestDeps = {
  readonly facts: CompanyFactsPort
  readonly narrator: NarratorPort
  readonly classifier: ClassifierPort
  readonly conversations: ConversationRepository
  readonly catalog: ConversationCatalog
}

export type AnswerInterestResult = {
  readonly conversationId: string
  readonly interest: InterestId
  readonly turn: Turn
}

/** 会話が見つからなければ null。ターン 1 以外への要求は例外で弾く */
export type AnswerInterest = (
  conversationId: string,
  answer: UserAnswer,
) => Promise<AnswerInterestResult | null>

/**
 * 4 分類のどれかに必ず落とす。
 *
 * 自由に語られても言い直させない。分類が失敗したら fallbackInterest
 * (何を配信すればいいか分からない) に倒してそのまま進む。
 */
async function resolveInterest(
  classifier: ClassifierPort,
  answer: UserAnswer,
): Promise<InterestId> {
  if (answer.choiceId && isInterestId(answer.choiceId)) return answer.choiceId

  const text = answer.text?.trim()
  if (!text) return fallbackInterest
  try {
    return (await classifier.classify(text)) ?? fallbackInterest
  } catch {
    return fallbackInterest
  }
}

/**
 * 種別の傾向を、その企業の商品に接続した文にする。
 * 「この業種では調査レポートが跳ねる」だけでは、商品の話が消えて他人事になる。
 * 障害 (埋もれる) → 仕組み (入り口を変える) → 数字、の順に書く。
 */
function bridgeDraft(
  trends: FactsTrends,
  history: FactsHistory,
): string | null {
  const best = trends.items[0]
  if (!best || best.pvP90 === null) return null

  const common = [...trends.items].sort((a, b) => b.n - a.n)[0]
  if (
    !common ||
    common.pvP90 === null ||
    common.releaseTypeName === best.releaseTypeName
  ) {
    return `同じ業種では「${best.releaseTypeName}」の形が最も大きく跳ねており、跳ねたときの水準は${best.pvP90}PVでした。`
  }

  const title = history.recent[0]?.title
  const head = title ? `御社が出された「${title.slice(0, 30)}…」のような` : ''
  return (
    `${head}${common.releaseTypeName}の告知は、この業種で最も多く出されている形です（${count(common.n)}本）。` +
    `数が多いぶん埋もれやすく、跳ねたときの水準も${common.pvP90}PVにとどまります。` +
    `一方「${best.releaseTypeName}」の形は${best.pvP90}PVまで伸びています。` +
    `商品を別のものに変えるという話ではなく、商品そのものを説明する前に、` +
    `その商品が解決している問題のほうを先に出す、という順番の違いです。`
  )
}

export function answerInterest(deps: AnswerInterestDeps): AnswerInterest {
  const narrate = narrateWithGuard(deps.narrator)

  return async (conversationId, answer) => {
    const conversation = await deps.conversations.find(conversationId)
    if (!conversation) return null

    const next = assertCanAdvance(conversation)
    if (next !== 1) {
      throw new Error('ターン 1 に進める会話ではありません')
    }

    const snapshot = await deps.facts.load(conversation.companyId)
    if (!snapshot) return null

    const { company, history, hitCurve, periodCurve, trends } = snapshot
    const interest = await resolveInterest(deps.classifier, answer)
    const segment = snapshot.resume?.segment ?? null
    const now = history.totalReleases
    const here = hitCurve?.buckets.find((b) => b.bucket === snapshot.bucket)

    // 「あと何本でどこまで違うか」を配信ペースに換算する。当たり率が
    // 分かっている段だけを残すので、hitPct が欠けた段は出さない
    const steps: OutlookStep[] = []
    for (const target of [3, 5, 10, 20]) {
      if (target <= now) continue
      const bucket = deps.catalog.bucketOf(target)
      const row = hitCurve?.buckets.find((b) => b.bucket === bucket)
      if (!row) continue
      steps.push({
        target,
        need: target - now,
        hitPct: row.hitPct,
        monthsMonthly: target - now,
        monthsQuarterly: (target - now) * 3,
      })
    }

    const features = featuresOf(deps.catalog, interest)
    const lastPeriod = periodCurve?.rows.at(-1) ?? null

    // 目標は必ず出すので blocks が空にならない
    const outlook: Block = {
      kind: 'outlook',
      title: '目標',
      now,
      currentPct: here?.hitPct ?? null,
      steps,
      resumeTarget: segment,
    }
    const rest: Block[] = []
    if (periodCurve && periodCurve.rows.length > 0) {
      rest.push({
        kind: 'period',
        title: '時間をかけるだけでは上がらない',
        curve: periodCurve,
      })
    }
    if (trends.items.length > 0) {
      rest.push({
        kind: 'trends',
        title: 'どの種類のリリースが跳ねやすいか',
        trends,
      })
    }
    rest.push({
      kind: 'features',
      title: '使うとよい機能',
      items: features,
      articles: articlesOf(deps.catalog, interest),
    })
    const blocks: readonly [Block, ...Block[]] = [outlook, ...rest]

    const firstStep = steps[0]
    const draft: Record<string, string> = {
      outlook: segment
        ? `まず${segment.addedP50}本を目標にしてください。同じところで止まってから再開した${count(segment.companies)}社が、中央値で${segment.addedP50}本を追加し、${segment.hitAfterPct}%が手応えのある結果に届いています。月1本なら${segment.addedP50}か月、3か月に1本でも${segment.addedP50 * 3}か月で届く範囲です。`
        : firstStep
          ? `いまは${now}本で${percent(here?.hitPct)}の地点です。同じ業種で${firstStep.target}本まで出した企業では、${firstStep.hitPct}%が手応えのある結果に届いています。あと${firstStep.need}本です。`
          : 'すでに十分な本数を配信しています。',
    }
    if (lastPeriod) {
      const elapsed = elapsedLabel(lastPeriod.months)
      draft.time = `ただし時間をかけるだけでは上がりません。同じ業種で初回配信から${elapsed}経った企業でも、当たりを引いていたのは${lastPeriod.hitPct}%です。中央値の企業は${elapsed}で${lastPeriod.releasesP50}本しか配信していません。`
    }
    const trend = bridgeDraft(trends, history)
    if (trend) draft.trend = trend
    const firstFeature = features[0]
    if (firstFeature) {
      // 関心のラベルは「〜したい」で終わる文なので、括ってから続けないと文が繋がらない
      draft.feature = `「${interestLabel(deps.catalog, interest)}」であれば、${firstFeature.name}が使えます。`
    }

    const best = trends.items[0]
    const mostCommon = [...trends.items].sort((a, b) => b.n - a.n)[0]
    const facts: FactSheet = {
      現在の配信本数: `${now}本`,
      現在の当たり率: percent(here?.hitPct),
      ...Object.fromEntries(
        steps.map((s) => [
          `${s.target}本まで出した場合の当たり率`,
          `${s.hitPct}%`,
        ]),
      ),
      ...(lastPeriod
        ? {
            [`${elapsedLabel(lastPeriod.months)}経過時点の当たり率`]: `${lastPeriod.hitPct}%`,
            [`${elapsedLabel(lastPeriod.months)}経過時点の配信本数の中央値`]: `${lastPeriod.releasesP50}本`,
          }
        : {}),
      最も跳ねやすい種別: best
        ? `${best.releaseTypeName}（跳ねたとき${best.pvP90 ?? unknownFact}PV）`
        : unknownFact,
      最も多く出されている種別: mostCommon
        ? `${mostCommon.releaseTypeName}（${count(mostCommon.n)}本・跳ねたとき${mostCommon.pvP90 ?? unknownFact}PV）`
        : unknownFact,
      御社が実際に出したリリース: history.recent[0]?.title ?? unknownFact,
      御社の事業内容: company.description?.slice(0, 160) || unknownFact,
      選ばれた関心: interestLabel(deps.catalog, interest),
    }

    const question: Question = {
      id: 'next',
      // プロトタイプの「別の関心を選び直す」は 0→1→2 の状態機械では実現できない。
      // 実現できない選択肢は出さず、次のターンで出す一手のほうを変える
      text: 'この方向で進めますか？',
      options: [
        { id: 'ok', label: 'この方向でいく' },
        { id: 'other', label: '別の一手にしたい' },
      ],
    }

    const narrative = await narrate({
      facts,
      draft,
      questionText: question.text,
    })

    const turn: Turn = { turn: 1, blocks, narrative, question }
    await deps.conversations.appendTurn(conversationId, {
      role: 'user',
      payload: answer,
    })
    await deps.conversations.appendTurn(conversationId, {
      role: 'agent',
      payload: turn,
    })
    await deps.conversations.update(conversationId, { turn: next, interest })

    return { conversationId, interest, turn }
  }
}
