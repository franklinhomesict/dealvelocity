"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Phone, X, PhoneCall } from "lucide-react";
import type { LeadRow } from "@/lib/queries";
import { money, relTime, formatPhone } from "@/lib/format";
import { updateLeadAction, addNoteAction, clearCallbackAction } from "@/app/actions";
import { PROPERTY_TYPES } from "@/lib/domain";
import { Drawer } from "../ui/overlay";
import { Button } from "../ui/button";
import { Textarea } from "../ui/field";
import { Badge, SampleTag } from "../ui/badge";
import { DataRow } from "../ui/misc";
import { notify } from "../ui/toast";
import { InlineEdit } from "../inline-edit";
import { StageMenu } from "./stage-menu";
import { ScoreMeter, TemperatureTag, VerdictBadge } from "../status";
import { cn } from "../ui/cn";

export function LeadDrawer({ lead, onClose, readOnly }: { lead: LeadRow | null; onClose: () => void; readOnly: boolean }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!lead) return null;
  const save = (k: string) => (v: string) => updateLeadAction(lead.id, { [k]: v });
  const overAsk = lead.askingPrice != null && lead.mao != null && lead.askingPrice > lead.mao;
  return (
    <Drawer open={!!lead} onClose={onClose} label={`Lead ${lead.street}`}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs text-fg-3">
            <span className="num">L-{lead.ref}</span>
            <span>·</span>
            <span>{PROPERTY_TYPES[lead.propertyType as keyof typeof PROPERTY_TYPES]}</span>
            {lead.isSample && <SampleTag />}
          </div>
          <h2 className="truncate text-lg font-semibold">{lead.street}</h2>
          <div className="text-sm text-fg-3">Wichita, KS {lead.zip}</div>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/properties/${lead.propertyId}`} className="inline-flex h-7 items-center gap-1 rounded border border-line bg-surface-2 px-2 text-sm hover:bg-surface-3">
            Open record <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <button aria-label="Close" onClick={onClose} className="rounded p-1.5 text-fg-3 hover:bg-surface-3 hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5">
        <StageMenu leadId={lead.id} stage={lead.stage} disabled={readOnly} />
        <TemperatureTag t={lead.temperature} />
        <VerdictBadge verdict={lead.verdict} />
        {lead.callbackRequested && <Badge tone="negative" dot>Callback requested</Badge>}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <section>
          <div className="eyebrow mb-2">Seller</div>
          <div className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">{lead.sellerName ?? "Unknown"}</div>
              <div className="num text-xs text-fg-3">{formatPhone(lead.sellerPhone)}</div>
            </div>
            <div className="flex items-center gap-1.5">
              {lead.doNotContact && <Badge tone="negative">Do not contact</Badge>}
              {lead.sellerPhone && !lead.doNotContact && (
                <a href={`tel:${lead.sellerPhone}`} className="inline-flex h-7 items-center gap-1.5 rounded border border-line px-2 text-sm hover:bg-surface-3" title="Calls from your own phone. In-app calling arrives in Phase 4.">
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              )}
            </div>
          </div>
          {lead.callbackRequested && !readOnly && (
            <Button size="sm" className="mt-2 w-full" loading={pending} onClick={() => start(async () => (notify(await clearCallbackAction(lead.id)), router.refresh()))}>
              <PhoneCall className="h-3.5 w-3.5" /> Mark callback returned
            </Button>
          )}
        </section>

        <section>
          <div className="eyebrow mb-1">Deal</div>
          <div className="divide-y divide-line">
            <DataRow label="Asking price" value={readOnly ? money(lead.askingPrice) : <InlineEdit label="asking price" kind="money" align="right" value={lead.askingPrice} display={<span className={cn(overAsk && "text-neg")}>{money(lead.askingPrice)}</span>} onSave={save("askingPrice")} />} />
            <DataRow label="Max allowable offer" value={<span className="font-medium">{money(lead.mao)}</span>} />
            <DataRow label="Est. ARV" value={money(lead.arv)} />
            <DataRow label="Rehab estimate" value={money(lead.rehab)} />
            <DataRow label="Cash flow at asking" value={lead.cashFlow != null ? `${money(lead.cashFlow)}/mo` : "—"} />
            <DataRow label="Deal score" value={<ScoreMeter score={lead.dealScore} />} />
          </div>
        </section>

        <section>
          <div className="eyebrow mb-1">Qualification</div>
          <div className="divide-y divide-line">
            <DataRow label="Temperature" value={readOnly ? lead.temperature : <InlineEdit label="temperature" kind="select" align="right" value={lead.temperature} display={<TemperatureTag t={lead.temperature} />} options={[{ value: "hot", label: "Hot" }, { value: "warm", label: "Warm" }, { value: "cold", label: "Cold" }]} onSave={save("temperature")} />} />
            <DataRow label="Timeline" value={readOnly ? lead.timeline ?? "—" : <InlineEdit label="timeline" align="right" value={lead.timeline} onSave={save("timeline")} />} />
            <div className="py-2 text-sm">
              <div className="mb-1 text-fg-2">Motivation</div>
              {readOnly ? <div>{lead.motivation ?? "—"}</div> : <InlineEdit label="motivation" kind="textarea" value={lead.motivation} onSave={save("motivation")} className="w-full" />}
            </div>
          </div>
        </section>

        <section>
          <div className="eyebrow mb-1">Next action</div>
          <div className="divide-y divide-line">
            <DataRow label="Action" value={readOnly ? lead.nextAction ?? "—" : <InlineEdit label="next action" align="right" value={lead.nextAction} onSave={save("nextAction")} />} />
            <DataRow
              label="Due"
              value={readOnly ? relTime(lead.nextActionDueAt) : (
                <InlineEdit
                  label="due date"
                  kind="datetime"
                  align="right"
                  value={lead.nextActionDueAt ? toLocalInput(lead.nextActionDueAt) : null}
                  display={<span className={cn(lead.nextActionDueAt && new Date(lead.nextActionDueAt) < new Date() && "text-warn")}>{relTime(lead.nextActionDueAt)}</span>}
                  onSave={save("nextActionDueAt")}
                />
              )}
            />
          </div>
        </section>

        {!readOnly && (
          <section>
            <div className="eyebrow mb-2">Add note</div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Call summary, condition details, seller expectations…" rows={3} />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="primary"
                disabled={!note.trim()}
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await addNoteAction(lead.propertyId, lead.id, note);
                    notify(r);
                    if (r.ok) setNote("");
                  })
                }
              >
                Add note
              </Button>
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
