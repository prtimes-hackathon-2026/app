# 広報伴走エージェント

止まっている広報担当者に、**最初の一言で価値を返す**エージェント。
AI SDK（Vercel）+ Express + PostgreSQL。

## 動かす

```bash
cp .env.example .env   # 初回のみ
npm install
npm start
```

→ http://localhost:3100

**DBもキーも無しで動きます**（模擬データ＋テンプレート文）。

Dockerで動かす場合:

```bash
docker compose up --build
```

## RDSに繋ぐ

`.env` に追記して再起動するだけ。**テーブル名・カラム名はER図の実スキーマに合わせて実装済み**。

```
DB_HOST=<RDSのエンドポイント>
DB_PORT=5432
DB_NAME=<データベース名>
DATABASE_USER=<ユーザー>
DATABASE_PASS=<パスワード>
DEFAULT_COMPANY_ID=<対象の company_id>
```

繋いだら確認:

```bash
curl localhost:3100/api/health     # 接続状態
curl localhost:3100/api/inspect    # テーブルと件数
curl "localhost:3100/api/companies?q=" # 配信数が少ない企業を20件（デモ対象探し）
```

> RDSがVPC内なら手元から直接は繋がらない。EC2経由のSSHトンネルを張るか、
> このコンテナごとEC2で動かす。

## 設計

```
数値 … SQL（src/metrics.js）でのみ算出
文章 … AI SDK（src/narrate.js）で下書きを言い換えるだけ
```

LLMには**日本語ラベル付きの事実**と**テンプレの下書き**しか渡さない。
生の指標名（`eval_point` 等）を渡すと意味を誤読するため。
LLMが落ちてもテンプレート文でそのまま動く。

## 会話の流れ

| ターン | 内容                                                           | 質問               |
| ------ | -------------------------------------------------------------- | ------------------ |
| 0      | 診断・似た企業の傾向・現在地・未使用機能                       | 関心を4択で        |
| 1      | 見込み（配信ペース換算）・種別ごとの傾向・使うとよい機能＋記事 | この方向で進めるか |

**ターン0で先に価値を出す**（質問だけのターンを作らない）のが設計の核。

## API

|                         |                                      |
| ----------------------- | ------------------------------------ |
| `POST /api/sessions`    | ターン0。`{ company_id }`            |
| `POST /api/messages`    | ターン1。`{ company_id, choice_id }` |
| `GET /api/health`       | 接続状態                             |
| `GET /api/inspect`      | テーブル一覧と件数                   |
| `GET /api/companies?q=` | 企業検索（デモ対象探し用）           |

## ファイル

```
src/
  metrics.js  ← SQL。数値はここでしか作らない
  mock.js     ← DB未接続時の模擬データ
  turns.js    ← ターン0 / ターン1 の組み立て
  narrate.js  ← AI SDK。言い換え専用
  script.js   ← 画面の文章を読み上げ用の台本に落とす
  voice.js    ← OpenAI の音声。TTS / 聞き取り / 4択への分類
  catalog.js  ← 機能カタログとマガジン記事の対応表
  db.js       ← 接続。DATABASE_URL または DB_HOST から組み立て
  server.js   ← ルーティング
public/index.html ← 画面（1ファイル）
```

## 音声で聞く（AI営業）

`OPENAI_API_KEY` があれば右上に **🔊 音声で聞く** が出る。押すと喋り出す。

```
数値 … SQL          （metrics.js）
文章 … AI SDKで言い換え（narrate.js）
台本 … 文章を耳向けに整形（script.js）  ← ここまでサーバで確定
声  … 台本をそのまま読むだけ（voice.js）
```

**声は台本を読むだけで、文章を作らない。** だからLLMが数値を言い間違える経路がない。
台本の1文ごとに、その文が指すブロックだけが画面に出る。喋りと画面が同時に進む。

聞き手は **🎙 声で答える** で自由に喋れる。聞き取った内容はサーバ側で4つの関心の
どれかに黙って割り当てる（言い直させない）。Chrome推奨。

|                 |                                            |
| --------------- | ------------------------------------------ |
| `POST /api/tts` | `{ text }` → mp3。同じ文はキャッシュする   |
| `POST /api/stt` | 音声をそのままPOST → `{ text, choice_id }` |

起動時に、毎回同じになる文（1文目と締めの問い）だけ先に音声化しておく。
これで押してから喋り出すまでの間が **2.6秒 → 0.04秒** になる。

声を変えるなら `.env` の `TTS_VOICE`（`shimmer` / `sage` / `coral` / `nova` など）。

## 実データで確認したいこと

- `release_type` の実際の値（傾向テーブルの中身が決まる）
- `webclipping_list` の充足率（転載率が出せるか）
- `capital` の分布（規模バンドの刻みが妥当か）
- 業種だけで絞ったときの社数（フォールバックが何段目で止まるか）
