"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Building2, Plus, Sun } from "lucide-react";
import { searchAction } from "@/app/actions";
import type { SearchHit } from "@/lib/queries";
import { NAV } from "./nav";
import { StageIcon } from "../status";
import { cn } from "../ui/cn";
import { Kbd } from "../ui/misc";

type Item = { id: string; group: string; label: string; sub?: string; icon: React.ReactNode; run: () => void };

export function CommandPalette({ open, onClose, onQuickAdd, onToggleTheme }: { open: boolean; onClose: () => void; onQuickAdd: () => void; onToggleTheme: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(() => start(async () => setHits(await searchAction(q))), 120);
    return () => clearTimeout(t);
  }, [q]);

  const items: Item[] = useMemo(() => {
    const go = (href: string) => () => (onClose(), router.push(href));
    const results: Item[] = hits.map((h) => ({
      id: h.propertyId,
      group: "Properties",
      label: h.street,
      sub: [h.sellerName, `${h.city} ${h.zip}`, h.ref ? `L-${h.ref}` : null].filter(Boolean).join(" · "),
      icon: h.stage ? <StageIcon stage={h.stage} /> : <Building2 className="h-3.5 w-3.5" />,
      run: go(`/properties/${h.propertyId}`),
    }));
    const ql = q.toLowerCase();
    const nav: Item[] = NAV.flatMap((g) => g.items)
      .filter((n) => !ql || n.label.toLowerCase().includes(ql))
      .map((n) => ({ id: n.href, group: "Go to", label: n.label, sub: n.phase ? `Phase ${n.phase}` : undefined, icon: <n.icon className="h-3.5 w-3.5" />, run: go(n.href) }));
    const actions: Item[] = [
      { id: "add", group: "Actions", label: "Add property", icon: <Plus className="h-3.5 w-3.5" />, run: onQuickAdd },
      { id: "theme", group: "Actions", label: "Toggle light / dark theme", icon: <Sun className="h-3.5 w-3.5" />, run: () => (onClose(), onToggleTheme()) },
    ].filter((a) => !ql || a.label.toLowerCase().includes(ql));
    return [...results, ...actions, ...nav];
  }, [hits, q, router, onClose, onQuickAdd, onToggleTheme]);

  useEffect(() => setActive(0), [items.length]);
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open || typeof document === "undefined") return null;
  let lastGroup = "";
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 px-3 pt-[12vh] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Command menu" className="w-full max-w-[600px] animate-pop-in overflow-hidden rounded-lg border border-line-strong bg-surface shadow-pop">
        <div className="flex h-12 items-center gap-2.5 border-b border-line px-3.5">
          <Search className="h-4 w-4 text-fg-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, items.length - 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              else if (e.key === "Enter") (e.preventDefault(), items[active]?.run());
              else if (e.key === "Escape") onClose();
            }}
            placeholder="Search properties, sellers, phone numbers, or jump to…"
            aria-label="Search"
            className="h-full flex-1 bg-transparent text-md text-fg placeholder:text-fg-3 focus:outline-none"
          />
          {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-fg-3 border-t-transparent" />}
          <Kbd>Esc</Kbd>
        </div>
        <div ref={list} className="max-h-[380px] overflow-y-auto p-1.5" role="listbox">
          {q.trim().length >= 2 && !pending && hits.length === 0 && (
            <div className="px-3 py-3 text-sm text-fg-3">No properties or sellers match “{q}”.</div>
          )}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? ((lastGroup = it.group), <div key={`h-${it.group}`} className="eyebrow px-2.5 pb-1 pt-2.5">{it.group}</div>) : null;
            return (
              <div key={it.group + it.id}>
                {header}
                <button
                  data-idx={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={it.run}
                  className={cn("flex h-9 w-full items-center gap-2.5 rounded px-2.5 text-left text-sm", i === active ? "bg-surface-3 text-fg" : "text-fg-2")}
                >
                  <span className="flex w-4 justify-center text-fg-3">{it.icon}</span>
                  <span className="truncate text-fg">{it.label}</span>
                  {it.sub && <span className="truncate text-xs text-fg-3">{it.sub}</span>}
                  {i === active && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-fg-3" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-3.5 py-2 text-xs text-fg-3">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <span className="ml-auto flex items-center gap-1"><Kbd>Esc</Kbd> close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
