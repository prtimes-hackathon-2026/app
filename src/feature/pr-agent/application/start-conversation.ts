import type { ConversationRepository } from '../domain/conversation-repository'
import type { CompanyFactsPort, CompanyFactsSnapshot } from '../domain/facts'
import type { FactSheet, NarratorPort, ProfilerPort } from '../domain/llm'
import type { Block, Question, Turn } from '../domain/turn'

import type { ConversationCatalog } from './catalog'
import { count, percent, unknownFact } from './format'
import { narrateWithGuard } from './narrate-with-guard'

/**
 * ターン 0 — 何も聞かずに、診断・当たり率カーブ・再開した企業・未使用機能を返す。
 *
 * 「質問だけのターンを作らない」を守る要のターン。最初の一言で価値を返し、
 * そのうえで関心を 4 択 (+その他) で聞く。
 * 文面と事実のキーは voice-agent/src/turns.js の buildTurn0 を移植したもの。
 */

export type StartConversationDeps = {
  readonly facts: CompanyFactsPort
  readonly narrator: NarratorPort
  readonly profiler: ProfilerPort
  readonly conversations: ConversationRepository
  readonly catalog: ConversationCatalog
}

export type StartConversationResult = {
  readonly conversationId: string
  readonly company: {
    readonly id: number
    readonly name: string | null
    readonly industryName: string | null
  }
  readonly turn: Turn
}

/** 企業が見つからなければ会話を作らずに null を返す */
export type StartConversation = (
  companyId: number,
) => Promise<StartConversationResult | null>

/**
 * 3 層の推定は提示物に出ないので、失敗しても会話は止めない。
 * 関心が決まる前でも推定できるよう、ポートは interest に null を受け付ける。
 */
async function guessProfile(
  profiler: ProfilerPort,
  snapshot: CompanyFactsSnapshot,
) {
  try {
    return await profiler.profile({ snapshot, interest: null })
  } catch {
    return null
  }
}

export function startConversation(
  deps: StartConversationDeps,
): StartConversation {
  const narrate = narrateWithGuard(deps.narrator)

  return async (companyId) => {
    const snapshot = await deps.facts.load(companyId)
    if (!snapshot) return null

    const { company, history, hitCurve, resume } = snapshot
    const segment = resume?.segment ?? null
    const longGap = resume?.gaps.find((g) => g.gap === '2年以上') ?? null
    const here = hitCurve?.buckets.find((b) => b.bucket === snapshot.bucket)
    // 最も多く配信している企業群。カーブは本数の昇順に並んでいる
    const top = hitCurve?.buckets.at(-1)

    // 先頭の診断は必ず入るので blocks が空にならない (質問だけのターンにならない)
    const diagnosis: Block = {
      kind: 'diagnosis',
      title: '現在地',
      totalReleases: history.totalReleases,
      stoppedMonths: history.stoppedMonths,
      lastReleasedAt: history.lastReleasedAt,
      recent: history.recent,
    }
    const rest: Block[] = []
    if (hitCurve) {
      rest.push({
        kind: 'hit_curve',
        title: '配信本数と、手応えのある結果に届いた企業の割合',
        curve: hitCurve,
        mine: snapshot.bucket,
        evidence: {
          companies: hitCurve.totalCompanies,
          axes: [company.industryName ?? '業種'],
          source: snapshot.source,
        },
      })
    }
    if (segment && resume) {
      rest.push({
        kind: 'resume',
        title: '同じところで止まって、戻ってきた企業',
        segment,
        gaps: resume.gaps,
        totalResumed: resume.totalResumed,
      })
    }
    if (snapshot.unused.length > 0) {
      rest.push({
        kind: 'unused_features',
        title: '使われていない機能',
        items: snapshot.unused,
      })
    }
    const blocks: readonly [Block, ...Block[]] = [diagnosis, ...rest]

    const draft: Record<string, string> = {
      position:
        history.totalReleases <= 3
          ? `御社は${history.totalReleases}本で止まっています。同じ業種で${snapshot.bucket}だけ配信した企業のうち、手応えのある結果に届いたのは${percent(here?.hitPct)}でした。反応が無かったのは、御社に問題があったからではありません。`
          : `御社はこれまで${history.totalReleases}本を配信しています。同じ業種の${snapshot.bucket}の企業では${percent(here?.hitPct)}が手応えのある結果に届いています。`,
    }
    if (top) {
      draft.lottery = `1本あたりの反応は本数を重ねても平均は変わりませんが、当たり外れの幅がとても大きいという特徴があります。${top.bucket}まで続けた企業では${top.hitPct}%が当たりを引いています。本数がそのまま確率になります。`
    }
    if (segment) {
      const stuckAt =
        segment.fromN === segment.toN
          ? `${segment.fromN}本`
          : `${segment.fromN}〜${segment.toN}本`
      draft.resume = `そして御社と同じく${stuckAt}で止まっていた企業のうち、${count(segment.companies)}社が配信を再開しています。再開前の当たり率は${segment.hitBeforePct}%でしたが、再開後は${segment.hitAfterPct}%まで上がりました。追加した本数は中央値で${segment.addedP50}本です。`
    }

    // 生の指標名ではなく、指標の定義そのものをキーにする (意味の誤読を防ぐ)
    const facts: FactSheet = {
      御社の配信本数: `${history.totalReleases}本`,
      停止期間:
        history.stoppedMonths !== null
          ? `${history.stoppedMonths}か月`
          : '不明',
      業種: company.industryName ?? '不明',
      同じ業種の企業数: hitCurve
        ? `${count(hitCurve.totalCompanies)}社`
        : unknownFact,
      御社と同じ本数の企業が当たりを引いた割合: percent(here?.hitPct),
      最も多く配信している企業群の当たり率: top
        ? `${top.hitPct}%（${top.bucket}）`
        : unknownFact,
      手応えのある結果の基準: hitCurve
        ? `${hitCurve.thresholdPv}PV以上（業種内の上位10%）`
        : unknownFact,
      同じ本数で止まってから再開した企業数: segment
        ? `${count(segment.companies)}社`
        : unknownFact,
      再開前の当たり率: percent(segment?.hitBeforePct),
      再開後の当たり率: percent(segment?.hitAfterPct),
      再開後に追加した本数の中央値: segment
        ? `${segment.addedP50}本`
        : unknownFact,
      '2年以上あけてから再開した企業数': longGap
        ? `${count(longGap.companies)}社`
        : unknownFact,
    }

    const question: Question = {
      id: 'interest',
      text: 'どれから手を付けますか？',
      // 4 択に無い答えも受け取る。言い直させず Classifier で 4 分類に割り当てる
      options: [
        ...deps.catalog.interests.map((i) => ({ id: i.id, label: i.label })),
        { id: 'other', label: 'その他' },
      ],
    }

    const conversation = await deps.conversations.create(companyId)
    // 3 層の推定は提示物に出ないので、文章化と並べて待ち時間を増やさない
    const [narrative, profile] = await Promise.all([
      narrate({ facts, draft, questionText: question.text }),
      guessProfile(deps.profiler, snapshot),
    ])

    const turn: Turn = { turn: 0, blocks, narrative, question }
    await deps.conversations.appendTurn(conversation.id, {
      role: 'agent',
      payload: turn,
    })
    if (profile) {
      await deps.conversations.update(conversation.id, { profile })
    }

    return {
      conversationId: conversation.id,
      company: {
        id: company.companyId,
        name: company.companyName,
        industryName: company.industryName,
      },
      turn,
    }
  }
}
