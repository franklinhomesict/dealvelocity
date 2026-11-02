"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, Bot, Clock, TrendingDown, Stamp, CalendarClock, Sparkles, FileQuestion, ChevronRight, CheckCheck } from "lucide-react";
import type { AttentionItem } from "@/lib/queries";
import { clearCallbackAction, completeTaskAction, decideOfferAction } from "@/app/actions";
import { relTime } from "@/lib/format";
import { Button } from "../ui/button";
import { notify } from "../ui/toast";
import { Modal } from "../ui/overlay";
import { cn } from "../ui/cn";
import { EmptyState } from "../ui/misc";

const ICONS = { callback: PhoneCall, human: Bot, overdue: Clock, ceiling: TrendingDown, approval: Stamp, deadline: CalendarClock, opportunity: Sparkles, inputs: FileQuestion };
const TONE = { negative: "text-neg bg-neg-bg", warning: "text-warn bg-warn-bg", positive: "text-pos bg-pos-bg", info: "text-info bg-info-bg" };

export function AttentionList({ items, canApprove }: { items: AttentionItem[]; canApprove: boolean }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [review, setReview] = useState<AttentionItem | null>(null);
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 8;
  const visible = expanded ? items : items.slice(0, LIMIT);
  const router = useRouter();

  const run = (item: AttentionItem) => {
    if (!item.action) return;
    if (item.action.type === "approve_offer") return setReview(item);
    setBusy(item.id);
    start(async () => {
      const r = item.action!.type === "clear_callback" ? await clearCallbackAction(item.action!.id) : await completeTaskAction(item.action!.id);
      notify(r);
      setBusy(null);
      router.refresh();
    });
  };
  const decide = (d: "approve" | "reject") =>
    start(async () => {
      const r = await decideOfferAction(review!.action!.id, d);
      notify(r);
      setReview(null);
      router.refresh();
    });

  if (!items.length)
    return <EmptyState icon={<CheckCheck className="h-4 w-4" />} title="Nothing needs you right now" body="Callbacks, approvals, deadlines and risks will appear here as they come in." />;

  return (
    <>
      <ul className="divide-y divide-line">
        {visible.map((it) => {
          const Icon = ICONS[it.kind];
          return (
            <li key={it.id} className="group row-hover flex items-center gap-3 px-3.5 py-2">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded", TONE[it.severity])}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <Link href={it.href} className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-fg">{it.title}</div>
                <div className="truncate text-xs text-fg-3">{it.detail}</div>
              </Link>
              <span className="hidden shrink-0 text-xs text-fg-3 sm:block">{relTime(it.at)}</span>
              {it.action && (it.action.type !== "approve_offer" || canApprove) ? (
                <Button size="xs" onClick={() => run(it)} loading={pending && busy === it.id} className="shrink-0">
                  {it.action.label}
                </Button>
              ) : (
                <Link href={it.href} aria-label="Open" className="rounded p-1 text-fg-3 hover:bg-surface-3 hover:text-fg">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > LIMIT && (
        <button onClick={() => setExpanded((e) => !e)} className="flex h-9 w-full items-center justify-center border-t border-line text-xs font-medium text-fg-2 hover:bg-surface-2 hover:text-fg">
          {expanded ? "Show fewer" : `Show ${items.length - LIMIT} more`}
        </button>
      )}
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title="Approve offer?"
        description="Approval records your authorization internally. Nothing is sent to the seller — document generation and e-signature arrive in Phase 6."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReview(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => decide("reject")} loading={pending}>Reject</Button>
            <Button variant="positive" onClick={() => decide("approve")} loading={pending}>Approve</Button>
          </>
        }
      >
        {review && (
          <div className="space-y-2 text-sm">
            <div className="font-medium">{review.title}</div>
            <div className="text-fg-2">{review.detail}</div>
            <Link href={review.href} className="inline-block text-info hover:underline">Review full underwriting →</Link>
          </div>
        )}
      </Modal>
    </>
  );
}
