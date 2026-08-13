import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const KEY = process.env.OPENAI_API_KEY.trim();
const openai = createOpenAI({ apiKey: KEY });

const SYSTEM = `あなたはPR TIMESの広報伴走エージェントの「言い換え」部品です。
相手は広報・マーケティングの知見がない担当者。社長が兼任していることも多い。忙しい。
仕事は、渡された下書き(draft)を読みやすく書き直すことだけです。
- 事実の追加・削除・数値の変更は禁止
- facts に書かれた日本語ラベルが指標の意味の唯一の正解。自分で推測しない
- 一般論・励まし・精神論を書かない
- 他社名を出さない。比較や順位づけをしない
- マーケ用語を使わない
- 数値は下書きのものをそのまま残す
出力はJSONのみ。draft と同じキーを持たせること。各1〜3文、日本語。`;

const payload = {
  facts: { '御社の配信本数':'1本','停止期間':'9か月','業種':'情報通信','同じ業種の企業数':'22,748社',
    '御社と同じ本数の企業が当たりを引いた割合':'17%','最も多く配信している企業群の当たり率':'87%（21本以上）',
    '手応えのある結果の基準':'50PV以上（業種内の上位10%）','同じ本数で止まってから再開した企業数':'4,291社',
    '再開前の当たり率':'9%','再開後の当たり率':'44%','再開後に追加した本数の中央値':'3本',
    '2年以上あけてから再開した企業数':'2,671社' },
  draft: {
    position:'御社は1本で止まっています。同じ業種で1本だけ配信した企業のうち、手応えのある結果に届いたのは17%でした。反応が無かったのは、御社に問題があったからではありません。',
    lottery:'1本あたりの反応は本数を重ねても平均は変わりませんが、当たり外れの幅がとても大きいという特徴があります。21本以上まで続けた企業では87%が当たりを引いています。本数がそのまま確率になります。',
    resume:'そして御社と同じく1本で止まっていた企業のうち、4,291社が配信を再開しています。再開前の当たり率は9%でしたが、再開後は44%まで上がりました。追加した本数は中央値で3本です。' },
};

console.log('=== テキストLLM 1回あたりのトークン ===');
for (const m of ['gpt-4o-mini','gpt-3.5-turbo']) {
  const r = await generateText({ model: openai(m), system: SYSTEM,
    prompt: JSON.stringify(payload, null, 2), temperature: 0.3 });
  const u = r.usage || {};
  console.log(`${m.padEnd(16)} 入力 ${u.inputTokens ?? u.promptTokens} / 出力 ${u.outputTokens ?? u.completionTokens}`);
}

console.log('\n=== TTS（音声）1文あたり ===');
const sentences = [
  'デンキヤギ株式会社さんの状況を確認しました。配信は1本、そこから9か月止まっています。',
  '御社は1本で止まっています。同じ業種で1本だけ配信した企業のうち、手応えのある結果に届いたのは17パーセントでした。反応が無かったのは、御社に問題があったからではありません。',
];
let bytes = 0, chars = 0;
for (const s of sentences) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},
    body: JSON.stringify({ model:'gpt-4o-mini-tts', voice:'shimmer', input:s, response_format:'mp3' }),
  });
  if (!r.ok) { console.log('  TTS失敗', r.status, (await r.text()).slice(0,120)); break; }
  const b = (await r.arrayBuffer()).byteLength;
  bytes += b; chars += s.length;
  // mp3 は概ね 32kbps → 秒数 = bytes / 4000
  console.log(`  ${s.length}文字 → ${(b/1024).toFixed(0)}KB  約${(b/4000).toFixed(1)}秒`);
}
console.log(`\n合計 ${chars}文字 / ${(bytes/1024).toFixed(0)}KB / 約${(bytes/4000).toFixed(0)}秒`);
console.log(`ターン0の台本は約5文なので、概算で ${(chars/2*5)}文字・${(bytes/4000/2*5).toFixed(0)}秒程度`);
