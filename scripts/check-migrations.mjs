#!/usr/bin/env node
/**
 * アプリ用 DB のマイグレーションが base ブランチと矛盾していないかを確認する。
 *
 * 主に拾いたいのは「同じ時期に切った別ブランチが先にマージされ、同じ番号の
 * マイグレーションが 2 本できてしまう」事故。番号が衝突したまま流すと、
 * どちらか一方が飛ばされたり、スナップショットの連鎖が切れたりする。
 *
 *   使い方: node scripts/check-migrations.mjs [base-ref]   (既定: origin/main)
 *
 * DB には接続しない。git に入っているファイルだけを突き合わせる。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = 'drizzle/app/migrations'
const JOURNAL = `${MIGRATIONS_DIR}/meta/_journal.json`
const EMPTY_PREV_ID = '00000000-0000-0000-0000-000000000000'

const baseRef = process.argv[2] ?? 'origin/main'
const problems = []

/** base 側のファイルを読む。base に存在しなければ undefined */
function readFromBase(path) {
  try {
    return execFileSync('git', ['show', `${baseRef}:${path}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return undefined
  }
}

function readLocal(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

const snapshotPath = (idx) =>
  `${MIGRATIONS_DIR}/meta/${String(idx).padStart(4, '0')}_snapshot.json`
const sqlPath = (tag) => `${MIGRATIONS_DIR}/${tag}.sql`

const localJournalRaw = readLocal(JOURNAL)
if (localJournalRaw === undefined) {
  console.error(`${JOURNAL} が見つかりません。`)
  process.exit(1)
}

const baseJournalRaw = readFromBase(JOURNAL)
const localEntries = JSON.parse(localJournalRaw).entries
const baseEntries = baseJournalRaw ? JSON.parse(baseJournalRaw).entries : []

// 1. base のマイグレーションは、こちらの先頭にそのまま残っていること。
//    番号が同じで tag が違う = 別ブランチが先にマージされた合図。
for (const [i, baseEntry] of baseEntries.entries()) {
  const localEntry = localEntries[i]

  if (localEntry === undefined) {
    problems.push(
      `${baseRef} にある ${baseEntry.tag} がこのブランチにありません。` +
        `base を取り込んでください。`,
    )
    continue
  }

  if (localEntry.idx !== baseEntry.idx || localEntry.tag !== baseEntry.tag) {
    problems.push(
      `マイグレーションの番号が衝突しています: ${baseRef} は ` +
        `idx=${baseEntry.idx} が ${baseEntry.tag}、このブランチは ${localEntry.tag}。` +
        `別のブランチが先にマージされています。base を取り込み、生成済みの ` +
        `SQL とスナップショットを消してから pnpm db:app:generate をやり直してください。`,
    )
    continue
  }

  // 2. マージ済みのマイグレーションは書き換えない。適用済みの DB との
  //    整合が取れなくなる (drizzle はハッシュで適用済みを判定する)。
  for (const path of [sqlPath(baseEntry.tag), snapshotPath(baseEntry.idx)]) {
    if (readFromBase(path) !== readLocal(path)) {
      problems.push(
        `${path} が ${baseRef} から変更されています。` +
          `適用済みのマイグレーションは書き換えず、新しく generate してください。`,
      )
    }
  }
}

// 3. スナップショットの連鎖 (prevId) が繋がっていること。
//    番号が衝突していなくても、取り込み方を間違えるとここが切れる。
let expectedPrevId = EMPTY_PREV_ID
for (const entry of localEntries) {
  const path = snapshotPath(entry.idx)
  const raw = readLocal(path)

  if (raw === undefined) {
    problems.push(`${path} がありません (${entry.tag} のスナップショット)。`)
    break
  }

  const snapshot = JSON.parse(raw)
  if (snapshot.prevId !== expectedPrevId) {
    problems.push(
      `${path} の prevId が繋がっていません ` +
        `(期待 ${expectedPrevId} / 実際 ${snapshot.prevId})。` +
        `base を取り込んだうえで generate をやり直してください。`,
    )
    break
  }

  expectedPrevId = snapshot.id
}

// 4. journal に載っていない SQL が転がっていないこと (generate の消し忘れ)。
const listed = new Set(localEntries.map((entry) => join(sqlPath(entry.tag))))
const tracked = execFileSync('git', ['ls-files', `${MIGRATIONS_DIR}/*.sql`], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

for (const path of tracked) {
  if (!listed.has(path)) {
    problems.push(`${path} が _journal.json に載っていません。`)
  }
}

if (problems.length > 0) {
  console.error('マイグレーションの整合性チェックに失敗しました:\n')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(
  `マイグレーションは ${baseRef} と整合しています ` +
    `(base ${baseEntries.length} 件 / このブランチ ${localEntries.length} 件)。`,
)
