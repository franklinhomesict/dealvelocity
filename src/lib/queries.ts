import "server-only";
import { sql, eq, desc, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  assumptionSets,
  properties,
  leads,
  contacts,
  activities,
  tasks,
  offers,
  transactions,
  analyses,
  users,
  type LeadStage,
} from "@/db/schema";
import { resolveAssumptions, type Assumptions } from "./underwriting/assumptions";
import { ACTIVE_STAGES, STUCK_AFTER_DAYS } from "./domain";
import type { BrrrrResult } from "./underwriting/engine";

export async function getAssumptions(): Promise<{ values: Assumptions; updatedAt: Date | null; id: string | null }> {
  const [row] = await db.select().from(assumptionSets).orderBy(desc(assumptionSets.createdAt)).limit(1);
  return { values: resolveAssumptions(row?.values), updatedAt: row?.createdAt ?? null, id: row?.id ?? null };
}

/* ───────────────────────── Lead rows ───────────────────────── */

export interface LeadRow {
  id: string;
  ref: number;
  stage: LeadStage;
  temperature: "hot" | "warm" | "cold";
  stageChangedAt: string;
  updatedAt: string;
  createdAt: string;
  source: string;
  askingPrice: number | null;
  motivation: string | null;
  motivationScore: number | null;
  timeline: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  callbackRequested: boolean;
  needsHuman: boolean;
  isSample: boolean;
  propertyId: string;
  street: string;
  city: string;
  zip: string;
  propertyType: string;
  beds: number | null;
  baths: string | null;
  sqft: number | null;
  contactId: string | null;
  sellerName: string | null;
  sellerPhone: string | null;
  doNotContact: boolean | null;
  ownerName: string | null;
  arv: number | null;
  rehab: number | null;
  rent: number | null;
  mao: number | null;
  dealScore: number | null;
  verdict: string | null;
  cashFlow: number | null;
  cashLeft: number | null;
}

const leadRowSelect = sql`
  select
    l.id, l.ref, l.stage, l.temperature, l.stage_changed_at as "stageChangedAt", l.updated_at as "updatedAt",
    l.created_at as "createdAt", l.source, l.asking_price as "askingPrice", l.motivation,
    l.motivation_score as "motivationScore", l.timeline, l.next_action as "nextAction",
    l.next_action_due_at as "nextActionDueAt", l.callback_requested as "callbackRequested",
    l.needs_human as "needsHuman", l.is_sample as "isSample",
    p.id as "propertyId", p.street, p.city, p.zip, p.property_type as "propertyType", p.beds, p.baths::text as baths, p.sqft,
    p.owner_name as "ownerName",
    c.id as "contactId", c.full_name as "sellerName", c.phone_e164 as "sellerPhone", c.do_not_contact as "doNotContact",
    a.arv, a.rehab, a.monthly_rent as rent, a.max_allowable_offer as mao, a.deal_score as "dealScore", a.verdict,
    (a.outputs #>> '{primary,monthlyCashFlow}')::float as "cashFlow",
    (a.outputs #>> '{primary,cashRemainingInDeal}')::float as "cashLeft"
  from leads l
  join properties p on p.id = l.property_id
  left join contacts c on c.id = l.contact_id
  left join lateral (
    select * from analyses an where an.property_id = p.id order by an.created_at desc limit 1
  ) a on true
`;

export type LeadSort = "updated" | "score" | "asking" | "mao" | "arv" | "stage" | "address" | "next";

export async function listLeads(opts: {
  q?: string;
  stages?: LeadStage[];
  temperature?: string;
  sort?: LeadSort;
  dir?: "asc" | "desc";
  limit?: number;
}): Promise<LeadRow[]> {
  const where: ReturnType<typeof sql>[] = [];
  if (opts.q) {
    const like = `%${opts.q.trim()}%`;
    where.push(sql`(p.street ilike ${like} or p.city ilike ${like} or p.zip ilike ${like} or c.full_name ilike ${like} or p.owner_name ilike ${like} or l.ref::text = ${opts.q.trim().replace(/^L-?/i, "")})`);
  }
  if (opts.stages?.length) where.push(sql`l.stage in ${sql.raw(`(${opts.stages.map((s) => `'${s.replace(/[^a-z_]/g, "")}'`).join(",")})`)}`);
  if (opts.temperature && ["hot", "warm", "cold"].includes(opts.temperature)) where.push(sql`l.temperature = ${opts.temperature}`);
  const dir = sql.raw(opts.dir === "asc" ? "asc" : "desc");
  const order = {
    updated: sql`l.updated_at ${dir}`,
    score: sql`a.deal_score ${dir} nulls last`,
    asking: sql`l.asking_price ${dir} nulls last`,
    mao: sql`a.max_allowable_offer ${dir} nulls last`,
    arv: sql`a.arv ${dir} nulls last`,
    stage: sql`array_position(enum_range(null::lead_stage), l.stage) ${dir}, l.updated_at desc`,
    address: sql`p.street ${dir}`,
    next: sql`l.next_action_due_at ${dir} nulls last`,
  }[opts.sort ?? "updated"];
  const q = sql`${leadRowSelect} ${where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``} order by ${order} limit ${opts.limit ?? 500}`;
  return (await db.execute(q)) as unknown as LeadRow[];
}

