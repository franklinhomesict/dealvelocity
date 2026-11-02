import Link from "next/link";
import { sql } from "drizzle-orm";
import { HandCoins } from "lucide-react";
import { db } from "@/db";
import { money, relTime } from "@/lib/format";
import { PageHeader, th, td } from "@/components/page-header";
import { Badge, SampleTag, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Offers" };
export const dynamic = "force-dynamic";
const TONE: Record<string, Tone> = { draft: "neutral", pending_approval: "warning", approved: "info", sent: "info", countered: "warning", accepted: "positive", rejected: "negative", withdrawn: "neutral" };

export default async function OffersPage() {
  const rows = (await db.execute(sql`
    select o.id, o.amount, o.max_allowable_offer as mao, o.status, o.created_at as at, o.approved_at as "approvedAt", o.is_sample as sample,
      p.id as pid, p.street, l.asking_price as asking, ru.name as "requestedBy", au.name as "approvedBy"
    from offers o join leads l on l.id = o.lead_id join properties p on p.id = l.property_id
    left join users ru on ru.id = o.requested_by left join users au on au.id = o.approved_by
    order by case o.status when 'pending_approval' then 0 else 1 end, o.created_at desc`)) as unknown as {
    id: string; amount: number; mao: number | null; status: string; at: string; approvedAt: string | null; sample: boolean; pid: string; street: string; asking: number | null; requestedBy: string | null; approvedBy: string | null;
  }[];
  return (
    <div>
      <PageHeader title="Offers" meta="Every offer requires owner approval. Document generation and e-sign ship in Phase 6." />
      {rows.length === 0 ? <EmptyState icon={<HandCoins className="h-4 w-4" />} title="No offers yet" body="Request an offer from a property once underwriting is saved." /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead><tr className="border-b border-line">{["Property", "Offer", "MAO", "vs MAO", "Asking", "Status", "Requested", "Approved by"].map((h, i) => <th key={h} className={cn(th, i > 0 && i < 5 && "text-right")}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const diff = r.mao != null ? r.amount - r.mao : null;
                return (
                  <tr key={r.id} className="row-hover border-b border-line">
                    <td className={td}><Link href={`/properties/${r.pid}`} className="flex items-center gap-2 font-medium hover:underline">{r.street}{r.sample && <SampleTag />}</Link></td>
                    <td className={cn(td, "num text-right font-semibold")}>{money(r.amount)}</td>
                    <td className={cn(td, "num text-right text-fg-2")}>{money(r.mao)}</td>
                    <td className={cn(td, "num text-right", diff != null && diff > 0 ? "text-neg" : "text-fg-2")}>{diff != null ? money(diff, { sign: true }) : "—"}</td>
                    <td className={cn(td, "num text-right text-fg-2")}>{money(r.asking)}</td>
                    <td className={td}><Badge tone={TONE[r.status]}>{r.status.replace("_", " ")}</Badge></td>
                    <td className={cn(td, "text-xs text-fg-3")}>{relTime(r.at)}{r.requestedBy ? ` · ${r.requestedBy}` : ""}</td>
                    <td className={cn(td, "text-xs text-fg-3")}>{r.approvedBy ? `${r.approvedBy} · ${relTime(r.approvedAt)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
