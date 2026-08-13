-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "agent_daily_stats" (
	"agent_id" uuid NOT NULL,
	"date" date NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "agent_daily_stats_pkey" PRIMARY KEY("agent_id","date")
);

*/