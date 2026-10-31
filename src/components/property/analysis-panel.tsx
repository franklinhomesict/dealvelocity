"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, RotateCcw, CircleSlash } from "lucide-react";
import { analyzeBrrrr, analyzeFlip, type BrrrrResult, type RefiScenario } from "@/lib/underwriting/engine";
import type { Assumptions } from "@/lib/underwriting/assumptions";
import { money, percent, ratio, relTime } from "@/lib/format";
import { saveAnalysisAction } from "@/app/actions";
import { Panel, PanelHeader, DataRow } from "../ui/misc";
import { Button } from "../ui/button";
import { Input, Label, Select } from "../ui/field";
import { Badge } from "../ui/badge";
import { notify } from "../ui/toast";
import { cn } from "../ui/cn";
import { VerdictBadge } from "../status";

export interface AnalysisSeed {
  purchasePrice: number | null;
  arv: number | null;
  arvSource: string | null;
  rehab: number | null;
  monthlyRent: number | null;
  savedAt: string | null;
  engineVersion: string | null;
}

const toNum = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};
const fmtIn = (n: number | null) => (n == null ? "" : n.toLocaleString("en-US"));

export function AnalysisPanel({ seed, assumptions, askingPrice, propertyId, readOnly }: { seed: AnalysisSeed; assumptions: Assumptions; askingPrice: number | null; propertyId: string | null; readOnly: boolean }) {
  const initial = {
    purchasePrice: fmtIn(seed.purchasePrice ?? askingPrice),
    arv: fmtIn(seed.arv),
    arvSource: seed.arvSource ?? "estimate",
    rehab: fmtIn(seed.rehab),
    monthlyRent: fmtIn(seed.monthlyRent),
  };
  const [v, setV] = useState(initial);
  // Comps panel can push a comps-based ARV into the scenario ("Use as ARV").
  useEffect(() => {
    const h = (e: Event) => {
      const arv = (e as CustomEvent<number>).detail;
      setV((x) => ({ ...x, arv: fmtIn(arv), arvSource: "comps" }));
      document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("aos:set-arv", h);
    return () => window.removeEventListener("aos:set-arv", h);
  }, []);
  const [strategy, setStrategy] = useState<"brrrr" | "flip">("brrrr");
  const [refi, setRefi] = useState<"cash_out" | "rate_term">("cash_out");
  const [pending, start] = useTransition();
  const router = useRouter();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const inputs = useMemo(
    () => ({ purchasePrice: toNum(v.purchasePrice), arv: toNum(v.arv), rehab: toNum(v.rehab), monthlyRent: toNum(v.monthlyRent) }),
    [v],
  );
  const r = useMemo(() => analyzeBrrrr(inputs, assumptions), [inputs, assumptions]);
  const f = useMemo(() => analyzeFlip(inputs, assumptions), [inputs, assumptions]);
  const s: RefiScenario | null = refi === "cash_out" ? r.cashOut : r.rateTerm;

  const field = (k: keyof typeof v, label: string, hint?: string) => (
    <div>
      <Label htmlFor={`an-${k}`} hint={hint}>{label}</Label>
      <Input
        id={`an-${k}`}
        prefix="$"
        inputMode="numeric"
        value={v[k]}
        disabled={readOnly}
        onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value.replace(/[^\d,]/g, "") }))}
        onBlur={(e) => {
          const n = toNum(e.target.value);
          setV((x) => ({ ...x, [k]: fmtIn(n) }));
        }}
        className={cn(!toNum(v[k]) && k !== "purchasePrice" && "[&_input]:border-warn/50")}
      />
    </div>
  );

  const save = () =>
    start(async () => {
      if (!propertyId) return;
      const res = await saveAnalysisAction(propertyId, { ...inputs, arvSource: v.arvSource });
      notify(res);
      if (res.ok) router.refresh();
    });

  return (
    <Panel id="analysis">
      <PanelHeader
        title="Investment analysis"
        meta={!propertyId ? "Scratch calculator · not linked to a property" : seed.savedAt ? `Saved ${relTime(seed.savedAt)} · engine ${seed.engineVersion}` : "Not yet saved"}
        actions={
          <div className="flex h-7 items-center rounded border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Strategy">
            {(["brrrr", "flip"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={strategy === k} onClick={() => setStrategy(k)} className={cn("h-full rounded-sm px-2.5 text-xs font-medium", strategy === k ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
                {k === "brrrr" ? "BRRRR" : "Flip"}
              </button>
            ))}
          </div>
        }
      />

      {/* Scenario inputs */}
      <div className="grid grid-cols-2 gap-3 border-b border-line bg-surface-2/40 px-3.5 py-3 sm:grid-cols-5">
        {field("purchasePrice", "Purchase price", askingPrice ? "offer" : undefined)}
        {field("arv", "After-repair value")}
        <div>
          <Label htmlFor="an-arvSource">ARV source</Label>
          <Select id="an-arvSource" value={v.arvSource} disabled={readOnly} onChange={(e) => setV((x) => ({ ...x, arvSource: e.target.value }))}>
            <option value="estimate">Estimate</option>
            <option value="comps">Comps</option>
            <option value="appraisal">Appraisal</option>
            <option value="owner">Owner opinion</option>
          </Select>
        </div>
        {field("rehab", "Rehab estimate")}
        {field("monthlyRent", "Market rent / mo")}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2">
        <div className="flex items-center gap-2 text-xs text-fg-3">
          {dirty ? <Badge tone="warning" dot>Unsaved scenario</Badge> : <span>Edit any input to model a scenario. Results update instantly.</span>}
          {v.arvSource === "estimate" && toNum(v.arv) && <span className="hidden sm:inline">· ARV is an estimate, not verified comps</span>}
        </div>
        {!readOnly && propertyId && (
          <div className="flex items-center gap-1.5">
            {dirty && (
              <Button size="xs" variant="ghost" onClick={() => setV(initial)}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            )}
            <Button size="xs" variant={dirty ? "primary" : "secondary"} onClick={save} loading={pending} disabled={!dirty && !!seed.savedAt}>
              Save analysis
            </Button>
          </div>
        )}
      </div>

      {strategy === "brrrr" ? <BrrrrView r={r} s={s} refi={refi} setRefi={setRefi} purchase={inputs.purchasePrice} a={assumptions} /> : <FlipView f={f} purchase={inputs.purchasePrice} a={assumptions} />}
    </Panel>
  );
}

function Headline({ label, value, sub, tone, big }: { label: string; value: string; sub?: React.ReactNode; tone?: "pos" | "neg" | "warn"; big?: boolean }) {
  return (
    <div className="min-w-0 bg-surface px-3.5 py-3">
      <div className="truncate text-xs text-fg-2">{label}</div>
      <div className={cn("num mt-1 truncate font-semibold tracking-tight", big ? "text-2xl" : "text-xl", tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "warn" ? "text-warn" : "text-fg")}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-fg-3">{sub}</div>}
    </div>
  );
}

function Flags({ r }: { r: { flags: BrrrrResult["flags"] } }) {
  if (!r.flags.length) return null;
  return (
    <ul className="space-y-1 border-b border-line px-3.5 py-2.5">
      {r.flags.map((f) => (
        <li key={f.code} className={cn("flex items-start gap-2 text-sm", f.level === "missing" ? "text-warn" : f.level === "risk" ? "text-neg" : "text-fg-2")}>
          {f.level === "info" ? <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {f.message}
        </li>
      ))}
    </ul>
  );
}

function BrrrrView({ r, s, refi, setRefi, purchase, a }: { r: BrrrrResult; s: RefiScenario | null; refi: "cash_out" | "rate_term"; setRefi: (x: "cash_out" | "rate_term") => void; purchase: number | null; a: Assumptions }) {
  if (!r.complete || !s || !r.costs || !r.operating) {
    return (
      <>
        <Flags r={r} />
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <CircleSlash className="mb-2 h-5 w-5 text-fg-3" />
          <div className="text-sm font-medium">Flagged for review — inputs incomplete</div>
          <p className="mt-1 max-w-sm text-sm text-fg-3">The engine won’t fill gaps with optimistic guesses. Add ARV, rehab and market rent to calculate a maximum allowable offer.</p>
        </div>
      </>
    );
  }
  const spread = purchase != null && r.maxAllowableOffer != null ? r.maxAllowableOffer - purchase : null;
  const c = r.costs;
  const o = r.operating;
  return (
    <>
      {/* Verdict line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3.5 py-2.5">
        <VerdictBadge verdict={r.verdict} />
        <span className="text-sm text-fg-2">{r.verdictReasons[0]}</span>
        {r.verdictReasons.length > 1 && <span className="text-xs text-fg-3">+{r.verdictReasons.length - 1} more</span>}
        <span className="ml-auto text-xs text-fg-3">Score <span className="num font-medium text-fg">{r.dealScore}</span>/100</span>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        <Headline big label="Max allowable offer" value={money(r.maxAllowableOffer)} sub={r.recommendedOffer ? `Open at ${money(r.recommendedOffer)}` : "—"} />
        <Headline big label={purchase ? "Spread vs. price" : "Purchase price"} value={spread != null ? money(spread, { sign: true }) : "—"} tone={spread == null ? undefined : spread >= 0 ? "pos" : "neg"} sub={purchase ? `at ${money(purchase)}` : "No price entered"} />
        <Headline big label="Cash left in deal" value={money(Math.max(s.cashRemainingInDeal, 0))} tone={s.cashRemainingInDeal <= 0 ? "pos" : undefined} sub={s.cashRemainingInDeal < 0 ? `${money(-s.cashRemainingInDeal)} returned at refi` : `of ${money(c.cashInvested)} invested`} />
        <Headline big label="Cash flow" value={`${money(s.monthlyCashFlow)}/mo`} tone={s.monthlyCashFlow >= a.minMonthlyCashFlow ? undefined : "neg"} sub={`DSCR ${ratio(s.dscr)} · CoC ${s.cashOnCash == null ? "∞" : percent(s.cashOnCash)}`} />
      </div>

      <Flags r={r} />

      <div className="grid md:grid-cols-2 md:divide-x md:divide-line">
        {/* Cost stack */}
        <div className="px-3.5 py-3">
          <div className="eyebrow mb-1">Acquisition &amp; rehab</div>
          <div className="divide-y divide-line">
            <DataRow label="Purchase price" value={money(c.purchasePrice)} />
            <DataRow label="Rehab" value={money(c.rehab)} />
            <DataRow label={`Contingency (${a.rehabContingencyPct}%)`} value={money(c.rehabContingency)} />
            <DataRow label="Purchase closing" value={money(c.purchaseClosing)} />
            <DataRow label={`Points (${a.privatePointsPct}%)`} value={money(c.points)} />
            <DataRow label={`Interest carry (${a.holdMonths} mo @ ${a.privateRatePct}%)`} value={money(c.interestCarry)} />
            <DataRow label="Holding taxes & insurance" value={money(c.holdingTaxesInsurance)} />
            <DataRow label={<span className="font-medium text-fg">All-in cost</span>} value={<span className="font-semibold">{money(c.allInCost)}</span>} />
            <DataRow label="Acquisition loan" value={money(c.acquisitionLoan)} hint={`${a.privateLoanToCostPct}% LTC`} />
            <DataRow label="Cash invested" value={money(c.cashInvested)} />
          </div>
        </div>

        {/* Refinance */}
        <div className="border-t border-line px-3.5 py-3 md:border-t-0">
          <div className="mb-1 flex items-center justify-between">
            <span className="eyebrow">Refinance</span>
            <div className="flex h-6 items-center rounded border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Refinance type">
              {(["cash_out", "rate_term"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={refi === k} onClick={() => setRefi(k)} className={cn("h-full rounded-sm px-2 text-2xs font-medium", refi === k ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
                  {k === "cash_out" ? `Cash-out ${a.cashOutLtvPct}%` : `Rate & term ${a.rateTermLtvPct}%`}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-line">
            <DataRow label="Lender value basis" value={money(s.valueBasis)} hint={s.limitedBy === "seasoning" ? "cost (unseasoned)" : "ARV"} />
            <DataRow label="Max loan by LTV" value={money(s.maxLoanByLtv)} />
            <DataRow label={`Max loan by DSCR ${a.dscrMin.toFixed(2)}`} value={money(s.maxLoanByDscr)} />
            <DataRow label="Loan amount" value={<span className="font-semibold">{money(s.loanAmount)}</span>} hint={`limited by ${s.limitedBy.replace("_", " ")}`} />
            <DataRow label="Refi closing costs" value={money(-s.closingCosts)} />
            <DataRow label="Payoff acquisition loan" value={money(-s.payoff)} />
            <DataRow label={<span className="font-medium text-fg">Cash to you at refi</span>} value={<span className={cn("font-semibold", s.cashToOwnerAtRefi >= 0 ? "text-pos" : "text-neg")}>{money(s.cashToOwnerAtRefi, { sign: true })}</span>} />
            <DataRow label="P&I" value={`${money(s.monthlyPI)}/mo`} hint={`${a.refiRatePct}% · ${a.refiAmortYears}yr`} />
            <DataRow label="PITI" value={`${money(s.monthlyPITI)}/mo`} />
            <DataRow label="DSCR" value={<span className={cn(s.dscr < a.dscrMin && "text-neg")}>{ratio(s.dscr)}</span>} hint={`rent −${a.rentHaircutPct}%`} />
          </div>
          {!s.eligible && <p className="mt-2 text-xs text-warn">Rate-and-term is disabled in assumptions.</p>}
        </div>
      </div>

      <div className="grid border-t border-line md:grid-cols-2 md:divide-x md:divide-line">
        {/* Operating */}
        <div className="px-3.5 py-3">
          <div className="eyebrow mb-1">Monthly operations</div>
          <div className="divide-y divide-line">
            <DataRow label="Gross rent" value={money(o.grossRent)} />
            <DataRow label={`Vacancy (${a.vacancyPct}%)`} value={money(-o.vacancy)} />
            <DataRow label={`Maintenance (${a.maintenancePct}%)`} value={money(-o.maintenance)} />
            <DataRow label={`CapEx (${a.capexPct}%)`} value={money(-o.capex)} />
            <DataRow label={`Management (${a.managementPct}%)`} value={money(-o.management)} />
            <DataRow label="Taxes" value={money(-o.taxes)} />
            <DataRow label="Insurance" value={money(-o.insurance)} />
            <DataRow label="Debt service (P&I)" value={money(-s.monthlyPI)} />
            <DataRow label={<span className="font-medium text-fg">Net cash flow</span>} value={<span className={cn("font-semibold", s.monthlyCashFlow < 0 && "text-neg")}>{money(s.monthlyCashFlow)}</span>} />
          </div>
        </div>
        {/* Stress */}
        <div className="border-t border-line px-3.5 py-3 md:border-t-0">
          <div className="eyebrow mb-1">Sensitivity at this price</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-2xs uppercase tracking-[0.06em] text-fg-3">
                <th className="h-7 text-left font-medium">Case</th>
                <th className="text-right font-medium">Cash left</th>
                <th className="text-right font-medium">Flow/mo</th>
                <th className="text-right font-medium">DSCR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr className="h-[30px]">
                <td className="text-fg-2">Base</td>
                <td className="num text-right">{money(Math.max(s.cashRemainingInDeal, 0))}</td>
                <td className="num text-right">{money(s.monthlyCashFlow)}</td>
                <td className="num text-right">{ratio(s.dscr)}</td>
              </tr>
              {r.stress.map((x) => (
                <tr key={x.label} className="h-[30px]">
                  <td className="text-fg-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", x.passes ? "bg-fg-3" : "bg-neg")} />
                      {x.label}
                    </span>
                  </td>
                  <td className="num text-right">{money(Math.max(x.cashRemainingInDeal, 0))}</td>
                  <td className={cn("num text-right", x.monthlyCashFlow < 0 && "text-neg")}>{money(x.monthlyCashFlow)}</td>
                  <td className={cn("num text-right", x.dscr < 1 && "text-neg")}>{ratio(x.dscr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-fg-3">Red marks a case that breaks even cash flow or DSCR below 1.00.</p>
        </div>
      </div>
    </>
  );
}

function FlipView({ f, purchase, a }: { f: ReturnType<typeof analyzeFlip>; purchase: number | null; a: Assumptions }) {
  if (!f.complete || !f.costs) {
    return (
      <>
        <Flags r={f} />
        <div className="px-6 py-10 text-center text-sm text-fg-3">Add ARV and rehab to run the flip pathway.</div>
      </>
    );
  }
  const spread = purchase != null && f.maxAllowableOffer != null ? f.maxAllowableOffer - purchase : null;
  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-3.5 py-2.5">
        <VerdictBadge verdict={f.verdict} />
        <span className="text-sm text-fg-2">Secondary strategy · minimum profit {money(a.flipMinProfit)}</span>
      </div>
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        <Headline big label="Flip MAO" value={money(f.maxAllowableOffer)} sub={`70% rule: ${money(f.rule70)}`} />
        <Headline big label="Spread vs. price" value={spread != null ? money(spread, { sign: true }) : "—"} tone={spread == null ? undefined : spread >= 0 ? "pos" : "neg"} />
        <Headline big label="Net profit" value={money(f.netProfit)} tone={(f.netProfit ?? 0) >= a.flipMinProfit ? "pos" : "neg"} />
        <Headline big label="ROI" value={percent(f.roi)} sub={`${percent(f.annualizedRoi)} annualized`} />
      </div>
      <div className="px-3.5 py-3">
        <div className="divide-y divide-line md:max-w-md">
          <DataRow label="Sale price (ARV)" value={money(f.salePrice)} />
          <DataRow label={`Selling costs (${a.flipSellingCostsPct}%)`} value={money(-(f.sellingCosts ?? 0))} />
          <DataRow label="All-in cost" value={money(-f.costs.allInCost)} hint={`${a.flipHoldMonths} mo hold`} />
          <DataRow label={<span className="font-medium text-fg">Net profit</span>} value={<span className="font-semibold">{money(f.netProfit)}</span>} />
        </div>
      </div>
    </>
  );
}
