"use client";
import Link from "next/link";
import { ChevronRight, Copy, MapPin, MoreHorizontal, Phone } from "lucide-react";
import type { LeadStage } from "@/db/schema";
import { StageMenu } from "../leads/stage-menu";
import { Menu } from "../ui/menu";
import { Button } from "../ui/button";
import { SampleTag } from "../ui/badge";
import { TemperatureTag } from "../status";
import { toast } from "../ui/toast";

export function PropertyHeader({
  address, cityLine, leadRef, leadId, stage, temperature, phone, canCall, isSample, readOnly, meta,
}: {
  address: string; cityLine: string; leadRef: number | null; leadId: string | null; stage: LeadStage | null; temperature: "hot" | "warm" | "cold" | null;
  phone: string | null; canCall: boolean; isSample: boolean; readOnly: boolean; meta: React.ReactNode;
}) {
  const full = `${address}, ${cityLine}`;
  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-1 px-4 pt-3 text-xs text-fg-3 md:px-6">
        <Link href="/properties" className="hover:text-fg-2">Properties</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-fg-2">{address}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-1.5 md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{address}</h1>
            {isSample && <SampleTag />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-fg-3">
            <span>{cityLine}</span>
            {leadRef && <span className="num">· L-{leadRef}</span>}
            {temperature && <span className="flex items-center gap-2">· <TemperatureTag t={temperature} /></span>}
            {meta}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {leadId && stage && <StageMenu leadId={leadId} stage={stage} disabled={readOnly} />}
          {phone && (
            canCall ? (
              <a href={`tel:${phone}`} className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded border border-line bg-surface-2 px-2.5 text-sm font-medium hover:bg-surface-3" title="Dials from your device. In-app calling and recording arrive in Phase 4.">
                <Phone className="h-3.5 w-3.5" /> Call<span className="hidden sm:inline"> seller</span>
              </a>
            ) : (
              <Button size="sm" disabled title="Seller is marked Do Not Contact"><Phone className="h-3.5 w-3.5" /> Do not contact</Button>
            )
          )}
          <Button size="sm" variant="primary" onClick={() => document.getElementById("offers")?.scrollIntoView({ behavior: "smooth", block: "center" })} disabled={readOnly}>
            Request offer
          </Button>
          <Menu
            label="More actions"
            trigger={(p) => <Button {...p} size="sm" icon aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>}
            items={[
              { label: "Copy address", icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => navigator.clipboard.writeText(full).then(() => toast("Address copied")) },
              { label: "Open in Google Maps", icon: <MapPin className="h-3.5 w-3.5" />, onSelect: () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`, "_blank", "noopener") },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
