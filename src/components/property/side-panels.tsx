"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Check, Plus, ShieldCheck, Sparkles } from "lucide-react";
import type { Property, Lead, Contact, Task } from "@/db/schema";
import { money, relTime, formatPhone, shortDate } from "@/lib/format";
import { PROPERTY_TYPES, OCCUPANCY, CONDITION, SOURCES } from "@/lib/domain";
import { updatePropertyAction, updateLeadAction, addTaskAction, completeTaskAction, requestOfferApprovalAction, decideOfferAction } from "@/app/actions";
import { Panel, PanelHeader, DataRow } from "../ui/misc";
import { Badge, SampleTag, type Tone } from "../ui/badge";
import { Button } from "../ui/button";
import { Input, Textarea } from "../ui/field";
import { Modal } from "../ui/overlay";
import { notify } from "../ui/toast";
import { InlineEdit } from "../inline-edit";
import { cn } from "../ui/cn";

const opts = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

export function PropertyOverview({ p, readOnly }: { p: Property; readOnly: boolean }) {
  const save = (k: string) => (v: string) => updatePropertyAction(p.id, { [k]: v });
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.street}, ${p.city}, ${p.state} ${p.zip}`)}`;
  const edit = (k: keyof Property, kind: "number" | "select" | "text", display: React.ReactNode, options?: { value: string; label: string }[]) =>
    readOnly ? display : <InlineEdit label={String(k)} kind={kind} align="right" value={(p[k] as string | number | null) ?? null} display={display} options={options} onSave={save(String(k))} />;
  return (
    <Panel>
      <PanelHeader title="Property" meta={p.isSample ? <SampleTag /> : undefined} />
      <div className="p-3.5">
        {p.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photoUrl} alt={`Photo of ${p.street}`} className="aspect-[16/9] w-full rounded border border-line object-cover" />
        ) : (
          <div className="relative flex aspect-[16/8] w-full flex-col items-center justify-center overflow-hidden rounded border border-line bg-surface-2">
            <svg className="absolute inset-0 h-full w-full text-line" aria-hidden>
              <defs>
                <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
                  <path d="M22 0H0V22" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
            <Building2 className="relative h-5 w-5 text-fg-3" />
            <span className="relative mt-1.5 text-xs text-fg-3">No photo · DealMachine imagery arrives in Phase 2</span>
          </div>
        )}
        <a href={maps} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-fg-2 hover:text-fg hover:underline">
          <MapPin className="h-3 w-3" /> Open in Google Maps
        </a>
      </div>
      <div className="grid grid-cols-4 gap-px border-y border-line bg-line">
        {[
          ["Beds", edit("beds", "number", p.beds ?? "—")],
          ["Baths", edit("baths", "number", p.baths ? Number(p.baths) : "—")],
          ["Sq ft", edit("sqft", "number", p.sqft?.toLocaleString("en-US") ?? "—")],
          ["Built", edit("yearBuilt", "number", p.yearBuilt ?? "—")],
        ].map(([l, v]) => (
          <div key={l as string} className="bg-surface px-3 py-2">
            <div className="text-2xs uppercase tracking-[0.06em] text-fg-3">{l}</div>
            <div className="num mt-0.5 text-md font-medium [&_button]:mx-0 [&_button]:px-0">{v}</div>
          </div>
        ))}
      </div>
      <div className="divide-y divide-line px-3.5 py-1">
        <DataRow label="Type" value={edit("propertyType", "select", PROPERTY_TYPES[p.propertyType], opts(PROPERTY_TYPES))} />
        <DataRow label="Units" value={edit("units", "number", p.units)} />
        <DataRow label="Occupancy" value={edit("occupancy", "select", OCCUPANCY[p.occupancy], opts(OCCUPANCY))} />
        <DataRow label="Condition" value={edit("condition", "select", CONDITION[p.condition], opts(CONDITION))} />
        <DataRow label="County" value={p.county ?? "—"} />
      </div>
      <div className="border-t border-line px-3.5 py-2">
        <div className="eyebrow mb-1 mt-1">Owner of record</div>
        <div className="divide-y divide-line">
          <DataRow label="Name" value={p.ownerName ?? "—"} />
          <DataRow label="Mailing address" value={<span className="block max-w-[200px] truncate">{p.ownerMailingAddress ?? "Same as property"}</span>} />
        </div>
      </div>
      <div className="border-t border-line px-3.5 py-2">
        <div className="eyebrow mb-1 mt-1">Valuation data</div>
        <div className="divide-y divide-line">
          <DataRow label="Assessed value" value={money(p.assessedValue)} hint={<Verified on={p.assessedValue != null} />} />
          <DataRow label="Last sale" value={p.lastSalePrice ? `${money(p.lastSalePrice)} · ${shortDate(p.lastSaleDate)}` : "—"} hint={<Verified on={p.lastSalePrice != null} />} />
          <DataRow label="Estimated value" value={money(p.estimatedValue)} hint={p.estimatedValue != null ? <Badge tone="neutral">Estimate</Badge> : undefined} />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-3.5 py-2.5 text-xs text-fg-3">
        <span>Source: {SOURCES[p.dataSource]}</span>
        <span>Updated {relTime(p.updatedAt)}</span>
      </div>
    </Panel>
  );
}

