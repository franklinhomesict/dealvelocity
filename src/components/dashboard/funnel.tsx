import Link from "next/link";
import type { LeadStage } from "@/db/schema";
import { STAGES, STUCK_AFTER_DAYS } from "@/lib/domain";
import { StageIcon } from "../status";

export function PipelineFunnel({ data }: { data: { stage: LeadStage; count: number; medianDays: number; stuck: number }[] }) {
  const stages = STAGES.filter((s) => !s.terminal);
  const by = new Map(data.map((d) => [d.stage, d]));
  const max = Math.max(1, ...data.map((d) => d.count));
  // The bottleneck is the stage holding the most stuck leads.
  const worst = [...data].sort((a, b) => b.stuck - a.stuck)[0];
  return (
    <div className="px-3.5 py-3">
      <ul className="space-y-1">
        {stages.map((s) => {
          const d = by.get(s.id);
          const count = d?.count ?? 0;
          const stuck = d?.stuck ?? 0;
          const healthy = count - stuck;
          return (
            <li key={s.id}>
              <Link href={`/leads?stage=${s.id}`} className="group grid grid-cols-[112px_1fr_84px] items-center gap-3 rounded px-1 py-1 hover:bg-surface-2">
                <span className="flex items-center gap-2 truncate text-sm text-fg-2 group-hover:text-fg">
                  <StageIcon stage={s.id} />
                  {s.label}
                </span>
                <span className="flex h-[14px] items-center">
                  <span className="flex h-full overflow-hidden rounded-[3px]" style={{ width: `${Math.max((count / max) * 100, count ? 4 : 0)}%` }}>
                    <span className="h-full bg-fg-3/50" style={{ flex: healthy }} />
                    <span className="h-full bg-warn" style={{ flex: stuck }} />
                  </span>
                  {!count && <span className="h-px w-full bg-line" />}
                </span>
                <span className="num flex items-baseline justify-end gap-1.5 text-sm">
                  {stuck > 0 && <span className="text-xs text-warn" title={`${stuck} in stage longer than ${STUCK_AFTER_DAYS[s.id]} days`}>{stuck} stuck</span>}
                  <span className="w-5 text-right font-medium text-fg">{count}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs text-fg-3">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-fg-3/50" />Moving</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-warn" />Stuck past SLA</span>
        </span>
        {worst && worst.stuck > 0 ? (
          <span className="text-warn">Bottleneck: {STAGES.find((s) => s.id === worst.stage)?.label}</span>
        ) : (
          <span>No bottlenecks</span>
        )}
      </div>
    </div>
  );
}
