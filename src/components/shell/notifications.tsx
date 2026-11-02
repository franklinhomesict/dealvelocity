"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AttentionItem } from "@/lib/queries";
import { relTime } from "@/lib/format";
import { Dot } from "../ui/badge";
import { cn } from "../ui/cn";

export function Notifications({ items, trigger }: { items: AttentionItem[]; trigger: (p: { onClick: () => void; "aria-expanded": boolean }) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open })}
      {open && (
        <div className="fixed left-3 right-3 top-[52px] z-[60] animate-pop-in overflow-hidden rounded-md border border-line-strong bg-surface-2 shadow-pop sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+6px)] sm:w-[380px]">
          <div className="flex h-10 items-center justify-between border-b border-line px-3.5">
            <span className="text-sm font-semibold">Needs your attention</span>
            <span className="num text-xs text-fg-3">{items.length}</span>
          </div>
          <ul className="max-h-[420px] overflow-y-auto py-1">
            {items.length === 0 && <li className="px-3.5 py-6 text-center text-sm text-fg-3">You’re all caught up.</li>}
            {items.map((i) => (
              <li key={i.id}>
                <Link href={i.href} onClick={() => setOpen(false)} className="flex gap-2.5 px-3.5 py-2 hover:bg-surface-3">
                  <Dot tone={i.severity} className="mt-[7px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{i.title}</span>
                    <span className={cn("block truncate text-xs text-fg-3")}>{i.detail}</span>
                  </span>
                  <span className="shrink-0 pt-px text-xs text-fg-3">{relTime(i.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
