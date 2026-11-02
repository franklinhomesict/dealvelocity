"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { cn } from "./ui/cn";
import { notify } from "./ui/toast";
import type { ActionResult } from "@/app/actions";

type Kind = "text" | "money" | "number" | "textarea" | "datetime" | "select";

/**
 * Click-to-edit value. Enter (or blur) saves through the given server action,
 * Escape cancels. Shows a pending state and toasts the result.
 */
export function InlineEdit({
  value, display, kind = "text", options, placeholder = "Add…", onSave, className, align = "left", label,
}: {
  value: string | number | null;
  display?: React.ReactNode;
  kind?: Kind;
  options?: { value: string; label: string }[];
  placeholder?: string;
  onSave: (v: string) => Promise<ActionResult>;
  className?: string;
  align?: "left" | "right";
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      if (kind !== "select") ref.current?.select?.();
    }
  }, [editing, kind]);
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);

  const commit = () => {
    const orig = value == null ? "" : String(value);
    if (draft === orig) return setEditing(false);
    start(async () => {
      const r = await onSave(draft);
      notify(r);
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  };
  const cancel = () => {
    setDraft(value == null ? "" : String(value));
    setEditing(false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") (e.preventDefault(), e.stopPropagation(), cancel());
    if (e.key === "Enter" && (kind !== "textarea" || e.metaKey || e.ctrlKey)) (e.preventDefault(), commit());
  };

  const input = "w-full rounded-sm border border-focus bg-surface-2 px-1.5 text-sm text-fg outline-none ring-2 ring-focus/20";
  if (editing) {
    if (kind === "textarea")
      return <textarea aria-label={label} ref={ref} rows={3} value={draft} disabled={pending} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey} className={cn(input, "py-1 leading-5", className)} />;
    if (kind === "select")
      return (
        <select aria-label={label} ref={ref} value={draft} disabled={pending} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey} className={cn(input, "h-7", className)}>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    return (
      <input
        aria-label={label}
        ref={ref}
        type={kind === "datetime" ? "datetime-local" : "text"}
        inputMode={kind === "money" || kind === "number" ? "numeric" : undefined}
        value={draft}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className={cn(input, "h-7", (kind === "money" || kind === "number") && "num", align === "right" && "text-right", className)}
      />
    );
  }
  const empty = value == null || value === "";
  return (
    <button
      type="button"
      aria-label={`Edit ${label}`}
      onClick={() => setEditing(true)}
      className={cn(
        "group -mx-1.5 inline-flex min-h-[26px] items-center gap-1.5 rounded-sm px-1.5 text-left text-sm hover:bg-surface-3",
        kind === "textarea" ? "max-w-full" : "shrink-0",
        align === "right" && "justify-end",
        empty ? "text-fg-3" : "text-fg",
        pending && "opacity-60",
        className,
      )}
    >
      <span className={cn("min-w-0", kind === "textarea" ? "whitespace-pre-wrap" : "block max-w-[200px] truncate", (kind === "money" || kind === "number") && "num")}>{empty ? placeholder : display ?? String(value)}</span>
      <Pencil className={cn("h-3 w-3 shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100", align === "right" && "order-first")} />
    </button>
  );
}
