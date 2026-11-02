"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadRow } from "@/lib/queries";
import type { LeadStage } from "@/db/schema";
import { STAGES, STUCK_AFTER_DAYS } from "@/lib/domain";
import { money } from "@/lib/format";
import { moveLeadStageAction } from "@/app/actions";
import { StageIcon, ScoreMeter } from "../status";
import { SampleTag } from "../ui/badge";
import { notify } from "../ui/toast";
import { cn } from "../ui/cn";

const days = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);

export function PipelineBoard({ rows, readOnly, showClosed }: { rows: LeadRow[]; readOnly: boolean; showClosed: boolean }) {
  const [items, setItems] = useState(rows);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  useEffect(() => setItems(rows), [rows]);

  const stages = STAGES.filter((s) => showClosed || !s.terminal);
  const move = (id: string, stage: LeadStage) => {
    const prev = items;
    const lead = items.find((i) => i.id === id);
    if (!lead || lead.stage === stage) return;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, stage, stageChangedAt: new Date().toISOString() } : x)));
    start(async () => {
      const r = await moveLeadStageAction(id, stage);
      notify(r);
      if (!r.ok) setItems(prev);
      router.refresh();
    });
  };

  return (
    <div className="flex h-full gap-2.5 overflow-x-auto px-4 pb-4 pt-3 md:px-6">
      {stages.map((s) => {
        const col = items.filter((i) => i.stage === s.id);
        const value = col.reduce((a, r) => a + (r.mao ?? 0), 0);
        return (
          <section
            key={s.id}
            aria-label={s.label}
            onDragOver={(e) => { if (!readOnly && drag) { e.preventDefault(); setOver(s.id); } }}
            onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); if (drag) move(drag, s.id); setDrag(null); setOver(null); }}
            className={cn("flex w-[272px] shrink-0 flex-col rounded-md border border-line bg-surface/60 transition-colors", over === s.id && "border-focus/60 bg-info-bg/30")}
          >
            <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
              <StageIcon stage={s.id} />
              <span className="text-sm font-medium">{s.label}</span>
              <span className="num text-xs text-fg-3">{col.length}</span>
              <span className="num ml-auto text-xs text-fg-3" title="Sum of maximum allowable offers">{value ? money(value, { compact: true }) : ""}</span>
            </header>
            <ul className="flex-1 space-y-1.5 overflow-y-auto p-1.5">
              {col.length === 0 && <li className="rounded border border-dashed border-line px-3 py-5 text-center text-xs text-fg-3">No leads</li>}
              {col.map((r) => {
                const d = days(r.stageChangedAt);
                const sla = STUCK_AFTER_DAYS[r.stage];
                const stuck = sla != null && d > sla;
                const overAsk = r.askingPrice != null && r.mao != null && r.askingPrice > r.mao;
                return (
                  <li
                    key={r.id}
                    draggable={!readOnly}
                    onDragStart={(e) => { setDrag(r.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    className={cn("group rounded border border-line bg-surface px-2.5 py-2 shadow-sm transition-colors hover:border-line-strong", !readOnly && "cursor-grab active:cursor-grabbing", drag === r.id && "opacity-40")}
                  >
                    <div className="flex items-start gap-2">
                      <Link href={`/properties/${r.propertyId}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{r.street}</Link>
                      {r.callbackRequested && <span title="Callback requested" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neg" />}
                      {r.isSample && <SampleTag className="mt-0.5" />}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-fg-3">{r.sellerName ?? "Unknown seller"}</div>
                    <div className="mt-2 grid grid-cols-2 gap-x-2 text-xs">
                      <div><span className="text-fg-3">Ask </span><span className={cn("num", overAsk ? "text-neg" : "text-fg")}>{money(r.askingPrice, { compact: true })}</span></div>
                      <div className="text-right"><span className="text-fg-3">MAO </span><span className="num font-medium">{money(r.mao, { compact: true })}</span></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-line pt-1.5">
                      <span className={cn("text-xs", stuck ? "text-warn" : "text-fg-3")} title={stuck ? `Over ${sla}-day stage SLA` : undefined}>{d === 0 ? "Today" : `${d}d in stage`}</span>
                      <ScoreMeter score={r.dealScore} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
