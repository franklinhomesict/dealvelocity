import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./page-header";

export function PlannedPage({ title, phase, icon: Icon, summary, items }: { title: string; phase: number; icon: LucideIcon; summary: string; items: string[] }) {
  return (
    <div>
      <PageHeader title={title} meta={<span className="rounded-sm border border-line px-1.5 py-px text-2xs font-semibold uppercase tracking-wider text-fg-3">Phase {phase} · not yet available</span>} />
      <div className="mx-auto max-w-xl px-4 py-14">
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface-2 text-fg-3"><Icon className="h-4 w-4" /></div>
        <h2 className="text-lg font-semibold">{title} is planned for Phase {phase}</h2>
        <p className="mt-1.5 text-sm text-fg-2">{summary}</p>
        <ul className="mt-5 space-y-2 border-t border-line pt-4">
          {items.map((i) => <li key={i} className="flex gap-2.5 text-sm text-fg-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-3" />{i}</li>)}
        </ul>
        <p className="mt-6 text-xs text-fg-3">Nothing on this screen is connected yet. No calls, messages or documents are sent from this application.</p>
      </div>
    </div>
  );
}
