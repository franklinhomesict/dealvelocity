"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  properties,
  contacts,
  leads,
  activities,
  tasks,
  analyses,
  offers,
  assumptionSets,
  savedViews,
  leadStage,
} from "@/db/schema";
import { createSession, destroySession, verifyCredentials, requireRole, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { normalizeAddress, toE164 } from "@/lib/format";
import { stageLabel } from "@/lib/domain";
import { analyzeBrrrr, ENGINE_VERSION } from "@/lib/underwriting/engine";
import { assumptionsSchema } from "@/lib/underwriting/assumptions";
import { getAssumptions, searchAll, type SearchHit } from "@/lib/queries";

export type ActionResult<T = unknown> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

const WRITE_ROLES = ["owner", "acquisitions"] as const;
const fail = (e: unknown): ActionResult<never> => ({
  ok: false,
  error: e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : e instanceof Error ? e.message : "Something went wrong",
});

const optInt = z.preprocess(
  (v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : v),
  z.number().int().nonnegative().nullable(),
);
const optStr = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(2000).nullable().optional());

/* ───────────────────────── Auth ───────────────────────── */

export async function loginAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const r = await verifyCredentials(email, password);
  if (!r.ok) return { error: r.error };
  await createSession(r.user.id);
  await audit(r.user.id, "login", "user", r.user.id);
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/* ───────────────────────── Search ───────────────────────── */

export async function searchAction(q: string): Promise<SearchHit[]> {
  await requireUser();
  return searchAll(q.slice(0, 100));
}

/* ───────────────────────── Properties / leads ───────────────────────── */

const quickAddSchema = z.object({
  street: z.string().trim().min(3, "Street is required").max(200),
  unit: optStr,
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().length(2).toUpperCase(),
  zip: z.string().trim().regex(/^\d{5}$/, "ZIP must be 5 digits"),
  propertyType: z.enum(["single_family", "duplex", "triplex", "fourplex", "townhouse", "condo", "mobile", "land", "other"]),
  beds: optInt,
  baths: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).max(20).nullable()),
  sqft: optInt,
  yearBuilt: optInt,
  sellerName: optStr,
  sellerPhone: optStr,
  askingPrice: optInt,
  source: z.enum(["manual", "referral", "inbound_call"]).default("manual"),
  notes: optStr,
});

export async function createPropertyAction(input: Record<string, unknown>): Promise<ActionResult<{ propertyId: string; existing?: boolean }>> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const v = quickAddSchema.parse(input);
    const normalized = normalizeAddress(v.street, v.city, v.state, v.zip, v.unit);
    const [dupe] = await db.select({ id: properties.id }).from(properties).where(eq(properties.normalizedAddress, normalized)).limit(1);
    if (dupe) return { ok: true, data: { propertyId: dupe.id, existing: true }, message: "Property already exists — opened existing record" };

    const phone = v.sellerPhone ? toE164(v.sellerPhone) : null;
    if (v.sellerPhone && !phone) return { ok: false, error: "Seller phone must be a 10-digit US number" };

    const propertyId = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(properties)
        .values({
          street: v.street, unit: v.unit ?? null, city: v.city, state: v.state, zip: v.zip,
          propertyType: v.propertyType, beds: v.beds, baths: v.baths?.toString() ?? null, sqft: v.sqft,
          yearBuilt: v.yearBuilt, dataSource: v.source === "inbound_call" ? "inbound_call" : v.source === "referral" ? "referral" : "manual",
          normalizedAddress: normalized,
        })
        .returning({ id: properties.id });
      let contactId: string | null = null;
      if (v.sellerName || phone) {
        const name = v.sellerName ?? "Unknown seller";
        const [c] = await tx
          .insert(contacts)
          .values({ fullName: name, firstName: name.split(" ")[0], lastName: name.split(" ").slice(1).join(" ") || null, phone: v.sellerPhone ?? null, phoneE164: phone, relationship: "owner" })
          .returning({ id: contacts.id });
        contactId = c.id;
      }
      const [l] = await tx
        .insert(leads)
        .values({ propertyId: p.id, contactId, ownerUserId: user.id, askingPrice: v.askingPrice, source: v.source, nextAction: "Make first contact", nextActionDueAt: new Date(Date.now() + 864e5) })
        .returning({ id: leads.id });
      await tx.insert(activities).values({ leadId: l.id, propertyId: p.id, type: "system", title: "Lead created", body: v.notes ?? null, actorUserId: user.id });
      return p.id;
    });
    await audit(user.id, "create", "property", propertyId, { street: v.street });
    revalidatePath("/", "layout");
    return { ok: true, data: { propertyId }, message: "Property added" };
  } catch (e) {
    return fail(e);
  }
}

