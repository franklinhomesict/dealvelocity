"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  icon?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  separatorBefore?: boolean;
}

/** Accessible dropdown menu with arrow-key navigation. */
export function Menu({ trigger, items, align = "end", width = 200, label }: { trigger: (p: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode; items: MenuItem[]; align?: "start" | "end"; width?: number; label?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (open) {
      const first = items.findIndex((i) => !i.disabled);
      setActive(first < 0 ? 0 : first);
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("[role=menu]")?.focus());
    }
  }, [open, items]);
  const select = (i: MenuItem) => {
    if (i.disabled) return;
    setOpen(false);
    i.onSelect?.();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = (d: number) => {
      let n = active;
      for (let k = 0; k < items.length; k++) {
        n = (n + d + items.length) % items.length;
        if (!items[n].disabled) break;
      }
      setActive(n);
    };
    if (e.key === "ArrowDown") (e.preventDefault(), step(1));
    else if (e.key === "ArrowUp") (e.preventDefault(), step(-1));
    else if (e.key === "Enter") (e.preventDefault(), select(items[active]));
    else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
  };
  return (
    <div ref={ref} className="relative inline-flex">
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open && (
        <div
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKey}
          style={{ width }}
          className={cn("absolute top-[calc(100%+4px)] z-[60] animate-pop-in rounded-md border border-line-strong bg-surface-2 p-1 shadow-pop outline-none", align === "end" ? "right-0" : "left-0")}
        >
          {items.map((i, idx) => (
            <div key={i.label}>
              {i.separatorBefore && <div className="my-1 h-px bg-line" />}
              <button
                role="menuitem"
                disabled={i.disabled}
                onMouseEnter={() => setActive(idx)}
                onClick={() => select(i)}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-sm",
                  idx === active && !i.disabled && "bg-surface-3",
                  i.danger ? "text-neg" : "text-fg",
                  i.disabled && "cursor-not-allowed text-fg-3",
                )}
              >
                {i.icon && <span className="flex w-4 justify-center text-fg-3">{i.icon}</span>}
                <span className="flex-1 truncate">{i.label}</span>
                {i.checked && <span className="text-xs text-fg-2">✓</span>}
                {i.hint && <span className="text-xs text-fg-3">{i.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
