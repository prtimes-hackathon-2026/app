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
 * デモ対象を探す。認証がまだ無いため、企業を人が選ぶ画面のためにある (設計 §11(a))。
 *
 * 認証が入ったら app 層で企業 ID を確定させる形に置き換わるので、
 * ここは「デモ用」であることを前提に、絞り込み条件を増やさない。
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