/* ───────────────────────── Dashboard ───────────────────────── */

export interface AttentionItem {
  id: string;
  kind: "callback" | "human" | "overdue" | "ceiling" | "approval" | "deadline" | "opportunity" | "inputs";
  severity: "negative" | "warning" | "positive" | "info";
  title: string;
  detail: string;
  href: string;
  at: string | null;
  action?: { type: "complete_task" | "clear_callback" | "approve_offer"; id: string; label: string };
}

export async function getDashboard() {
  const active = sql.raw(`(${ACTIVE_STAGES.map((s) => `'${s}'`).join(",")})`);
  const [m] = (await db.execute(sql`
    select
      (select count(*) from leads where stage in ${active})::int as "activeLeads",
      (select count(*) from leads where stage in ${active} and created_at > now() - interval '7 days')::int as "newThisWeek",
      (select count(*) from leads where stage in ('qualified','underwriting','offer','negotiating','under_contract'))::int as "qualified",
      (select count(*) from offers where status in ('pending_approval','approved','sent','countered'))::int as "offersOutstanding",
      (select count(*) from offers where status = 'pending_approval')::int as "offersPendingApproval",
      (select coalesce(sum(amount),0) from offers where status in ('approved','sent','countered'))::bigint as "offersValue",
      (select count(*) from leads where stage = 'under_contract')::int as "underContract",
      (select count(*) from transactions where status <> 'cancelled'
         and closing_date >= date_trunc('month', now())::date
         and closing_date < (date_trunc('month', now()) + interval '1 month')::date)::int as "closingsThisMonth",
      (select count(*) from transactions where status = 'closed'
         and closing_date >= date_trunc('month', now())::date)::int as "closedThisMonth"
  `)) as unknown as {
    activeLeads: number;
    newThisWeek: number;
    qualified: number;
    offersOutstanding: number;
    offersPendingApproval: number;
    offersValue: string;
    underContract: number;
    closingsThisMonth: number;
    closedThisMonth: number;
  }[];

  // Pipeline value: contract price when under contract, else min(asking, MAO), else MAO.
  const [pv] = (await db.execute(sql`
    select coalesce(sum(
      case
        when l.stage = 'under_contract' and t.contract_price is not null then t.contract_price
        when l.asking_price is not null and a.max_allowable_offer is not null then least(l.asking_price, a.max_allowable_offer)
        else a.max_allowable_offer
      end), 0)::bigint as value,
      count(a.max_allowable_offer)::int as counted
    from leads l
    left join transactions t on t.lead_id = l.id
    left join lateral (select max_allowable_offer from analyses an where an.property_id = l.property_id order by created_at desc limit 1) a on true
    where l.stage in ('qualified','underwriting','offer','negotiating','under_contract')
  `)) as unknown as { value: string; counted: number }[];

  const funnel = (await db.execute(sql`
    select stage, count(*)::int as count,
      coalesce(percentile_cont(0.5) within group (order by extract(epoch from now() - stage_changed_at) / 86400), 0)::float as "medianDays",
      count(*) filter (where extract(epoch from now() - stage_changed_at) / 86400 > case stage
        ${sql.raw(Object.entries(STUCK_AFTER_DAYS).map(([s, d]) => `when '${s}' then ${d}`).join(" "))} else 100000 end)::int as stuck
    from leads where stage in ${active}
    group by stage
  `)) as unknown as { stage: LeadStage; count: number; medianDays: number; stuck: number }[];

  const recent = await listLeads({ stages: ACTIVE_STAGES, sort: "updated", limit: 8 });
  const attention = await getAttention();

  return {
    metrics: { ...m, offersValue: Number(m.offersValue), pipelineValue: Number(pv.value), pipelineValueCount: pv.counted },
    funnel,
    recent,
    attention,
  };
}

