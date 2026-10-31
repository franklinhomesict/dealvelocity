import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { getAssumptions, listUsers } from "@/lib/queries";
import { relTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelHeader, DataRow } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { AssumptionsForm } from "@/components/assumptions-form";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [user, { values, updatedAt }, users] = await Promise.all([requireUser(), getAssumptions(), listUsers()]);
  const [stats] = (await db.execute(sql`select (select count(*) from properties)::int as props, (select count(*) from audit_log)::int as audits, (select max(at) from audit_log) as "lastAudit"`)) as unknown as { props: number; audits: number; lastAudit: string | null }[];
  const external = process.env.EXTERNAL_ACTIONS_ENABLED === "true";
  return (
    <div className="pb-10">
      <PageHeader title="Settings" />
      <div className="grid gap-4 px-4 pt-4 md:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel id="assumptions" className="min-w-0 overflow-hidden">
          <PanelHeader title="Underwriting assumptions" meta={`Version saved ${relTime(updatedAt)}`} />
          <AssumptionsForm values={values} canEdit={user.role === "owner"} />
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="System" />
            <div className="divide-y divide-line px-3.5 py-1">
              <DataRow label="External communications" value={external ? <Badge tone="warning">Enabled</Badge> : <Badge tone="neutral">Off · kill switch</Badge>} />
              <DataRow label="Paid AI actions" value={<Badge tone="neutral">Off · Phase 5</Badge>} />
              <DataRow label="DealMachine" value={process.env.DEALMACHINE_API_KEY ? <Badge tone="positive">Connected</Badge> : <Badge tone="warning">API key not set</Badge>} />
              <DataRow label="DealMachine webhooks" value={process.env.DEALMACHINE_WEBHOOK_SECRET ? <Badge tone="positive">Signing secret set</Badge> : <Badge tone="neutral">Not configured</Badge>} />
              <DataRow label="Twilio" value={<Badge tone="neutral">Not connected · Phase 4</Badge>} />
              <DataRow label="Properties stored" value={stats.props.toLocaleString("en-US")} />
              <DataRow label="Audit log entries" value={stats.audits.toLocaleString("en-US")} hint={stats.lastAudit ? `last ${relTime(stats.lastAudit)}` : undefined} />
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Team" meta={`${users.length} users`} />
            <ul className="divide-y divide-line">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-3.5 py-2">
                  <div className="min-w-0"><div className="truncate text-sm">{u.name}</div><div className="truncate text-xs text-fg-3">{u.email}</div></div>
                  <Badge tone={u.role === "owner" ? "info" : "neutral"}>{u.role}</Badge>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-3.5 py-2.5 text-xs text-fg-3">Add users with <code className="text-fg-2">npm run user:create</code>. In-app user management ships with Phase 7 hardening.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
