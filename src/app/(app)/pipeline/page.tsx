import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listLeads } from "@/lib/queries";
import { STAGES } from "@/lib/domain";
import { PageHeader } from "@/components/page-header";
import { PipelineBoard } from "@/components/leads/board";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ closed?: string }> }) {
  const user = await requireUser();
  const showClosed = (await searchParams).closed === "1";
  const rows = await listLeads({ stages: STAGES.filter((s) => showClosed || !s.terminal).map((s) => s.id), sort: "score", dir: "desc" });
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Pipeline"
        meta="Drag cards between stages. Moving to contract requires an approved offer."
        actions={
          <div className="flex h-7 items-center rounded border border-line bg-surface p-0.5 text-xs">
            <Link href="/pipeline" className={cn("flex h-full items-center rounded-sm px-2", !showClosed ? "bg-surface-3 font-medium" : "text-fg-3")}>Active</Link>
            <Link href="/pipeline?closed=1" className={cn("flex h-full items-center rounded-sm px-2", showClosed ? "bg-surface-3 font-medium" : "text-fg-3")}>Include closed</Link>
          </div>
        }
      />
      <div className="min-h-0 flex-1">
        <PipelineBoard rows={rows} readOnly={user.role === "viewer"} showClosed={showClosed} />
      </div>
    </div>
  );
}
