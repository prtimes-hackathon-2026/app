/**
 * 画面に描く部品。
 *
 * 数値は本文ではなくここから描く。本文（言い換え）が揺れても、
 * ブロックの数値は SQL の結果そのままで変わらない。
 * 文章だけだと数字が読み取れない、という指摘への対応でもある。
 */

/** 見出し数値。配信本数や停止期間のように一目で分かる値 */
export type StatBlock = {
  type: 'stat'
  items: readonly { label: string; value: string }[]
}

/** 棒グラフ。並べて初めて意味が出るもの（配信本数と当たり率など） */
export type BarsBlock = {
  type: 'bars'
  title: string
  unit: string
  items: readonly { label: string; value: number }[]
  /** 御社の現在地。ここだけ色を変える */
  highlight?: string
  note?: string
}

/** 2つの値を並べる。使用時と未使用時、再開前と再開後など */
export type CompareBlock = {
  type: 'compare'
  title: string
  left: { label: string; value: string }
  right: { label: string; value: string }
  note?: string
}

/** 表。期間ごとの推移や達成率のように複数列で見るもの */
export type TableBlock = {
  type: 'table'
  title: string
  columns: readonly string[]
  rows: readonly (readonly string[])[]
  note?: string
}

/** 目標。会話の中で一番目立たせたいもの */
export type GoalBlock = {
  type: 'goal'
  headline: string
  detail: string
}

/** チェックリスト。出す前に確認することを、差分つきで並べる */
export type ChecklistBlock = {
  type: 'checklist'
  title: string
  items: readonly { label: string; withPct?: number; withoutPct?: number }[]
  note?: string
}

/** 参考になる記事。なぜ出したかを添えられないものは出さない */
export type ArticlesBlock = {
  type: 'articles'
  title: string
  items: readonly {
    title: string
    url: string
    why: string
    /** 記事を実際に読んで取り出した要点。読めなければ空 */
    points?: readonly string[]
  }[]
}

export type Block =
  | StatBlock
  | BarsBlock
  | CompareBlock
  | TableBlock
  | GoalBlock
  | ChecklistBlock
  | ArticlesBlock
