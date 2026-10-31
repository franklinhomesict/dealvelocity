import Link from "next/link";
import { Building2 } from "lucide-react";
import { listProperties } from "@/lib/queries";
import { money, relTime } from "@/lib/format";
import { PROPERTY_TYPES, OCCUPANCY, CONDITION, SOURCES } from "@/lib/domain";
import { PageHeader, th, td } from "@/components/page-header";
import { StagePill, ScoreMeter } from "@/components/status";
import { SampleTag } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { SearchBox } from "@/components/search-box";

export const metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const rows = await listProperties(q);
  return (
    <div>
      <PageHeader title="Properties" meta={`${rows.length} records`} />
      <div className="border-b border-line px-4 py-2 md:px-6"><SearchBox placeholder="Filter by address, ZIP or owner…" /></div>
      {rows.length === 0 ? (
        <EmptyState icon={<Building2 className="h-4 w-4" />} title={q ? "No properties match" : "No properties yet"} body={q ? "Try a different address or owner name." : "Use Add property (C) to create one."} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead><tr className="border-b border-line">
              {["Address", "Type", "Beds / baths", "Sq ft", "Built", "Occupancy", "Condition", "Est. ARV", "MAO", "Score", "Stage", "Source", "Updated"].map((h, i) => (
                <th key={h} className={cn(th, [3, 4, 7, 8, 9, 12].includes(i) && "text-right")}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="row-hover border-b border-line">
                  <td className={td}>
                    <Link href={`/properties/${r.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <span className="max-w-[220px] truncate">{r.street}</span>{r.isSample && <SampleTag />}
                    </Link>
                    <div className="text-xs text-fg-3">{r.city} {r.zip}</div>
                  </td>
                  <td className={cn(td, "text-fg-2")}>{PROPERTY_TYPES[r.propertyType as keyof typeof PROPERTY_TYPES]}</td>
                  <td className={cn(td, "num text-fg-2")}>{r.beds ?? "—"} / {r.baths ? Number(r.baths) : "—"}</td>
                  <td className={cn(td, "num text-right")}>{r.sqft?.toLocaleString("en-US") ?? "—"}</td>
                  <td className={cn(td, "num text-right text-fg-2")}>{r.yearBuilt ?? "—"}</td>
                  <td className={cn(td, "text-fg-2")}>{OCCUPANCY[r.occupancy as keyof typeof OCCUPANCY]}</td>
                  <td className={cn(td, "text-fg-2")}>{CONDITION[r.condition as keyof typeof CONDITION]}</td>
                  <td className={cn(td, "num text-right")}>{money(r.arv)}</td>
                  <td className={cn(td, "num text-right font-medium")}>{money(r.mao)}</td>
                  <td className={cn(td, "text-right")}><ScoreMeter score={r.dealScore} /></td>
                  <td className={td}>{r.stage ? <StagePill stage={r.stage} /> : <span className="text-fg-3">No lead</span>}</td>
                  <td className={cn(td, "text-xs text-fg-3")}>{SOURCES[r.dataSource as keyof typeof SOURCES]}</td>
                  <td className={cn(td, "text-right text-xs text-fg-3")}>{relTime(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
