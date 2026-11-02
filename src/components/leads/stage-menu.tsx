"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { LeadStage } from "@/db/schema";
import { STAGES } from "@/lib/domain";
import { moveLeadStageAction } from "@/app/actions";
import { Menu } from "../ui/menu";
import { StageIcon, StagePill } from "../status";
import { notify } from "../ui/toast";
import { cn } from "../ui/cn";

export function StageMenu({ leadId, stage, compact, disabled }: { leadId: string; stage: LeadStage; compact?: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Menu
      label="Change stage"
      align="start"
      width={190}
      trigger={(p) => (
        <button
          {...p}
          disabled={disabled}
          onClick={(e) => (e.stopPropagation(), p.onClick())}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm border border-transparent text-sm transition-colors hover:border-line-strong hover:bg-surface-2 disabled:pointer-events-none",
            compact ? "-mx-1.5 h-6 px-1.5" : "h-7 border-line bg-surface-2 px-2",
            pending && "opacity-50",
          )}
        >
          <StagePill stage={stage} />
          <ChevronDown className="h-3 w-3 text-fg-3" />
        </button>
      )}
      items={STAGES.map((s) => ({
        label: s.label,
        icon: <StageIcon stage={s.id} />,
        checked: s.id === stage,
        separatorBefore: s.id === "closed",
        onSelect: () =>
          start(async () => {
            notify(await moveLeadStageAction(leadId, s.id));
            router.refresh();
          }),
      }))}
    />
  );
}
