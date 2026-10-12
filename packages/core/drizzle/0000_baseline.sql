-- Baseline: the full schema from packages/core/src/db/schema.ts (drizzle-kit export), for a fresh database.
-- Later changes go in new files after this one; deploy applies each file once, in name order.

CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid,
	"used_by" uuid,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);

CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid,
	"config_hash" text,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration" integer,
	"total_tests" integer DEFAULT 0 NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"environment" text,
	"triggered_by" text DEFAULT 'manual' NOT NULL,
	"triggered_by_user" uuid,
	"result_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prompt" text,
	"url" text,
	"yaml_content" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenarios_prompt_or_yaml" CHECK (("scenarios"."prompt" IS NOT NULL AND "scenarios"."url" IS NOT NULL) OR "scenarios"."yaml_content" IS NOT NULL)
);

CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"cron_expression" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"rule_name" text NOT NULL,
	"app_name" text NOT NULL,
	"status" text NOT NULL,
	"severity" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"duration" integer NOT NULL,
	"error" text,
	"screenshot" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"steps_json" jsonb,
	"validations_json" jsonb
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "runs" ADD CONSTRAINT "runs_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "runs" ADD CONSTRAINT "runs_triggered_by_user_users_id_fk" FOREIGN KEY ("triggered_by_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_runs_scenario_id" ON "runs" USING btree ("scenario_id");
CREATE INDEX "idx_runs_started_at" ON "runs" USING btree ("started_at");
CREATE INDEX "idx_runs_status" ON "runs" USING btree ("status");
CREATE INDEX "idx_scenarios_created_by" ON "scenarios" USING btree ("created_by");
CREATE INDEX "idx_schedules_scenario_id" ON "schedules" USING btree ("scenario_id");
CREATE INDEX "idx_schedules_enabled" ON "schedules" USING btree ("enabled");
CREATE INDEX "idx_test_results_run_id" ON "test_results" USING btree ("run_id");
CREATE INDEX "idx_test_results_status" ON "test_results" USING btree ("status");
CREATE INDEX "idx_test_results_rule_id" ON "test_results" USING btree ("rule_id");
