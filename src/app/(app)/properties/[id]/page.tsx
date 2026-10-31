import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAssumptions, getPropertyDetail } from "@/lib/queries";
import { PropertyHeader } from "@/components/property/header";
import { AnalysisPanel } from "@/components/property/analysis-panel";
import { Timeline } from "@/components/property/timeline";
import { PropertyOverview, SellerIntel, TasksPanel, OffersPanel, TransactionPanel } from "@/components/property/side-panels";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { VerdictBadge } from "@/components/status";
import { DealMachinePanel } from "@/components/property/dealmachine-panel";
import { getComps, getCreditSettings, isConfigured } from "@/lib/dealmachine/service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const d = await getPropertyDetail((await params).id);
  return { title: d?.property.street ?? "Property" };
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, d, { values: assumptions }, comps, dmSettings] = await Promise.all([requireUser(), getPropertyDetail(id), getAssumptions(), getComps(id).catch(() => []), getCreditSettings()]);
  if (!d) notFound();
  const { property: p, lead, contact, analysis, analysisResult } = d;
  const readOnly = user.role === "viewer";
  return (
    <div className="pb-12">
      <PropertyHeader
        address={p.street + (p.unit ? ` #${p.unit}` : "")}
        cityLine={`${p.city}, ${p.state} ${p.zip}`}
        leadRef={lead?.ref ?? null}
        leadId={lead?.id ?? null}
        stage={lead?.stage ?? null}
        temperature={lead?.temperature ?? null}
        phone={contact?.phoneE164 ?? null}
        canCall={!contact?.doNotContact}
        isSample={p.isSample}
        readOnly={readOnly}
        meta={
          <span className="flex items-center gap-2">
            · <span className="rounded-sm border border-line px-1.5 text-2xs font-semibold uppercase tracking-wider text-fg-2">BRRRR</span>
            {analysis && <VerdictBadge verdict={analysis.verdict} />}
          </span>
        }
      />
      <div className="grid gap-4 px-4 pt-4 md:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <AnalysisPanel
            propertyId={p.id}
            assumptions={assumptions}
            askingPrice={lead?.askingPrice ?? null}
            readOnly={readOnly}
            seed={{
              purchasePrice: analysis?.purchasePrice ?? null,
              arv: analysis?.arv ?? null,
              arvSource: analysis?.arvSource ?? null,
              rehab: analysis?.rehab ?? null,
              monthlyRent: analysis?.monthlyRent ?? null,
              savedAt: analysis?.createdAt.toISOString() ?? null,
              engineVersion: analysis?.engineVersion ?? null,
            }}
          />
          <Panel>
            <PanelHeader title="Activity" meta={`${d.timeline.length} events`} />
            <Timeline items={d.timeline} propertyId={p.id} leadId={lead?.id ?? null} readOnly={readOnly} />
          </Panel>
        </div>
        <div className="min-w-0 space-y-4">
          {d.transaction && <TransactionPanel t={d.transaction} />}
          {lead && (
            <div id="offers">
              <OffersPanel
                leadId={lead.id}
                offers={d.offers}
                mao={analysis?.maxAllowableOffer ?? null}
                recommended={analysisResult?.recommendedOffer ?? null}
                isOwner={user.role === "owner"}
                readOnly={readOnly}
              />
            </div>
          )}
          {lead && <TasksPanel leadId={lead.id} tasks={d.openTasks} readOnly={readOnly} />}
          {lead && <SellerIntel lead={lead} contact={contact} readOnly={readOnly} />}
          <DealMachinePanel
            propertyId={p.id}
            connected={isConfigured()}
            paidEnabled={dmSettings.paidEnabled}
            canWrite={!readOnly}
            sourceRef={p.sourceRef ?? ((p.sourcePayload as { dm_property_id?: string } | null)?.dm_property_id ?? null)}
            isDealMachine={p.dataSource === "dealmachine"}
            syncedAt={p.sourceSyncedAt?.toISOString() ?? null}
            enrichedAt={p.sourceEnrichedAt?.toISOString() ?? null}
            flags={p.distressFlags}
            estimatedValue={p.estimatedValue}
            estimatedRepairCost={p.estimatedRepairCost}
            equityPercent={p.estimatedEquityPercent != null ? Number(p.estimatedEquityPercent) : null}
            equityAmount={p.estimatedEquityAmount}
            subjectSqft={p.sqft}
            comps={comps}
          />
          <PropertyOverview p={p} readOnly={readOnly} />
        </div>
      </div>
    </div>
  );
}
