import type { Block, Turn } from '@/feature/pr-agent'

import { blank, formatDate, formatNumber, formatPercent } from './format'
import styles from './pr-agent.module.css'

/**
 * 1 ターンの提示物の描画。
 *
 * `Block` は判別可能ユニオンなので `kind` ごとに描き分け、`switch` の網羅性は
 * 型で担保する (新しい block が増えたらコンパイルエラーになる)。
 * 文章 (`narrative`) は blocks の言い換えでしかないため、数字は必ず blocks 側から出す。
 */

type BlockOf<K extends Block['kind']> = Extract<Block, { kind: K }>

export type HitCurveBlock = BlockOf<'hit_curve'>
type PeriodBlock = BlockOf<'period'>
type UnusedItem = BlockOf<'unused_features'>['items'][number]
type MeasuredUnusedItem = UnusedItem & {
  readonly impact: NonNullable<UnusedItem['impact']>
}

export function findHitCurve(turn: Turn): HitCurveBlock | undefined {
  return turn.blocks.find((block): block is HitCurveBlock => {
    return block.kind === 'hit_curve'
  })
}

function findPeriod(turn: Turn): PeriodBlock | undefined {
  return turn.blocks.find((block): block is PeriodBlock => {
    return block.kind === 'period'
  })
}

export function TurnView({
  turn,
  hitCurveFallback,
}: {
  turn: Turn
  /** 前のターンで出した当たり率カーブ。期間カーブと並べるために借りてくる */
  hitCurveFallback?: HitCurveBlock | undefined
}) {
  const ownHitCurve = findHitCurve(turn)
  const hitCurve = ownHitCurve ?? hitCurveFallback
  const period = findPeriod(turn)

  // 当たり率カーブと期間カーブは対でしか意味を持たない (設計 §5)。
  // 片方だけのターンでも並ぶよう、先に出た方の位置でまとめて 1 枠に描く
  const pairAt = turn.blocks.findIndex((block) => {
    return block.kind === 'hit_curve' || block.kind === 'period'
  })

  return (
    <article className={styles.turn}>
      <Narrative narrative={turn.narrative} />
      {turn.blocks.map((block, index) => {
        if (block.kind === 'hit_curve' || block.kind === 'period') {
          return index === pairAt ? (
            <CurvePair
              key="curves"
              hitCurve={hitCurve}
              period={period}
              borrowed={ownHitCurve === undefined}
            />
          ) : null
        }
        return <BlockView key={`${block.kind}-${index}`} block={block} />
      })}
    </article>
  )
}

function Narrative({ narrative }: { narrative: Turn['narrative'] }) {
  // narrative のキーと block の kind の対応は契約に無いので、並べ替えずにそのまま出す
  const paragraphs = Object.entries(narrative.text)
  if (paragraphs.length === 0) return null

  return (
    <div className={styles.narrative}>
      {paragraphs.map(([key, text]) => (
        <p key={key}>{text}</p>
      ))}
      {narrative.source === 'template' ? (
        // LLM が使えずテンプレのまま出ている状態。利用者向けの情報ではないので控えめに
        <p className={styles.devNote}>文章は言い換え前のテンプレートです</p>
      ) : null}
    </div>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'diagnosis':
      return <Diagnosis block={block} />
    case 'hit_curve':
      return <HitCurve block={block} />
    case 'period':
      return <Period block={block} />
    case 'resume':
      return <Resume block={block} />
    case 'unused_features':
      return <UnusedFeatures block={block} />
    case 'outlook':
      return <Outlook block={block} />
    case 'trends':
      return <Trends block={block} />
    case 'features':
      return <Features block={block} />
    case 'next_step':
      return <NextStep block={block} />
    default: {
      // block が増えたらここで型エラーになる。描画漏れを実行時まで持ち越さないための番人
      const _exhaustive: never = block
      return null
    }
  }
}