export async function getAttention(): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  const callbacks = (await db.execute(sql`
    select l.id, p.id as pid, p.street, c.full_name as name, l.updated_at as at, l.next_action as na
    from leads l join properties p on p.id = l.property_id left join contacts c on c.id = l.contact_id
    where l.callback_requested and l.stage not in ('closed','dead') order by l.updated_at asc limit 10`)) as unknown as {
    id: string; pid: string; street: string; name: string | null; at: string; na: string | null;
  }[];
  for (const r of callbacks)
    items.push({
      id: `cb-${r.id}`, kind: "callback", severity: "negative",
      title: `${r.name ?? "Seller"} is waiting for a callback`,
      detail: r.street, href: `/properties/${r.pid}`, at: r.at,
      action: { type: "clear_callback", id: r.id, label: "Mark called" },
    });

  const human = (await db.execute(sql`
    select l.id, p.id as pid, p.street, c.full_name as name, l.updated_at as at
    from leads l join properties p on p.id = l.property_id left join contacts c on c.id = l.contact_id
    where l.needs_human and l.stage not in ('closed','dead') limit 10`)) as unknown as {
    id: string; pid: string; street: string; name: string | null; at: string;
  }[];
  for (const r of human)
    items.push({
      id: `hu-${r.id}`, kind: "human", severity: "warning",
      title: `Conversation needs a human`, detail: `${r.name ?? "Seller"} · ${r.street}`,
      href: `/properties/${r.pid}`, at: r.at,
    });

  const approvals = (await db.execute(sql`
    select o.id, o.amount, o.max_allowable_offer as mao, p.id as pid, p.street, o.created_at as at
    from offers o join leads l on l.id = o.lead_id join properties p on p.id = l.property_id
    where o.status = 'pending_approval' order by o.created_at asc`)) as unknown as {
    id: string; amount: number; mao: number | null; pid: string; street: string; at: string;
  }[];
  for (const r of approvals)
    items.push({
      id: `ap-${r.id}`, kind: "approval", severity: "warning",
      title: `Offer of $${r.amount.toLocaleString("en-US")} awaiting your approval`,
      detail: `${r.street}${r.mao ? ` · MAO $${r.mao.toLocaleString("en-US")}` : ""}`,
      href: `/properties/${r.pid}`, at: r.at,
      action: { type: "approve_offer", id: r.id, label: "Review" },
    });

  const ceiling = (await db.execute(sql`
    select l.id, p.id as pid, p.street, l.asking_price as asking, a.max_allowable_offer as mao, l.updated_at as at
    from leads l join properties p on p.id = l.property_id
    join lateral (select max_allowable_offer from analyses an where an.property_id = p.id order by created_at desc limit 1) a on true
    where l.stage in ('offer','negotiating') and l.asking_price > a.max_allowable_offer
    order by (l.asking_price - a.max_allowable_offer) desc limit 10`)) as unknown as {
    id: string; pid: string; street: string; asking: number; mao: number; at: string;
  }[];
  for (const r of ceiling)
    items.push({
      id: `ce-${r.id}`, kind: "ceiling", severity: "negative",
      title: `Asking is $${(r.asking - r.mao).toLocaleString("en-US")} above purchase ceiling`,
      detail: `${r.street} · ask $${r.asking.toLocaleString("en-US")} vs MAO $${r.mao.toLocaleString("en-US")}`,
      href: `/properties/${r.pid}`, at: r.at,
    });

  const deadlines = (await db.execute(sql`
    select t.id, p.id as pid, p.street, t.inspection_deadline as d
    from transactions t join leads l on l.id = t.lead_id join properties p on p.id = l.property_id
    where t.status = 'open' and t.inspection_deadline between current_date and current_date + 5
    order by t.inspection_deadline`)) as unknown as { id: string; pid: string; street: string; d: string }[];
  for (const r of deadlines)
    items.push({
      id: `dl-${r.id}`, kind: "deadline", severity: "warning",
      title: `Inspection deadline ${new Date(r.d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
      detail: r.street, href: `/properties/${r.pid}`, at: r.d,
    });

  const overdue = (await db.execute(sql`
    select t.id, t.title, t.due_at as at, p.id as pid, p.street
    from tasks t left join leads l on l.id = t.lead_id left join properties p on p.id = l.property_id
    where t.completed_at is null and t.due_at < now() order by t.due_at asc limit 10`)) as unknown as {
    id: string; title: string; at: string; pid: string | null; street: string | null;
  }[];
  for (const r of overdue)
    items.push({
      id: `ta-${r.id}`, kind: "overdue", severity: "warning",
      title: r.title, detail: `Overdue${r.street ? ` · ${r.street}` : ""}`,
      href: r.pid ? `/properties/${r.pid}` : "/leads", at: r.at,
      action: { type: "complete_task", id: r.id, label: "Complete" },
    });

  const opps = (await db.execute(sql`
    select l.id, p.id as pid, p.street, a.deal_score as score, a.max_allowable_offer as mao, a.created_at as at
    from leads l join properties p on p.id = l.property_id
    join lateral (select * from analyses an where an.property_id = p.id order by created_at desc limit 1) a on true
    where l.stage in ('new','contacting','qualified','underwriting') and a.deal_score >= 70 and a.verdict <> 'fail'
      and a.created_at > now() - interval '7 days'
    order by a.deal_score desc limit 5`)) as unknown as {
    id: string; pid: string; street: string; score: number; mao: number; at: string;
  }[];
  for (const r of opps)
    items.push({
      id: `op-${r.id}`, kind: "opportunity", severity: "positive",
      title: `Strong BRRRR opportunity · score ${r.score}`,
      detail: `${r.street} · MAO $${r.mao?.toLocaleString("en-US") ?? "—"}`,
      href: `/properties/${r.pid}`, at: r.at,
    });

  const inputs = (await db.execute(sql`
    select l.id, p.id as pid, p.street, l.stage_changed_at as at
    from leads l join properties p on p.id = l.property_id
    left join lateral (select * from analyses an where an.property_id = p.id order by created_at desc limit 1) a on true
    where l.stage = 'underwriting' and (a.id is null or a.verdict = 'review' and a.max_allowable_offer is null)
    limit 5`)) as unknown as { id: string; pid: string; street: string; at: string }[];
  for (const r of inputs)
    items.push({
      id: `in-${r.id}`, kind: "inputs", severity: "info",
      title: "Underwriting is missing inputs", detail: r.street, href: `/properties/${r.pid}#analysis`, at: r.at,
    });

  const rank = { negative: 0, warning: 1, positive: 2, info: 3 } as const;
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/* ───────────────────────── Property detail ───────────────────────── */

