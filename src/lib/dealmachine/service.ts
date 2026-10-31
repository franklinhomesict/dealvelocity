import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, apiCalls, appSettings, comparables, importJobs, leads, properties, webhookEvents, type ImportJob } from "@/db/schema";
import { normalizeAddress } from "@/lib/format";
import { DealMachineClient, DealMachineError, pageSizeFor, type DmProperty, type DmUsage, type Filter, type Location } from "./client";
import { mapDmProperty, propertyPatch } from "./mapper";
import { parseComps, suggestArv } from "./comps";
import { checkCredits, DEFAULT_CREDIT_SETTINGS, type CreditSettings } from "./budget";
import type { DmWebhookEvent } from "./webhook";

const SETTINGS_KEY = "dealmachine.credits";
const USAGE_KEY = "dealmachine.usage_cache";
const JOB_SLICE_MS = 45_000;
const PAGE_SIZE = 25;

export const isConfigured = () => !!process.env.DEALMACHINE_API_KEY;

interface CallContext {
  jobId?: string | null;
  propertyId?: string | null;
}

/** Client wired to the api_calls log. Returns null when no key is configured. */
export function dmClient(ctx: CallContext = {}): DealMachineClient | null {
  if (!isConfigured()) return null;
  return new DealMachineClient({
    apiKey: process.env.DEALMACHINE_API_KEY!,
    baseUrl: process.env.DEALMACHINE_API_URL || undefined,
    onCall: async (c) => {
      await db.insert(apiCalls).values({
        provider: "dealmachine", operation: c.operation, method: c.method, path: c.path.split("?")[0], status: c.status,
        durationMs: c.durationMs, creditsUsed: c.credits?.used ?? 0, creditsDeduplicated: c.credits?.deduplicated ?? 0,
        jobId: ctx.jobId ?? null, propertyId: ctx.propertyId ?? null, error: c.error ?? null,
      });
    },
  });
}

function requireClient(ctx?: CallContext) {
  const c = dmClient(ctx);
  if (!c) throw new Error("DealMachine is not connected. Set DEALMACHINE_API_KEY on the server.");
  return c;
}

/* ───────────────────────── Settings & usage ───────────────────────── */

export async function getCreditSettings(): Promise<CreditSettings> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY));
  return { ...DEFAULT_CREDIT_SETTINGS, ...((r?.value as Partial<CreditSettings>) ?? {}) };
}

export async function saveCreditSettings(v: CreditSettings, userId: string) {
  await db
    .insert(appSettings)
    .values({ key: SETTINGS_KEY, value: v, updatedBy: userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: v, updatedBy: userId, updatedAt: new Date() } });
}

/** Live account usage, cached 5 minutes. Null when not configured or unreachable. */
export async function getUsage(force = false): Promise<(DmUsage & { fetchedAt: string }) | null> {
  const [cached] = await db.select().from(appSettings).where(eq(appSettings.key, USAGE_KEY));
  const c = cached?.value as (DmUsage & { fetchedAt: string }) | undefined;
  if (!force && c && Date.now() - new Date(c.fetchedAt).getTime() < 5 * 60e3) return c;
  const client = dmClient();
  if (!client) return null;
  try {
    const u = { ...(await client.usage()), fetchedAt: new Date().toISOString() };
    await db.insert(appSettings).values({ key: USAGE_KEY, value: u }).onConflictDoUpdate({ target: appSettings.key, set: { value: u, updatedAt: new Date() } });
    return u;
  } catch {
    return c ?? null;
  }
}

/** Credits this app has spent since the start of the current billing cycle. */
export async function creditsUsedThisCycle(): Promise<{ used: number; since: Date }> {
  const usage = await getUsage();
  const since = usage ? new Date(usage.billing_cycle.start) : new Date(Date.now() - 30 * 864e5);
  const [r] = await db
    .select({ used: sql<number>`coalesce(sum(${apiCalls.creditsUsed}),0)::int` })
    .from(apiCalls)
    .where(and(eq(apiCalls.provider, "dealmachine"), gte(apiCalls.at, since)));
  return { used: r.used, since };
}