function CurvePair({
  hitCurve,
  period,
  borrowed,
}: {
  hitCurve: HitCurveBlock | undefined
  period: PeriodBlock | undefined
  borrowed: boolean
}) {
  if (hitCurve === undefined && period === undefined) return null

  return (
    <div className={styles.curvePair}>
      {hitCurve ? <HitCurve block={hitCurve} borrowed={borrowed} /> : null}
      {period ? <Period block={period} /> : null}
    </div>
  )
}

function Diagnosis({ block }: { block: BlockOf<'diagnosis'> }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{block.title}</h3>
      <dl className={styles.facts}>
        <div>
          <dt>配信本数</dt>
          <dd>{formatNumber(block.totalReleases)}本</dd>
        </div>
        <div>
          <dt>最後の配信</dt>
          <dd>{formatDate(block.lastReleasedAt)}</dd>
        </div>
        <div>
          <dt>止まっている期間</dt>
          <dd>
            {block.stoppedMonths === null
              ? blank
              : `${formatNumber(block.stoppedMonths)}か月`}
          </dd>
        </div>
      </dl>

      {block.recent.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>直近の配信</caption>
            <thead>
              <tr>
                <th scope="col">配信日</th>
                <th scope="col">タイトル</th>
                <th scope="col" className={styles.num}>
                  PV
                </th>
              </tr>
            </thead>
            <tbody>
              {block.recent.map((release, index) => (
                <tr key={`${release.title ?? ''}-${index}`}>
                  <td className={styles.num}>
                    {formatDate(release.releasedAt)}
                  </td>
                  <td>{release.title ?? blank}</td>
                  <td className={styles.num}>
                    {formatNumber(release.pageView)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

function HitCurve({
  block,
  borrowed = false,
}: {
  block: HitCurveBlock
  borrowed?: boolean
}) {
  return (
    <section className={`${styles.block} ${styles.lead}`}>
      <h3 className={styles.blockTitle}>
        {block.title}
        {borrowed ? <span className={styles.tag}>再掲</span> : null}
      </h3>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>配信本数で分けたときの当たり率</caption>
          <thead>
            <tr>
              <th scope="col">配信本数</th>
              <th scope="col" className={styles.num}>
                企業数
              </th>
              <th scope="col" className={styles.num}>
                当たり率
              </th>
            </tr>
          </thead>
          <tbody>
            {block.curve.buckets.map((bucket) => {
              // 自社が今いるバケットが対話全体の主役の数字なので、行ごと強調する
              const mine = bucket.bucket === block.mine
              return (
                <tr
                  key={bucket.bucket}
                  className={mine ? styles.mine : undefined}
                  aria-current={mine ? 'true' : undefined}
                >
                  <th scope="row">
                    {bucket.bucket}
                    {mine ? <span className={styles.tag}>御社</span> : null}
                  </th>
                  <td className={styles.num}>
                    {formatNumber(bucket.companies)}社
                  </td>
                  <td className={`${styles.num} ${styles.headline}`}>
                    {formatPercent(bucket.hitPct)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>
        「当たり」は業種内の PV 上位 10%（
        {formatNumber(block.curve.thresholdPv)} PV
        以上）に届いたこと。集計対象は
        {formatNumber(block.curve.totalCompanies)}社。
      </p>
      <EvidenceView evidence={block.evidence} />
    </section>
  )
}

function EvidenceView({ evidence }: { evidence: HitCurveBlock['evidence'] }) {
  return (
    <p className={styles.evidence}>
      <span>根拠 {formatNumber(evidence.companies)}社</span>
      <span>
        照合の軸 {evidence.axes.length > 0 ? evidence.axes.join('・') : blank}
      </span>
      {/* 模擬データかどうかはコードが付ける表記。文章側には混ぜない */}
      {evidence.source === 'mock' ? (
        <span className={styles.mock}>模擬データ</span>
      ) : null}
    </p>
  )
}

function Period({ block }: { block: PeriodBlock }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{block.title}</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>初回配信からの経過期間で分けたときの当たり率</caption>
          <thead>
            <tr>
              <th scope="col">経過期間</th>
              <th scope="col" className={styles.num}>
                企業数
              </th>
              <th scope="col" className={styles.num}>
                当たり率
              </th>
              <th scope="col" className={styles.num}>
                本数の中央値
              </th>
              <th scope="col" className={styles.num}>
                累計 PV 中央値
              </th>
              <th scope="col" className={styles.num}>
                累計 PV 上位 10%
              </th>
            </tr>
          </thead>
          <tbody>
            {block.curve.rows.map((row) => (
              <tr key={row.months}>
                <th scope="row">{formatNumber(row.months)}か月</th>
                <td className={styles.num}>{formatNumber(row.companies)}社</td>
                <td className={`${styles.num} ${styles.headline}`}>
                  {formatPercent(row.hitPct)}
                </td>
                <td className={styles.num}>
                  {formatNumber(row.releasesP50)}本
                </td>
                <td className={styles.num}>{formatNumber(row.cumPvP50)}</td>
                <td className={styles.num}>{formatNumber(row.cumPvP90)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>
        左の本数別と同じ「当たり率」を、経過期間で分け直したもの。
      </p>
    </section>
  )
}

function Resume({ block }: { block: BlockOf<'resume'> }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{block.title}</h3>
      <dl className={styles.facts}>
        <div>
          <dt>休止前の配信本数</dt>
          <dd>
            {formatNumber(block.segment.fromN)}〜
            {formatNumber(block.segment.toN)}本
          </dd>
        </div>
        <div>
          <dt>該当する企業</dt>
          <dd>{formatNumber(block.segment.companies)}社</dd>
        </div>
        <div>
          <dt>再開前の当たり率</dt>
          <dd>{formatPercent(block.segment.hitBeforePct)}</dd>
        </div>
        <div>
          <dt>再開後の当たり率</dt>
          <dd className={styles.headline}>
            {formatPercent(block.segment.hitAfterPct)}
          </dd>
        </div>
        <div>
          <dt>再開後に足した本数の中央値</dt>
          <dd>{formatNumber(block.segment.addedP50)}本</dd>
        </div>
      </dl>

      {block.gaps.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>休止していた期間の内訳</caption>
            <thead>
              <tr>
                <th scope="col">休止期間</th>
                <th scope="col" className={styles.num}>
                  企業数
                </th>
              </tr>
            </thead>
            <tbody>
              {block.gaps.map((gap) => (
                <tr key={gap.gap}>
                  <th scope="row">{gap.gap}</th>
                  <td className={styles.num}>
                    {formatNumber(gap.companies)}社
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className={styles.note}>
        休止から再開した企業は全体で{formatNumber(block.totalResumed)}社。
      </p>
    </section>
  )
}

function UnusedFeatures({ block }: { block: BlockOf<'unused_features'> }) {
  // 効果差分が分かっているものと、分かっていないものを混ぜない。
  // 後者に効果があるかのような書き方をしないための切り分け
  const measured = block.items.filter((item): item is MeasuredUnusedItem => {
    return item.impact !== null
  })
  const unmeasured = block.items.filter((item) => item.impact === null)

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{block.title}</h3>

      {measured.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>
              同じ業種で、使っている企業と使っていない企業の当たり率
            </caption>
            <thead>
              <tr>
                <th scope="col">機能</th>
                <th scope="col">今の状態</th>
                <th scope="col" className={styles.num}>
                  使っている
                </th>
                <th scope="col" className={styles.num}>
                  使っていない
                </th>
                <th scope="col" className={styles.num}>
                  集計本数
                </th>
              </tr>
            </thead>
            <tbody>
              {measured.map((item) => (
                <tr key={item.key}>
                  <th scope="row">{item.label}</th>
                  <td>{item.detected}</td>
                  <td className={`${styles.num} ${styles.headline}`}>
                    {formatPercent(item.impact.withPct)}
                  </td>
                  <td className={styles.num}>
                    {formatPercent(item.impact.withoutPct)}
                  </td>
                  <td className={styles.num}>{formatNumber(item.impact.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {measured.length > 0 ? (
        <p className={styles.note}>
          同じ業種の実績にこれだけの差がある、というだけの数字。
        </p>
      ) : null}

      {unmeasured.length > 0 ? (
        <div className={styles.subBlock}>
          <h4 className={styles.subTitle}>設定できる項目</h4>
          <ul className={styles.list}>
            {unmeasured.map((item) => (
              <li key={item.key}>
                <span className={styles.itemName}>{item.label}</span>
                <span className={styles.itemNote}>{item.detected}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            当たり率の差は測れていない項目。設定できる、というところまで。
          </p>
        </div>
      ) : null}
    </section>
  )
}

function Outlook({ block }: { block: BlockOf<'outlook'> }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{block.title}</h3>
      <dl className={styles.facts}>
        <div>
          <dt>今の配信本数</dt>
          <dd>{formatNumber(block.now)}本</dd>
        </div>
        <div>
          <dt>今いる本数帯の当たり率</dt>
          <dd>{formatPercent(block.currentPct)}</dd>
        </div>
      </dl>

      {block.steps.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>本数帯ごとの当たり率と、そこに届くまでの本数</caption>
            <thead>
              <tr>
                <th scope="col">目標の本数</th>
                <th scope="col" className={styles.num}>
                  あと
                </th>
                <th scope="col" className={styles.num}>
                  その帯の当たり率
                </th>
                <th scope="col" className={styles.num}>
                  月 1 本なら
                </th>
                <th scope="col" className={styles.num}>
                  3 か月に 1 本なら
                </th>
              </tr>
            </thead>
            <tbody>
              {block.steps.map((step) => (
                <tr key={step.target}>
                  <th scope="row">{formatNumber(step.target)}本</th>
                  <td className={styles.num}>{formatNumber(step.need)}本</td>
                  <td className={`${styles.num} ${styles.headline}`}>
                    {formatPercent(step.hitPct)}
                  </td>
                  <td className={styles.num}>
                    {formatNumber(step.monthsMonthly)}か月
                  </td>
                  <td className={styles.num}>
                    {formatNumber(step.monthsQuarterly)}か月
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {block.resumeTarget ? (
        <p className={styles.note}>
          同じ本数から再開した{formatNumber(block.resumeTarget.companies)}
          社では、再開前{formatPercent(block.resumeTarget.hitBeforePct)}に対して
          再開後は{formatPercent(block.resumeTarget.hitAfterPct)}。足した本数の
          中央値は{formatNumber(block.resumeTarget.addedP50)}本。
        </p>
      ) : null}
    </section>
  )
}

function Trends({ block }: { block: BlockOf<'trends'> }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{block.title}</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>リリース種別ごとの PV</caption>
          <thead>
            <tr>
              <th scope="col">種別</th>
              <th scope="col" className={styles.num}>
                本数
              </th>
              <th scope="col" className={styles.num}>
                PV 中央値
              </th>
              <th scope="col" className={styles.num}>
                PV 上位 10%
              </th>
            </tr>
          </thead>
          <tbody>
            {block.trends.items.map((item) => (
              <tr key={item.releaseTypeName}>
                <th scope="row">{item.releaseTypeName}</th>
                <td className={styles.num}>{formatNumber(item.n)}</td>
                <td className={styles.num}>{formatNumber(item.pvP50)}</td>
                <td className={styles.num}>{formatNumber(item.pvP90)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Features({ block }: { block: BlockOf<'features'> }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{block.title}</h3>
      <ul className={styles.list}>
        {block.items.map((item) => (
          <li key={item.key}>
            <span className={styles.itemName}>{item.name}</span>
            <span className={styles.itemNote}>{item.note}</span>
          </li>
        ))}
      </ul>
      {block.articles.length > 0 ? (
        <div className={styles.subBlock}>
          <h4 className={styles.subTitle}>読んでおくとよい記事</h4>
          <ul className={styles.list}>
            {block.articles.map((article) => (
              <li key={article.url}>
                <a href={article.url} target="_blank" rel="noreferrer">
                  {article.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function NextStep({ block }: { block: BlockOf<'next_step'> }) {
  return (
    <section className={`${styles.block} ${styles.nextStep}`}>
      <h3 className={styles.blockTitle}>{block.title}</h3>
      <p className={styles.action}>{block.action}</p>
      <p>{block.detail}</p>
    </section>
  )
}
