"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { CreditSettings } from "@/lib/dealmachine/budget";
import { refreshUsageAction, saveCreditSettingsAction } from "@/app/(app)/prospecting/actions";
import { Panel, PanelHeader, DataRow } from "../ui/misc";
import { Button } from "../ui/button";
import { Input, Select } from "../ui/field";
import { Badge } from "../ui/badge";
import { notify } from "../ui/toast";
import { relTime, shortDate } from "@/lib/format";
import { cn } from "../ui/cn";

export interface UsageView {
  remaining: number;
  cap: number;
  used: number;
  cycleEnd: string;
  plan: string;
  fetchedAt: string;
}

export function CreditsPanel({ settings, appUsed, usage, isOwner }: { settings: CreditSettings; appUsed: number; usage: UsageView | null; isOwner: boolean }) {
  const [v, setV] = useState({ paidEnabled: settings.paidEnabled, monthlyBudget: String(settings.monthlyBudget), maxPerImport: String(settings.maxPerImport) });
  const [pending, start] = useTransition();
  const router = useRouter();
  const dirty = v.paidEnabled !== settings.paidEnabled || Number(v.monthlyBudget) !== settings.monthlyBudget || Number(v.maxPerImport) !== settings.maxPerImport;
  const budgetPct = Math.min(100, (appUsed / Math.max(settings.monthlyBudget, 1)) * 100);
  return (
    <Panel>
      <PanelHeader
        title="Credits"
        meta={usage ? `Synced ${relTime(usage.fetchedAt)}` : undefined}
        actions={<Button size="xs" variant="ghost" icon aria-label="Refresh usage" loading={pending} onClick={() => start(async () => (notify(await refreshUsageAction()), router.refresh()))}><RefreshCw className="h-3 w-3" /></Button>}
      />
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
        <div className="bg-surface px-3.5 py-3">
          <div className="text-xs text-fg-2">DealMachine balance</div>
          <div className="num mt-1 text-xl font-semibold">{usage ? usage.remaining.toLocaleString("en-US") : "—"}</div>
          <div className="text-xs text-fg-3">{usage ? `of ${usage.cap.toLocaleString("en-US")} · resets ${shortDate(usage.cycleEnd)}` : "Not connected"}</div>
        </div>
        <div className="bg-surface px-3.5 py-3">
          <div className="text-xs text-fg-2">Spent by this app</div>
          <div className="num mt-1 text-xl font-semibold">{appUsed.toLocaleString("en-US")}</div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className={cn("h-full rounded-full", budgetPct > 90 ? "bg-neg" : budgetPct > 70 ? "bg-warn" : "bg-fg-2")} style={{ width: `${budgetPct}%` }} />
          </div>
          <div className="mt-1 text-xs text-fg-3">of {settings.monthlyBudget.toLocaleString("en-US")} monthly budget</div>
        </div>
      </div>
      <div className="divide-y divide-line px-3.5 py-1">
        <DataRow
          label="Paid requests"
          value={isOwner ? (
            <Select aria-label="Paid requests" value={String(v.paidEnabled)} onChange={(e) => setV({ ...v, paidEnabled: e.target.value === "true" })} className="h-7 w-[120px]">
              <option value="false">Off</option>
              <option value="true">On</option>
            </Select>
          ) : settings.paidEnabled ? <Badge tone="warning">On</Badge> : <Badge>Off</Badge>}
        />
        <DataRow label="Monthly budget" value={isOwner ? <Input aria-label="Monthly budget" inputMode="numeric" value={v.monthlyBudget} onChange={(e) => setV({ ...v, monthlyBudget: e.target.value.replace(/\D/g, "") })} suffix="cr" className="w-[120px] [&_input]:h-7 [&_input]:text-right" /> : settings.monthlyBudget.toLocaleString("en-US")} />
        <DataRow label="Max per import" value={isOwner ? <Input aria-label="Max per import" inputMode="numeric" value={v.maxPerImport} onChange={(e) => setV({ ...v, maxPerImport: e.target.value.replace(/\D/g, "") })} suffix="cr" className="w-[120px] [&_input]:h-7 [&_input]:text-right" /> : settings.maxPerImport.toLocaleString("en-US")} />
      </div>
      {isOwner && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2.5">
          <span className="text-xs text-fg-3">Applies to searches, enrichment and comps.</span>
          <Button
            size="sm"
            variant="primary"
            disabled={!dirty}
            loading={pending}
            onClick={() =>
              start(async () => {
                notify(await saveCreditSettingsAction({ paidEnabled: v.paidEnabled, monthlyBudget: Number(v.monthlyBudget), maxPerImport: Number(v.maxPerImport) }));
                router.refresh();
              })
            }
          >
            Save
          </Button>
        </div>
      )}
    </Panel>
  );
}
