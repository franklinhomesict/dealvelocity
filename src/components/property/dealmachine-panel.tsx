"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, LineChart, ExternalLink } from "lucide-react";
import type { Comparable } from "@/db/schema";
import { enrichPropertyAction, fetchCompsAction, toggleCompAction } from "@/app/(app)/prospecting/actions";
import { suggestArv } from "@/lib/dealmachine/comps";
import { DISTRESS_LABELS } from "@/lib/dealmachine/mapper";
import { money, relTime, shortDate } from "@/lib/format";
import { Panel, PanelHeader, DataRow } from "../ui/misc";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Modal } from "../ui/overlay";
import { notify, toast } from "../ui/toast";
import { cn } from "../ui/cn";

export interface DmPanelProps {
  propertyId: string;
  connected: boolean;
  paidEnabled: boolean;
  canWrite: boolean;
  sourceRef: string | null;
  isDealMachine: boolean;
  syncedAt: string | null;
  enrichedAt: string | null;
  flags: string[];
  estimatedValue: number | null;
  estimatedRepairCost: number | null;
  equityPercent: number | null;
  equityAmount: number | null;
  subjectSqft: number | null;
}

/** DealMachine data for one property: signals, estimates, enrichment and comps. Paid actions confirm first. */
export function DealMachinePanel(p: DmPanelProps & { comps: Comparable[] }) {
  const [confirm, setConfirm] = useState<null | "enrich" | "comps">(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (kind: "enrich" | "comps") =>
    start(async () => {
      const r = kind === "enrich" ? await enrichPropertyAction(p.propertyId) : await fetchCompsAction(p.propertyId);
      notify(r);
      setConfirm(null);
      router.refresh();
    });
  const blocked = !p.connected ? "DealMachine is not connected" : !p.paidEnabled ? "Paid requests are off (Prospecting → Credits)" : !p.canWrite ? "Read-only access" : null;
  const dmId = p.sourceRef;
  return (
    <Panel id="dealmachine">
      <PanelHeader
        title="DealMachine"
        meta={p.enrichedAt ? `Enriched ${relTime(p.enrichedAt)}` : p.syncedAt ? `Synced ${relTime(p.syncedAt)}` : "Not linked"}
        actions={
          <Button size="xs" variant="ghost" disabled={!!blocked} title={blocked ?? "Uses 1 property credit"} onClick={() => setConfirm("enrich")}>
            <Sparkles className="h-3 w-3" /> {p.enrichedAt ? "Refresh" : "Enrich"}
          </Button>
        }
      />
      {p.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-3.5 py-2.5">
          {p.flags.map((f) => <Badge key={f} tone={["probate", "preforeclosure", "tax_delinquent", "vacant"].includes(f) ? "warning" : "neutral"}>{DISTRESS_LABELS[f] ?? f}</Badge>)}
        </div>
      )}
      <div className="divide-y divide-line px-3.5 py-1">
        <DataRow label="Estimated value" value={money(p.estimatedValue)} hint={p.estimatedValue != null ? "DM estimate" : undefined} />
        <DataRow label="Estimated equity" value={p.equityAmount != null ? `${money(p.equityAmount)}${p.equityPercent != null ? ` · ${Math.round(p.equityPercent)}%` : ""}` : "—"} hint={p.equityAmount != null ? "estimate" : undefined} />
        <DataRow label="Modeled repair cost" value={money(p.estimatedRepairCost)} hint={p.estimatedRepairCost != null ? "not a bid" : undefined} />
        <DataRow label="DealMachine ID" value={dmId ? <span className="font-mono text-xs text-fg-2">{dmId}</span> : <span className="text-fg-3">—</span>} />
      </div>
      {!p.enrichedAt && <p className="border-t border-line px-3.5 py-2 text-xs text-fg-3">Valuation, equity and distress signals appear after enrichment (1 credit). Contact data is never purchased here.</p>}
      <Comps {...p} onPull={() => setConfirm("comps")} blocked={blocked ?? (!dmId ? "Enrich first to link a DealMachine ID" : null)} />
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === "comps" ? "Pull comparables?" : "Enrich from DealMachine?"}
        description="This uses 1 DealMachine property credit (none if DealMachine already charged for this property this billing cycle). No owner contact data is purchased."
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="primary" loading={pending} onClick={() => run(confirm!)}>Use 1 credit</Button>
          </>
        }
      >
        <p className="text-sm text-fg-2">{confirm === "comps" ? "Fetches sold comps, pending and active listings from the last 12 months, matched on property type." : "Updates valuation, equity, repair estimate, ownership and distress signals. Values you entered manually are kept."}</p>
      </Modal>
    </Panel>
  );
}

