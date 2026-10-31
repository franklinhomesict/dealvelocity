import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  date,
  bigserial,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ───────────────────────────── Enums ───────────────────────────── */

export const userRole = pgEnum("user_role", ["owner", "acquisitions", "viewer"]);

export const leadStage = pgEnum("lead_stage", [
  "new",
  "contacting",
  "qualified",
  "underwriting",
  "offer",
  "negotiating",
  "under_contract",
  "closed",
  "dead",
]);

export const leadTemperature = pgEnum("lead_temperature", ["hot", "warm", "cold"]);

export const propertyType = pgEnum("property_type", [
  "single_family",
  "duplex",
  "triplex",
  "fourplex",
  "townhouse",
  "condo",
  "mobile",
  "land",
  "other",
]);

export const occupancyStatus = pgEnum("occupancy_status", [
  "owner_occupied",
  "tenant_occupied",
  "vacant",
  "unknown",
]);

export const conditionRating = pgEnum("condition_rating", [
  "turnkey",
  "light",
  "moderate",
  "heavy",
  "teardown",
  "unknown",
]);

export const dataSource = pgEnum("data_source", ["manual", "dealmachine", "inbound_call", "referral", "sample"]);

export const consentStatus = pgEnum("consent_status", ["unknown", "granted", "revoked"]);

export const activityType = pgEnum("activity_type", [
  "note",
  "call",
  "sms",
  "email",
  "stage_change",
  "analysis",
  "offer",
  "task",
  "document",
  "system",
]);

