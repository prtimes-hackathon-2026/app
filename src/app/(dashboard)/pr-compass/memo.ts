import type {
  Block,
  Conversation,
  ConversationTurn,
  Turn,
  TurnNumber,
  UserAnswer,
} from '@/feature/pr-agent'

import { blank, formatNumber, formatPercent } from './format'

/**
 * 聞き取りメモの組み立て。
 *
 * メモは LLM に書かせず、会話に実際に出た提示物からコードで組み立てる。
 * そうしないと、画面の左半分だけが数字の出どころを持たない自然文になり、
 * 「数値・判定はコード、文章は LLM」(設計 §4) が崩れる。
 * ここに出る値はすべて、右のチャットに提示済みのものと同じ block から読んでいる。
 *
 * 3 層の推定 (`conversation.profile`) は「相手には見せない」ものなので出さない (設計 §1)。
 */

export type MemoItem = {
  readonly label: string
  /** 会話がそこまで進んでいない項目は null。空欄のまま置いて、埋まっていく様子を見せる */
  readonly value: string | null
}

type BlockOf<K extends Block['kind']> = Extract<Block, { kind: K }>

/**
 * 履歴の payload は `Turn | UserAnswer`。
 * `blocks` を持つのはエージェントのターンだけなので、そこで見分ける。
 */
function isTurn(payload: Turn | UserAnswer): payload is Turn {
  return 'blocks' in payload
}

function findTurn(
  turns: readonly ConversationTurn[],
  number: TurnNumber,
): Turn | undefined {
  for (const entry of turns) {
    if (isTurn(entry.payload) && entry.payload.turn === number) {
      return entry.payload
    }
  }
  return undefined
}

function findBlock<K extends Block['kind']>(
  turn: Turn | undefined,
  kind: K,
): BlockOf<K> | undefined {
  return turn?.blocks.find((block): block is BlockOf<K> => block.kind === kind)
}

/** 業種が不明なときに feature 側が軸に入れる語。値ではないので出さない */
const unknownIndustryAxis = '業種'

function industryOf(hitCurve: BlockOf<'hit_curve'> | undefined): string | null {
  if (hitCurve === undefined) return null

  const axes = hitCurve.evidence.axes.filter(
    (axis) => axis !== unknownIndustryAxis,
  )
  return axes.length === 0 ? blank : axes.join('・')
}

export function buildMemo(
  source: {
    readonly conversation: Conversation
    readonly turns: readonly ConversationTurn[]
  } | null,
): readonly MemoItem[] {
  const turns = source?.turns ?? []
  const turn0 = findTurn(turns, 0)
  const turn1 = findTurn(turns, 1)
  const turn2 = findTurn(turns, 2)

  const diagnosis = findBlock(turn0, 'diagnosis')
  const hitCurve = findBlock(turn0, 'hit_curve')
  const outlook = findBlock(turn1, 'outlook')
  const nextStep = findBlock(turn2, 'next_step')

  return [
    // 業種は診断の block には入っていない。会話に出ているのは当たり率カーブの
    // 照合の軸としてだけなので、提示済みの値を使うためにそこから読む。
    //
    // 業種が不明な企業では feature 側が軸を '業種' という語で埋めるため、
    // そのまま出すと「業種：業種」になる。値が無いことを示す blank に倒す。
    {
      label: '業種',
      value: industryOf(hitCurve),
    },
    {
      label: '配信本数',
      value: diagnosis ? `${formatNumber(diagnosis.totalReleases)}本` : null,
    },
    {
      // 提示済みだが値が無い (blank) と、まだ提示していない (null) は別物として扱う
      label: '止まっている期間',
      value: diagnosis
        ? diagnosis.stoppedMonths === null
          ? blank
          : `${formatNumber(diagnosis.stoppedMonths)}か月`
        : null,
    },
    {
      label: '現在地の当たり率',
      value: hitCurveValue(hitCurve),
    },
    {
      label: '選んだ関心',
      value: interestValue(source?.conversation ?? null, turn0),
    },
    {
      label: '目標',
      value: outlookValue(outlook),
    },
    {
      label: '最初の一手',
      value: nextStep?.action ?? null,
    },
  ]
}

/** 埋まった項目が 1 つも無ければ、メモではなく空状態の案内を出す */
export function isMemoEmpty(items: readonly MemoItem[]): boolean {
  return items.every((item) => item.value === null)
}

/** 主役の数字。自社が今いるバケットの当たり率だけを、どの帯かと合わせて持ってくる */
function hitCurveValue(block: BlockOf<'hit_curve'> | undefined): string | null {
  if (block === undefined) return null
  const mine = block.curve.buckets.find(
    (bucket) => bucket.bucket === block.mine,
  )
  return `${formatPercent(mine?.hitPct ?? null)}（${block.mine}）`
}

/**
 * 選ばれた関心。
 *
 * 会話が持っているのは識別子だけなので、ラベルはターン 0 の質問の選択肢から引く。
 * 自由入力が Classifier で 4 分類のどれかに割り当てられた場合も、
 * 割り当て先の選択肢のラベルがそのまま出る (利用者に言い直させない)。
 */
function interestValue(
  conversation: Conversation | null,
  turn0: Turn | undefined,
): string | null {
  const interest = conversation?.interest
  if (!interest) return null
  const option = turn0?.question?.options.find(
    (candidate) => candidate.id === interest,
  )
  return option?.label ?? null
}

/**
 * 目標。
 *
 * 提示した文章と食い違わないよう、ターン 1 が目標として書いたのと同じ順で拾う
 * (再開した企業が追加した本数 → 次の本数帯まであと何本)。
 */
function outlookValue(block: BlockOf<'outlook'> | undefined): string | null {
  if (block === undefined) return null

  const resume = block.resumeTarget
  if (resume) return `あと${formatNumber(resume.addedP50)}本`

  const step = block.steps[0]
  if (step) {
    return `あと${formatNumber(step.need)}本（${formatNumber(step.target)}本まで）`
  }
  return blank
}
