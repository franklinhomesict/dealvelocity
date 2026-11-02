CREATE TYPE "public"."activity_type" AS ENUM('note', 'call', 'sms', 'email', 'stage_change', 'analysis', 'offer', 'task', 'document', 'system');--> statement-breakpoint
CREATE TYPE "public"."condition_rating" AS ENUM('turnkey', 'light', 'moderate', 'heavy', 'teardown', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('unknown', 'granted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."data_source" AS ENUM('manual', 'dealmachine', 'inbound_call', 'referral', 'sample');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'contacting', 'qualified', 'underwriting', 'offer', 'negotiating', 'under_contract', 'closed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."lead_temperature" AS ENUM('hot', 'warm', 'cold');--> statement-breakpoint
CREATE TYPE "public"."occupancy_status" AS ENUM('owner_occupied', 'tenant_occupied', 'vacant', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('draft', 'pending_approval', 'approved', 'sent', 'countered', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('single_family', 'duplex', 'triplex', 'fourplex', 'townhouse', 'condo', 'mobile', 'land', 'other');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'acquisitions', 'viewer');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"property_id" uuid,
	"type" "activity_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"metadata" jsonb,
	"actor_user_id" uuid,
	"actor_label" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"lead_id" uuid,
	"strategy" text DEFAULT 'brrrr' NOT NULL,
	"engine_version" text NOT NULL,
	"arv" integer,
	"arv_source" text,
	"rehab" integer,
	"monthly_rent" integer,
	"purchase_price" integer,
	"inputs" jsonb NOT NULL,
	"outputs" jsonb NOT NULL,
	"max_allowable_offer" integer,
	"deal_score" integer,
	"verdict" text NOT NULL,
	"created_by" uuid,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assumption_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"values" jsonb NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"changes" jsonb,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text,
	"last_name" text,
	"full_name" text NOT NULL,
	"phone" text,
	"phone_e164" text,
	"email" text,
	"relationship" text,
	"preferred_channel" text,
	"sms_consent" "consent_status" DEFAULT 'unknown' NOT NULL,
	"sms_consent_at" timestamp with time zone,
	"sms_consent_source" text,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"do_not_contact_reason" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" bigserial NOT NULL,
	"property_id" uuid NOT NULL,
	"contact_id" uuid,
	"owner_user_id" uuid,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"temperature" "lead_temperature" DEFAULT 'warm' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"motivation" text,
	"motivation_score" integer,
	"timeline" text,
	"asking_price" integer,
	"price_flexibility" text,
	"condition_notes" text,
	"title_concerns" text,
	"mortgage_balance" integer,
	"open_to_cash_offer" boolean,
	"qualification_summary" text,
	"next_action" text,
	"next_action_due_at" timestamp with time zone,
	"callback_requested" boolean DEFAULT false NOT NULL,
	"needs_human" boolean DEFAULT false NOT NULL,
	"lost_reason" text,
	"closed_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_motivation_score_range" CHECK ("leads"."motivation_score" is null or "leads"."motivation_score" between 1 and 5),
	CONSTRAINT "leads_asking_price_nonneg" CHECK ("leads"."asking_price" is null or "leads"."asking_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"success" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"analysis_id" uuid,
	"amount" integer NOT NULL,
	"max_allowable_offer" integer,
	"status" "offer_status" DEFAULT 'draft' NOT NULL,
	"rationale" text,
	"requested_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_amount_positive" CHECK ("offers"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"street" text NOT NULL,
	"unit" text,
	"city" text NOT NULL,
	"state" text DEFAULT 'KS' NOT NULL,
	"zip" text NOT NULL,
	"county" text,
	"apn" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"property_type" "property_type" DEFAULT 'single_family' NOT NULL,
	"beds" integer,
	"baths" numeric(3, 1),
	"sqft" integer,
	"lot_sqft" integer,
	"year_built" integer,
	"units" integer DEFAULT 1 NOT NULL,
	"occupancy" "occupancy_status" DEFAULT 'unknown' NOT NULL,
	"condition" "condition_rating" DEFAULT 'unknown' NOT NULL,
	"owner_name" text,
	"owner_mailing_address" text,
	"photo_url" text,
	"assessed_value" integer,
	"last_sale_price" integer,
	"last_sale_date" date,
	"estimated_value" integer,
	"data_source" "data_source" DEFAULT 'manual' NOT NULL,
	"source_ref" text,
	"source_synced_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"normalized_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_units_positive" CHECK ("properties"."units" > 0)
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"title" text NOT NULL,
	"kind" text DEFAULT 'follow_up' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assignee_user_id" uuid,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"status" "transaction_status" DEFAULT 'open' NOT NULL,
	"contract_price" integer,
	"effective_date" date,
	"earnest_money_due" date,
	"inspection_deadline" date,
	"closing_date" date,
	"title_company" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'acquisitions' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_sets" ADD CONSTRAINT "assumption_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_lead_idx" ON "activities" USING btree ("lead_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activities_property_idx" ON "activities" USING btree ("property_id","occurred_at");--> statement-breakpoint
CREATE INDEX "analyses_property_created_idx" ON "analyses" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "contacts_phone_idx" ON "contacts" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "contacts_name_idx" ON "contacts" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_ref_idx" ON "leads" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "leads_property_idx" ON "leads" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "leads_contact_idx" ON "leads" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "leads_next_action_idx" ON "leads" USING btree ("next_action_due_at");--> statement-breakpoint
CREATE INDEX "login_attempts_email_at_idx" ON "login_attempts" USING btree ("email","at");--> statement-breakpoint
CREATE INDEX "offers_lead_idx" ON "offers" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "offers_status_idx" ON "offers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_normalized_address_idx" ON "properties" USING btree ("normalized_address");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_source_ref_idx" ON "properties" USING btree ("data_source","source_ref") WHERE "properties"."source_ref" is not null;--> statement-breakpoint
CREATE INDEX "properties_zip_idx" ON "properties" USING btree ("zip");--> statement-breakpoint
CREATE INDEX "saved_views_user_entity_idx" ON "saved_views" USING btree ("user_id","entity");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_open_due_idx" ON "tasks" USING btree ("due_at") WHERE "tasks"."completed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_lead_idx" ON "transactions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "transactions_closing_idx" ON "transactions" USING btree ("closing_date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));