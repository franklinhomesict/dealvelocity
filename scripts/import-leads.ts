/**
 * Imports a reviewed batch of DealMachine records as leads.
 *
 *   npx tsx scripts/import-leads.ts data/private/<file>.json
 *
 * Input: { leads: [{ profile: "pershing" | "prescott", record: <DealMachine property record> }] }
 *
 * - Idempotent: properties dedupe on DealMachine ID, then normalized address;
 *   an existing lead or screening analysis is never duplicated.
 * - Each lead gets a SCREENING analysis using the profile's rent ratio and an
 *   assumed $15K light rehab, clearly labeled as unverified.
 * - Nothing contacts anyone. Lead data files live in data/private (gitignored).
 */
import "./env";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, desc, eq, or, sql } from "drizzle-orm";
import * as s from "../src/db/schema";
import { mapDmProperty, propertyPatch, DISTRESS_LABELS } from "../src/lib/dealmachine/mapper";
import { normalizeAddress } from "../src/lib/format";
import { analyzeBrrrr, ENGINE_VERSION } from "../src/lib/underwriting/engine";
import { resolveAssumptions } from "../src/lib/underwriting/assumptions";
import type { DmProperty } from "../src/lib/dealmachine/client";

/** Benchmarks from the owner's own rentals. */
const PROFILES = {
  pershing: { label: "906 N Pershing St", rentPct: 0.011, rehab: 15000 },
  prescott: { label: "1914 S Prescott Cir", rentPct: 0.0079, rehab: 15000 },
} as const;

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/import-leads.ts <file.json>");
  process.exit(1);
}
const input = JSON.parse(readFileSync(file, "utf8")) as { leads: { profile: keyof typeof PROFILES; record: DmProperty }[] };

const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema: s });

const titleCase = (t: string) => t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Ne|Nw|Se|Sw)\b/g, (m) => m.toUpperCase());
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

async function main() {
  const [owner] = await db.select().from(s.users).where(eq(s.users.role, "owner")).limit(1);
  const [aset] = await db.select().from(s.assumptionSets).orderBy(desc(s.assumptionSets.createdAt)).limit(1);
  const a = resolveAssumptions(aset?.values);
  let created = 0, merged = 0, leadsCreated = 0, analyses = 0;

  for (const { profile, record } of input.leads) {
    const p = PROFILES[profile];
    const rec = { ...record, address: titleCase(String(record.address)), city: titleCase(String(record.city)) };
    const m = mapDmProperty(rec);
    const normalized = normalizeAddress(m.street, m.city, m.state, m.zip);
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(s.properties)
        .where(or(and(eq(s.properties.dataSource, "dealmachine"), eq(s.properties.sourceRef, m.sourceRef)), eq(s.properties.normalizedAddress, normalized)))
        .limit(1);
      let propertyId: string;
      if (existing) {
        await tx
          .update(s.properties)
          .set({ ...propertyPatch(m, existing as unknown as Record<string, unknown>, existing.dataSource === "dealmachine"), sourcePayload: rec, sourceSyncedAt: now, sourceEnrichedAt: now, updatedAt: now })
          .where(eq(s.properties.id, existing.id));
        propertyId = existing.id;
        merged++;
      } else {
        const [row] = await tx
          .insert(s.properties)
          .values({
            street: m.street, city: m.city, state: m.state, zip: m.zip, normalizedAddress: normalized,
            ...(propertyPatch(m, null, true) as object),
            dataSource: "dealmachine", sourceRef: m.sourceRef, sourcePayload: rec, sourceSyncedAt: now, sourceEnrichedAt: now,
          })
          .returning({ id: s.properties.id });
        propertyId = row.id;
        created++;
      }

      let [lead] = await tx.select().from(s.leads).where(eq(s.leads.propertyId, propertyId)).limit(1);
      const signals = m.distressFlags.map((f) => DISTRESS_LABELS[f] ?? f);
      if (!lead) {
        const strong = m.distressFlags.filter((f) => ["vacant", "tax_delinquent", "probate", "preforeclosure"].includes(f)).length;
        [lead] = await tx
          .insert(s.leads)
          .values({
            propertyId, source: "dealmachine", ownerUserId: owner?.id ?? null,
            temperature: strong >= 2 ? "warm" : "cold",
            motivation: signals.length ? `DealMachine signals: ${signals.join(", ")}` : null,
            nextAction: "Drive by and verify rent comps",
            nextActionDueAt: new Date(Date.now() + 3 * 864e5),
          })
          .returning();
        await tx.insert(s.activities).values({
          propertyId, leadId: lead.id, type: "system", actorLabel: "DealMachine import",
          title: `Imported from DealMachine · lookalike of ${p.label}`,
          body: [signals.length ? `Signals: ${signals.join(", ")}` : null, m.estimatedValue ? `DealMachine est. value ${usd(m.estimatedValue)}` : null].filter(Boolean).join(" · "),
          metadata: { sourceRef: m.sourceRef, profile },
        });
        leadsCreated++;
      }

      const [hasScreening] = await tx
        .select({ id: s.analyses.id })
        .from(s.analyses)
        .where(and(eq(s.analyses.propertyId, propertyId), sql`${s.analyses.inputs}->>'screening' = 'true'`))
        .limit(1);
      if (!hasScreening && m.estimatedValue) {
        const arv = m.estimatedValue;
        const rent = Math.round((arv * p.rentPct) / 25) * 25;
        const r = analyzeBrrrr({ purchasePrice: null, arv, rehab: p.rehab, monthlyRent: rent }, a);
        await tx.insert(s.analyses).values({
          propertyId, leadId: lead.id, engineVersion: ENGINE_VERSION, arv, arvSource: "estimate", rehab: p.rehab, monthlyRent: rent, purchasePrice: null,
          inputs: { screening: true, profile, purchasePrice: null, arv, rehab: p.rehab, monthlyRent: rent, assumptions: a },
          outputs: r, maxAllowableOffer: r.maxAllowableOffer, dealScore: r.dealScore, verdict: r.verdict, createdBy: owner?.id ?? null,
        });
        await tx.insert(s.activities).values({
          propertyId, leadId: lead.id, type: "analysis", actorLabel: "DealMachine import",
          title: `Screening analysis · max offer ${r.maxAllowableOffer != null ? usd(r.maxAllowableOffer) : "—"} (unverified)`,
          body: `Assumes ARV = DealMachine estimate ${usd(arv)}, rent ${usd(rent)}/mo (${(p.rentPct * 100).toFixed(2)}% of value, like ${p.label}) and $15K light rehab. DealMachine's modeled repair cost is ${m.estimatedRepairCost ? usd(m.estimatedRepairCost) : "—"}. Verify condition, rent comps and sold comps before any offer.`,
        });
        analyses++;
        return `${m.street.padEnd(24)} ${profile.padEnd(9)} ARV ${usd(arv).padStart(9)} rent ${usd(rent).padStart(7)} max offer ${r.maxAllowableOffer != null ? usd(r.maxAllowableOffer) : "—"}`;
      }
      return `${m.street.padEnd(24)} ${profile.padEnd(9)} (already imported)`;
    });
    console.log(result);
  }
  console.log(`\n✓ ${created} properties created, ${merged} merged, ${leadsCreated} leads created, ${analyses} screening analyses`);
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
