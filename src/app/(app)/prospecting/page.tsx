import { requireUser } from "@/lib/auth";
import { creditsUsedThisCycle, getCreditSettings, getUsage, isConfigured, listJobs, recentCalls } from "@/lib/dealmachine/service";
import { relTime } from "@/lib/format";
import { PageHeader, th, td } from "@/components/page-header";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ImportBuilder } from "@/components/prospecting/import-builder";
import { JobsTable } from "@/components/prospecting/jobs-table";
import { CreditsPanel } from "@/components/prospecting/credits-panel";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Prospecting" };
export const dynamic = "force-dynamic";

export default async function ProspectingPage() {
  const user = await requireUser();
  const connected = isConfigured();
  const [jobs, { rows: calls, routineLast24h }, settings, { used }, usage] = await Promise.all([listJobs(), recentCalls(), getCreditSettings(), creditsUsedThisCycle(), connected ? getUsage() : null]);
  return (
    <div className="pb-10">
      <PageHeader
        title="Prospecting"
        meta="DealMachine imports, enrichment and credit control"
        actions={connected ? <Badge tone="positive" dot>DealMachine connected</Badge> : <Badge tone="warning" dot>DealMachine not connected</Badge>}
      />
      <div className="space-y-4 px-4 pt-4 md:px-6">
        {!connected && (
          <Panel className="border-warn/30">
            <div className="px-4 py-3.5 text-sm">
              <div className="font-medium">Connect DealMachine</div>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-fg-2">
                <li>In DealMachine, open Settings → Developer and create an API key (starts with <code className="text-fg">dm_sk_live_</code>).</li>
                <li>Add it to the server environment as <code className="text-fg">DEALMACHINE_API_KEY</code> — never in the browser or Git.</li>
                <li>Restart the app. Imports, enrichment and comps unlock here and on property pages.</li>
              </ol>
            </div>
          </Panel>
        )}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ImportBuilder connected={connected} readOnly={user.role === "viewer"} />
          <CreditsPanel
            settings={settings}
            appUsed={used}
            isOwner={user.role === "owner"}
            usage={usage ? { remaining: usage.credits.remaining, cap: usage.credits.total_cap ?? usage.credits.total_available + usage.credits.used, used: usage.credits.used, cycleEnd: usage.billing_cycle.end, plan: usage.plan.name, fetchedAt: usage.fetchedAt } : null}
          />
        </div>
        <Panel>
          <PanelHeader title="Imports" meta={`${jobs.length} recent`} />
          <JobsTable jobs={jobs} isOwner={user.role === "owner"} readOnly={user.role === "viewer"} />
        </Panel>
        <Panel>
          <PanelHeader title="API activity" meta={`Searches, credit-consuming and failed requests · ${routineLast24h.toLocaleString("en-US")} routine free lookups in the last 24h`} />
          {calls.length === 0 ? (
            <div className="px-3.5 py-6 text-center text-sm text-fg-3">No requests yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr className="border-b border-line">{["Operation", "Endpoint", "Status", "Credits", "Time", "When"].map((h, i) => <th key={h} className={cn(th, i >= 3 && i <= 4 && "text-right")}>{h}</th>)}</tr></thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className={cn(td, "font-medium")}>{c.operation.replace("_", " ")}</td>
                      <td className={cn(td, "font-mono text-xs text-fg-3")}>{c.method} {c.path}</td>
                      <td className={td}>{c.error ? <span className="text-neg" title={c.error}>{c.status ?? "ERR"}</span> : <span className="text-fg-2">{c.status}</span>}</td>
                      <td className={cn(td, "num text-right", c.creditsUsed > 0 && "font-medium")}>{c.creditsUsed}{c.creditsDeduplicated > 0 && <span className="text-xs text-fg-3"> (+{c.creditsDeduplicated} dedup)</span>}</td>
                      <td className={cn(td, "num text-right text-fg-3")}>{c.durationMs}ms</td>
                      <td className={cn(td, "text-xs text-fg-3")}>{relTime(c.at)}</td>
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
