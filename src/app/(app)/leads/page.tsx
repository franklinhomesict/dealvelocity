import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedViews, leadStage, type LeadStage } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { listLeads, type LeadSort } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { LeadsTable } from "@/components/leads/leads-table";
import { BUILTIN_VIEWS } from "@/lib/views";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

const SORTS: LeadSort[] = ["updated", "score", "asking", "mao", "arv", "stage", "address", "next"];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const hasParams = Object.keys(sp).length > 0;
  const p = hasParams ? sp : BUILTIN_VIEWS[0].query;
  const stages = (p.stage ?? "").split(",").filter((s): s is LeadStage => (leadStage.enumValues as readonly string[]).includes(s));
  const sort = SORTS.includes(p.sort as LeadSort) ? (p.sort as LeadSort) : "updated";
  const [rows, views] = await Promise.all([
    listLeads({ q: p.q, stages, temperature: p.temp, sort, dir: p.dir === "asc" ? "asc" : "desc" }),
    db.select().from(savedViews).where(and(eq(savedViews.userId, user.id), eq(savedViews.entity, "leads"))),
  ]);
  return (
    <div>
      <PageHeader title="Leads" meta="Sellers and properties in acquisition" />
      <LeadsTable
        rows={rows}
        views={views.map((v) => ({ id: v.id, name: v.name, query: v.query as Record<string, string> }))}
        readOnly={user.role === "viewer"}
      />
    </div>
  );
}
