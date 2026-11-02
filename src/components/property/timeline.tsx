"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Phone, MessageSquare, Mail, ArrowRightLeft, Calculator, HandCoins, CheckSquare, FileText, Cog, PhoneIncoming, PhoneMissed } from "lucide-react";
import { addNoteAction } from "@/app/actions";
import { dateTime, relTime } from "@/lib/format";
import { Textarea } from "../ui/field";
import { Button } from "../ui/button";
import { notify } from "../ui/toast";
import { Kbd } from "../ui/misc";
import { cn } from "../ui/cn";

export interface TimelineItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: unknown;
  occurredAt: Date | string;
  actorLabel: string | null;
  actorName: string | null;
}

const ICON: Record<string, typeof StickyNote> = {
  note: StickyNote, call: Phone, sms: MessageSquare, email: Mail, stage_change: ArrowRightLeft, analysis: Calculator,
  offer: HandCoins, task: CheckSquare, document: FileText, system: Cog,
};
const FILTERS = [
  { id: "all", label: "All" },
  { id: "comms", label: "Calls & texts", types: ["call", "sms", "email"] },
  { id: "note", label: "Notes", types: ["note"] },
  { id: "deal", label: "Deal", types: ["analysis", "offer", "stage_change", "document"] },
];

export function Timeline({ items, propertyId, leadId, readOnly }: { items: TimelineItem[]; propertyId: string; leadId: string | null; readOnly: boolean }) {
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("all");
  const [pending, start] = useTransition();
  const router = useRouter();
  const types = FILTERS.find((f) => f.id === filter)?.types;
  const shown = types ? items.filter((i) => types.includes(i.type)) : items;
  const submit = () =>
    start(async () => {
      const r = await addNoteAction(propertyId, leadId, note);
      notify(r);
      if (r.ok) (setNote(""), router.refresh());
    });
  return (
    <div>
      {!readOnly && (
        <div className="border-b border-line px-3.5 py-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && note.trim() && submit()}
            placeholder="Log a note — call outcome, condition details, seller expectations…"
            rows={2}
            aria-label="New note"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-fg-3"><Kbd>⌘</Kbd><Kbd>↵</Kbd> to save</span>
            <Button size="sm" variant="primary" disabled={!note.trim()} loading={pending} onClick={submit}>Add note</Button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 border-b border-line px-3.5 py-1.5">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={cn("h-6 rounded-sm px-2 text-xs", filter === f.id ? "bg-surface-3 font-medium text-fg" : "text-fg-3 hover:text-fg-2")}>
            {f.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="px-3.5 py-8 text-center text-sm text-fg-3">No activity of this type yet.</div>
      ) : (
        <ol className="relative px-3.5 py-3">
          <span className="absolute bottom-5 left-[29px] top-5 w-px bg-line" aria-hidden />
          {shown.map((i) => {
            const meta = (i.metadata ?? {}) as { direction?: string; missed?: boolean };
            const Icon = i.type === "call" && meta.missed ? PhoneMissed : i.type === "call" && meta.direction === "inbound" ? PhoneIncoming : ICON[i.type] ?? Cog;
            const who = i.actorName ?? i.actorLabel ?? "System";
            return (
              <li key={i.id} className="relative flex gap-3 pb-4 last:pb-0">
                <span className={cn("relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-line bg-surface", i.type === "note" && "border-line-strong", meta.missed && "text-neg")}>
                  <Icon className={cn("h-3.5 w-3.5", !meta.missed && "text-fg-2")} />
                </span>
                <div className="min-w-0 flex-1 pt-[5px]">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-fg">{i.title}</span>
                    <span className="text-xs text-fg-3">{who}</span>
                    <span className="ml-auto text-xs text-fg-3" title={dateTime(i.occurredAt)}>{relTime(i.occurredAt)}</span>
                  </div>
                  {i.body && (
                    <p className={cn("mt-1 whitespace-pre-wrap text-sm leading-5 text-fg-2", (i.type === "note" || i.type === "sms") && "rounded border border-line bg-surface-2 px-2.5 py-2")}>{i.body}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
