import { cn } from "./cn";
import type { ReactNode } from "react";

export type Tone = "neutral" | "positive" | "warning" | "negative" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-fg-2 border-line",
  positive: "bg-pos-bg text-pos border-pos/20",
  warning: "bg-warn-bg text-warn border-warn/20",
  negative: "bg-neg-bg text-neg border-neg/20",
  info: "bg-info-bg text-info border-info/20",
};
const dots: Record<Tone, string> = {
  neutral: "bg-fg-3",
  positive: "bg-pos",
  warning: "bg-warn",
  negative: "bg-neg",
  info: "bg-info",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-[18px] items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-2xs font-medium", tones[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", dots[tone], className)} />;
}

export function SampleTag({ className }: { className?: string }) {
  return (
    <span
      title="Development sample record — not real business data"
      className={cn("inline-flex h-4 items-center rounded-sm border border-dashed border-line-strong px-1 text-[9.5px] font-semibold uppercase tracking-wider text-fg-3", className)}
    >
      Sample
    </span>
  );
}
