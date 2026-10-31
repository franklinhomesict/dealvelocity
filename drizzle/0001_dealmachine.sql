CREATE TYPE "public"."import_job_status" AS ENUM('draft', 'estimated', 'approved', 'running', 'paused', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "api_calls" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status" integer,
	"duration_ms" integer,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"credits_deduplicated" integer DEFAULT 0 NOT NULL,
	"job_id" uuid,
	"property_id" uuid,
	"error" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comparables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"source" text DEFAULT 'dealmachine' NOT NULL,
	"source_ref" text,
	"address" text NOT NULL,
	"status" text NOT NULL,
	"price" integer,
	"date" date,
	"beds" integer,
	"baths" numeric(3, 1),
	"sqft" integer,
	"year_built" integer,
	"distance_miles" numeric(6, 2),
	"excluded" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'dealmachine' NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"status" "import_job_status" DEFAULT 'draft' NOT NULL,
	"query" jsonb NOT NULL,
	"max_records" integer NOT NULL,
	"matching_count" integer,
	"estimated_credits" integer,
	"approved_credits" integer,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"duplicates" integer DEFAULT 0 NOT NULL,
	"failed_records" integer DEFAULT 0 NOT NULL,
	"cursor" jsonb,
	"last_error" text,
	"locked_until" timestamp with time zone,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_jobs_max_positive" CHECK ("import_jobs"."max_records" > 0),
	CONSTRAINT "import_jobs_credit_cap" CHECK ("import_jobs"."approved_credits" is null or "import_jobs"."credits_used" <= "import_jobs"."approved_credits")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "estimated_repair_cost" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "estimated_equity_percent" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "estimated_equity_amount" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "distress_flags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "source_enriched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "source_payload" jsonb;--> statement-breakpoint
ALTER TABLE "api_calls" ADD CONSTRAINT "api_calls_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_calls" ADD CONSTRAINT "api_calls_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparables" ADD CONSTRAINT "comparables_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_calls_provider_at_idx" ON "api_calls" USING btree ("provider","at");--> statement-breakpoint
CREATE INDEX "comparables_property_idx" ON "comparables" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "import_jobs_status_idx" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_idx" ON "webhook_events" USING btree ("provider","event_id");