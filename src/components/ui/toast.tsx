"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "./cn";

type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
let listeners: ((t: Toast[]) => void)[] = [];
let toasts: Toast[] = [];
let seq = 0;

function emit() {
  listeners.forEach((l) => l(toasts));
}
export function toast(text: string, kind: Toast["kind"] = "success") {
  const t = { id: ++seq, kind, text };
  toasts = [...toasts.slice(-3), t];
  emit();
  setTimeout(() => dismiss(t.id), kind === "error" ? 6000 : 3200);
}
toast.error = (text: string) => toast(text, "error");
toast.info = (text: string) => toast(text, "info");
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Shows the result of a server action. */
export function notify(r: { ok: boolean; message?: string; error?: string }, fallback = "Saved") {
  if (r.ok) toast(r.message ?? fallback);
  else toast.error(r.error ?? "Something went wrong");
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="pointer-events-auto flex animate-pop-in items-start gap-2.5 rounded-md border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-fg shadow-pop"
        >
          {t.kind === "success" ? (
            <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-pos" />
          ) : t.kind === "error" ? (
            <AlertCircle className="mt-px h-4 w-4 shrink-0 text-neg" />
          ) : (
            <Info className="mt-px h-4 w-4 shrink-0 text-info" />
          )}
          <span className={cn("flex-1 leading-5")}>{t.text}</span>
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-fg-3 hover:text-fg">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
