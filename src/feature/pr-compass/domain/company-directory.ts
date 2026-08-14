/**
 * ログイン後に「どの企業として使うか」を選ぶための一覧。
 *
 * 対話そのものには関わらないが、統計 DB を読むのはこの feature だけと決めているので
 * ここに置く。認証が利用者と企業を結びつけるようになったら、この一覧は要らなくなる。
 */
export type StoppedCompany = {
  readonly companyId: number
  readonly companyName: string | null
  readonly industryName: string | null
  readonly releases: number
  readonly lastReleasedAt: Date | null
}

export type CompanyDirectory = {
  /** 配信が少なく、しばらく止まっている企業を返す */
  findStoppedCompanies(limit: number): Promise<readonly StoppedCompany[]>
}