export async function moveLeadStageAction(leadId: string, stage: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const s = z.enum(leadStage.enumValues).parse(stage);
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) return { ok: false, error: "Lead not found" };
    if (lead.stage === s) return { ok: true };
    // Contract stage requires an approved/accepted offer — no shortcuts around approval.
    if (s === "under_contract" || s === "closed") {
      const statuses = await db.select({ status: offers.status }).from(offers).where(eq(offers.leadId, leadId));
      if (!statuses.some((o) => o.status === "accepted" || o.status === "approved" || o.status === "countered")) {
        return { ok: false, error: "Moving to contract requires an owner-approved offer" };
      }
    }
    await db.transaction(async (tx) => {
      await tx
        .update(leads)
        .set({ stage: s, stageChangedAt: new Date(), updatedAt: new Date(), closedAt: s === "closed" ? new Date() : lead.closedAt })
        .where(eq(leads.id, leadId));
      await tx.insert(activities).values({
        leadId, propertyId: lead.propertyId, type: "stage_change",
        title: `Moved to ${stageLabel(s)}`, metadata: { from: lead.stage, to: s }, actorUserId: user.id,
      });
    });
    await audit(user.id, "stage_change", "lead", leadId, { from: lead.stage, to: s });
    revalidatePath("/", "layout");
    return { ok: true, message: `Moved to ${stageLabel(s)}` };
  } catch (e) {
    return fail(e);
  }
}

const leadPatchSchema = z
  .object({
    askingPrice: optInt,
    mortgageBalance: optInt,
    motivation: optStr,
    motivationScore: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(5).nullable()),
    timeline: optStr,
    priceFlexibility: optStr,
    conditionNotes: optStr,
    titleConcerns: optStr,
    nextAction: optStr,
    nextActionDueAt: z.preprocess((v) => (v === "" || v == null ? null : new Date(String(v))), z.date().nullable()),
    temperature: z.enum(["hot", "warm", "cold"]),
    openToCashOffer: z.boolean().nullable(),
  })
  .partial();

export async function updateLeadAction(leadId: string, patch: Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const v = leadPatchSchema.parse(patch);
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) return { ok: false, error: "Lead not found" };
    await db.update(leads).set({ ...v, updatedAt: new Date() }).where(eq(leads.id, leadId));
    const changed = Object.keys(v);
    if (changed.length) {
      await audit(user.id, "update", "lead", leadId, v as Record<string, unknown>);
      if ("askingPrice" in v && v.askingPrice !== lead.askingPrice) {
        await db.insert(activities).values({
          leadId, propertyId: lead.propertyId, type: "note", actorUserId: user.id,
          title: `Asking price ${lead.askingPrice ? `changed from $${lead.askingPrice.toLocaleString("en-US")} to` : "set to"} ${v.askingPrice ? `$${v.askingPrice.toLocaleString("en-US")}` : "—"}`,
        });
      }
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

const propertyPatchSchema = z
  .object({
    beds: optInt,
    baths: z.preprocess((v) => (v === "" || v == null ? null : String(Number(v))), z.string().nullable()),
    sqft: optInt,
    yearBuilt: optInt,
    propertyType: z.enum(["single_family", "duplex", "triplex", "fourplex", "townhouse", "condo", "mobile", "land", "other"]),
    occupancy: z.enum(["owner_occupied", "tenant_occupied", "vacant", "unknown"]),
    condition: z.enum(["turnkey", "light", "moderate", "heavy", "teardown", "unknown"]),
    units: z.preprocess((v) => Number(v), z.number().int().min(1).max(50)),
  })
  .partial();

export async function updatePropertyAction(propertyId: string, patch: Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const v = propertyPatchSchema.parse(patch);
    await db.update(properties).set({ ...v, updatedAt: new Date() }).where(eq(properties.id, propertyId));
    await audit(user.id, "update", "property", propertyId, v as Record<string, unknown>);
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function addNoteAction(propertyId: string, leadId: string | null, body: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const text = z.string().trim().min(1, "Note is empty").max(5000).parse(body);
    await db.insert(activities).values({ propertyId, leadId, type: "note", title: "Note", body: text, actorUserId: user.id });
    if (leadId) await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId));
    revalidatePath(`/properties/${propertyId}`);
    return { ok: true, message: "Note added" };
  } catch (e) {
    return fail(e);
  }
}

