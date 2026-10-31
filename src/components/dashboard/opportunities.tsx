import Link from "next/link";
import type { LeadRow } from "@/lib/queries";
import { money, relTime } from "@/lib/format";
import { StagePill, ScoreMeter } from "../status";
import { SampleTag } from "../ui/badge";
import { th, td } from "../page-header";
import { cn } from "../ui/cn";

export function OpportunitiesTable({ rows }: { rows: LeadRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Property</th>
            <th className={th}>Seller</th>
            <th className={cn(th, "text-right")}>Est. ARV</th>
            <th className={cn(th, "text-right")}>Rehab</th>
            <th className={cn(th, "text-right")}>Asking</th>
            <th className={cn(th, "text-right")}>MAO</th>
            <th className={cn(th, "text-right")}>Cash flow</th>
            <th className={cn(th, "text-right")}>Score</th>
            <th className={th}>Status</th>
            <th className={th}>Next action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const overAsk = r.askingPrice != null && r.mao != null && r.askingPrice > r.mao;
            const overdue = r.nextActionDueAt && new Date(r.nextActionDueAt) < new Date();
            return (
              <tr key={r.id} className="row-hover border-b border-line last:border-0">
                <td className={td}>
                  <Link href={`/properties/${r.propertyId}`} className="flex items-center gap-2 font-medium text-fg hover:underline">
                    <span className="max-w-[200px] truncate">{r.street}</span>
                    {r.isSample && <SampleTag />}
                  </Link>
                </td>
                <td className={cn(td, "max-w-[150px] truncate text-fg-2")}>{r.sellerName ?? "—"}</td>
                <td className={cn(td, "num text-right")}>{money(r.arv)}</td>
                <td className={cn(td, "num text-right text-fg-2")}>{money(r.rehab)}</td>
                <td className={cn(td, "num text-right", overAsk && "text-neg")}>{money(r.askingPrice)}</td>
                <td className={cn(td, "num text-right font-medium")}>{money(r.mao)}</td>
                <td className={cn(td, "num text-right", r.cashFlow != null && (r.cashFlow >= 0 ? "text-fg" : "text-neg"))}>
                  {r.cashFlow != null ? `${money(r.cashFlow)}/mo` : "—"}
                </td>
                <td className={cn(td, "text-right")}><ScoreMeter score={r.dealScore} /></td>
                <td className={td}><StagePill stage={r.stage} /></td>
                <td className={cn(td, "max-w-[220px]")}>
                  <div className="truncate text-fg-2">{r.nextAction ?? "—"}</div>
                  {r.nextActionDueAt && <div className={cn("text-xs", overdue ? "text-warn" : "text-fg-3")}>{overdue ? "Overdue · " : ""}{relTime(r.nextActionDueAt)}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
