import 'server-only'

import { Agent } from '@openai/agents'
import { z } from 'zod'

import { openaiRunner, profilerModel } from '@/external/openai'

import type { CompanyFactsSnapshot } from '../domain/facts'
import type { InterestId } from '../domain/interest'
import type { ProfilerPort } from '../domain/llm'

import { interestLabels } from './interest-labels'

/**
 * 3 層 (トップ / ミドル / ボトム) の推定。
 *
 * 相手には一切質問しない。ラダリング (「なぜ」「それが実現したら」) で目的を
 * 引き出す設計は採らないと決まっている (設計 §1・§2) ので、推定は裏で完結させる。
 * 提示物にも出さないため、外したときの実害は小さい。失敗したら null。
 */

const instructions = `あなたはPR TIMESの広報伴走エージェントの裏側で動く推定部品です。

渡された事実から、その会社の3層を推定してください。相手には質問できません。
出力は相手に見せません。後続の文章が方向を間違えないための当て推量です。

top: 何のために存在する会社か
middle: 実際に何をしているか
bottom: 広報として何をするとよいか

- 渡された事実に無いことを作らない。分からない部分は幅のある書き方にする
- 各1文、日本語、40字程度
- 誇張しない。売り文句を書かない`

/**
 * 3 つの短文。形が決まっているので SDK の構造化出力に任せ、
 * 自前の JSON パースを増やさない (narrator は draft のキーが可変なので手で解く)。
 */
const profileSchema = z.object({
  top: z.string(),
  middle: z.string(),
  bottom: z.string(),
})

/**
 * 推定材料も日本語ラベルの辞書にする。生の列名を見せると意味を推測で埋められる。
 *
 * 創業年は CompanyFactsSnapshot に無いので渡していない。
 * 必要になったら domain 側の FactsCompany に足すところから。
 */
function toFacts(
  snapshot: CompanyFactsSnapshot,
  interest: InterestId | null,
): Record<string, string> {
  const titles = snapshot.history.recent
    .map((release) => release.title)
    .filter((title): title is string => Boolean(title))
  const mostCommonType = [...snapshot.trends.items].sort((a, b) => b.n - a.n)[0]

  return {
    会社名: snapshot.company.companyName ?? '不明',
    業種: snapshot.company.industryName ?? '不明',
    事業内容: snapshot.company.description ?? '不明',
    これまでの配信本数: `${snapshot.history.totalReleases}本`,
    最後の配信からの経過:
      snapshot.history.stoppedMonths !== null
        ? `${snapshot.history.stoppedMonths}か月`
        : '不明',
    過去に出したリリースの見出し: titles.length ? titles.join(' / ') : '無し',
    同じ業種で最も多く出されている形: mostCommonType
      ? mostCommonType.releaseTypeName
      : '不明',
    相手が選んだ関心: interest ? interestLabels[interest] : 'まだ選んでいない',
  }
}

export function openaiProfiler(): ProfilerPort {
  return {
    async profile({ snapshot, interest }) {
      try {
        const runner = openaiRunner()
        if (!runner) return null

        const { model, modelSettings } = profilerModel()
        const agent = new Agent({
          name: 'PR TIMES 広報伴走エージェント / 3層推定',
          instructions,
          model,
          modelSettings,
          outputType: profileSchema,
        })

        const result = await runner.run(
          agent,
          JSON.stringify(toFacts(snapshot, interest), null, 2),
        )
        const output = result.finalOutput
        if (!output) return null

        const top = output.top.trim()
        const middle = output.middle.trim()
        const bottom = output.bottom.trim()
        // 3 層は揃って初めて使えるので、欠けたら使わない
        if (!top || !middle || !bottom) return null

        return { top, middle, bottom }
      } catch (error) {
        console.error('[pr-agent] profile に失敗しました', error)
        return null
      }
    },
  }
}
