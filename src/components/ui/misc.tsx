import type { ReactNode } from "react";
import { cn } from "./cn";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("kbd", className)}>{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-3", className)} />;
}

export function Panel({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("rounded-md border border-line bg-surface", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, meta, actions, className }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex min-h-[40px] items-center justify-between gap-3 border-b border-line px-3.5", className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>
        {meta && <span className="hidden truncate text-xs text-fg-3 sm:inline">{meta}</span>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface-2 text-fg-3">{icon}</div>}
      <div className="text-sm font-medium text-fg">{title}</div>
      {body && <div className="mt-1 max-w-sm text-sm text-fg-3">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DataRow({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-[30px] items-center justify-between gap-4 text-sm", className)}>
      <span className="shrink-0 text-fg-2">{label}</span>
      <span className="num flex min-w-0 items-center justify-end text-right text-fg">
        {value}
        {hint && <span className="ml-1.5 text-xs text-fg-3">{hint}</span>}
      </span>
    </div>
  );
}
