"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";
import type { ImportJob } from "@/db/schema";
import { approveJobAction, cancelJobAction, resumeJobAction } from "@/app/(app)/prospecting/actions";
import { relTime } from "@/lib/format";
import { th, td } from "../page-header";
import { Badge, type Tone } from "../ui/badge";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/misc";
import { notify } from "../ui/toast";
import { cn } from "../ui/cn";

const TONE: Record<string, Tone> = { draft: "neutral", estimated: "warning", approved: "info", running: "info", paused: "neutral", completed: "positive", failed: "negative", cancelled: "neutral" };
const LABEL: Record<string, string> = { estimated: "Awaiting approval", approved: "Starting", running: "Running", paused: "Paused", completed: "Completed", failed: "Failed", cancelled: "Cancelled", draft: "Draft" };

export function JobsTable({ jobs, isOwner, readOnly }: { jobs: ImportJob[]; isOwner: boolean; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const active = jobs.some((j) => j.status === "running" || j.status === "approved");
  // Live progress while an import runs.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [active, router]);
  const act = (fn: (id: string) => Promise<{ ok: boolean; message?: string; error?: string }>, id: string) =>
    start(async () => {
      notify(await fn(id));
      router.refresh();
    });

  if (!jobs.length) return <EmptyState icon={<Radar className="h-4 w-4" />} title="No imports yet" body="Start with a saved DealMachine list (free) or count a search before spending credits." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="border-b border-line">
            {["Import", "Status", "Matching", "Credits", "Progress", "Result", ""].map((h, i) => <th key={i} className={cn(th, (i === 2 || i === 3) && "text-right")}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => {
            const pct = Math.min(100, Math.round((j.processed / Math.max(j.maxRecords, 1)) * 100));
            const paid = j.kind === "search";
            return (
              <tr key={j.id} className="border-b border-line align-top last:border-0">
                <td className={cn(td, "py-2")}>
                  <div className="max-w-[260px] truncate font-medium">{j.name}</div>
                  <div className="text-xs text-fg-3">{paid ? "Search · paid" : "Saved list · free"} · {relTime(j.createdAt)}</div>
                </td>
                <td className={cn(td, "py-2")}>
                  <Badge tone={TONE[j.status]} dot={j.status === "running"}>{LABEL[j.status]}</Badge>
                  {j.lastError && <div className="mt-1 max-w-[220px] whitespace-normal text-xs text-neg">{j.lastError}</div>}
                </td>
                <td className={cn(td, "num py-2 text-right")}>{j.matchingCount?.toLocaleString("en-US") ?? "—"}<div className="text-xs text-fg-3">max {j.maxRecords.toLocaleString("en-US")}</div></td>
                <td className={cn(td, "num py-2 text-right")}>
                  {paid ? <>{j.creditsUsed.toLocaleString("en-US")}<span className="text-fg-3"> / {(j.approvedCredits ?? j.estimatedCredits ?? 0).toLocaleString("en-US")}</span></> : <span className="text-fg-3">Free</span>}
                  {paid && j.status === "estimated" && <div className="text-xs text-warn">needs approval</div>}
                </td>
                <td className={cn(td, "py-2")}>
                  <div className="flex items-center gap-2">
                    <span className="relative h-1.5 w-28 overflow-hidden rounded-full bg-surface-3">
                      <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width]", j.status === "failed" ? "bg-neg" : j.status === "completed" ? "bg-pos" : "bg-fg-2")} style={{ width: `${pct}%` }} />
                    </span>
                    <span className="num text-xs text-fg-3">{j.processed.toLocaleString("en-US")}</span>
                  </div>
                </td>
                <td className={cn(td, "py-2 text-xs text-fg-2")}>
                  <span className="num">{j.created}</span> new · <span className="num">{j.updated}</span> updated · <span className="num">{j.duplicates}</span> merged
                  {j.failedRecords > 0 && <span className="text-neg"> · {j.failedRecords} failed</span>}
                </td>
                <td className={cn(td, "py-2 text-right")}>
                  {!readOnly && (
                    <div className="flex justify-end gap-1.5">
                      {j.status === "estimated" && (paid ? (
                        isOwner ? <Button size="xs" variant="positive" loading={pending} onClick={() => act(approveJobAction, j.id)}>Approve {j.estimatedCredits} credits</Button> : <span className="text-xs text-fg-3">Owner approval</span>
                      ) : (
                        <Button size="xs" variant="primary" loading={pending} onClick={() => act(approveJobAction, j.id)}>Start import</Button>
                      ))}
                      {(j.status === "paused" || j.status === "failed") && <Button size="xs" loading={pending} onClick={() => act(resumeJobAction, j.id)}>Resume</Button>}
                      {["estimated", "approved", "running", "paused", "failed"].includes(j.status) && <Button size="xs" variant="ghost" onClick={() => act(cancelJobAction, j.id)}>Cancel</Button>}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