export async function addTaskAction(leadId: string, title: string, dueAt: string | null, kind = "follow_up"): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const t = z.string().trim().min(1).max(300).parse(title);
    const due = dueAt ? new Date(dueAt) : null;
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) return { ok: false, error: "Lead not found" };
    await db.insert(tasks).values({ leadId, title: t, dueAt: due, kind, assigneeUserId: user.id });
    await db.insert(activities).values({ leadId, propertyId: lead.propertyId, type: "task", title: `Task created: ${t}`, actorUserId: user.id });
    revalidatePath("/", "layout");
    return { ok: true, message: "Task added" };
  } catch (e) {
    return fail(e);
  }
}

export async function completeTaskAction(taskId: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const [t] = await db.update(tasks).set({ completedAt: new Date() }).where(eq(tasks.id, taskId)).returning();
    if (!t) return { ok: false, error: "Task not found" };
    if (t.leadId) {
      const [lead] = await db.select({ propertyId: leads.propertyId }).from(leads).where(eq(leads.id, t.leadId));
      await db.insert(activities).values({ leadId: t.leadId, propertyId: lead?.propertyId, type: "task", title: `Completed: ${t.title}`, actorUserId: user.id });
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "Task completed" };
  } catch (e) {
    return fail(e);
  }
}

export async function clearCallbackAction(leadId: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const [lead] = await db.update(leads).set({ callbackRequested: false, updatedAt: new Date() }).where(eq(leads.id, leadId)).returning();
    if (!lead) return { ok: false, error: "Lead not found" };
    await db.insert(activities).values({ leadId, propertyId: lead.propertyId, type: "call", title: "Returned seller callback", actorUserId: user.id });
    revalidatePath("/", "layout");
    return { ok: true, message: "Callback marked complete" };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────── Underwriting ───────────────────────── */

const analysisInputSchema = z.object({
  purchasePrice: optInt,
  arv: optInt,
  arvSource: z.enum(["estimate", "comps", "appraisal", "owner"]).default("estimate"),
  rehab: optInt,
  monthlyRent: optInt,
  loanPayoffOverride: optInt.optional(),
});

export async function saveAnalysisAction(propertyId: string, input: Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const v = analysisInputSchema.parse(input);
    const { values: a } = await getAssumptions();
    const result = analyzeBrrrr(
      { purchasePrice: v.purchasePrice, arv: v.arv, rehab: v.rehab, monthlyRent: v.monthlyRent, loanPayoffOverride: v.loanPayoffOverride ?? null },
      a,
    );
    const [lead] = await db.select().from(leads).where(eq(leads.propertyId, propertyId)).orderBy(desc(leads.updatedAt)).limit(1);
    await db.insert(analyses).values({
      propertyId, leadId: lead?.id ?? null, strategy: "brrrr", engineVersion: ENGINE_VERSION,
      arv: v.arv, arvSource: v.arvSource, rehab: v.rehab, monthlyRent: v.monthlyRent, purchasePrice: v.purchasePrice,
      inputs: { ...v, assumptions: a }, outputs: result,
      maxAllowableOffer: result.maxAllowableOffer, dealScore: result.dealScore, verdict: result.verdict, createdBy: user.id,
    });
    await db.insert(activities).values({
      propertyId, leadId: lead?.id ?? null, type: "analysis", actorUserId: user.id,
      title: `Underwriting saved · ${result.verdict.toUpperCase()}`,
      body: result.maxAllowableOffer != null ? `MAO $${result.maxAllowableOffer.toLocaleString("en-US")} · score ${result.dealScore}` : result.verdictReasons.join("; "),
    });
    await audit(user.id, "analyze", "property", propertyId, { mao: result.maxAllowableOffer, verdict: result.verdict });
    revalidatePath("/", "layout");
    return { ok: true, message: "Analysis saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveAssumptionsAction(values: unknown, note?: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["owner"]);
    const v = assumptionsSchema.parse(values);
    await db.insert(assumptionSets).values({ values: v, note: note ?? null, createdBy: user.id });
    await audit(user.id, "update", "assumptions", null, v as unknown as Record<string, unknown>);
    revalidatePath("/", "layout");
    return { ok: true, message: "Assumptions saved. New analyses will use them." };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────── Offers (approval gate) ───────────────────────── */

export async function decideOfferAction(offerId: string, decision: "approve" | "reject"): Promise<ActionResult> {
  try {
    const user = await requireRole(["owner"]);
    const [o] = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
    if (!o) return { ok: false, error: "Offer not found" };
    if (o.status !== "pending_approval") return { ok: false, error: "Offer is not awaiting approval" };
    const status = decision === "approve" ? "approved" : "rejected";
    const [lead] = await db.select().from(leads).where(eq(leads.id, o.leadId));
    await db.transaction(async (tx) => {
      await tx
        .update(offers)
        .set({ status, approvedBy: decision === "approve" ? user.id : null, approvedAt: decision === "approve" ? new Date() : null, updatedAt: new Date() })
        .where(eq(offers.id, offerId));
      await tx.insert(activities).values({
        leadId: o.leadId, propertyId: lead?.propertyId, type: "offer", actorUserId: user.id,
        title: `Offer $${o.amount.toLocaleString("en-US")} ${status} by owner`,
        body: decision === "approve" ? "Approved internally. Not sent — document generation and e-sign arrive in Phase 6." : null,
      });
    });
    await audit(user.id, `offer_${status}`, "offer", offerId, { amount: o.amount });
    revalidatePath("/", "layout");
    return { ok: true, message: decision === "approve" ? "Offer approved (not sent)" : "Offer rejected" };
  } catch (e) {
    return fail(e);
  }
}

export async function requestOfferApprovalAction(leadId: string, amount: number, rationale: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const amt = z.number().int().positive().parse(amount);
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    if (!lead) return { ok: false, error: "Lead not found" };
    const [an] = await db.select().from(analyses).where(eq(analyses.propertyId, lead.propertyId)).orderBy(desc(analyses.createdAt)).limit(1);
    if (!an || an.maxAllowableOffer == null) return { ok: false, error: "Save a complete underwriting analysis before requesting an offer" };
    await db.insert(offers).values({
      leadId, analysisId: an.id, amount: amt, maxAllowableOffer: an.maxAllowableOffer, status: "pending_approval",
      rationale: z.string().max(2000).parse(rationale), requestedBy: user.id,
    });
    await db.insert(activities).values({
      leadId, propertyId: lead.propertyId, type: "offer", actorUserId: user.id,
      title: `Offer $${amt.toLocaleString("en-US")} submitted for owner approval`,
      body: amt > an.maxAllowableOffer ? `Exceeds MAO by $${(amt - an.maxAllowableOffer).toLocaleString("en-US")}` : null,
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Sent for owner approval" };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────── Saved views ───────────────────────── */

export async function saveViewAction(entity: "leads" | "properties", name: string, query: Record<string, string>): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db.insert(savedViews).values({ userId: user.id, entity, name: z.string().trim().min(1).max(60).parse(name), query });
    revalidatePath(`/${entity}`);
    return { ok: true, message: "View saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteViewAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db.delete(savedViews).where(and(eq(savedViews.id, id), eq(savedViews.userId, user.id)));
    revalidatePath("/leads");
    return { ok: true, message: "View deleted" };
  } catch (e) {
    return fail(e);
  }
}