function Verified({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-0.5 align-middle text-2xs text-fg-3" title="Public record value from source data">
      <ShieldCheck className="h-3 w-3" /> Record
    </span>
  );
}

export function SellerIntel({ lead, contact, readOnly }: { lead: Lead; contact: Contact | null; readOnly: boolean }) {
  const save = (k: string) => (v: string) => updateLeadAction(lead.id, { [k]: k === "openToCashOffer" ? (v === "" ? null : v === "true") : v });
  const e = (k: keyof Lead, kind: "text" | "textarea" | "money" | "select" = "text", display?: React.ReactNode, options?: { value: string; label: string }[]) =>
    readOnly ? (display ?? (lead[k] as string) ?? "—") : (
      <InlineEdit label={String(k)} kind={kind} value={(lead[k] as string | number | null) ?? null} display={display} options={options} onSave={save(String(k))} align={kind === "textarea" ? "left" : "right"} className={kind === "textarea" ? "w-full" : undefined} />
    );
  const consentTone: Record<string, Tone> = { granted: "positive", revoked: "negative", unknown: "neutral" };
  return (
    <Panel>
      <PanelHeader title="Seller intelligence" />
      {contact && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{contact.fullName}</div>
            <div className="num text-xs text-fg-3">{formatPhone(contact.phoneE164)} · {contact.relationship ?? "Owner"}</div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {contact.doNotContact ? <Badge tone="negative">Do not contact</Badge> : <Badge tone={consentTone[contact.smsConsent]}>SMS consent: {contact.smsConsent}</Badge>}
          </div>
        </div>
      )}
      {lead.qualificationSummary && (
        <div className="border-b border-line px-3.5 py-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-2">
            <Sparkles className="h-3 w-3" /> Qualification summary
          </div>
          <p className="text-sm leading-5 text-fg">{lead.qualificationSummary}</p>
        </div>
      )}
      <div className="divide-y divide-line px-3.5 py-1">
        <DataRow label="Motivation score" value={e("motivationScore", "select", lead.motivationScore ? <Dots n={lead.motivationScore} /> : "—", [{ value: "", label: "—" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` }))])} />
        <DataRow label="Timeline" value={e("timeline")} />
        <DataRow label="Asking price" value={e("askingPrice", "money", money(lead.askingPrice))} />
        <DataRow label="Mortgage balance" value={e("mortgageBalance", "money", money(lead.mortgageBalance))} />
        <DataRow label="Price flexibility" value={e("priceFlexibility")} />
        <DataRow label="Open to as-is cash" value={e("openToCashOffer", "select", lead.openToCashOffer == null ? "Unknown" : lead.openToCashOffer ? "Yes" : "No", [{ value: "", label: "Unknown" }, { value: "true", label: "Yes" }, { value: "false", label: "No" }])} />
      </div>
      {(["motivation", "conditionNotes", "titleConcerns"] as const).map((k) => (
        <div key={k} className="border-t border-line px-3.5 py-2.5">
          <div className="mb-1 text-xs text-fg-2">{{ motivation: "Motivation", conditionNotes: "Condition disclosures", titleConcerns: "Title / lien concerns" }[k]}</div>
          {e(k, "textarea")}
        </div>
      ))}
    </Panel>
  );
}

function Dots({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= n ? (n >= 4 ? "bg-pos" : "bg-fg-2") : "bg-surface-3")} />)}
    </span>
  );
}

export function TasksPanel({ leadId, tasks, readOnly }: { leadId: string; tasks: Task[]; readOnly: boolean }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Panel>
      <PanelHeader
        title="Follow-ups"
        meta={tasks.length ? `${tasks.length} open` : undefined}
        actions={!readOnly && <Button size="xs" variant="ghost" onClick={() => setAdding((a) => !a)}><Plus className="h-3 w-3" /> Add</Button>}
      />
      {adding && (
        <form
          className="space-y-2 border-b border-line px-3.5 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addTaskAction(leadId, title, due || null);
              notify(r);
              if (r.ok) (setTitle(""), setDue(""), setAdding(false), router.refresh());
            });
          }}
        >
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call back about walkthrough" aria-label="Task title" />
          <div className="flex gap-2">
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due" />
            <Button type="submit" size="md" variant="primary" disabled={!title.trim()} loading={pending}>Add</Button>
          </div>
        </form>
      )}
      {tasks.length === 0 ? (
        <div className="px-3.5 py-5 text-center text-sm text-fg-3">No open follow-ups.</div>
      ) : (
        <ul className="divide-y divide-line">
          {tasks.map((t) => {
            const overdue = t.dueAt && new Date(t.dueAt) < new Date();
            return (
              <li key={t.id} className="flex items-center gap-2.5 px-3.5 py-2">
                <button
                  disabled={readOnly || pending}
                  aria-label={`Complete ${t.title}`}
                  onClick={() => start(async () => (notify(await completeTaskAction(t.id)), router.refresh()))}
                  className="group flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-line-strong hover:border-pos hover:bg-pos-bg"
                >
                  <Check className="h-3 w-3 text-pos opacity-0 group-hover:opacity-100" />
                </button>
                <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                <span className={cn("shrink-0 text-xs", overdue ? "text-warn" : "text-fg-3")}>{t.dueAt ? relTime(t.dueAt) : "No date"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

type OfferRow = { id: string; amount: number; maxAllowableOffer: number | null; status: string; createdAt: Date; rationale: string | null };
const OFFER_TONE: Record<string, Tone> = { draft: "neutral", pending_approval: "warning", approved: "info", sent: "info", countered: "warning", accepted: "positive", rejected: "negative", withdrawn: "neutral" };

export function OffersPanel({ leadId, offers, mao, recommended, isOwner, readOnly }: { leadId: string; offers: OfferRow[]; mao: number | null; recommended: number | null; isOwner: boolean; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(recommended ? String(recommended) : "");
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const amt = Number(amount.replace(/[^\d]/g, ""));
  const over = mao != null && amt > mao;
  return (
    <Panel>
      <PanelHeader
        title="Offers"
        meta="Owner approval required"
        actions={!readOnly && <Button size="xs" variant="ghost" onClick={() => setOpen(true)} disabled={mao == null} title={mao == null ? "Save a complete analysis first" : undefined}><Plus className="h-3 w-3" /> Request</Button>}
      />
      {offers.length === 0 ? (
        <div className="px-3.5 py-5 text-center text-sm text-fg-3">{mao == null ? "Complete underwriting to recommend an offer." : `Recommended opening offer: ${money(recommended)}`}</div>
      ) : (
        <ul className="divide-y divide-line">
          {offers.map((o) => (
            <li key={o.id} className="px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="num text-sm font-semibold">{money(o.amount)}</span>
                <Badge tone={OFFER_TONE[o.status]}>{o.status.replace("_", " ")}</Badge>
                <span className="ml-auto text-xs text-fg-3">{relTime(o.createdAt)}</span>
              </div>
              <div className="num mt-0.5 text-xs text-fg-3">
                MAO at request {money(o.maxAllowableOffer)}
                {o.maxAllowableOffer != null && o.amount > o.maxAllowableOffer && <span className="text-neg"> · {money(o.amount - o.maxAllowableOffer)} over</span>}
              </div>
              {o.status === "pending_approval" && isOwner && (
                <div className="mt-2 flex gap-1.5">
                  <Button size="xs" variant="positive" loading={pending} onClick={() => start(async () => (notify(await decideOfferAction(o.id, "approve")), router.refresh()))}>Approve</Button>
                  <Button size="xs" variant="danger" loading={pending} onClick={() => start(async () => (notify(await decideOfferAction(o.id, "reject")), router.refresh()))}>Reject</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request offer approval"
        description="The owner must approve before any offer is presented. Approval does not send anything to the seller."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!amt}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await requestOfferApprovalAction(leadId, amt, why);
                  notify(r);
                  if (r.ok) (setOpen(false), router.refresh());
                })
              }
            >
              Submit for approval
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-2" htmlFor="offer-amt">Offer amount</label>
            <Input id="offer-amt" prefix="$" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="num mt-1.5 flex justify-between text-xs">
              <span className="text-fg-3">MAO {money(mao)} · recommended {money(recommended)}</span>
              {over && <span className="text-neg">{money(amt - (mao ?? 0))} above MAO</span>}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-2" htmlFor="offer-why">Rationale</label>
            <Textarea id="offer-why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why this number, what the seller said, room to negotiate…" />
          </div>
        </div>
      </Modal>
    </Panel>
  );
}

type Txn = { contractPrice: number | null; effectiveDate: string | null; earnestMoneyDue: string | null; inspectionDeadline: string | null; closingDate: string | null; titleCompany: string | null; status: string };

export function TransactionPanel({ t }: { t: Txn }) {
  const rows: [string, string | null][] = [
    ["Effective", t.effectiveDate],
    ["Earnest money due", t.earnestMoneyDue],
    ["Inspection deadline", t.inspectionDeadline],
    ["Closing", t.closingDate],
  ];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Panel>
      <PanelHeader title="Transaction" meta={t.status === "closed" ? "Closed" : "Under contract"} />
      <div className="divide-y divide-line px-3.5 py-1">
        <DataRow label="Contract price" value={<span className="font-semibold">{money(t.contractPrice)}</span>} />
        {rows.map(([l, d]) => {
          const past = d && d < today;
          const soon = d && !past && (new Date(d).getTime() - Date.now()) / 864e5 <= 3;
          return <DataRow key={l} label={l} value={<span className={cn(soon && "text-warn", past && "text-fg-3 line-through decoration-fg-3/50")}>{d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—"}</span>} />;
        })}
        <DataRow label="Title company" value={t.titleCompany ?? "—"} />
      </div>
    </Panel>
  );
}
