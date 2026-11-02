import Link from "next/link";
import { sql } from "drizzle-orm";
import { ClipboardCheck } from "lucide-react";
import { db } from "@/db";
import { money } from "@/lib/format";
import { PageHeader, th, td } from "@/components/page-header";
import { Badge, SampleTag } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

function DateCell({ d }: { d: string | null }) {
  if (!d) return <span className="text-fg-3">—</span>;
  const days = Math.ceil((new Date(d + "T12:00:00").getTime() - Date.now()) / 864e5);
  const label = new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return <span className={cn("num", days < 0 ? "text-fg-3" : days <= 3 ? "text-warn" : "text-fg")}>{label}{days >= 0 && days <= 14 && <span className="ml-1 text-xs text-fg-3">{days === 0 ? "today" : `${days}d`}</span>}</span>;
}

export default async function TransactionsPage() {
  const rows = (await db.execute(sql`
    select t.id, t.status, t.contract_price as price, t.effective_date as eff, t.earnest_money_due as em, t.inspection_deadline as insp,
      t.closing_date as closing, t.title_company as title, t.is_sample as sample, p.id as pid, p.street
    from transactions t join leads l on l.id = t.lead_id join properties p on p.id = l.property_id
    order by (t.status = 'open') desc, t.closing_date asc`)) as unknown as { id: string; status: string; price: number | null; eff: string | null; em: string | null; insp: string | null; closing: string | null; title: string | null; sample: boolean; pid: string; street: string }[];
  return (
    <div>
      <PageHeader title="Transactions" meta="Contract-to-close tracking. Document checklists and reminders expand in Phase 6." />
      {rows.length === 0 ? <EmptyState icon={<ClipboardCheck className="h-4 w-4" />} title="No transactions" body="Transactions are created when an approved offer is accepted." /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b border-line">{["Property", "Status", "Price", "Effective", "Earnest $", "Inspection", "Closing", "Title"].map((h, i) => <th key={h} className={cn(th, i === 2 && "text-right")}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="row-hover border-b border-line">
                  <td className={td}><Link href={`/properties/${r.pid}`} className="flex items-center gap-2 font-medium hover:underline">{r.street}{r.sample && <SampleTag />}</Link></td>
                  <td className={td}><Badge tone={r.status === "closed" ? "positive" : r.status === "open" ? "info" : "neutral"}>{r.status === "open" ? "Under contract" : r.status}</Badge></td>
                  <td className={cn(td, "num text-right font-medium")}>{money(r.price)}</td>
                  <td className={td}><DateCell d={r.eff} /></td>
                  <td className={td}><DateCell d={r.em} /></td>
                  <td className={td}><DateCell d={r.insp} /></td>
                  <td className={td}><DateCell d={r.closing} /></td>
                  <td className={cn(td, "text-fg-2")}>{r.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
