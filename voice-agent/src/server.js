import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

import { USING_MOCK, maskedUrl, ping, query } from './db.js'
import { buildTurn0, buildTurn1 } from './turns.js'
import {
  findStoppedCompanies,
  getCompany,
  getHitCurve,
  getLevers,
  getPeriodCurve,
  getTrends,
} from './metrics.js'
import { VOICE_READY, classify, listen, speak } from './voice.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))

const DEFAULT_COMPANY = Number(process.env.DEFAULT_COMPANY_ID || 0)

app.get('/api/health', async (_req, res) => {
  const p = await ping()
  res.json({
    ...p,
    mock: USING_MOCK,
    db: maskedUrl(),
    openai_key: Boolean((process.env.OPENAI_API_KEY || '').trim()),
    voice: VOICE_READY,
  })
})

/** 台本の1段を音声にする。落ちたら 204 を返し、画面は音なしで進む */
app.post('/api/tts', async (req, res) => {
  const buf = await speak(String(req.body?.text || ''))
  if (!buf) return res.status(204).end()
  res
    .set('Content-Type', 'audio/mpeg')
    .set('Cache-Control', 'no-store')
    .send(buf)
})

/** 話しかけられた音声を聞き取り、4つの関心のどれかに落とす */
app.post(
  '/api/stt',
  express.raw({ type: 'audio/*', limit: '25mb' }),
  async (req, res) => {
    try {
      const text = await listen(
        req.body,
        req.get('content-type') || 'audio/webm',
      )
      res.json({ text, choice_id: text ? await classify(text) : null })
    } catch (e) {
      console.error('[stt]', e.message)
      res.status(500).json({ error: e.message })
    }
  },
)

/** 会話を開始する（ターン0） */
app.post('/api/sessions', async (req, res) => {
  const companyId = Number(req.body?.company_id) || DEFAULT_COMPANY
  try {
    const out = await buildTurn0(companyId)
    if (out.error) return res.status(404).json(out)
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

/** 回答を送る（ターン1） */
app.post('/api/messages', async (req, res) => {
  const companyId = Number(req.body?.company_id) || DEFAULT_COMPANY
  const interest = String(req.body?.choice_id || 'topic')
  try {
    const out = await buildTurn1(companyId, interest)
    if (out.error) return res.status(404).json(out)
    res.json(out)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

/** 繋いだ直後の確認用。テーブル一覧と件数を返す */
app.get('/api/inspect', async (_req, res) => {
  if (USING_MOCK) return res.json({ mock: true, tables: [] })
  try {
    const tables = await query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`,
    )
    const wanted = [
      'company',
      'release',
      'release_statistic',
      'webclipping_list',
      'release_keyword',
      'release_type',
      'industry',
    ]
    const counts = {}
    for (const t of wanted) {
      if (!tables.some((r) => r.table_name === t)) {
        counts[t] = null
        continue
      }
      try {
        const [c] = await query(`SELECT COUNT(*)::int AS n FROM ${t}`)
        counts[t] = c.n
      } catch {
        counts[t] = 'error'
      }
    }
    res.json({ mock: false, tables: tables.map((r) => r.table_name), counts })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** デモ対象を探す：配信が1〜3本で、9か月以上止まっている企業 */
app.get('/api/stopped', async (_req, res) => {
  try {
    res.json({ items: await findStoppedCompanies(15) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** 会社を探す（company_id が分からないとき） */
app.get('/api/companies', async (req, res) => {
  if (USING_MOCK) return res.json({ items: [] })
  const q = String(req.query.q || '')
  try {
    const rows = await query(
      `SELECT c.company_id, c.company_name, i.industry_name,
              (SELECT COUNT(*) FROM release r WHERE r.company_id = c.company_id)::int AS releases
         FROM company c
         LEFT JOIN industry i ON i.industry_id = c.industry_id
        WHERE ($1 = '' OR c.company_name ILIKE '%' || $1 || '%')
        ORDER BY releases ASC
        LIMIT 20`,
      [q],
    )
    res.json({ items: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** デモ前に集計を温めておく（初回の待ちを消す） */
async function warm() {
  if (USING_MOCK || !DEFAULT_COMPANY) return
  try {
    const c = await getCompany(DEFAULT_COMPANY)
    if (!c) return
    console.log(`… ${c.company_name}（${c.industry_name}）の集計を準備中`)
    await Promise.all([
      getHitCurve(c.industry_id),
      getTrends(c.industry_id),
      getPeriodCurve(c.industry_id),
      getLevers(c.industry_id),
    ])
    console.log('✔ 準備完了')

    // 台本のうち毎回同じになる文だけ先に音声化しておく。
    // 1文目（社名・本数・停止月から組む）と締めの問いは narrate を通らないので必ず一致する。
    if (VOICE_READY) {
      const t0 = await buildTurn0(DEFAULT_COMPANY)
      await Promise.all(
        [
          t0.speech?.[0]?.text && speak(t0.speech[0].text),
          speak('どれから手を付けましょうか。'),
          speak('この方向で進めてよろしいですか。'),
        ].filter(Boolean),
      )
      console.log('✔ 音声の準備完了')
    }
  } catch (e) {
    console.error('[warm]', e.message)
  }
}

const port = Number(process.env.PORT || 3000)
app.listen(port, '0.0.0.0', () => {
  console.log(
    `▶ http://localhost:${port}  (${USING_MOCK ? 'モックデータ' : maskedUrl()})`,
  )
  warm()
})
