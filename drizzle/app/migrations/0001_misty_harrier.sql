CREATE TYPE "public"."pr_conversation_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."pr_conversation_turn_role" AS ENUM('agent', 'user');--> statement-breakpoint
CREATE TABLE "pr_conversation_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" "pr_conversation_turn_role" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pr_conversation_turns_conversation_id_position_unique" UNIQUE("conversation_id","position")
);
--> statement-breakpoint
CREATE TABLE "pr_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" integer NOT NULL,
	"status" "pr_conversation_status" DEFAULT 'in_progress' NOT NULL,
	"turn" integer DEFAULT 0 NOT NULL,
	"interest" text,
	"profile" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_industry_metrics" (
	"industry_id" integer PRIMARY KEY NOT NULL,
	"metrics" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pr_conversation_turns" ADD CONSTRAINT "pr_conversation_turns_conversation_id_pr_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."pr_conversations"("id") ON DELETE cascade ON UPDATE no action;