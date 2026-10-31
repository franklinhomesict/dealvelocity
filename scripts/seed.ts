/**
 * Development seed. Every record is flagged is_sample=true and the UI labels
 * it "Sample". Seller names are fictional and phone numbers use the reserved
 * 555-01xx range. Never run against production.
 */
import "./env";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as s from "../src/db/schema";
import { analyzeBrrrr, ENGINE_VERSION } from "../src/lib/underwriting/engine";
import { DEFAULT_ASSUMPTIONS } from "../src/lib/underwriting/assumptions";
import { normalizeAddress } from "../src/lib/format";

if (process.env.NODE_ENV === "production" || process.env.ALLOW_SAMPLE_DATA !== "true") {
  throw new Error("Sample data is disabled. Set ALLOW_SAMPLE_DATA=true in a non-production environment.");
}

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema: s });

const DAY = 864e5;
const ago = (d: number, h = 0) => new Date(Date.now() - d * DAY - h * 36e5);
const ahead = (d: number) => new Date(Date.now() + (d === 0 ? 0.25 : d) * DAY);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

type Seed = {
  street: string; zip: string; type?: (typeof s.propertyType.enumValues)[number]; beds: number; baths: number; sqft: number; year: number;
  occ: (typeof s.occupancyStatus.enumValues)[number]; cond: (typeof s.conditionRating.enumValues)[number];
  seller: string; rel?: string; stage: s.LeadStage; temp: "hot" | "warm" | "cold"; daysInStage: number; age: number;
  asking: number | null; arv: number | null; rehab: number | null; rent: number | null;
  motivation?: string; mscore?: number; timeline?: string; next?: string; nextIn?: number; callback?: boolean; human?: boolean;
  source?: string; condition?: string; flex?: string; title?: string; balance?: number;
};

