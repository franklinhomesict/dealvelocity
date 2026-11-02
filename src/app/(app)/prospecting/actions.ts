"use server";

import { z } from "zod";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  approveJob, cancelJob, createListJob, dmClient, enrichProperty, estimateSearchJob, fetchComps, getUsage,
  runJobSlice, saveCreditSettings, setCompExcluded,
} from "@/lib/dealmachine/service";
import { buildFilters, SIGNALS, TYPES } from "@/lib/dealmachine/presets";
import type { ActionResult } from "@/app/actions";

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : e instanceof Error ? e.message : "Something went wrong",
});
const WRITE = ["owner", "acquisitions"] as const;

/** Runs job slices after the response is sent, chaining until done or paused. */
function continueInBackground(jobId: string, userId: string) {
  after(async () => {
    for (let i = 0; i < 20; i++) if (!(await runJobSlice(jobId, userId))) break;
  });
}

const searchSchema = z.object({
  name: z.string().trim().min(1, "Name the import").max(80),
  zips: z.array(z.string().regex(/^\d{5}$/, "ZIP codes must be 5 digits")).min(1, "Add at least one ZIP code").max(25),
  signals: z.array(z.enum(SIGNALS.map((s) => s.id) as [string, ...string[]])).max(8),
  types: z.array(z.enum(TYPES.map((t) => t.id) as [string, ...string[]])),
  maxRecords: z.number().int().min(1).max(1000),
});

export async function estimateSearchAction(input: unknown): Promise<ActionResult<{ jobId: string }>> {
  try {
    const user = await requireRole([...WRITE]);
    const v = searchSchema.parse(input);
    const job = await estimateSearchJob(
      v.name,
      { locations: v.zips.map((code) => ({ type: "zip_code" as const, code })), filters: buildFilters(v.signals, v.types), presets: [...v.signals, ...v.types] },
      v.maxRecords,
      user.id,
    );
    await audit(user.id, "estimate", "import_job", job.id, { matching: job.matchingCount, credits: job.estimatedCredits });
    revalidatePath("/prospecting");
    return { ok: true, data: { jobId: job.id }, message: `${job.matchingCount?.toLocaleString("en-US")} matching · up to ${job.estimatedCredits} credits` };
  } catch (e) {
    return fail(e);
  }
}

export async function listDmListsAction(): Promise<ActionResult<{ id: string; name: string; total: number }[]>> {
  try {
    await requireUser();
    const c = dmClient();
    if (!c) return { ok: false, error: "DealMachine is not connected" };
    const r = await c.lists();
    return { ok: true, data: r.data.map((l) => ({ id: l.list_id, name: l.name, total: l.total_count })) };
  } catch (e) {
    return fail(e);
  }
}

export async function createListJobAction(input: unknown): Promise<ActionResult<{ jobId: string }>> {
  try {
    const user = await requireRole([...WRITE]);
    const v = z.object({ listId: z.string().min(1), listName: z.string().max(200), total: z.number().int().min(0), maxRecords: z.number().int().min(1).max(5000), fetchDetails: z.boolean() }).parse(input);
    const job = await createListJob({ listId: v.listId, listName: v.listName, fetchDetails: v.fetchDetails }, v.total, v.maxRecords, user.id);
    revalidatePath("/prospecting");
    return { ok: true, data: { jobId: job.id }, message: "List import ready — no credits required" };
  } catch (e) {
    return fail(e);
  }
}

export async function approveJobAction(jobId: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE]);
    await approveJob(jobId, user.id, user.role);
    await audit(user.id, "approve", "import_job", jobId);
    continueInBackground(jobId, user.id);
    revalidatePath("/prospecting");
    return { ok: true, message: "Import started" };
  } catch (e) {
    return fail(e);
  }
}

export async function resumeJobAction(jobId: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE]);
    continueInBackground(jobId, user.id);
    revalidatePath("/prospecting");
    return { ok: true, message: "Resuming import" };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelJobAction(jobId: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE]);
    await cancelJob(jobId);
    await audit(user.id, "cancel", "import_job", jobId);
    revalidatePath("/prospecting");
    return { ok: true, message: "Import cancelled" };
  } catch (e) {
    return fail(e);
  }
}

export async function enrichPropertyAction(propertyId: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE]);
    const r = await enrichProperty(propertyId, user.id);
    await audit(user.id, "enrich", "property", propertyId, r);
    revalidatePath(`/properties/${propertyId}`);
    return { ok: true, message: `Enriched${r.credits != null ? ` · ${r.credits} credit${r.credits === 1 ? "" : "s"}` : ""}` };
  } catch (e) {
    return fail(e);
  }
}

export async function fetchCompsAction(propertyId: string): Promise<ActionResult> {
  try {
    const user = await requireRole([...WRITE]);
    const r = await fetchComps(propertyId, user.id);
    await audit(user.id, "comps", "property", propertyId, { count: r.count });
    revalidatePath(`/properties/${propertyId}`);
    return { ok: true, message: `${r.count} comparables loaded` };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleCompAction(propertyId: string, compId: string, excluded: boolean): Promise<ActionResult> {
  try {
    await requireRole([...WRITE]);
    await setCompExcluded(compId, excluded);
    revalidatePath(`/properties/${propertyId}`);
    return { ok: true, message: excluded ? "Comp excluded" : "Comp included" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveCreditSettingsAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["owner"]);
    const v = z.object({ paidEnabled: z.boolean(), monthlyBudget: z.number().int().min(0).max(100_000), maxPerImport: z.number().int().min(1).max(5000) }).parse(input);
    await saveCreditSettings(v, user.id);
    await audit(user.id, "update", "dealmachine_settings", null, v);
    revalidatePath("/", "layout");
    return { ok: true, message: v.paidEnabled ? "Paid requests enabled within budget" : "Paid requests switched off" };
  } catch (e) {
    return fail(e);
  }
}

export async function refreshUsageAction(): Promise<ActionResult> {
  try {
    await requireUser();
    const u = await getUsage(true);
    revalidatePath("/prospecting");
    return u ? { ok: true, message: "Usage refreshed" } : { ok: false, error: "Could not reach DealMachine" };
  } catch (e) {
    return fail(e);
  }
}