export async function getPropertyDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [property] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  if (!property) return null;
  const [lead] = await db.select().from(leads).where(eq(leads.propertyId, id)).orderBy(desc(leads.updatedAt)).limit(1);
  const contact = lead?.contactId
    ? (await db.select().from(contacts).where(eq(contacts.id, lead.contactId)).limit(1))[0] ?? null
    : null;
  const owner = lead?.ownerUserId
    ? (await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, lead.ownerUserId)).limit(1))[0] ?? null
    : null;
  const analysisRows = await db
    .select()
    .from(analyses)
    .where(eq(analyses.propertyId, id))
    .orderBy(desc(analyses.createdAt))
    .limit(10);
  const timeline = await db
    .select({
      id: activities.id, type: activities.type, title: activities.title, body: activities.body,
      metadata: activities.metadata, occurredAt: activities.occurredAt, actorLabel: activities.actorLabel,
      actorName: users.name, isSample: activities.isSample,
    })
    .from(activities)
    .leftJoin(users, eq(users.id, activities.actorUserId))
    .where(eq(activities.propertyId, id))
    .orderBy(desc(activities.occurredAt))
    .limit(100);
  const openTasks = lead
    ? await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.leadId, lead.id), isNull(tasks.completedAt)))
        .orderBy(sql`${tasks.dueAt} asc nulls last`)
    : [];
  const leadOffers = lead ? await db.select().from(offers).where(eq(offers.leadId, lead.id)).orderBy(desc(offers.createdAt)) : [];
  const [txn] = lead ? await db.select().from(transactions).where(eq(transactions.leadId, lead.id)).limit(1) : [];
  return {
    property,
    lead: lead ?? null,
    contact,
    owner,
    analysis: analysisRows[0] ?? null,
    analysisResult: (analysisRows[0]?.outputs as BrrrrResult | undefined) ?? null,
    analysisHistory: analysisRows,
    timeline,
    openTasks,
    offers: leadOffers,
    transaction: txn ?? null,
  };
}

/* ───────────────────────── Search ───────────────────────── */

export interface SearchHit {
  propertyId: string;
  street: string;
  city: string;
  zip: string;
  sellerName: string | null;
  stage: LeadStage | null;
  ref: number | null;
}