const seeds: Seed[] = [
  { street: "1418 S Seneca St", zip: "67213", beds: 3, baths: 1, sqft: 1124, year: 1948, occ: "vacant", cond: "moderate", seller: "Darlene Whitaker", rel: "Heir", stage: "negotiating", temp: "hot", daysInStage: 3, age: 21, asking: 72000, arv: 148000, rehab: 34000, rent: 1325, motivation: "Inherited from mother; lives in Denver and wants it handled before winter", mscore: 5, timeline: "Within 30 days", next: "Counter at $64,500", nextIn: 0, flex: "Said 'make me an offer I can take to my brother'", title: "Probate opened Aug; letters testamentary issued" },
  { street: "2231 N Volutsia Ave", zip: "67214", beds: 2, baths: 1, sqft: 912, year: 1925, occ: "tenant_occupied", cond: "light", seller: "Marcus Bell", stage: "offer", temp: "hot", daysInStage: 2, age: 12, asking: 58000, arv: 118000, rehab: 19000, rent: 1050, motivation: "Tired landlord, tenant 2 months behind", mscore: 4, timeline: "60 days", next: "Owner approval on $55,000 offer", nextIn: 0 },
  { street: "3305 E Lincoln St", zip: "67218", beds: 3, baths: 1.5, sqft: 1302, year: 1955, occ: "owner_occupied", cond: "moderate", seller: "Patricia Ochoa", stage: "under_contract", temp: "hot", daysInStage: 9, age: 40, asking: 79000, arv: 162000, rehab: 38000, rent: 1450, motivation: "Relocating to Kansas City for work", mscore: 4, timeline: "Close by Nov 20", next: "Schedule inspection", nextIn: 1 },
  { street: "915 N Grove St", zip: "67214", beds: 3, baths: 1, sqft: 1040, year: 1942, occ: "vacant", cond: "heavy", seller: "Leonard Haskins", stage: "underwriting", temp: "warm", daysInStage: 4, age: 9, asking: 45000, arv: 128000, rehab: 52000, rent: 1150, motivation: "Code violations, city deadline in December", mscore: 5, timeline: "ASAP", next: "Get contractor bid on foundation", nextIn: 2, condition: "Foundation crack NE corner, roof 20+ yrs, no HVAC" },
  { street: "4410 S Laura Ave", zip: "67216", beds: 3, baths: 2, sqft: 1380, year: 1961, occ: "owner_occupied", cond: "light", seller: "Gloria Reyes", stage: "qualified", temp: "warm", daysInStage: 5, age: 14, asking: 98000, arv: 168000, rehab: 22000, rent: 1495, motivation: "Downsizing after retirement", mscore: 3, timeline: "3–4 months", next: "Walkthrough Thursday 2pm", nextIn: 2 },
  { street: "1702 W 13th St N", zip: "67203", beds: 2, baths: 1, sqft: 860, year: 1930, occ: "tenant_occupied", cond: "moderate", seller: "Harold Jennings", stage: "contacting", temp: "warm", daysInStage: 6, age: 8, asking: null, arv: 112000, rehab: 26000, rent: 995, next: "Second call attempt", nextIn: -1, callback: true },
  { street: "2627 S Hydraulic Ave", zip: "67216", beds: 3, baths: 1, sqft: 1150, year: 1950, occ: "vacant", cond: "moderate", seller: "Wendell Pratt", stage: "new", temp: "warm", daysInStage: 1, age: 1, asking: null, arv: null, rehab: null, rent: null, source: "dealmachine", next: "Make first contact", nextIn: 0 },
  { street: "1036 N Oliver Ave", zip: "67208", beds: 3, baths: 1.5, sqft: 1268, year: 1952, occ: "owner_occupied", cond: "light", seller: "Beverly Strand", stage: "new", temp: "cold", daysInStage: 0, age: 0, asking: 115000, arv: 172000, rehab: 18000, rent: 1450, source: "referral", next: "Make first contact", nextIn: 1 },
  { street: "3819 E Harry St", zip: "67218", beds: 2, baths: 1, sqft: 940, year: 1949, occ: "tenant_occupied", cond: "light", seller: "Ray Castellano", stage: "contacting", temp: "cold", daysInStage: 8, age: 15, asking: 85000, arv: 125000, rehab: 15000, rent: 1095, next: "Text follow-up (consent on file)", nextIn: 1 },
  { street: "521 S Pinecrest Ave", zip: "67218", beds: 3, baths: 1, sqft: 1080, year: 1954, occ: "vacant", cond: "moderate", seller: "Elaine Duvall", rel: "Executor", stage: "underwriting", temp: "hot", daysInStage: 1, age: 6, asking: 55000, arv: 145000, rehab: 31000, rent: 1350, motivation: "Estate sale, three heirs agree to sell", mscore: 5, timeline: "45 days", next: "Finish comps", nextIn: 1, human: true },
  { street: "2944 N Arkansas Ave", zip: "67204", beds: 3, baths: 1, sqft: 1012, year: 1928, occ: "owner_occupied", cond: "heavy", seller: "Tommy Nguyen", stage: "dead", temp: "cold", daysInStage: 12, age: 30, asking: 110000, arv: 118000, rehab: 48000, rent: 1050, motivation: "Testing the market" },
  { street: "1125 S Elizabeth St", zip: "67213", beds: 2, baths: 1, sqft: 820, year: 1925, occ: "vacant", cond: "moderate", seller: "Agnes Feller", stage: "closed", temp: "warm", daysInStage: 4, age: 75, asking: 49000, arv: 109000, rehab: 24000, rent: 975 },
  { street: "4120 W Maple St", zip: "67209", beds: 3, baths: 2, sqft: 1420, year: 1964, occ: "tenant_occupied", cond: "light", seller: "Curtis Mabry", stage: "negotiating", temp: "warm", daysInStage: 9, age: 33, asking: 128000, arv: 176000, rehab: 16000, rent: 1550, motivation: "Moving to assisted living", mscore: 3, timeline: "Flexible", next: "Seller reviewing $98k", nextIn: -2, flex: "Firm on price for now" },
  { street: "1815 S Water St", zip: "67213", type: "duplex", beds: 4, baths: 2, sqft: 1680, year: 1938, occ: "tenant_occupied", cond: "moderate", seller: "Ronald Kimes", stage: "qualified", temp: "hot", daysInStage: 2, age: 7, asking: 84000, arv: 205000, rehab: 41000, rent: 1900, motivation: "Partner buyout dispute", mscore: 4, timeline: "60 days", next: "Request rent rolls + leases", nextIn: 1 },
  { street: "2518 E Pawnee St", zip: "67211", beds: 3, baths: 1, sqft: 1096, year: 1953, occ: "vacant", cond: "moderate", seller: "Shirley Polk", stage: "offer", temp: "warm", daysInStage: 6, age: 19, asking: 99000, arv: 139000, rehab: 29000, rent: 1250, motivation: "Behind on taxes", mscore: 4, timeline: "30–60 days", next: "Follow up on offer", nextIn: -1, balance: 22000 },
  { street: "711 N Waco Ave", zip: "67203", beds: 2, baths: 1, sqft: 900, year: 1915, occ: "unknown", cond: "unknown", seller: "Dale Ritter", stage: "contacting", temp: "warm", daysInStage: 3, age: 4, asking: null, arv: null, rehab: null, rent: null, source: "dealmachine", next: "Call — voicemail left", nextIn: 0 },
  { street: "3022 S Meridian Ave", zip: "67217", beds: 3, baths: 1, sqft: 1060, year: 1956, occ: "owner_occupied", cond: "light", seller: "Norma Fitch", stage: "new", temp: "warm", daysInStage: 3, age: 3, asking: 64000, arv: 138000, rehab: 17000, rent: 1250, source: "inbound_call", next: "Make first contact", nextIn: -1, callback: true },
  { street: "1349 N Hillside St", zip: "67214", beds: 4, baths: 2, sqft: 1560, year: 1922, occ: "tenant_occupied", cond: "moderate", seller: "Victor Lindqvist", stage: "underwriting", temp: "warm", daysInStage: 6, age: 16, asking: 118000, arv: null, rehab: 36000, rent: 1600, motivation: "Portfolio sale (3 doors)", mscore: 3, timeline: "Q1", next: "Pull comps for ARV", nextIn: 0 },
  { street: "805 S Broadway Ave", zip: "67211", type: "triplex", beds: 6, baths: 3, sqft: 2240, year: 1910, occ: "tenant_occupied", cond: "moderate", seller: "Imogene Barlow", stage: "under_contract", temp: "hot", daysInStage: 14, age: 52, asking: 165000, arv: 285000, rehab: 52000, rent: 2650, motivation: "Retiring from landlording", mscore: 4, timeline: "Close Dec 5", next: "Lender appraisal ordered", nextIn: 3 },
  { street: "2210 E Kinkaid St", zip: "67211", beds: 2, baths: 1, sqft: 880, year: 1947, occ: "vacant", cond: "heavy", seller: "Frank Odom", stage: "new", temp: "cold", daysInStage: 0, age: 0, asking: null, arv: null, rehab: null, rent: null, source: "dealmachine", next: "Make first contact", nextIn: 1 },
  { street: "4515 E Funston St", zip: "67218", beds: 3, baths: 1.5, sqft: 1210, year: 1958, occ: "owner_occupied", cond: "light", seller: "Lorraine Becker", stage: "contacting", temp: "hot", daysInStage: 2, age: 5, asking: 69000, arv: 152000, rehab: 21000, rent: 1395, motivation: "Divorce — both parties want quick sale", mscore: 5, timeline: "ASAP", next: "Get both signatures on intent", nextIn: 1 },
  { street: "1623 S Market St", zip: "67211", beds: 2, baths: 1, sqft: 836, year: 1920, occ: "vacant", cond: "teardown", seller: "Eugene Sharp", stage: "dead", temp: "cold", daysInStage: 20, age: 41, asking: 30000, arv: 70000, rehab: 60000, rent: 800 },
  { street: "3711 W 2nd St N", zip: "67203", beds: 3, baths: 1, sqft: 1045, year: 1951, occ: "tenant_occupied", cond: "light", seller: "Sylvia Marsh", stage: "qualified", temp: "warm", daysInStage: 7, age: 18, asking: 88000, arv: 140000, rehab: 18000, rent: 1295, motivation: "Moving in with daughter", mscore: 3, timeline: "90 days", next: "Send intro letter", nextIn: 3 },
  { street: "1938 N Estelle St", zip: "67214", beds: 3, baths: 1, sqft: 1098, year: 1940, occ: "vacant", cond: "moderate", seller: "Arthur Penn", stage: "closed", temp: "warm", daysInStage: 10, age: 90, asking: 55000, arv: 132000, rehab: 30000, rent: 1200 },
];