function Comps(p: DmPanelProps & { comps: Comparable[]; onPull: () => void; blocked: string | null }) {
  const [, start] = useTransition();
  const router = useRouter();
  const suggestion = useMemo(
    () => suggestArv(p.comps.filter((c) => !c.excluded).map((c) => ({ status: c.status as "sold" | "active" | "pending", price: c.price, sqft: c.sqft })), p.subjectSqft),
    [p.comps, p.subjectSqft],
  );
  return (
    <div className="border-t border-line">
      <div className="flex items-center justify-between px-3.5 pb-1.5 pt-2.5">
        <span className="eyebrow">Comparables{p.comps.length ? ` · ${p.comps.length}` : ""}</span>
        <Button size="xs" variant="ghost" disabled={!!p.blocked} title={p.blocked ?? "Uses 1 property credit"} onClick={p.onPull}>
          <LineChart className="h-3 w-3" /> {p.comps.length ? "Refresh comps" : "Pull comps"}
        </Button>
      </div>
      {p.comps.length === 0 ? (
        <p className="px-3.5 pb-3 text-xs text-fg-3">No comparables yet.</p>
      ) : (
        <>
          {suggestion ? (
            <div className="mx-3.5 mb-2 flex items-center justify-between gap-3 rounded border border-line bg-surface-2 px-3 py-2">
              <div>
                <div className="text-xs text-fg-2">Comps-based ARV <span className="text-fg-3">· estimate</span></div>
                <div className="num text-lg font-semibold">{money(suggestion.arv)}</div>
                <div className="num text-xs text-fg-3">
                  {suggestion.compsUsed} sold · {suggestion.medianPpsf ? `$${suggestion.medianPpsf}/sqft median · ` : ""}range {money(suggestion.low, { compact: true })}–{money(suggestion.high, { compact: true })}
                </div>
              </div>
              {p.canWrite && (
                <Button size="xs" onClick={() => (window.dispatchEvent(new CustomEvent("aos:set-arv", { detail: suggestion.arv })), toast.info("ARV applied to scenario — review and save the analysis"))}>
                  Use as ARV
                </Button>
              )}
            </div>
          ) : (
            <p className="px-3.5 pb-2 text-xs text-warn">Fewer than 3 included sold comps — no ARV suggested.</p>
          )}
          <ul className="divide-y divide-line border-t border-line">
            {p.comps.map((c) => {
              const ppsf = c.price && c.sqft ? Math.round(c.price / c.sqft) : null;
              return (
                <li key={c.id} className={cn("flex items-center gap-2.5 px-3.5 py-1.5", c.excluded && "opacity-45")}>
                  <input
                    type="checkbox"
                    aria-label={`Include ${c.address}`}
                    checked={!c.excluded}
                    disabled={!p.canWrite}
                    onChange={(e) => start(async () => (notify(await toggleCompAction(p.propertyId, c.id, !e.target.checked)), router.refresh()))}
                    className="h-3.5 w-3.5 shrink-0 accent-current"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm">{c.address}</span>
                      {c.status !== "sold" && <Badge tone="info">{c.status}</Badge>}
                    </div>
                    <div className="num text-xs text-fg-3">
                      {[c.beds && `${c.beds}bd`, c.baths && `${Number(c.baths)}ba`, c.sqft && `${c.sqft.toLocaleString("en-US")} sf`, c.distanceMiles && `${Number(c.distanceMiles)} mi`, c.date && shortDate(c.date)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num text-sm font-medium">{money(c.price)}</div>
                    {ppsf && <div className="num text-xs text-fg-3">${ppsf}/sf</div>}
                  </div>
                </li>
              );
            })}
          </ul>
          <a href="https://app.dealmachine.com" target="_blank" rel="noreferrer" className="flex items-center gap-1 border-t border-line px-3.5 py-2 text-xs text-fg-3 hover:text-fg-2">
            Open DealMachine <ExternalLink className="h-3 w-3" />
          </a>
        </>
      )}
    </div>
  );
}
