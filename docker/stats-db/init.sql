-- 統計 DB (外部 PostgreSQL) のローカル代役。
-- 本番ではこの DB はこのアプリの管理外なので、ここは「向こう側にある想定のスキーマ」を
-- 再現するためだけのファイル。アプリのマイグレーションとは別物として扱う。
--
-- STATS_DATABASE_URL の接続先は PR TIMES のデータベースになった。
-- 以下の PR TIMES 相当のテーブルは src/external/db/stats/schema/prtimes.ts に対応する。
-- そちらと同じく、実 RDS との照合は済んでいない (voice-agent プロトタイプの SQL から
-- 起こしたもの)。実接続できたら `pnpm db:stats:pull` で引き直して差分を確認すること。

-- 骨組みのサンプルとして残してある。PR TIMES 側には存在しないテーブルなので、
-- 本番ではこれを参照する feature/stats は実行時に落ちる (削除の判断は別途)
CREATE TABLE IF NOT EXISTS agent_daily_stats (
  agent_id      uuid    NOT NULL,
  date          date    NOT NULL,
  run_count     integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, date)
);

-- ─────────────────────────────────────────── PR TIMES 相当

CREATE TABLE IF NOT EXISTS industry (
  industry_id   integer PRIMARY KEY,
  industry_name text
);

CREATE TABLE IF NOT EXISTS company (
  company_id      integer PRIMARY KEY,
  company_name    text,
  industry_id     integer,
  capital         bigint,
  foundation_date timestamptz,
  description     text
);

CREATE TABLE IF NOT EXISTS release_type (
  release_type_id   integer PRIMARY KEY,
  release_type_name text
);

CREATE TABLE IF NOT EXISTS release (
  company_id      integer NOT NULL,
  release_id      integer NOT NULL,
  title           text,
  subtitle        text,
  main_image      text,
  youtube_url     text,
  release_type_id integer,
  created_at      timestamptz,
  PRIMARY KEY (company_id, release_id)
);

-- release と同じく (company_id, release_id) の複合キー。release_id 単独では一意にならない
CREATE TABLE IF NOT EXISTS release_statistic (
  company_id integer NOT NULL,
  release_id integer NOT NULL,
  page_view  integer,
  PRIMARY KEY (company_id, release_id)
);

-- キーワードは 1 リリースに複数付くので、1 行 1 キーワード。
-- 未使用機能の検出は「リリースあたりの件数」を数えるだけなので、
-- schema/prtimes.ts 側は keyword 列を写していない (読まない列は型に起こさない方針)
CREATE TABLE IF NOT EXISTS release_keyword (
  company_id integer NOT NULL,
  release_id integer NOT NULL,
  keyword    text    NOT NULL,
  PRIMARY KEY (company_id, release_id, keyword)
);

-- ─────────────────────────────────────────── 動作確認用のシード
--
-- 対象は「配信が止まっている企業」(company_id = 1001)。
-- 同じ業種の企業を 2 社だけ足してあるのは、当たり率カーブと PV の上位 10% が
-- 業種内の分布から出るため。1 社だけだと業種単位のクエリが何も返さない。
-- クエリが通ることを確かめるための量しか入れていないので、出てくる割合に意味は無い。

INSERT INTO industry (industry_id, industry_name) VALUES
  (1, '情報通信')
ON CONFLICT DO NOTHING;

INSERT INTO release_type (release_type_id, release_type_name) VALUES
  (1, '商品サービス'),
  (2, '調査レポート'),
  (3, 'イベント')
ON CONFLICT DO NOTHING;

INSERT INTO company
  (company_id, company_name, industry_id, capital, foundation_date, description)
VALUES
  (1001, '株式会社サンプル', 1, 5000000, '2019-04-01T00:00:00Z',
   '中小企業向けに在庫管理のクラウドサービスを提供している。'),
  (1002, 'サンプル商事株式会社', 1, 30000000, '2005-06-01T00:00:00Z',
   '業務システムの受託開発。'),
  (1003, '株式会社サンプルラボ', 1, 1000000, '2021-11-01T00:00:00Z',
   'データ分析ツールの開発と運用支援。')
ON CONFLICT DO NOTHING;

-- 1001: 1 本だけ出して止まっている (メイン画像・サブタイトル・動画・キーワードすべて無し)
INSERT INTO release
  (company_id, release_id, title, subtitle, main_image, youtube_url,
   release_type_id, created_at)
VALUES
  (1001, 1, '在庫管理クラウド「サンプル在庫」の提供を開始しました',
   NULL, NULL, NULL, 1, '2025-02-10T10:00:00Z'),
  -- 1002: 出し続けていて、1 本だけ大きく跳ねている
  (1002, 1, '受託開発の新プランを開始', NULL, 'https://example.test/1.jpg', NULL,
   1, '2025-01-15T10:00:00Z'),
  (1002, 2, '【調査】中小企業の業務システム利用実態を調査しました',
   '回答数312社', 'https://example.test/2.jpg', NULL, 2, '2025-04-20T10:00:00Z'),
  (1002, 3, '導入事例セミナーを開催します', NULL, 'https://example.test/3.jpg',
   NULL, 3, '2025-07-01T10:00:00Z'),
  (1002, 4, '新オフィスへ移転しました', NULL, NULL, NULL, 1,
   '2025-10-05T10:00:00Z'),
  -- 1003: 2 本で止まっている
  (1003, 1, 'データ分析ツールを公開しました', NULL, NULL, NULL, 1,
   '2025-03-02T10:00:00Z'),
  (1003, 2, '分析ツールに新機能を追加しました', NULL, NULL, NULL, 1,
   '2025-05-18T10:00:00Z')
ON CONFLICT DO NOTHING;

INSERT INTO release_statistic (company_id, release_id, page_view) VALUES
  (1001, 1, 24),
  (1002, 1, 31),
  (1002, 2, 1480),
  (1002, 3, 45),
  (1002, 4, 18),
  (1003, 1, 27),
  (1003, 2, 12)
ON CONFLICT DO NOTHING;

-- キーワードは 1002 の跳ねた 1 本にだけ付けてある (効果差分の on / off が両方揃う)
INSERT INTO release_keyword (company_id, release_id, keyword) VALUES
  (1002, 2, '調査'),
  (1002, 2, '中小企業'),
  (1002, 2, '業務システム'),
  (1002, 3, 'セミナー')
ON CONFLICT DO NOTHING;

-- アプリからは参照専用で接続する
CREATE ROLE stats_reader LOGIN PASSWORD 'stats';
GRANT CONNECT ON DATABASE stats TO stats_reader;
GRANT USAGE ON SCHEMA public TO stats_reader;
-- テーブルを作り切ってから流すこと。ここより後に CREATE TABLE を足すと権限が付かない
GRANT SELECT ON ALL TABLES IN SCHEMA public TO stats_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO stats_reader;
