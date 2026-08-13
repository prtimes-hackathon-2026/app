import 'server-only'

import { OpenAIProvider, Runner } from '@openai/agents'

import { env } from '@/shared/env'

/**
 * OpenAI Agents SDK の Runner。プロセスで 1 つだけ持つ。
 *
 * dev サーバーはモジュールを HMR で再評価するため、素直に生成すると Runner と
 * その下の HTTP クライアント (keep-alive 接続) が増え続ける。
 * db/connection.ts と同じ問題なので、同じくプロセス単位のレジストリに載せる。
 */
type GlobalWithRegistry = typeof globalThis & {
  __openaiRunner?: Runner
}

/**
 * キーが無いときは例外を投げず null を返す。
 * OPENAI_API_KEY 未設定でもアプリは動かなければならず (テンプレの文章をそのまま
 * 出して会話は続く)、「キーが無い」は障害ではなく想定内の状態だから。
 */
export function openaiRunner(): Runner | null {
  const apiKey = env().OPENAI_API_KEY
  if (!apiKey) return null

  const g = globalThis as GlobalWithRegistry
  g.__openaiRunner ??= new Runner({
    // キーは shared/env.ts で検証したものだけを渡す。SDK 側の環境変数読み取りに任せない
    modelProvider: new OpenAIProvider({ apiKey }),
    // トレースは OpenAI への別経路の送信になる。会話の正は自前テーブルに人間が読める
    // 形で持つ方針 (設計 §8) なので、ベンダー側に会話の中身を送る必要がない
    tracingDisabled: true,
  })
  return g.__openaiRunner
}