async function guard(requested: number, isImport = false) {
  const [settings, { used }, usage] = await Promise.all([getCreditSettings(), creditsUsedThisCycle(), getUsage()]);
  const r = checkCredits({ settings, usedThisCycle: used, liveRemaining: usage?.credits.remaining ?? null, requested, isImport });
  if (!r.ok) throw new Error(r.reason);
}

/* ───────────────────────── Import jobs ───────────────────────── */

export interface SearchQuery {
  locations: Location[];
  filters: Filter[];
  presets: string[];
}
export interface ListQuery {
  listId: string;
  listName: string;
  fetchDetails: boolean;
}

/** Free: count + DealMachine's own cost estimate. Nothing is retrieved. */
export async function estimateSearchJob(name: string, q: SearchQuery, maxRecords: number, userId: string) {
  const client = requireClient();
  const count = await client.count(q.locations, q.filters);
  const est = await client.estimateSearch(q.locations, q.filters, PAGE_SIZE);
  const records = Math.min(maxRecords, count.total_properties);
  const perRecord = est.estimated_credits.this_page / Math.max(1, Math.min(PAGE_SIZE, count.total_properties));
  const already = est.estimated_credits.breakdown?.already_accessed ?? 0;
  const credits = Math.max(0, Math.ceil(records * (Number.isFinite(perRecord) ? perRecord : 1)) - Math.min(already, records));
  const [job] = await db
    .insert(importJobs)
    .values({ kind: "search", name, status: "estimated", query: q, maxRecords, matchingCount: count.total_properties, estimatedCredits: credits, createdBy: userId })
    .returning();
  return job;
}

export async function createListJob(q: ListQuery, total: number, maxRecords: number, userId: string) {
  const [job] = await db
    .insert(importJobs)
    .values({ kind: "list", name: `List · ${q.listName}`, status: "estimated", query: q, maxRecords: Math.min(maxRecords, Math.max(total, 1)), matchingCount: total, estimatedCredits: 0, createdBy: userId })
    .returning();
  return job;
}

