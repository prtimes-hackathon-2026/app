import 'dotenv/config'

// デンキヤギ（実データ）で実際に生成された facts / draft をそのまま使う
const facts = {
  御社の配信本数: '1本',
  停止期間: '9か月',
  業種: '情報通信',
  同じ業種の企業数: '22,748社',
  御社と同じ本数の企業が当たりを引いた割合: '17%',
  最も多く配信している企業群の当たり率: '87%（21本以上）',
  手応えのある結果の基準: '50PV以上（業種内の上位10%）',
  同じ本数で止まってから再開した企業数: '4,291社',
  再開前の当たり率: '9%',
  再開後の当たり率: '44%',
  再開後に追加した本数の中央値: '3本',
  '2年以上あけてから再開した企業数': '2,671社',
}
const draft = {
  position:
    '御社は1本で止まっています。同じ業種で1本だけ配信した企業のうち、手応えのある結果に届いたのは17%でした。反応が無かったのは、御社に問題があったからではありません。',
  lottery:
    '1本あたりの反応は本数を重ねても平均は変わりませんが、当たり外れの幅がとても大きいという特徴があります。21本以上まで続けた企業では87%が当たりを引いています。本数がそのまま確率になります。',
  resume:
    'そして御社と同じく1本で止まっていた企業のうち、4,291社が配信を再開しています。再開前の当たり率は9%でしたが、再開後は44%まで上がりました。追加した本数は中央値で3本です。',
}

// 出力に必ず残っていなければいけない数値
const MUST = {
  position: ['1', '17'],
  lottery: ['87'],
  resume: ['4,291', '44', '3'],
}

const models = process.argv.slice(2)
console.log('■ テンプレート（LLMなし）')
for (const [k, v] of Object.entries(draft)) console.log(`  [${k}] ${v}`)

for (const model of models) {
  process.env.OPENAI_MODEL = model
  const { narrate } = await import(
    `./src/narrate.js?m=${encodeURIComponent(model)}`
  )
  const t = Date.now()
  const { text, source } = await narrate({ facts, draft })
  const ms = Date.now() - t

  // 数値が消えていないかを機械的に検査する
  const lost = []
  for (const [k, needles] of Object.entries(MUST)) {
    const miss = needles.filter((n) => !String(text[k] || '').includes(n))
    if (miss.length) lost.push(`${k}:${miss.join(',')}`)
  }
  console.log(
    `\n■ ${model}  (${ms}ms)  ${source.startsWith('AI') ? '' : '← ' + source}`,
  )
  for (const [k, v] of Object.entries(text))
    if (k !== 'source') console.log(`  [${k}] ${v}`)
  console.log(`  → 数値の欠落: ${lost.length ? lost.join(' / ') : 'なし'}`)
}
