import type { LeadStage } from "@/db/schema";
import { stageLabel } from "@/lib/domain";
import { cn } from "./ui/cn";
import { Badge, type Tone } from "./ui/badge";

/** Stage glyph: a ring that fills as the lead progresses. Color only for terminal outcomes. */
const PROGRESS: Record<LeadStage, number> = {
  new: 0, contacting: 1, qualified: 2, underwriting: 3, offer: 4, negotiating: 5, under_contract: 6, closed: 7, dead: -1,
};

export function StageIcon({ stage, className }: { stage: LeadStage; className?: string }) {
  const p = PROGRESS[stage];
  const r = 5.25;
  const c = 2 * Math.PI * r;
  if (stage === "dead")
    return (
      <svg viewBox="0 0 14 14" className={cn("h-3.5 w-3.5 shrink-0 text-fg-3", className)} aria-hidden>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.8 4.8l4.4 4.4M9.2 4.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  if (stage === "closed")
    return (
      <svg viewBox="0 0 14 14" className={cn("h-3.5 w-3.5 shrink-0 text-pos", className)} aria-hidden>
        <circle cx="7" cy="7" r="6.25" fill="currentColor" />
        <path d="M4.3 7.2l1.8 1.8 3.6-3.8" fill="none" stroke="rgb(var(--bg-surface))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  const frac = p / 7;
  const color = stage === "under_contract" ? "text-pos" : p >= 4 ? "text-warn" : p >= 2 ? "text-info" : "text-fg-3";
  return (
    <svg viewBox="0 0 14 14" className={cn("h-3.5 w-3.5 shrink-0 -rotate-90", color, className)} aria-hidden>
      <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={p === 0 ? "1.6 1.6" : undefined} opacity={p === 0 ? 1 : 0.35} />
      {p > 0 && <circle cx="7" cy="7" r={r / 2} fill="none" stroke="currentColor" strokeWidth={r} strokeDasharray={`${(c / 2) * frac} ${c}`} />}
    </svg>
  );
}

export function StagePill({ stage, className }: { stage: LeadStage; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-fg", className)}>
      <StageIcon stage={stage} />
      {stageLabel(stage)}
    </span>
  );
}

export function TemperatureTag({ t }: { t: "hot" | "warm" | "cold" }) {
  const dot = { hot: "bg-neg", warm: "bg-warn", cold: "bg-fg-3" }[t];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-fg-2">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {t[0].toUpperCase() + t.slice(1)}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-xs text-fg-3">Not analyzed</span>;
  const map: Record<string, [Tone, string]> = { pass: ["positive", "Meets criteria"], review: ["warning", "Review"], fail: ["negative", "Fails criteria"] };
  const [tone, text] = map[verdict] ?? ["neutral", verdict];
  return <Badge tone={tone}>{text}</Badge>;
}

export function ScoreMeter({ score, className }: { score: number | null; className?: string }) {
  if (score == null) return <span className="text-fg-3">—</span>;
  // Only strong deals get color; everything else stays neutral to keep tables calm.
  const tone = score >= 70 ? "bg-pos" : score >= 50 ? "bg-fg-2" : "bg-fg-3/60";
  const text = score >= 70 ? "text-pos" : score >= 50 ? "text-fg" : "text-fg-3";
  return (
    <span className={cn("inline-flex items-center justify-end gap-2", className)} title={`Deal score ${score}/100`}>
      <span className="relative h-1 w-10 overflow-hidden rounded-full bg-surface-3">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${score}%` }} />
      </span>
      <span className={cn("num w-6 text-right text-sm font-medium", text)}>{score}</span>
    </span>
  );
}
