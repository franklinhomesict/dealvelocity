"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Search, SlidersHorizontal, BookmarkPlus, X, Users } from "lucide-react";
import type { LeadRow, LeadSort } from "@/lib/queries";
import type { LeadStage } from "@/db/schema";
import { STAGES } from "@/lib/domain";
import { money, relTime } from "@/lib/format";
import { saveViewAction, deleteViewAction } from "@/app/actions";
import { th, td } from "../page-header";
import { cn } from "../ui/cn";
import { Menu } from "../ui/menu";
import { Button } from "../ui/button";
import { Kbd, EmptyState } from "../ui/misc";
import { SampleTag } from "../ui/badge";
import { Modal } from "../ui/overlay";
import { Input } from "../ui/field";
import { notify } from "../ui/toast";
import { StageIcon, ScoreMeter, TemperatureTag } from "../status";
import { StageMenu } from "./stage-menu";
import { BUILTIN_VIEWS } from "@/lib/views";
import { LeadDrawer } from "./lead-drawer";


type Col = { key: LeadSort | null; label: string; align?: "right"; className?: string };
const COLS: Col[] = [
  { key: "address", label: "Property" },
  { key: null, label: "Seller" },
  { key: "stage", label: "Stage" },
  { key: null, label: "Temp" },
  { key: "asking", label: "Asking", align: "right" },
  { key: "mao", label: "MAO", align: "right" },
  { key: "score", label: "Score", align: "right" },
  { key: "next", label: "Next action" },
  { key: "updated", label: "Updated", align: "right" },
];

