// DB未接続でも動かすための模擬データ。数字に意味はない。
const rnd = (seed) => {
  let s = seed
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
}

export function mockCompany() {
  return {
    company_id: 0,
    company_name: 'サンプル株式会社',
    industry_id: 7,
    industry_name: '情報通信',
    capital: 30_000_000,
    capital_band: '1,000万〜5,000万円',
    foundation_date: '2020-04',
  }
}

export function mockHistory() {
  return {
    total_releases: 1,
    first_released_at: '2025-08-01',
    last_released_at: '2025-08-01',
    stopped_months: 12,
    recent: [
      {
        title: 'サービス提供開始のお知らせ',
        released_at: '2025-08-01',
        page_view: 620,
        clip_count: 0,
      },
    ],
  }
}

export function mockHitCurve() {
  return {
    buckets: [
      { bucket: '1本', companies: 6244, hit_pct: 17 },
      { bucket: '2本', companies: 2912, hit_pct: 24 },
      { bucket: '3本', companies: 1974, hit_pct: 29 },
      { bucket: '4〜5本', companies: 2371, hit_pct: 37 },
      { bucket: '6〜10本', companies: 2836, hit_pct: 47 },
      { bucket: '11〜20本', companies: 2074, hit_pct: 60 },
      { bucket: '21本以上', companies: 4337, hit_pct: 87 },
    ],
    threshold_pv: 50,
    total_companies: 22748,
  }
}

export function mockBenchmark() {
  const r = rnd(42)
  const curve = []
  for (let nth = 1; nth <= 12; nth++) {
    const base = 740 * (1 + 0.42 * Math.log(nth + 1))
    curve.push({
      nth,
      pv_median: Math.round(base * (0.95 + r() * 0.12)),
      clip_rate: Math.min(Math.round(4 + 5.2 * (nth - 1)), 46),
      n: Math.max(44 - nth * 3, 6),
    })
  }
  return {
    curve,
    eval_point: 6,
    eval_range: [5, 7],
    lift: 1.7,
    days_to_eval: 210,
    stop_at_1_pct: 34,
    stop_at_3_pct: 58,
    interval_days: 45,
    evidence: { companies: 42, releases: 268, axes: ['業種'] },
  }
}

export function mockPeriodCurve() {
  return {
    rows: [
      {
        months: 3,
        companies: 22018,
        hit_pct: 13,
        releases_p50: 1,
        cum_pv_p50: 21,
        cum_pv_p90: 95,
      },
      {
        months: 6,
        companies: 21322,
        hit_pct: 14,
        releases_p50: 2,
        cum_pv_p50: 27,
        cum_pv_p90: 130,
      },
      {
        months: 12,
        companies: 20100,
        hit_pct: 16,
        releases_p50: 2,
        cum_pv_p50: 35,
        cum_pv_p90: 209,
      },
      {
        months: 24,
        companies: 17834,
        hit_pct: 19,
        releases_p50: 3,
        cum_pv_p50: 47,
        cum_pv_p90: 383,
      },
      {
        months: 36,
        companies: 15680,
        hit_pct: 23,
        releases_p50: 4,
        cum_pv_p50: 58,
        cum_pv_p90: 591,
      },
    ],
  }
}

export function mockTrends() {
  return {
    items: [
      { release_type_name: '調査レポート', n: 50800, pv_p50: 14, pv_p90: 79 },
      { release_type_name: '人物', n: 5338, pv_p50: 16, pv_p90: 72 },
      { release_type_name: '経営情報', n: 46383, pv_p50: 14, pv_p90: 58 },
      { release_type_name: '商品サービス', n: 442128, pv_p50: 13, pv_p90: 52 },
      { release_type_name: 'イベント', n: 134919, pv_p50: 10, pv_p90: 40 },
      { release_type_name: 'キャンペーン', n: 44621, pv_p50: 8, pv_p90: 31 },
    ],
  }
}

export function mockResume() {
  return {
    segments: [
      {
        seg: 1,
        from_n: 1,
        to_n: 1,
        companies: 4291,
        hit_before_pct: 9,
        hit_after_pct: 44,
        added_p50: 3,
      },
      {
        seg: 2,
        from_n: 2,
        to_n: 3,
        companies: 2667,
        hit_before_pct: 12,
        hit_after_pct: 48,
        added_p50: 4,
      },
      {
        seg: 3,
        from_n: 4,
        to_n: 10,
        companies: 1995,
        hit_before_pct: 19,
        hit_after_pct: 53,
        added_p50: 6,
      },
      {
        seg: 4,
        from_n: 11,
        to_n: 99,
        companies: 1264,
        hit_before_pct: 42,
        hit_after_pct: 67,
        added_p50: 10,
      },
    ],
    gaps: [
      { gap: '6〜9か月', companies: 2382 },
      { gap: '9〜12か月', companies: 1672 },
      { gap: '1〜2年', companies: 3492 },
      { gap: '2年以上', companies: 2671 },
    ],
    total_resumed: 10217,
  }
}

export function mockAchievement() {
  return {
    companies: 22028,
    avg_releases: 2.3,
    pct_50: 12.5,
    pct_200: 2.4,
    pct_1000: 0.3,
  }
}

export function mockLevers() {
  return {
    main_image: {
      on: { n: 733704, hit_pct: 10.3 },
      off: { n: 22896, hit_pct: 4.4 },
      ratio: 2.3,
      n: 756600,
    },
    keyword: {
      on: { n: 695067, hit_pct: 10.5 },
      off: { n: 61533, hit_pct: 6.7 },
      ratio: 1.6,
      n: 756600,
    },
    title_number: {
      on: { n: 399920, hit_pct: 11.3 },
      off: { n: 356680, hit_pct: 8.9 },
      ratio: 1.3,
      n: 756600,
    },
    title_bracket: {
      on: { n: 118738, hit_pct: 11.8 },
      off: { n: 637862, hit_pct: 9.9 },
      ratio: 1.2,
      n: 756600,
    },
    location: {
      on: { n: 125699, hit_pct: 13.9 },
      off: { n: 630901, hit_pct: 9.4 },
      ratio: 1.5,
      n: 756600,
    },
    category: {
      on: { n: 740459, hit_pct: 10.3 },
      off: { n: 16141, hit_pct: 0.4 },
      ratio: 25.8,
      n: 756600,
    },
  }
}

export function mockUnused() {
  return {
    items: [
      {
        key: 'keyword',
        label: 'キーワード設定',
        detected: '0件',
        impact: {
          metric: 'clip_rate',
          with: 34,
          without: 17,
          ratio: 2.0,
          n: 268,
        },
      },
      {
        key: 'main_image',
        label: 'メイン画像',
        detected: '未設定',
        impact: null,
      },
      { key: 'lead', label: 'リード文', detected: '未設定', impact: null },
    ],
  }
}
