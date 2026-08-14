import { composeReason } from '../compose-draft'

import type { InferenceSkill } from './inference-skill'

/**
 * 「出しても反応が無かった」企業向けの最初の実運用 Skill。
 * 文言を変える場合も、下の手順・禁止事項・終了条件を一緒にレビューできる。
 */
export const noEffectSkill: InferenceSkill = {
  definition: {
    id: 'recover-from-no-effect',
    version: 1,
    enabled: true,
    description:
      '効果を感じられず配信を止めた企業に、現在地の実測値と未使用の打ち手を示す',
    activation: {
      minimumScore: 1,
      rules: [
        {
          id: 'reason-step',
          description: '停止理由への処方を返す段階である',
          field: 'step',
          equals: 'reason',
          weight: 0.4,
        },
        {
          id: 'classified-no-effect',
          description: '停止理由が「出しても反応が無かった」に分類された',
          field: 'reason',
          equals: 'no_effect',
          weight: 0.6,
        },
      ],
    },
    requiredFacts: [
      'insight.diagnosis.totalReleases',
      'insight.diagnosis.industryName',
    ],
    procedure: [
      '反応が無かったという相手の観測を否定しない',
      '同じ配信本数の企業群に実測値がある場合だけ当たり率を示す',
      'その企業がまだ使っていない打ち手があれば1つだけ示す',
      '次に実現したいことを1問だけ確認する',
    ],
    narrationPolicy: {
      objective:
        '効果が無かったという判断を押し返さず、判断材料が何かを実測値で増やす',
      instructions: [
        '相手の観測と統計上の解釈を分ける',
        '下書きにある比較は相関として表現する',
        '最後の問いかけを1つだけ残す',
      ],
      prohibited: [
        '継続すれば必ず成果が出ると断定する',
        '下書きに無い成功確率や目標値を補う',
        '反応が無かったことを努力不足として扱う',
      ],
    },
    decision: '実測値で現在地を再解釈し、次の関心を確認する',
    nextRoute: 'proposal',
  },
  execute({ insight }) {
    return composeReason(insight, 'no_effect')
  },
}