/** Owner approval for paid jobs; free list jobs need only a start. */
export async function approveJob(jobId: string, userId: string, role: string) {
  const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
  if (!job) throw new Error("Import not found");
  if (job.status !== "estimated") throw new Error(`Import is ${job.status}, not awaiting approval`);
  const credits = job.estimatedCredits ?? 0;
  if (job.kind === "search") {
    if (role !== "owner") throw new Error("Only the owner can approve credit-consuming imports.");
    await guard(credits, true);
  }
  await db
    .update(importJobs)
    .set({ status: "approved", approvedCredits: job.kind === "search" ? credits : 0, approvedBy: userId, approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(importJobs.id, jobId));
}

export async function cancelJob(jobId: string) {
  await db
    .update(importJobs)
    .set({ status: "cancelled", finishedAt: new Date(), lockedUntil: null, updatedAt: new Date() })
    .where(and(eq(importJobs.id, jobId), inArray(importJobs.status, ["draft", "estimated", "approved", "paused", "failed", "running"])));
}

/**
 * Processes one time-slice of a job. Safe to call repeatedly and concurrently:
 * a row lock (locked_until) admits one runner; the stored cursor resumes where
 * the last slice stopped; upserts make re-processing a page harmless.
 * Returns true when more work remains.
 */
export async function runJobSlice(jobId: string, userId: string | null): Promise<boolean> {
  const now = new Date();
  const [job] = await db
    .update(importJobs)
    .set({ status: "running", lockedUntil: new Date(now.getTime() + JOB_SLICE_MS + 30_000), startedAt: sql`coalesce(${importJobs.startedAt}, now())`, updatedAt: now })
    .where(and(eq(importJobs.id, jobId), inArray(importJobs.status, ["approved", "paused", "running"]), or(isNull(importJobs.lockedUntil), lt(importJobs.lockedUntil, now))))
    .returning();
  if (!job) return false;

  const deadline = Date.now() + JOB_SLICE_MS;
  let state: ImportJob = job;
  const client = requireClient({ jobId });
  try {
    while (Date.now() < deadline) {
      if (state.processed >= state.maxRecords) break;
      const remaining = state.maxRecords - state.processed;
      let per = Math.min(job.kind === "list" ? 100 : PAGE_SIZE, remaining);
      let records: DmProperty[] = [];
      let hasMore = false;
      let creditsUsed = 0;

      if (job.kind === "search") {
        // Never request more records than the owner-approved credits cover.
        if (state.approvedCredits != null) {
          const left = state.approvedCredits - state.creditsUsed;
          if (left <= 0) break;
          per = Math.min(per, left);
        }
      }
      // DealMachine pages are offset = (page-1) * per_page, so the page size must
      // divide the records already fetched or we'd skip/repeat records.
      const offset = (state.cursor as { offset?: number } | null)?.offset ?? 0;
      per = pageSizeFor(offset, per);
      const page = offset / per + 1;

      if (job.kind === "search") {
        const q = job.query as SearchQuery;
        const res = await client.searchPage(q.locations, q.filters, page, per);
        records = res.data ?? [];
        hasMore = !!res.pagination?.has_next_page;
        creditsUsed = res.credits?.used ?? records.length;
      } else {
        const q = job.query as ListQuery;
        const res = await client.prospects({ listId: q.listId, page, perPage: per });
        hasMore = !!res.pagination?.has_more;
        for (const p of res.data.filter((x) => x.record_type === "property")) {
          if (q.fetchDetails) {
            try {
              const b = await client.propertyBase(p.record_id);
              records.push(b.data);
              continue;
            } catch {
              /* fall back to the prospect's address-only record */
            }
          }
          records.push({ dm_property_id: p.record_id, ...p.record, prospect_tags: p.tags?.map((t) => t.name) ?? [] });
        }
      }

      let created = 0, updated = 0, duplicates = 0, failed = 0;
      for (const r of records.slice(0, remaining)) {
        try {
          const res = await upsertFromDealMachine(r, { jobId, jobName: job.name, userId, enriched: job.kind === "search" });
          if (res === "created") created++;
          else if (res === "duplicate") duplicates++;
          else updated++;
        } catch {
          failed++;
        }
      }
      const processed = Math.min(records.length, remaining);
      [state] = await db
        .update(importJobs)
        .set({
          cursor: { offset: offset + records.length }, processed: sql`${importJobs.processed} + ${processed}`, created: sql`${importJobs.created} + ${created}`,
          updated: sql`${importJobs.updated} + ${updated}`, duplicates: sql`${importJobs.duplicates} + ${duplicates}`,
          failedRecords: sql`${importJobs.failedRecords} + ${failed}`, creditsUsed: sql`${importJobs.creditsUsed} + ${creditsUsed}`, updatedAt: new Date(),
        })
        .where(eq(importJobs.id, jobId))
        .returning();
      if (!hasMore || records.length === 0) {
        state = { ...state, processed: state.maxRecords };
        break;
      }
    }
    const done = state.processed >= state.maxRecords || (state.approvedCredits != null && job.kind === "search" && state.creditsUsed >= state.approvedCredits);
    await db
      .update(importJobs)
      .set({ status: done ? "completed" : "paused", lockedUntil: null, finishedAt: done ? new Date() : null, lastError: null, updatedAt: new Date() })
      .where(eq(importJobs.id, jobId));
    return !done;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    await db.update(importJobs).set({ status: "failed", lastError: msg, lockedUntil: null, updatedAt: new Date() }).where(eq(importJobs.id, jobId));
    return false;
  }
}

/* ───────────────────────── Upsert ───────────────────────── */

/**
 * Idempotent property upsert keyed by DealMachine ID, then by normalized address.
 * New properties get a lead in "New" for review. Nothing here contacts anyone.
 */
export async function upsertFromDealMachine(
  r: DmProperty,
  ctx: { jobId?: string | null; jobName?: string; userId: string | null; enriched: boolean },
): Promise<"created" | "updated" | "duplicate"> {
  const m = mapDmProperty(r);
  const normalized = normalizeAddress(m.street, m.city, m.state, m.zip);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(properties)
      .where(or(and(eq(properties.dataSource, "dealmachine"), eq(properties.sourceRef, m.sourceRef)), eq(properties.normalizedAddress, normalized)))
      .limit(1);
    const now = new Date();
    if (existing) {
      const fromDm = existing.dataSource === "dealmachine";
      const patch = propertyPatch(m, existing as unknown as Record<string, unknown>, fromDm);
      await tx
        .update(properties)
        .set({
          ...patch,
          sourceRef: existing.sourceRef ?? (fromDm ? m.sourceRef : existing.sourceRef),
          sourcePayload: r,
          sourceSyncedAt: now,
          sourceEnrichedAt: ctx.enriched ? now : existing.sourceEnrichedAt,
          updatedAt: now,
        })
        .where(eq(properties.id, existing.id));
      // Manual records keep their source but remember the DealMachine ID for enrichment.
      if (!fromDm && !existing.sourcePayload) {
        await tx.insert(activities).values({ propertyId: existing.id, type: "system", title: "Matched to DealMachine record", body: `${m.sourceRef}${ctx.jobName ? ` · ${ctx.jobName}` : ""}`, actorLabel: "DealMachine sync" });
      }
      return fromDm ? "updated" : "duplicate";
    }
    const [p] = await tx
      .insert(properties)
      .values({
        street: m.street, city: m.city, state: m.state, zip: m.zip, normalizedAddress: normalized,
        ...(propertyPatch(m, null, true) as object),
        dataSource: "dealmachine", sourceRef: m.sourceRef, sourcePayload: r, sourceSyncedAt: now, sourceEnrichedAt: ctx.enriched ? now : null,
      })
      .returning({ id: properties.id });
    const [l] = await tx
      .insert(leads)
      .values({ propertyId: p.id, source: "dealmachine", ownerUserId: ctx.userId, temperature: "cold", nextAction: "Review and underwrite", nextActionDueAt: new Date(Date.now() + 2 * 864e5) })
      .returning({ id: leads.id });
    await tx.insert(activities).values({
      propertyId: p.id, leadId: l.id, type: "system", title: "Imported from DealMachine", actorLabel: "DealMachine sync",
      body: [ctx.jobName, m.distressFlags.length ? `Signals: ${m.distressFlags.join(", ")}` : null].filter(Boolean).join(" · ") || null,
      metadata: { jobId: ctx.jobId ?? null, sourceRef: m.sourceRef },
    });
    return "created";
  });
}

