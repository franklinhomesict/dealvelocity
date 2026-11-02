import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getDashboard, getUpcoming } from "@/lib/queries";
import { Upcoming } from "@/components/dashboard/upcoming";
import { requireUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelHeader, EmptyState } from "@/components/ui/misc";
import { AttentionList } from "@/components/dashboard/attention-list";
import { PipelineFunnel } from "@/components/dashboard/funnel";
import { OpportunitiesTable } from "@/components/dashboard/opportunities";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [user, d, upcoming] = await Promise.all([requireUser(), getDashboard(), getUpcoming()]);
  const m = d.metrics;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" });
  const metrics: { label: string; value: string; sub: string; href: string; tone?: "warn" | "pos" }[] = [
    { label: "Active leads", value: String(m.activeLeads), sub: m.newThisWeek ? `+${m.newThisWeek} this week` : "None new this week", href: "/leads" },
    { label: "Qualified sellers", value: String(m.qualified), sub: m.activeLeads ? `${Math.round((m.qualified / m.activeLeads) * 100)}% of active` : "—", href: "/leads?stage=qualified,underwriting,offer,negotiating,under_contract" },
    { label: "Offers outstanding", value: String(m.offersOutstanding), sub: m.offersPendingApproval ? `${m.offersPendingApproval} awaiting approval` : `${money(m.offersValue, { compact: true })} committed`, href: "/offers", tone: m.offersPendingApproval ? "warn" : undefined },
    { label: "Under contract", value: String(m.underContract), sub: "Properties", href: "/transactions" },
    { label: "Closings this month", value: String(m.closingsThisMonth), sub: `${m.closedThisMonth} closed`, href: "/transactions" },
    { label: "Pipeline value", value: money(m.pipelineValue, { compact: true }), sub: `Est. acquisition · ${m.pipelineValueCount} deals`, href: "/pipeline", tone: "pos" },
  ];

  return (
    <div className="pb-10">
      <PageHeader title="Overview" meta={today} />
      <div className="space-y-4 px-4 pt-4 md:px-6 md:pt-5">
        <Panel className="grid grid-cols-2 overflow-hidden sm:grid-cols-3 xl:grid-cols-6">
          {metrics.map((k, i) => (
            <Link
              key={k.label}
              href={k.href}
              className={cn(
                "group relative border-line px-4 py-3.5 transition-colors hover:bg-surface-2",
                "border-b xl:border-b-0",
                i % 2 === 0 && "border-r sm:border-r-0",
                i % 3 !== 2 && "sm:border-r",
                "xl:border-r xl:last:border-r-0",
                i >= 4 && "border-b-0 sm:border-b",
                i >= 3 && "sm:border-b-0",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-fg-2">{k.label}</span>
                <ArrowUpRight className="h-3 w-3 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className={cn("num mt-1.5 text-2xl font-semibold tracking-tight", k.tone === "pos" ? "text-pos" : "text-fg")}>{k.value}</div>
              <div className={cn("mt-0.5 truncate text-xs", k.tone === "warn" ? "text-warn" : "text-fg-3")}>{k.sub}</div>
            </Link>
          ))}
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Panel className="min-w-0 self-start">
            <PanelHeader
              title="Needs your attention"
              meta={d.attention.length ? `${d.attention.length} open` : undefined}
            />
            <AttentionList items={d.attention} canApprove={user.role === "owner"} />
          </Panel>
          <div className="flex min-w-0 flex-col gap-4">
            <Panel>
              <PanelHeader title="Acquisition pipeline" meta="Active leads by stage" actions={<Link href="/pipeline" className="text-xs text-fg-3 hover:text-fg">Open board →</Link>} />
              <PipelineFunnel data={d.funnel} />
            </Panel>
            <Panel>
              <PanelHeader title="Coming up" meta="Tasks and contract dates" />
              <Upcoming items={upcoming} />
            </Panel>
          </div>
        </div>

        <Panel>
          <PanelHeader title="Recent opportunities" meta="Most recently active" actions={<Link href="/leads" className="text-xs text-fg-3 hover:text-fg">All leads →</Link>} />
          {d.recent.length ? (
            <OpportunitiesTable rows={d.recent} />
          ) : (
            <EmptyState title="No active leads yet" body="Add a property or import from DealMachine (Phase 2) to start building your pipeline." />
          )}
        </Panel>
      </div>
    </div>
  );
}