export async function searchAll(q: string): Promise<SearchHit[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  const like = `%${t}%`;
  return (await db.execute(sql`
    select p.id as "propertyId", p.street, p.city, p.zip, c.full_name as "sellerName", l.stage, l.ref
    from properties p
    left join lateral (select * from leads where property_id = p.id order by updated_at desc limit 1) l on true
    left join contacts c on c.id = l.contact_id
    where p.street ilike ${like} or p.city ilike ${like} or p.zip ilike ${like} or c.full_name ilike ${like}
      or p.owner_name ilike ${like} or c.phone_e164 like ${`%${t.replace(/\D/g, "") || "~"}%`}
      or l.ref::text = ${t.replace(/^L-?/i, "")}
    order by l.updated_at desc nulls last limit 12
  `)) as unknown as SearchHit[];
}

export async function listProperties(q?: string) {
  const like = q ? `%${q}%` : null;
  return (await db.execute(sql`
    select p.id, p.street, p.city, p.zip, p.property_type as "propertyType", p.beds, p.baths::text as baths, p.sqft,
      p.year_built as "yearBuilt", p.occupancy, p.condition, p.data_source as "dataSource", p.is_sample as "isSample",
      p.updated_at as "updatedAt", p.owner_name as "ownerName", p.estimated_value as "estimatedValue", p.distress_flags as "flags",
      l.stage, l.id as "leadId", a.arv, a.max_allowable_offer as mao, a.deal_score as "dealScore"
    from properties p
    left join lateral (select * from leads where property_id = p.id order by updated_at desc limit 1) l on true
    left join lateral (select * from analyses where property_id = p.id order by created_at desc limit 1) a on true
    ${like ? sql`where p.street ilike ${like} or p.city ilike ${like} or p.zip ilike ${like} or p.owner_name ilike ${like}` : sql``}
    order by p.updated_at desc limit 500
  `)) as unknown as {
    id: string; street: string; city: string; zip: string; propertyType: string; beds: number | null; baths: string | null;
    sqft: number | null; yearBuilt: number | null; occupancy: string; condition: string; dataSource: string; isSample: boolean;
    updatedAt: string; ownerName: string | null; estimatedValue: number | null; flags: string[]; stage: LeadStage | null; leadId: string | null;
    arv: number | null; mao: number | null; dealScore: number | null;
  }[];
}

export async function hasSampleData(): Promise<boolean> {
  const [r] = (await db.execute(sql`select exists(select 1 from leads where is_sample) as s`)) as unknown as { s: boolean }[];
  return r.s;
}

export async function listUsers() {
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users);
}

export interface UpcomingItem {
  id: string;
  kind: "task" | "closing" | "inspection" | "earnest";
  title: string;
  detail: string | null;
  at: string;
  href: string;
}

/** Scheduled work for the next 7 days (tasks) and 21 days (contract dates). */
export async function getUpcoming(): Promise<UpcomingItem[]> {
  return (await db.execute(sql`
    select * from (
      select t.id::text, 'task' as kind, t.title, p.street as detail, t.due_at as at, '/properties/' || p.id as href
      from tasks t join leads l on l.id = t.lead_id join properties p on p.id = l.property_id
      where t.completed_at is null and t.due_at >= now() and t.due_at < now() + interval '7 days'
      union all
      select tr.id::text || '-c', 'closing', 'Closing', p.street, tr.closing_date::timestamptz + interval '12 hours', '/properties/' || p.id
      from transactions tr join leads l on l.id = tr.lead_id join properties p on p.id = l.property_id
      where tr.status = 'open' and tr.closing_date between current_date and current_date + 21
      union all
      select tr.id::text || '-i', 'inspection', 'Inspection deadline', p.street, tr.inspection_deadline::timestamptz + interval '12 hours', '/properties/' || p.id
      from transactions tr join leads l on l.id = tr.lead_id join properties p on p.id = l.property_id
      where tr.status = 'open' and tr.inspection_deadline between current_date and current_date + 21
      union all
      select tr.id::text || '-e', 'earnest', 'Earnest money due', p.street, tr.earnest_money_due::timestamptz + interval '12 hours', '/properties/' || p.id
      from transactions tr join leads l on l.id = tr.lead_id join properties p on p.id = l.property_id
      where tr.status = 'open' and tr.earnest_money_due between current_date and current_date + 21
    ) x order by at asc limit 12
  `)) as unknown as UpcomingItem[];
}