export function LeadsTable({
  rows, views, readOnly,
}: { rows: LeadRow[]; views: { id: string; name: string; query: Record<string, string> }[]; readOnly: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const tbody = useRef<HTMLTableSectionElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sort = (params.get("sort") as LeadSort) ?? "updated";
  const dir = params.get("dir") ?? "desc";
  const stages = (params.get("stage") ?? "").split(",").filter(Boolean) as LeadStage[];
  const temp = params.get("temp") ?? "";
  const currentView = params.get("view") ?? (params.toString() ? null : "active");

  const setParams = (patch: Record<string, string | null>, keepView = false) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!keepView) next.delete("view");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const applyView = (v: { id: string; query: Record<string, string> }) => {
    const next = new URLSearchParams({ ...v.query, view: v.id });
    setQ(v.query.q ?? "");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search → URL
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => setParams({ q: q || null }), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // j/k navigation, Enter opens, / focuses filter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || document.querySelector("[role=dialog]") || e.metaKey || e.ctrlKey) return;
      if (e.key === "j" || e.key === "ArrowDown") (e.preventDefault(), setCursor((c) => Math.min(c + 1, rows.length - 1)));
      else if (e.key === "k" || e.key === "ArrowUp") (e.preventDefault(), setCursor((c) => Math.max(c - 1, 0)));
      else if (e.key === "Enter" && rows[cursor]) setSelectedId(rows[cursor].id);
      else if (e.key === "f") (e.preventDefault(), searchRef.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, cursor]);
  useEffect(() => {
    tbody.current?.querySelector(`[data-row="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);
  useEffect(() => setCursor(0), [rows.length]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const filtersActive = stages.length > 0 || !!temp || !!q;
  const allViews = [...BUILTIN_VIEWS, ...views];

  return (
    <>
      {/* View tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-4 md:px-6">
        {allViews.map((v) => {
          const custom = !BUILTIN_VIEWS.some((b) => b.id === v.id);
          return (
            <div key={v.id} className="group relative flex items-center">
              <button
                onClick={() => applyView(v)}
                className={cn(
                  "relative h-9 whitespace-nowrap px-2.5 text-sm transition-colors",
                  currentView === v.id ? "font-medium text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:rounded-full after:bg-fg" : "text-fg-3 hover:text-fg-2",
                )}
              >
                {v.name}
              </button>
              {custom && (
                <button
                  aria-label={`Delete view ${v.name}`}
                  onClick={() => start(async () => notify(await deleteViewAction(v.id)))}
                  className="-ml-1.5 mr-1 hidden rounded p-0.5 text-fg-3 hover:text-fg group-hover:block"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 md:px-6">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setQ(""), (e.target as HTMLInputElement).blur())}
            placeholder="Filter leads…"
            aria-label="Filter leads"
            className="h-7 w-full rounded border border-line bg-surface pl-8 pr-8 text-sm placeholder:text-fg-3 hover:border-line-strong focus:border-focus focus:outline-none"
          />
          <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">F</Kbd>
        </div>
        <Menu
          label="Filter by stage"
          align="start"
          width={210}
          trigger={(p) => (
            <Button {...p} size="sm" variant={stages.length ? "secondary" : "ghost"} className={cn(!stages.length && "border border-dashed border-line-strong")}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Stage{stages.length ? <span className="num rounded-sm bg-surface-3 px-1 text-2xs">{stages.length}</span> : null}
            </Button>
          )}
          items={STAGES.map((s) => ({
            label: s.label,
            icon: <StageIcon stage={s.id} />,
            checked: stages.includes(s.id),
            onSelect: () => {
              const n = stages.includes(s.id) ? stages.filter((x) => x !== s.id) : [...stages, s.id];
              setParams({ stage: n.join(",") || null });
            },
          }))}
        />
        <div className="flex h-7 items-center rounded border border-line bg-surface p-0.5" role="group" aria-label="Temperature">
          {["", "hot", "warm", "cold"].map((t) => (
            <button
              key={t}
              onClick={() => setParams({ temp: t || null })}
              aria-pressed={temp === t}
              className={cn("h-full rounded-sm px-2 text-xs capitalize", temp === t ? "bg-surface-3 font-medium text-fg" : "text-fg-3 hover:text-fg-2")}
            >
              {t || "Any"}
            </button>
          ))}
        </div>
        {filtersActive && (
          <Button size="sm" variant="ghost" onClick={() => (setQ(""), setParams({ q: null, stage: null, temp: null }))}>
            Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="num text-xs text-fg-3">{rows.length} {rows.length === 1 ? "lead" : "leads"}</span>
          <Button size="sm" variant="ghost" onClick={() => setSaveOpen(true)} disabled={!params.toString()}>
            <BookmarkPlus className="h-3.5 w-3.5" /> Save view
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-4 w-4" />}
          title={filtersActive ? "No leads match these filters" : "No leads yet"}
          body={filtersActive ? "Try removing a filter or searching by a different address or seller name." : "Add a property to create your first lead."}
          action={filtersActive ? <Button size="sm" onClick={() => (setQ(""), setParams({ q: null, stage: null, temp: null }))}>Clear filters</Button> : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead className="sticky top-0 z-10 bg-app">
                <tr className="border-b border-line">
                  {COLS.map((c) => (
                    <th key={c.label} className={cn(th, c.align === "right" && "text-right")} aria-sort={c.key && sort === c.key ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                      {c.key ? (
                        <button
                          onClick={() => setParams({ sort: c.key, dir: sort === c.key && dir === "desc" ? "asc" : "desc" }, true)}
                          className={cn("inline-flex items-center gap-1 uppercase hover:text-fg-2", sort === c.key && "text-fg-2")}
                        >
                          {c.label}
                          {sort === c.key && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={tbody}>
                {rows.map((r, i) => {
                  const overAsk = r.askingPrice != null && r.mao != null && r.askingPrice > r.mao;
                  const overdue = r.nextActionDueAt && new Date(r.nextActionDueAt) < new Date();
                  return (
                    <tr
                      key={r.id}
                      data-row={i}
                      onClick={() => (setCursor(i), setSelectedId(r.id))}
                      className={cn("row-hover cursor-pointer border-b border-line", cursor === i && "bg-surface-2 shadow-[inset_2px_0_0_rgb(var(--focus))]")}
                    >
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <span className="num w-12 shrink-0 text-xs text-fg-3">L-{r.ref}</span>
                          <Link href={`/properties/${r.propertyId}`} onClick={(e) => e.stopPropagation()} className="max-w-[210px] truncate font-medium hover:underline">
                            {r.street}
                          </Link>
                          {r.isSample && <SampleTag />}
                          {r.callbackRequested && <span title="Callback requested" className="h-1.5 w-1.5 rounded-full bg-neg" />}
                        </div>
                      </td>
                      <td className={cn(td, "max-w-[160px] truncate text-fg-2")}>{r.sellerName ?? "—"}</td>
                      <td className={td} onClick={(e) => e.stopPropagation()}>
                        <StageMenu leadId={r.id} stage={r.stage} compact disabled={readOnly} />
                      </td>
                      <td className={td}><TemperatureTag t={r.temperature} /></td>
                      <td className={cn(td, "num text-right", overAsk && "text-neg")}>{money(r.askingPrice)}</td>
                      <td className={cn(td, "num text-right font-medium")}>{money(r.mao)}</td>
                      <td className={cn(td, "text-right")}><ScoreMeter score={r.dealScore} /></td>
                      <td className={cn(td, "max-w-[240px]")}>
                        <div className="flex items-baseline gap-2">
                          <span className="truncate text-fg-2">{r.nextAction ?? "—"}</span>
                          {r.nextActionDueAt && <span className={cn("shrink-0 text-xs", overdue ? "text-warn" : "text-fg-3")}>{relTime(r.nextActionDueAt)}</span>}
                        </div>
                      </td>
                      <td className={cn(td, "text-right text-xs text-fg-3")}>{relTime(r.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <button onClick={() => setSelectedId(r.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-surface-2">
                  <StageIcon stage={r.stage} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.street}</span>
                      {r.callbackRequested && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neg" />}
                    </div>
                    <div className="truncate text-xs text-fg-3">{r.sellerName ?? "Unknown seller"} · {r.nextAction ?? "No next action"}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num text-sm font-medium">{money(r.mao, { compact: true })}</div>
                    <div className="text-2xs text-fg-3">MAO</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <LeadDrawer lead={selected} onClose={() => setSelectedId(null)} readOnly={readOnly} />

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save view"
        description="Saves the current filters and sort as a tab."
        width={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!viewName.trim()}
              onClick={() =>
                start(async () => {
                  const query = Object.fromEntries([...params.entries()].filter(([k]) => k !== "view"));
                  const r = await saveViewAction("leads", viewName, query);
                  notify(r);
                  if (r.ok) (setSaveOpen(false), setViewName(""));
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <Input autoFocus value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="e.g. Hot heirs in 67213" aria-label="View name" />
      </Modal>
    </>
  );
}