async function main() {
  // Owner account
  const email = (process.env.SEED_OWNER_EMAIL ?? "owner@homebuyersict.test").toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "acquisition-os-dev";
  let [owner] = await db.select().from(s.users).where(eq(s.users.email, email));
  if (!owner) {
    [owner] = await db
      .insert(s.users)
      .values({ email, name: process.env.SEED_OWNER_NAME ?? "Ian Franklin", passwordHash: await bcrypt.hash(password, 12), role: "owner" })
      .returning();
    console.log(`✓ owner created: ${email} / ${password}`);
  }
  const [acq] = await db
    .insert(s.users)
    .values({ email: "acquisitions@homebuyersict.test", name: "Jordan Lee (sample)", passwordHash: await bcrypt.hash(password, 12), role: "acquisitions" })
    .onConflictDoNothing()
    .returning();

  // Assumptions
  const existing = await db.select().from(s.assumptionSets).limit(1);
  if (!existing.length) await db.insert(s.assumptionSets).values({ values: DEFAULT_ASSUMPTIONS, note: "Initial defaults", createdBy: owner.id });

  // Clear old sample data
  await db.delete(s.offers).where(eq(s.offers.isSample, true));
  await db.delete(s.transactions).where(eq(s.transactions.isSample, true));
  await db.delete(s.tasks).where(eq(s.tasks.isSample, true));
  await db.delete(s.activities).where(eq(s.activities.isSample, true));
  await db.delete(s.analyses).where(eq(s.analyses.isSample, true));
  await db.delete(s.leads).where(eq(s.leads.isSample, true));
  await db.delete(s.contacts).where(eq(s.contacts.isSample, true));
  await db.delete(s.properties).where(eq(s.properties.isSample, true));

  let phoneN = 100;
  for (const d of seeds) {
    const created = ago(d.age, 3);
    const stageAt = ago(d.daysInStage, 2);
    const [p] = await db
      .insert(s.properties)
      .values({
        street: d.street, city: "Wichita", state: "KS", zip: d.zip, county: "Sedgwick",
        propertyType: d.type ?? "single_family", beds: d.beds, baths: String(d.baths), sqft: d.sqft, yearBuilt: d.year,
        units: d.type === "duplex" ? 2 : d.type === "triplex" ? 3 : 1,
        occupancy: d.occ, condition: d.cond, ownerName: d.seller,
        assessedValue: d.arv ? Math.round((d.arv * 0.62) / 100) * 100 : null,
        lastSalePrice: d.arv ? Math.round((d.arv * 0.38) / 500) * 500 : null,
        lastSaleDate: d.arv ? `${2000 + (d.year % 20)}-0${1 + (d.sqft % 9)}-15` : null,
        estimatedValue: d.arv ? Math.round((d.arv * 0.7) / 1000) * 1000 : null,
        dataSource: "sample", normalizedAddress: normalizeAddress(d.street, "Wichita", "KS", d.zip),
        isSample: true, createdAt: created, updatedAt: stageAt,
      })
      .returning();
    const [first, ...rest] = d.seller.split(" ");
    const [c] = await db
      .insert(s.contacts)
      .values({
        fullName: d.seller, firstName: first, lastName: rest.join(" "), phone: `(316) 555-0${phoneN}`, phoneE164: `+13165550${phoneN++}`,
        relationship: d.rel ?? "Owner", smsConsent: d.stage === "contacting" || d.stage === "new" ? "unknown" : "granted",
        smsConsentAt: d.stage === "contacting" || d.stage === "new" ? null : created, smsConsentSource: "Seller opted in on inbound call (sample)",
        isSample: true, createdAt: created,
      })
      .returning();
    const [l] = await db
      .insert(s.leads)
      .values({
        propertyId: p.id, contactId: c.id, ownerUserId: owner.id, stage: d.stage, stageChangedAt: stageAt, temperature: d.temp,
        source: d.source ?? "manual", motivation: d.motivation ?? null, motivationScore: d.mscore ?? null, timeline: d.timeline ?? null,
        askingPrice: d.asking, priceFlexibility: d.flex ?? null, conditionNotes: d.condition ?? null, titleConcerns: d.title ?? null,
        mortgageBalance: d.balance ?? null, openToCashOffer: d.stage === "new" ? null : true,
        qualificationSummary: d.mscore
          ? `Seller (${d.rel ?? "owner"}) motivated: ${d.motivation?.toLowerCase()}. Timeline ${d.timeline?.toLowerCase()}. ${d.occ === "vacant" ? "Property vacant." : d.occ === "tenant_occupied" ? "Tenant in place." : "Owner occupied."} Open to as-is cash offer.`
          : null,
        nextAction: d.next ?? null, nextActionDueAt: d.nextIn != null ? ahead(d.nextIn) : null,
        callbackRequested: !!d.callback, needsHuman: !!d.human,
        closedAt: d.stage === "closed" ? stageAt : null, lostReason: d.stage === "dead" ? "Price expectations above market" : null,
        isSample: true, createdAt: created, updatedAt: stageAt,
      })
      .returning();

    // Timeline
    const acts: (typeof s.activities.$inferInsert)[] = [
      { type: "system", title: "Lead created", body: `Source: ${d.source ?? "manual"}`, occurredAt: created, actorUserId: owner.id },
    ];
    if (!["new"].includes(d.stage)) {
      acts.push({ type: "call", title: "Outbound call · 6 min", body: `Spoke with ${first}. ${d.motivation ?? "Gathering details."}`, occurredAt: ago(d.age - 0.2), actorUserId: owner.id, metadata: { direction: "outbound", durationSec: 372 } });
      if (d.timeline) acts.push({ type: "sms", title: "SMS from seller", body: `Thanks for calling. ${d.timeline} works for us.`, occurredAt: ago(Math.max(d.age - 1, 0.5)), actorLabel: d.seller, metadata: { direction: "inbound" } });
    }
    if (d.human) acts.push({ type: "sms", title: "Seller asked to speak with a person", body: "Can someone call me? I have questions about the probate timeline.", occurredAt: ago(0, 3), actorLabel: d.seller, metadata: { direction: "inbound" } });
    if (d.callback) acts.push({ type: "call", title: "Missed inbound call · voicemail", body: "Seller left voicemail requesting a callback this afternoon.", occurredAt: ago(0, 5), actorLabel: d.seller, metadata: { direction: "inbound", missed: true } });
    acts.push({ type: "stage_change", title: `Moved to ${d.stage.replace("_", " ")}`, occurredAt: stageAt, actorUserId: owner.id, metadata: { to: d.stage } });
    if (d.condition) acts.push({ type: "note", title: "Walkthrough notes", body: d.condition, occurredAt: ago(Math.max(d.daysInStage - 0.5, 0.2)), actorUserId: owner.id });
    await db.insert(s.activities).values(acts.map((a) => ({ ...a, leadId: l.id, propertyId: p.id, isSample: true })));

    // Underwriting
    let mao: number | null = null;
    let anId: string | null = null;
    if (d.arv || d.rehab || d.rent) {
      const r = analyzeBrrrr({ purchasePrice: d.asking, arv: d.arv, rehab: d.rehab, monthlyRent: d.rent }, DEFAULT_ASSUMPTIONS);
      mao = r.maxAllowableOffer;
      const anAt = ago(Math.max(d.daysInStage - 0.3, 0.1));
      const [an] = await db
        .insert(s.analyses)
        .values({
          propertyId: p.id, leadId: l.id, engineVersion: ENGINE_VERSION, arv: d.arv, arvSource: "estimate", rehab: d.rehab, monthlyRent: d.rent,
          purchasePrice: d.asking, inputs: { purchasePrice: d.asking, arv: d.arv, rehab: d.rehab, monthlyRent: d.rent, assumptions: DEFAULT_ASSUMPTIONS },
          outputs: r, maxAllowableOffer: r.maxAllowableOffer, dealScore: r.dealScore, verdict: r.verdict, createdBy: owner.id, isSample: true, createdAt: anAt,
        })
        .returning();
      anId = an.id;
      await db.insert(s.activities).values({
        leadId: l.id, propertyId: p.id, type: "analysis", title: `Underwriting saved · ${r.verdict.toUpperCase()}`,
        body: r.maxAllowableOffer != null ? `MAO $${r.maxAllowableOffer.toLocaleString("en-US")} · score ${r.dealScore}` : r.verdictReasons.join("; "),
        occurredAt: anAt, actorUserId: owner.id, isSample: true,
      });
    }

    // Tasks
    if (d.next && d.nextIn != null && !["closed", "dead"].includes(d.stage)) {
      await db.insert(s.tasks).values({ leadId: l.id, title: d.next, dueAt: ahead(d.nextIn), assigneeUserId: owner.id, isSample: true, kind: d.callback ? "callback" : "follow_up" });
    }

    // Offers + transactions
    const offerAt = ago(Math.max(d.daysInStage - 0.1, 0.05));
    if (d.stage === "offer" && mao) {
      const amount = Math.floor((mao * 0.92) / 500) * 500;
      await db.insert(s.offers).values({
        leadId: l.id, analysisId: anId, amount, maxAllowableOffer: mao,
        status: d.street.startsWith("2231") ? "pending_approval" : "sent",
        rationale: `Opening at ~92% of MAO $${mao.toLocaleString("en-US")}; ${d.occ === "tenant_occupied" ? "tenant in place, delinquent" : "vacant"}.`,
        requestedBy: acq?.id ?? owner.id, approvedBy: d.street.startsWith("2231") ? null : owner.id, approvedAt: d.street.startsWith("2231") ? null : offerAt,
        isSample: true, createdAt: offerAt,
      });
    }
    if (d.stage === "negotiating" && mao) {
      await db.insert(s.offers).values({ leadId: l.id, analysisId: anId, amount: Math.floor((mao * 0.9) / 500) * 500, maxAllowableOffer: mao, status: "countered", approvedBy: owner.id, approvedAt: offerAt, isSample: true, createdAt: offerAt });
    }
    if (d.stage === "under_contract" || d.stage === "closed") {
      const price = Math.min(d.asking ?? Infinity, mao ?? Infinity);
      const contractPrice = Number.isFinite(price) ? Math.floor(price / 500) * 500 : d.asking!;
      await db.insert(s.offers).values({ leadId: l.id, analysisId: anId, amount: contractPrice, maxAllowableOffer: mao, status: "accepted", approvedBy: owner.id, approvedAt: offerAt, isSample: true, createdAt: offerAt });
      const eff = ago(d.daysInStage);
      const closing = d.stage === "closed" ? ago(d.daysInStage - 0.5) : d.street.startsWith("3305") ? ahead(16) : ahead(30);
      await db.insert(s.transactions).values({
        leadId: l.id, status: d.stage === "closed" ? "closed" : "open", contractPrice,
        effectiveDate: isoDate(eff), earnestMoneyDue: isoDate(new Date(eff.getTime() + 3 * DAY)),
        inspectionDeadline: isoDate(d.street.startsWith("3305") ? ahead(2) : new Date(eff.getTime() + 10 * DAY)),
        closingDate: isoDate(d.stage === "closed" && d.street.startsWith("1125") ? ago(2) : closing),
        titleCompany: "Sample Title Co.", isSample: true,
      });
    }
  }
  console.log(`✓ seeded ${seeds.length} sample leads`);
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
