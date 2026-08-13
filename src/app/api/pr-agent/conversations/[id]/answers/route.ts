import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prAgentFeature, type UserAnswer } from '@/feature/pr-agent'

import { errorResponse, readJson } from '../../../http'

/**
 * 回答を受け取り、次のターンを返す。
 *
 * 動的セグメントの `params` は Promise なので await する。
 * 型は typegen が生成するグローバルヘルパー `RouteContext<...>` を使う (import 不要)。
 * ルートのリテラルを渡すため、パスを打ち間違えるとその場で型エラーになる。
 */

const answerSchema = z
  .object({
    questionId: z.string().min(1),
    // 選択肢と自由入力はどちらか片方。省略されたら null として扱う
    choiceId: z.string().min(1).nullable().default(null),
    text: z.string().trim().min(1).nullable().default(null),
  })
  .refine((answer) => answer.choiceId !== null || answer.text !== null, {
    message: '選択肢か自由入力のどちらかが必要です',
  })

export async function POST(
  request: Request,
  context: RouteContext<'/api/pr-agent/conversations/[id]/answers'>,
) {
  const { id } = await context.params

  const body = await readJson(request)
  if (!body.ok) {
    return errorResponse(400, 'リクエストの本文を JSON として読めませんでした')
  }

  const parsed = answerSchema.safeParse(body.value)
  if (!parsed.success) {
    return errorResponse(400, '入力が不正です', z.treeifyError(parsed.error))
  }

  // ドメインの型に代入して受け取る。feature 側の契約が変わればここで型エラーになる
  const answer: UserAnswer = parsed.data

  try {
    // 「存在しない」と「もう終わっている」を別のステータスで返したいので先に引く。
    // ターンの遷移そのものの判定は feature 側 (assertCanAdvance) が正で、
    // ここでやっているのは HTTP ステータスの割り当てだけ
    const found = await prAgentFeature.get(id)
    if (found === null) {
      return errorResponse(404, '会話が見つかりません')
    }
    if (found.conversation.status !== 'in_progress') {
      return errorResponse(409, 'この会話はすでに終わっています')
    }

    const next = await prAgentFeature.answer(id, answer)
    return NextResponse.json(next)
  } catch (cause) {
    console.error('回答の処理に失敗しました', cause)
    return errorResponse(500, '回答を処理できませんでした')
  }
}