/* ───────────────────────── Enrichment & comps ───────────────────────── */

export async function enrichProperty(propertyId: string, userId: string) {
  const [p] = await db.select().from(properties).where(eq(properties.id, propertyId));
  if (!p) throw new Error("Property not found");
  await guard(1);
  const client = requireClient({ propertyId });
  const res = p.sourceRef && p.dataSource === "dealmachine"
    ? await client.enrichProperty(p.sourceRef)
    : (p.sourcePayload as DmProperty | null)?.dm_property_id
      ? await client.enrichProperty((p.sourcePayload as DmProperty).dm_property_id)
      : await client.enrichAddress({ street: p.street, city: p.city, state: p.state, zip: p.zip });
  if (!res.data) throw new Error("DealMachine found no matching property for this address (no credit charged).");
  const m = mapDmProperty(res.data);
  const fromDm = p.dataSource === "dealmachine";
  await db
    .update(properties)
    .set({
      ...propertyPatch(m, p as unknown as Record<string, unknown>, fromDm),
      sourceRef: p.sourceRef ?? (fromDm ? m.sourceRef : null),
      sourcePayload: res.data, sourceSyncedAt: new Date(), sourceEnrichedAt: new Date(), updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId));
  await db.insert(activities).values({
    propertyId, type: "system", title: "Enriched from DealMachine", actorUserId: userId,
    body: `${res.credits?.used ?? 1} credit${(res.credits?.used ?? 1) === 1 ? "" : "s"} · ${m.distressFlags.length ? `signals: ${m.distressFlags.join(", ")}` : "no distress signals"}`,
  });
  return { credits: res.credits?.used ?? null };
}

