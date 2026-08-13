import 'server-only'

import type {
  CompanyHistory,
  CompanyProfile,
  FeatureUsage,
} from '../domain/company-position'
import type {
  HitCurve,
  Levers,
  PeriodCurve,
  ResumeStats,
  Trends,
} from '../domain/metrics'
import type { MetricsRepository } from '../domain/metrics-repository'

/**
 * PR TIMES DB に繋がっていないときの模擬データ。
 *
 * プロトタイプは「DB も API キーも無しで動く」ことを実証しており、その性質を引き継ぐ
 * (設計 §4 の全経路 degrade)。デモ環境や CI で、接続情報を配らずに一通り動かせる。
 *
 * 数値は voice-agent/src/mock.js の写し。実測値ではないので、ここの数字を
 * 資料に転記しないこと。実データか模擬データかは CompanyFactsBundle.source で判別する。
 */

const mockCompany: CompanyProfile = {
  companyId: 0,
  companyName: 'サンプル株式会社',
  industryId: 7,
  industryName: '情報通信',
  capital: 30_000_000,
  foundationDate: new Date('2020-04-01T00:00:00Z'),
  description: null,
}

const mockHistory: CompanyHistory = {
  totalReleases: 1,
  firstReleasedAt: new Date('2025-08-01T00:00:00Z'),
  lastReleasedAt: new Date('2025-08-01T00:00:00Z'),
  // mock.js の固定値。実時刻から計算すると日が経つほど数字がずれていくため据え置く
  stoppedMonths: 12,
  recent: [
    {
      title: 'サービス提供開始のお知らせ',
      releasedAt: new Date('2025-08-01T00:00:00Z'),
      pageView: 620,
    },
  ],
}

/**
 * 「1 本出したきりで、何の機能も使っていない」企業を模す。
 * mock.js は検出済みの一覧を直に持っていたが、検出ルールは domain に移ったので、
 * ルールの入力側 (集計値) を組み立てて同じ結果が出るようにしている。
 */
const mockFeatureUsage: FeatureUsage = {
  total: 1,
  noImage: 1,
  noVideo: 1,
  noSubtitle: 1,
  releaseTypes: 1,
  avgKeywords: 0,
  titlesWithNumber: 0,
  titlesWithBracket: 0,
}

const mockHitCurve: HitCurve = {
  buckets: [
    { bucket: '1本', companies: 6244, hitPct: 17 },
    { bucket: '2本', companies: 2912, hitPct: 24 },
    { bucket: '3本', companies: 1974, hitPct: 29 },
    { bucket: '4〜5本', companies: 2371, hitPct: 37 },
    { bucket: '6〜10本', companies: 2836, hitPct: 47 },
    { bucket: '11〜20本', companies: 2074, hitPct: 60 },
    { bucket: '21本以上', companies: 4337, hitPct: 87 },
  ],
  thresholdPv: 50,
  totalCompanies: 22748,
}

const mockPeriodCurve: PeriodCurve = {
  rows: [
    {
      months: 3,
      companies: 22018,
      hitPct: 13,
      releasesP50: 1,
      cumPvP50: 21,
      cumPvP90: 95,
    },
    {
      months: 6,
      companies: 21322,
      hitPct: 14,
      releasesP50: 2,
      cumPvP50: 27,
      cumPvP90: 130,
    },
    {
      months: 12,
      companies: 20100,
      hitPct: 16,
      releasesP50: 2,
      cumPvP50: 35,
      cumPvP90: 209,
    },
    {
      months: 24,
      companies: 17834,
      hitPct: 19,
      releasesP50: 3,
      cumPvP50: 47,
      cumPvP90: 383,
    },
    {
      months: 36,
      companies: 15680,
      hitPct: 23,
      releasesP50: 4,
      cumPvP50: 58,
      cumPvP90: 591,
    },
  ],
}

const mockTrends: Trends = {
  items: [
    { releaseTypeName: '調査レポート', n: 50800, pvP50: 14, pvP90: 79 },
    { releaseTypeName: '人物', n: 5338, pvP50: 16, pvP90: 72 },
    { releaseTypeName: '経営情報', n: 46383, pvP50: 14, pvP90: 58 },
    { releaseTypeName: '商品サービス', n: 442128, pvP50: 13, pvP90: 52 },
    { releaseTypeName: 'イベント', n: 134919, pvP50: 10, pvP90: 40 },
    { releaseTypeName: 'キャンペーン', n: 44621, pvP50: 8, pvP90: 31 },
  ],
}

const mockResume: ResumeStats = {
  segments: [
    {
      seg: 1,
      fromN: 1,
      toN: 1,
      companies: 4291,
      hitBeforePct: 9,
      hitAfterPct: 44,
      addedP50: 3,
    },
    {
      seg: 2,
      fromN: 2,
      toN: 3,
      companies: 2667,
      hitBeforePct: 12,
      hitAfterPct: 48,
      addedP50: 4,
    },
    {
      seg: 3,
      fromN: 4,
      toN: 10,
      companies: 1995,
      hitBeforePct: 19,
      hitAfterPct: 53,
      addedP50: 6,
    },
    {
      seg: 4,
      fromN: 11,
      toN: 99,
      companies: 1264,
      hitBeforePct: 42,
      hitAfterPct: 67,
      addedP50: 10,
    },
  ],
  gaps: [
    { gap: '6〜9か月', companies: 2382 },
    { gap: '9〜12か月', companies: 1672 },
    { gap: '1〜2年', companies: 3492 },
    { gap: '2年以上', companies: 2671 },
  ],
  totalResumed: 10217,
}

const mockLevers: Levers = {
  main_image: {
    on: { n: 733704, hitPct: 10.3 },
    off: { n: 22896, hitPct: 4.4 },
    ratio: 2.3,
  },
  keyword: {
    on: { n: 695067, hitPct: 10.5 },
    off: { n: 61533, hitPct: 6.7 },
    ratio: 1.6,
  },
  title_number: {
    on: { n: 399920, hitPct: 11.3 },
    off: { n: 356680, hitPct: 8.9 },
    ratio: 1.3,
  },
  title_bracket: {
    on: { n: 118738, hitPct: 11.8 },
    off: { n: 637862, hitPct: 9.9 },
    ratio: 1.2,
  },
}

export function mockMetricsRepository(): MetricsRepository {
  return {
    // どの企業 ID を指定しても同じ 1 社を返す。ID だけ echo するのは、
    // デモ画面が選んだ企業と返ってきた企業がずれて見えるのを避けるため
    async findCompany(companyId) {
      return { ...mockCompany, companyId }
    },
    async findHistory() {
      return mockHistory
    },
    async findFeatureUsage() {
      return mockFeatureUsage
    },

    async findHitCurve() {
      return mockHitCurve
    },
    async findPeriodCurve() {
      return mockPeriodCurve
    },
    async findTrends() {
      return mockTrends
    },
    async findResumeStats() {
      return mockResume
    },
    async findLevers() {
      return mockLevers
    },

    // 企業を選ぶ画面が空にならないよう、模擬データの 1 社だけを返す
    async findStoppedCompanies() {
      return [
        {
          companyId: mockCompany.companyId,
          companyName: mockCompany.companyName,
          industryName: mockCompany.industryName,
          releases: mockHistory.totalReleases,
          lastReleasedAt: mockHistory.lastReleasedAt,
        },
      ]
    },
  }
}
