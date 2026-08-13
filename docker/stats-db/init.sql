-- 統計 DB (外部 PostgreSQL) のローカル代役。
-- 本番ではこの DB はこのアプリの管理外なので、ここは「向こう側にある想定のスキーマ」を
-- 再現するためだけのファイル。アプリのマイグレーションとは別物として扱う。

CREATE TABLE IF NOT EXISTS agent_daily_stats (
  agent_id      uuid    NOT NULL,
  date          date    NOT NULL,
  run_count     integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, date)
);

-- アプリからは参照専用で接続する
CREATE ROLE stats_reader LOGIN PASSWORD 'stats';
GRANT CONNECT ON DATABASE stats TO stats_reader;
GRANT USAGE ON SCHEMA public TO stats_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO stats_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO stats_reader;
