import type {
  MetricsRepository,
  StoppedCompany,
} from '../domain/metrics-repository'

/** プロトタイプ (voice-agent/src/metrics.js) と同じ既定値 */
const defaultLimit = 15

export type FindStoppedCompanies = (
  limit?: number,
) => Promise<readonly StoppedCompany[]>

/**
 * 対象になりうる企業を探す。ログインで企業を選ばせる画面がこれを使う (設計 §11(a))。
 *
 * 「どの企業として入れるか」の一覧でもあるので、絞り込み条件はここで増やさない。
 * 条件を足すと、入れる企業が黙って変わってしまう。
 */
export function findStoppedCompanies(
  repository: MetricsRepository,
): FindStoppedCompanies {
  return (limit = defaultLimit) => {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RangeError('limit は 1 以上の整数である必要があります')
    }
    return repository.findStoppedCompanies(limit)
  }
}