export const offerStatus = pgEnum("offer_status", [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "countered",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const transactionStatus = pgEnum("transaction_status", ["open", "closed", "cancelled"]);

/* ─────────────────────────── Identity ─────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("acquisitions"),
    disabled: boolean("disabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the opaque token; the raw token only lives in the cookie
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull(),
    ip: text("ip"),
    success: boolean("success").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_email_at_idx").on(t.email, t.at)],
);

/* ─────────────────────────── Core CRM ─────────────────────────── */

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    street: text("street").notNull(),
    unit: text("unit"),
    city: text("city").notNull(),
    state: text("state").notNull().default("KS"),
    zip: text("zip").notNull(),
    county: text("county"),
    apn: text("apn"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    propertyType: propertyType("property_type").notNull().default("single_family"),
    beds: integer("beds"),
    baths: numeric("baths", { precision: 3, scale: 1 }),
    sqft: integer("sqft"),
    lotSqft: integer("lot_sqft"),
    yearBuilt: integer("year_built"),
    units: integer("units").notNull().default(1),
    occupancy: occupancyStatus("occupancy").notNull().default("unknown"),
    condition: conditionRating("condition").notNull().default("unknown"),
    ownerName: text("owner_name"),
    ownerMailingAddress: text("owner_mailing_address"),
    photoUrl: text("photo_url"),
    // Verified (public record / source) vs. estimated values are kept apart
    assessedValue: integer("assessed_value"),
    lastSalePrice: integer("last_sale_price"),
    lastSaleDate: date("last_sale_date"),
    estimatedValue: integer("estimated_value"),
    dataSource: dataSource("data_source").notNull().default("manual"),
    sourceRef: text("source_ref"),
    sourceSyncedAt: timestamp("source_synced_at", { withTimezone: true }),
    // DealMachine estimates (never treated as verified) and distress signals
    estimatedRepairCost: integer("estimated_repair_cost"),
    estimatedEquityPercent: numeric("estimated_equity_percent", { precision: 6, scale: 2 }),
    estimatedEquityAmount: integer("estimated_equity_amount"),
    distressFlags: text("distress_flags").array().notNull().default(sql`'{}'::text[]`),
    sourceEnrichedAt: timestamp("source_enriched_at", { withTimezone: true }),
    sourcePayload: jsonb("source_payload"),
    isSample: boolean("is_sample").notNull().default(false),
    normalizedAddress: text("normalized_address").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("properties_normalized_address_idx").on(t.normalizedAddress),
    uniqueIndex("properties_source_ref_idx")
      .on(t.dataSource, t.sourceRef)
      .where(sql`${t.sourceRef} is not null`),
    index("properties_zip_idx").on(t.zip),
    check("properties_units_positive", sql`${t.units} > 0`),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    phoneE164: text("phone_e164"),
    email: text("email"),
    relationship: text("relationship"), // owner, heir, spouse, POA, agent…
    preferredChannel: text("preferred_channel"),
    // Compliance: explicit consent, opt-out and DNC are first-class fields.
    smsConsent: consentStatus("sms_consent").notNull().default("unknown"),
    smsConsentAt: timestamp("sms_consent_at", { withTimezone: true }),
    smsConsentSource: text("sms_consent_source"),
    doNotContact: boolean("do_not_contact").notNull().default(false),
    doNotContactReason: text("do_not_contact_reason"),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contacts_phone_idx").on(t.phoneE164), index("contacts_name_idx").on(t.fullName)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ref: bigserial("ref", { mode: "number" }).notNull(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    stage: leadStage("stage").notNull().default("new"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    temperature: leadTemperature("temperature").notNull().default("warm"),
    source: text("source").notNull().default("manual"),
    // Seller intelligence
    motivation: text("motivation"),
    motivationScore: integer("motivation_score"), // 1–5
    timeline: text("timeline"),
    askingPrice: integer("asking_price"),
    priceFlexibility: text("price_flexibility"),
    conditionNotes: text("condition_notes"),
    titleConcerns: text("title_concerns"),
    mortgageBalance: integer("mortgage_balance"),
    openToCashOffer: boolean("open_to_cash_offer"),
    qualificationSummary: text("qualification_summary"),
    // Workflow
    nextAction: text("next_action"),
    nextActionDueAt: timestamp("next_action_due_at", { withTimezone: true }),
    callbackRequested: boolean("callback_requested").notNull().default(false),
    needsHuman: boolean("needs_human").notNull().default(false),
    lostReason: text("lost_reason"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("leads_ref_idx").on(t.ref),
    index("leads_stage_idx").on(t.stage),
    index("leads_property_idx").on(t.propertyId),
    index("leads_contact_idx").on(t.contactId),
    index("leads_next_action_idx").on(t.nextActionDueAt),
    check("leads_motivation_score_range", sql`${t.motivationScore} is null or ${t.motivationScore} between 1 and 5`),
    check("leads_asking_price_nonneg", sql`${t.askingPrice} is null or ${t.askingPrice} >= 0`),
  ],
);

/**
 * Underwriting inputs and computed outputs. Each save is a new immutable row
 * so the history of every recommendation is auditable.
 */
export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    strategy: text("strategy").notNull().default("brrrr"),
    engineVersion: text("engine_version").notNull(),
    arv: integer("arv"),
    arvSource: text("arv_source"), // "estimate" | "comps" | "appraisal" | "owner"
    rehab: integer("rehab"),
    monthlyRent: integer("monthly_rent"),
    purchasePrice: integer("purchase_price"),
    inputs: jsonb("inputs").notNull(),
    outputs: jsonb("outputs").notNull(),
    maxAllowableOffer: integer("max_allowable_offer"),
    dealScore: integer("deal_score"),
    verdict: text("verdict").notNull(), // pass | review | fail
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analyses_property_created_idx").on(t.propertyId, t.createdAt)],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }),
    type: activityType("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    metadata: jsonb("metadata"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorLabel: text("actor_label"), // e.g. "AI Assistant", "System"
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    isSample: boolean("is_sample").notNull().default(false),
  },
  (t) => [
    index("activities_lead_idx").on(t.leadId, t.occurredAt),
    index("activities_property_idx").on(t.propertyId, t.occurredAt),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("follow_up"), // follow_up, callback, deadline, review
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, { onDelete: "set null" }),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_open_due_idx").on(t.dueAt).where(sql`${t.completedAt} is null`)],
);

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id").references(() => analyses.id, { onDelete: "set null" }),
    amount: integer("amount").notNull(),
    maxAllowableOffer: integer("max_allowable_offer"),
    status: offerStatus("status").notNull().default("draft"),
    rationale: text("rationale"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("offers_lead_idx").on(t.leadId),
    index("offers_status_idx").on(t.status),
    check("offers_amount_positive", sql`${t.amount} > 0`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    status: transactionStatus("status").notNull().default("open"),
    contractPrice: integer("contract_price"),
    effectiveDate: date("effective_date"),
    earnestMoneyDue: date("earnest_money_due"),
    inspectionDeadline: date("inspection_deadline"),
    closingDate: date("closing_date"),
    titleCompany: text("title_company"),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("transactions_lead_idx").on(t.leadId), index("transactions_closing_idx").on(t.closingDate)],
);

/* ───────────────────────── Configuration ───────────────────────── */

/** Versioned underwriting assumptions. The newest row is active. */
export const assumptionSets = pgTable("assumption_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  values: jsonb("values").notNull(),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entity: text("entity").notNull(), // "leads" | "properties"
    name: text("name").notNull(),
    query: jsonb("query").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_views_user_entity_idx").on(t.userId, t.entity)],
);

/* ─────────────────────────── Audit ─────────────────────────── */

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    changes: jsonb("changes"),
    ip: text("ip"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_at_idx").on(t.at)],
);

/* ─────────────────────────── Integrations ─────────────────────────── */

export const importJobStatus = pgEnum("import_job_status", [
  "draft",
  "estimated",
  "approved",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

/**
 * A DealMachine import. Paid searches must be estimated (free count) and
 * approved by the owner before any credit-consuming request is made.
 * `cursor` makes runs resumable; property upserts make retries idempotent.
 */
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("dealmachine"),
    kind: text("kind").notNull(), // "search" (paid) | "list" (free base data)
    name: text("name").notNull(),
    status: importJobStatus("status").notNull().default("draft"),
    query: jsonb("query").notNull(),
    maxRecords: integer("max_records").notNull(),
    matchingCount: integer("matching_count"),
    estimatedCredits: integer("estimated_credits"),
    approvedCredits: integer("approved_credits"),
    creditsUsed: integer("credits_used").notNull().default(0),
    processed: integer("processed").notNull().default(0),
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    duplicates: integer("duplicates").notNull().default(0),
    failedRecords: integer("failed_records").notNull().default(0),
    cursor: jsonb("cursor"),
    lastError: text("last_error"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("import_jobs_status_idx").on(t.status),
    check("import_jobs_max_positive", sql`${t.maxRecords} > 0`),
    check("import_jobs_credit_cap", sql`${t.approvedCredits} is null or ${t.creditsUsed} <= ${t.approvedCredits}`),
  ],
);

/** Every outbound provider request, for credit tracking and debugging. Never stores secrets. */
export const apiCalls = pgTable(
  "api_calls",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    status: integer("status"),
    durationMs: integer("duration_ms"),
    creditsUsed: integer("credits_used").notNull().default(0),
    creditsDeduplicated: integer("credits_deduplicated").notNull().default(0),
    jobId: uuid("job_id").references(() => importJobs.id, { onDelete: "set null" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    error: text("error"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_calls_provider_at_idx").on(t.provider, t.at)],
);

export const comparables = pgTable(
  "comparables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("dealmachine"),
    sourceRef: text("source_ref"),
    address: text("address").notNull(),
    status: text("status").notNull(), // sold | active | pending
    price: integer("price"),
    date: date("date"),
    beds: integer("beds"),
    baths: numeric("baths", { precision: 3, scale: 1 }),
    sqft: integer("sqft"),
    yearBuilt: integer("year_built"),
    distanceMiles: numeric("distance_miles", { precision: 6, scale: 2 }),
    excluded: boolean("excluded").notNull().default(false),
    raw: jsonb("raw"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comparables_property_idx").on(t.propertyId)],
);

/** Inbound webhook deliveries, stored before processing; event id makes processing idempotent. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("received"), // received | processed | ignored | failed
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_idx").on(t.provider, t.eventId)],
);

/** Owner-controlled runtime settings (credit budgets, paid-request switch). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ImportJob = typeof importJobs.$inferSelect;
export type Comparable = typeof comparables.$inferSelect;
export type User = typeof users.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type LeadStage = (typeof leadStage.enumValues)[number];
