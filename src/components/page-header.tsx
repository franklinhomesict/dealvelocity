import type { ReactNode } from "react";
import { cn } from "./ui/cn";

export function PageHeader({ title, meta, actions, children, className }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("border-b border-line", className)}>
      <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 md:px-6">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {meta && <div className="truncate text-sm text-fg-3">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** Standard table header cell / cell styles shared by every data table. */
export const th = "h-8 whitespace-nowrap px-3 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6";
export const td = "h-row whitespace-nowrap px-3 text-sm first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6";
