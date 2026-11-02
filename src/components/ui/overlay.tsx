"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

function useFocusTrap(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current.querySelector<HTMLElement>("[autofocus],input,select,textarea,button:not([data-close])");
    el?.focus();
    return () => prev?.focus?.();
  }, [open]);
  return ref;
}

export function Modal({
  open, onClose, title, description, children, footer, width = 480,
}: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEscape(open, onClose);
  const ref = useFocusTrap(open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 px-4 pb-8 pt-[10vh] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }} className="w-full animate-pop-in rounded-lg border border-line-strong bg-surface shadow-pop">
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-md font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-fg-3">{description}</p>}
          </div>
          <button data-close aria-label="Close" onClick={onClose} className="rounded p-1 text-fg-3 hover:bg-surface-3 hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, children, width = 520, label }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; label: string }) {
  useEscape(open, onClose);
  const ref = useFocusTrap(open);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/30 md:bg-black/20" onMouseDown={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        style={{ width: `min(${width}px, 100vw)` }}
        className={cn("absolute bottom-0 right-0 top-0 flex animate-slide-in flex-col border-l border-line-strong bg-surface shadow-drawer")}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
