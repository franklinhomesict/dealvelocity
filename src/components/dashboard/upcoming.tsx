import Link from "next/link";
import type { UpcomingItem } from "@/lib/queries";
import { cn } from "../ui/cn";

const TZ = "America/Chicago";

export function Upcoming({ items }: { items: UpcomingItem[] }) {
  if (!items.length) return <div className="px-3.5 py-6 text-center text-sm text-fg-3">Nothing scheduled in the next week.</div>;
  let lastDay = "";
  return (
    <ul className="py-1.5">
      {items.map((i) => {
        const d = new Date(i.at);
        const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
        const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
        const header = day !== lastDay ? ((lastDay = day), day === today ? "Today" : day) : null;
        return (
          <li key={i.id}>
            {header && <div className="eyebrow px-3.5 pb-1 pt-2">{header}</div>}
            <Link href={i.href} className="flex items-center gap-2.5 px-3.5 py-1.5 hover:bg-surface-2">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", i.kind === "task" ? "bg-fg-3" : i.kind === "closing" ? "bg-pos" : "bg-warn")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">{i.title}</span>
                <span className="block truncate text-xs text-fg-3">{i.detail}</span>
              </span>
              <span className="num shrink-0 text-xs text-fg-3">
                {i.kind === "task" ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }) : "All day"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
