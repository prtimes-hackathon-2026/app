import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prAgentFeature, type UserAnswer } from '@/feature/pr-agent'

import { errorResponse, readJson } from '../../../../http'
import { signedInSession } from '../../../../../session'

/**
 * 回答を受け取り、次のターンを返す。
 *
 * 自社の会話にしか答えられない。他社の会話 ID を渡された場合は、
 * 存在しないときと同じ 404 で返す (存在の有無を知られないようにする)。
 *
 * 動的セグメントの `params` は Promise なので await する。
 * 型は typegen が生成するグローバルヘルパー `RouteContext<...>` を使う (import 不要)。
 * ルートのリテラルを実在するルートと突き合わせるので、パスを打ち間違えると型エラーになる。
 * 生成物なので、これを使う以上 `tsc` の前に `next typegen` が要る
 * (package.json の typecheck をそうしてある)。
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

  const session = await signedInSession()
  if (session === null) {
    return errorResponse(401, 'ログインしてください')
  }

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
    if (found === null || found.conversation.companyId !== session.company.id) {
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