export async function fetchComps(propertyId: string, userId: string) {
  const [p] = await db.select().from(properties).where(eq(properties.id, propertyId));
  if (!p) throw new Error("Property not found");
  const dmId = p.sourceRef ?? (p.sourcePayload as DmProperty | null)?.dm_property_id;
  if (!dmId) throw new Error("Enrich this property from DealMachine first so it has a DealMachine ID.");
  await guard(1);
  const raw = await requireClient({ propertyId }).comps(dmId);
  const comps = parseComps(raw);
  await db.transaction(async (tx) => {
    await tx.delete(comparables).where(eq(comparables.propertyId, propertyId));
    if (comps.length)
      await tx.insert(comparables).values(
        comps.map((c) => ({
          propertyId, sourceRef: c.sourceRef, address: c.address, status: c.status, price: c.price, date: c.date, beds: c.beds,
          baths: c.baths?.toString() ?? null, sqft: c.sqft, yearBuilt: c.yearBuilt, distanceMiles: c.distanceMiles?.toString() ?? null, raw: c.raw,
        })),
      );
  });
  const s = suggestArv(comps, p.sqft);
  await db.insert(activities).values({
    propertyId, type: "analysis", title: `Pulled ${comps.length} comparables from DealMachine`, actorUserId: userId,
    body: s ? `Suggested ARV $${s.arv.toLocaleString("en-US")} from ${s.compsUsed} sold comps (estimate)` : "Fewer than 3 sold comps — no ARV suggested",
  });
  return { count: comps.length, suggestion: s };
}

export async function setCompExcluded(compId: string, excluded: boolean) {
  await db.update(comparables).set({ excluded }).where(eq(comparables.id, compId));
}

export async function getComps(propertyId: string) {
  return db.select().from(comparables).where(eq(comparables.propertyId, propertyId)).orderBy(comparables.status, desc(comparables.date));
}

/* ───────────────────────── Webhooks ───────────────────────── */

/**
 * Stores each event once (provider + event id is unique), then processes it.
 * Duplicate deliveries are acknowledged and skipped. New prospects import free
 * base data only; nothing is enriched or contacted automatically.
 */
export async function ingestWebhook(events: DmWebhookEvent[]): Promise<{ stored: number; duplicates: number; processed: number }> {
  let stored = 0, duplicates = 0, processed = 0;
  for (const e of events) {
    const [row] = await db
      .insert(webhookEvents)
      .values({ provider: "dealmachine", eventId: e.id, type: e.type, payload: e })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    if (!row) {
      duplicates++;
      continue;
    }
    stored++;
    try {
      let status = "ignored";
      const recordId = e.data.prospect?.record_id ?? e.data.item?.record_id;
      const isProperty = (e.data.prospect?.record_type ?? e.data.item?.record_type) === "property";
      if ((e.type === "prospect.added" || e.type === "list.item_added") && recordId && isProperty) {
        let record: DmProperty | null = null;
        const client = dmClient();
        if (client) {
          try {
            record = (await client.propertyBase(recordId)).data;
          } catch (err) {
            if (!(err instanceof DealMachineError)) throw err;
          }
        }
        if (!record && e.data.prospect?.record) record = { dm_property_id: recordId, ...e.data.prospect.record };
        if (record) {
          await upsertFromDealMachine(record, { userId: null, enriched: false, jobName: e.type === "list.item_added" ? `List · ${e.data.list?.name ?? ""}` : "DealMachine prospect" });
          status = "processed";
        }
      }
      await db.update(webhookEvents).set({ status, processedAt: new Date() }).where(eq(webhookEvents.id, row.id));
      if (status === "processed") processed++;
    } catch (err) {
      await db.update(webhookEvents).set({ status: "failed", error: err instanceof Error ? err.message : "failed" }).where(eq(webhookEvents.id, row.id));
    }
  }
  return { stored, duplicates, processed };
}

/* ───────────────────────── Read models ───────────────────────── */

export async function listJobs(limit = 30) {
  return db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(limit);
}

const ROUTINE_OPS = ["property_base", "prospects", "lists", "usage", "whoami"];

/** Searches, metered calls and failures. Routine free lookups are summarized, not listed. */
export async function recentCalls(limit = 15) {
  const notable = or(sql`${apiCalls.operation} not in ${sql.raw(`(${ROUTINE_OPS.map((o) => `'${o}'`).join(",")})`)}`, sql`${apiCalls.error} is not null`, sql`${apiCalls.creditsUsed} > 0`);
  const [rows, [{ routine }]] = await Promise.all([
    db.select().from(apiCalls).where(and(eq(apiCalls.provider, "dealmachine"), notable)).orderBy(desc(apiCalls.at)).limit(limit),
    db
      .select({ routine: sql<number>`count(*)::int` })
      .from(apiCalls)
      .where(and(eq(apiCalls.provider, "dealmachine"), gte(apiCalls.at, new Date(Date.now() - 864e5)), sql`not (${notable})`)),
  ]);
  return { rows, routineLast24h: routine };
}
