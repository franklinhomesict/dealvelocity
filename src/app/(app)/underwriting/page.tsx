import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { getAssumptions } from "@/lib/queries";
import { money, relTime } from "@/lib/format";
import { PageHeader, th, td } from "@/components/page-header";
import { AnalysisPanel } from "@/components/property/analysis-panel";
import { Panel, PanelHeader, EmptyState } from "@/components/ui/misc";
import { VerdictBadge, ScoreMeter } from "@/components/status";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Underwriting" };
export const dynamic = "force-dynamic";

export default async function UnderwritingPage() {
  const [user, { values, updatedAt }] = await Promise.all([requireUser(), getAssumptions()]);
  const recent = (await db.execute(sql`
    select a.id, a.created_at as at, a.arv, a.rehab, a.monthly_rent as rent, a.purchase_price as price, a.max_allowable_offer as mao,
      a.deal_score as score, a.verdict, p.id as pid, p.street, u.name as by
    from analyses a join properties p on p.id = a.property_id left join users u on u.id = a.created_by
    order by a.created_at desc limit 25`)) as unknown as { id: string; at: string; arv: number | null; rehab: number | null; rent: number | null; price: number | null; mao: number | null; score: number | null; verdict: string; pid: string; street: string; by: string | null }[];
  return (
    <div className="pb-10">
      <PageHeader
        title="Underwriting"
        meta={`Buy box $${values.buyBoxMinArv / 1000}K–$${values.buyBoxMaxArv / 1000}K ARV · rent ≥ ${values.buyBoxMinRentPct}% · $${values.minMonthlyCashFlow}+/mo · DSCR ${Math.max(values.dscrMin, values.targetDscr).toFixed(2)} · ≤ $${values.maxCashLeftInDeal / 1000}K left in · updated ${relTime(updatedAt)}`}
        actions={<Link href="/settings#assumptions" className="text-sm text-fg-2 hover:text-fg">Edit assumptions →</Link>}
      />
      <div className="space-y-4 px-4 pt-4 md:px-6">
        <AnalysisPanel propertyId={null} assumptions={values} askingPrice={null} readOnly={user.role === "viewer"}
          seed={{ purchasePrice: null, arv: null, arvSource: "estimate", rehab: null, monthlyRent: null, savedAt: null, engineVersion: null }} />
        <Panel>
          <PanelHeader title="Recent analyses" meta="Every save is versioned" />
          {recent.length === 0 ? <EmptyState title="No analyses saved yet" body="Open a property and save its underwriting." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead><tr className="border-b border-line">
                  {["Property", "Price", "ARV", "Rehab", "Rent", "MAO", "Score", "Verdict", "Saved"].map((h, i) => <th key={h} className={cn(th, i > 0 && i < 7 && "text-right")}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="row-hover border-b border-line last:border-0">
                      <td className={td}><Link href={`/properties/${r.pid}#analysis`} className="font-medium hover:underline">{r.street}</Link></td>
                      <td className={cn(td, "num text-right")}>{money(r.price)}</td>
                      <td className={cn(td, "num text-right")}>{money(r.arv)}</td>
                      <td className={cn(td, "num text-right")}>{money(r.rehab)}</td>
                      <td className={cn(td, "num text-right")}>{money(r.rent)}</td>
                      <td className={cn(td, "num text-right font-medium")}>{money(r.mao)}</td>
                      <td className={cn(td, "text-right")}><ScoreMeter score={r.score} /></td>
                      <td className={td}><VerdictBadge verdict={r.verdict} /></td>
                      <td className={cn(td, "text-xs text-fg-3")}>{relTime(r.at)}{r.by ? ` · ${r.by}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
