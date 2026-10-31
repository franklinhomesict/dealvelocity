/**
 * Deterministic BRRRR + flip underwriting engine.
 *
 * Pure functions only — no I/O, no randomness, no AI. Every number shown in
 * the product traces back to these functions and the stored assumptions.
 * If a required input is missing the engine reports it and returns
 * verdict "review"; it never substitutes an optimistic guess.
 */
import type { Assumptions } from "./assumptions";

export const ENGINE_VERSION = "brrrr-1.1.0";

export interface DealInputs {
  purchasePrice: number | null; // the price being evaluated (offer or asking)
  arv: number | null;
  rehab: number | null;
  monthlyRent: number | null; // gross scheduled rent, all units
  otherMonthlyIncome?: number | null;
  /** Override computed acquisition-loan payoff (e.g. actual lender payoff letter). */
  loanPayoffOverride?: number | null;
  /** Override computed monthly taxes / insurance when actuals are known. */
  taxesMonthlyOverride?: number | null;
  insuranceMonthlyOverride?: number | null;
}

export type Flag = { level: "missing" | "risk" | "info"; code: string; message: string };

export interface RefiScenario {
  kind: "cash_out" | "rate_term";
  eligible: boolean;
  valueBasis: number;
  maxLoanByLtv: number;
  maxLoanByDscr: number;
  /** Largest loan that still meets the minimum monthly cash-flow target. */
  maxLoanByCashFlow: number;
  loanAmount: number;
  limitedBy: "ltv" | "dscr" | "cash_flow" | "payoff" | "seasoning";
  closingCosts: number;
  netProceeds: number; // loan − closing costs
  payoff: number;
  cashToOwnerAtRefi: number; // net proceeds − payoff
  cashRemainingInDeal: number; // total cash invested − cash returned (negative = cash out)
  monthlyPI: number;
  monthlyPITI: number;
  dscr: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCash: number | null; // null when no cash remains (infinite)
}

export interface CostBreakdown {
  purchasePrice: number;
  rehab: number;
  rehabContingency: number;
  purchaseClosing: number;
  acquisitionLoan: number;
  points: number;
  interestCarry: number;
  holdingTaxesInsurance: number;
  allInCost: number;
  cashInvested: number; // owner cash before refi (all-in minus acquisition loan)
}

export interface OperatingBreakdown {
  grossRent: number;
  otherIncome: number;
  vacancy: number;
  maintenance: number;
  capex: number;
  management: number;
  utilities: number;
  hoa: number;
  taxes: number;
  insurance: number;
  operatingExpenses: number; // excl. debt service
  noiMonthly: number;
  qualifyingRent: number; // after lender haircut
}

export interface StressResult {
  label: string;
  cashRemainingInDeal: number;
  monthlyCashFlow: number;
  dscr: number;
  passes: boolean;
}

export interface BuyBoxCheck {
  code: "arv_range" | "rent_ratio" | "rehab" | "forced_equity" | "cash_left" | "cash_flow" | "dscr";
  label: string;
  target: string;
  actual: string;
  pass: boolean;
}

export interface BrrrrResult {
  engineVersion: string;
  complete: boolean;
  flags: Flag[];
  costs: CostBreakdown | null;
  operating: OperatingBreakdown | null;
  cashOut: RefiScenario | null;
  rateTerm: RefiScenario | null;
  primary: RefiScenario | null;
  maxAllowableOffer: number | null;
  recommendedOffer: number | null;
  stress: StressResult[];
  dealScore: number | null;
  /** Owner buy-box screen. A deal outside it is never auto-passed. */
  buyBox: BuyBoxCheck[];
  inBuyBox: boolean | null;
  /**
   * Cash-out play: refinance sized only by lender limits (LTV, lender DSCR).
   * Qualifies when all cash comes back and cash flow stays ≥ $0 — rare deals
   * worth taking even outside the cash-flow buy box (e.g. 1914 S Prescott Cir).
   */
  cashOutPlay: { mao: number | null; qualifies: boolean; cashBack: number; monthlyCashFlow: number; dscr: number } | null;
  verdict: "pass" | "review" | "fail";
  verdictReasons: string[];
}

/* ───────────────────────── Math helpers ───────────────────────── */

export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0) return 0;
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/** Inverse of monthlyPayment: the principal a given payment supports. */
export function principalForPayment(payment: number, annualRatePct: number, years: number): number {
  if (payment <= 0) return 0;
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return payment * n;
  return (payment * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
}

const round = (n: number) => Math.round(n);
const pct = (p: number) => p / 100;

/* ───────────────────────── Components ───────────────────────── */

export function computeCosts(purchase: number, rehab: number, a: Assumptions, holdMonths = a.holdMonths, valueForCarry = 0): CostBreakdown {
  const rehabContingency = rehab * pct(a.rehabContingencyPct);
  const financedBase = purchase + rehab + rehabContingency;
  const acquisitionLoan = a.acquisitionFinancing === "private" ? financedBase * pct(a.privateLoanToCostPct) : 0;
  const points = acquisitionLoan * pct(a.privatePointsPct);
  const interestCarry = acquisitionLoan * (pct(a.privateRatePct) / 12) * holdMonths;
  // Taxes + insurance owed while holding, based on as-is value (purchase) — conservative and deterministic.
  const carryBasis = valueForCarry > 0 ? valueForCarry : purchase;
  const holdingTaxesInsurance = ((carryBasis * pct(a.taxesPctOfValue + a.insurancePctOfValue)) / 12) * holdMonths;
  const allInCost =
    purchase + rehab + rehabContingency + a.purchaseClosingCosts + points + interestCarry + holdingTaxesInsurance;
  return {
    purchasePrice: purchase,
    rehab,
    rehabContingency,
    purchaseClosing: a.purchaseClosingCosts,
    acquisitionLoan,
    points,
    interestCarry,
    holdingTaxesInsurance,
    allInCost,
    cashInvested: allInCost - acquisitionLoan,
  };
}

export function computeOperating(
  rent: number,
  arv: number,
  a: Assumptions,
  other = 0,
  taxesOverride?: number | null,
  insuranceOverride?: number | null,
): OperatingBreakdown {
  const vacancy = rent * pct(a.vacancyPct);
  const maintenance = rent * pct(a.maintenancePct);
  const capex = rent * pct(a.capexPct);
  const management = rent * pct(a.managementPct);
  const taxes = taxesOverride ?? (arv * pct(a.taxesPctOfValue)) / 12;
  const insurance = insuranceOverride ?? (arv * pct(a.insurancePctOfValue)) / 12;
  const operatingExpenses =
    vacancy + maintenance + capex + management + a.utilitiesMonthly + a.hoaMonthly + taxes + insurance;
  return {
    grossRent: rent,
    otherIncome: other,
    vacancy,
    maintenance,
    capex,
    management,
    utilities: a.utilitiesMonthly,
    hoa: a.hoaMonthly,
    taxes,
    insurance,
    operatingExpenses,
    noiMonthly: rent + other - operatingExpenses,
    qualifyingRent: rent * (1 - pct(a.rentHaircutPct)),
  };
}

function refiScenario(
  kind: RefiScenario["kind"],
  costs: CostBreakdown,
  op: OperatingBreakdown,
  arv: number,
  a: Assumptions,
  payoffOverride?: number | null,
): RefiScenario {
  const seasoned = a.holdMonths >= a.cashOutSeasoningMonths;
  const costBasis = costs.purchasePrice + costs.rehab + costs.rehabContingency;
  // Unseasoned cash-out: most DSCR lenders value the asset at documented cost.
  const valueBasis = kind === "cash_out" && !seasoned ? Math.min(arv, costBasis) : arv;
  const ltv = kind === "cash_out" ? a.cashOutLtvPct : a.rateTermLtvPct;
  const maxLoanByLtv = valueBasis * pct(ltv);

  // DSCR = qualifying rent / PITIA ≥ dscrMin  →  max P&I the rent supports
  const pitiaFixed = op.taxes + op.insurance + op.hoa;
  // Size to the stricter of the lender minimum and the owner's target.
  const maxPI = op.qualifyingRent / Math.max(a.dscrMin, a.targetDscr) - pitiaFixed;
  const maxLoanByDscr = Math.max(0, principalForPayment(maxPI, a.refiRatePct, a.refiAmortYears));

  // Size down rather than take a loan that breaks the cash-flow minimum.
  const maxLoanByCashFlow = Math.max(
    0,
    principalForPayment(op.noiMonthly - a.minMonthlyCashFlow, a.refiRatePct, a.refiAmortYears),
  );

  const payoff = payoffOverride ?? costs.acquisitionLoan;
  const closingFor = (loan: number) => (loan > 0 ? loan * pct(a.refiClosingPct) + a.refiClosingFixed + a.appraisalFee : 0);

  let loanAmount = Math.min(maxLoanByLtv, maxLoanByDscr, maxLoanByCashFlow);
  let limitedBy: RefiScenario["limitedBy"] =
    loanAmount === maxLoanByCashFlow && maxLoanByCashFlow < maxLoanByLtv
      ? "cash_flow"
      : loanAmount === maxLoanByDscr && maxLoanByDscr < maxLoanByLtv
        ? "dscr"
        : kind === "cash_out" && !seasoned && valueBasis < arv
          ? "seasoning"
          : "ltv";

  if (kind === "rate_term") {
    // Rate-and-term may only retire existing debt plus costs — no cash to owner.
    // Solve loan = payoff + closing(loan).
    const fixed = a.refiClosingFixed + a.appraisalFee;
    const needed = payoff > 0 ? (payoff + fixed) / (1 - pct(a.refiClosingPct)) : 0;
    if (needed < loanAmount) {
      loanAmount = needed;
      limitedBy = "payoff";
    }
  }

  loanAmount = Math.max(0, loanAmount);
  const closingCosts = closingFor(loanAmount);
  const netProceeds = loanAmount - closingCosts;
  const cashToOwnerAtRefi = netProceeds - payoff;
  const cashRemainingInDeal = costs.cashInvested - cashToOwnerAtRefi;

  const monthlyPI = monthlyPayment(loanAmount, a.refiRatePct, a.refiAmortYears);
  const monthlyPITI = monthlyPI + op.taxes + op.insurance + op.hoa;
  const dscr = monthlyPITI > 0 ? op.qualifyingRent / monthlyPITI : Infinity;
  const monthlyCashFlow = op.noiMonthly - monthlyPI;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCash = cashRemainingInDeal > 0 ? annualCashFlow / cashRemainingInDeal : null;

  return {
    kind,
    eligible: kind === "cash_out" ? true : a.rateTermEligible,
    valueBasis,
    maxLoanByLtv,
    maxLoanByDscr,
    maxLoanByCashFlow,
    loanAmount,
    limitedBy,
    closingCosts,
    netProceeds,
    payoff,
    cashToOwnerAtRefi,
    cashRemainingInDeal,
    monthlyPI,
    monthlyPITI,
    dscr,
    monthlyCashFlow,
    annualCashFlow,
    cashOnCash,
  };
}

interface Evaluated {
  costs: CostBreakdown;
  op: OperatingBreakdown;
  cashOut: RefiScenario;
  rateTerm: RefiScenario;
}

function evaluateAt(purchase: number, arv: number, rehab: number, rent: number, a: Assumptions, i: DealInputs): Evaluated {
  const costs = computeCosts(purchase, rehab, a);
  const op = computeOperating(rent, arv, a, i.otherMonthlyIncome ?? 0, i.taxesMonthlyOverride, i.insuranceMonthlyOverride);
  return {
    costs,
    op,
    cashOut: refiScenario("cash_out", costs, op, arv, a, i.loanPayoffOverride),
    rateTerm: refiScenario("rate_term", costs, op, arv, a, i.loanPayoffOverride),
  };
}

/** A purchase price is acceptable when the cash-out refi meets every criterion. */
function meetsCriteria(s: RefiScenario, a: Assumptions): boolean {
  return (
    s.cashRemainingInDeal <= a.maxCashLeftInDeal + 0.5 &&
    s.dscr >= Math.max(a.dscrMin, a.targetDscr) - 1e-9 &&
    s.monthlyCashFlow >= a.minMonthlyCashFlow - 1e-9
  );
}

/**
 * Highest purchase price meeting criteria, by bisection. Cash remaining is
 * monotonic non-decreasing in purchase price, so bisection is exact to $1.
 */
export function solveMaxAllowableOffer(arv: number, rehab: number, rent: number, a: Assumptions, i: DealInputs): number | null {
  const ok = (p: number) => meetsCriteria(evaluateAt(p, arv, rehab, rent, a, i).cashOut, a);
  if (!ok(0)) return null;
  let lo = 0;
  let hi = Math.max(arv, 1);
  if (ok(hi)) return round(hi);
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

/** Opening offer: MAO less a negotiating margin, rounded down to $500. */
export function recommendOpeningOffer(mao: number, asking: number | null): number {
  const anchor = Math.floor((mao * 0.9) / 500) * 500;
  if (asking != null && asking > 0 && asking < anchor) return asking;
  return Math.max(anchor, 0);
}

/* ───────────────────────── Public API ───────────────────────── */

export function analyzeBrrrr(i: DealInputs, a: Assumptions): BrrrrResult {
  const flags: Flag[] = [];
  const need = (v: number | null | undefined, code: string, label: string) => {
    if (v == null || !Number.isFinite(v) || v <= 0) {
      flags.push({ level: "missing", code, message: `${label} is required` });
      return false;
    }
    return true;
  };
  const hasArv = need(i.arv, "arv_missing", "After-repair value");
  const hasRehab = i.rehab != null && i.rehab >= 0;
  if (!hasRehab) flags.push({ level: "missing", code: "rehab_missing", message: "Rehab estimate is required" });
  const hasRent = need(i.monthlyRent, "rent_missing", "Market rent");
  const hasPrice = i.purchasePrice != null && i.purchasePrice > 0;
  if (!hasPrice) flags.push({ level: "info", code: "price_missing", message: "No asking or offer price yet — showing MAO only" });

  const empty: BrrrrResult = {
    engineVersion: ENGINE_VERSION,
    complete: false,
    flags,
    costs: null,
    operating: null,
    cashOut: null,
    rateTerm: null,
    primary: null,
    maxAllowableOffer: null,
    recommendedOffer: null,
    stress: [],
    dealScore: null,
    verdict: "review",
    verdictReasons: ["Missing required underwriting inputs"],
    buyBox: [],
    inBuyBox: null,
    cashOutPlay: null,
  };
  if (!hasArv || !hasRehab || !hasRent) return empty;

  const arv = i.arv!;
  const rehab = i.rehab!;
  const rent = i.monthlyRent!;

  const mao = solveMaxAllowableOffer(arv, rehab, rent, a, i);
  const evalPrice = hasPrice ? i.purchasePrice! : mao ?? 0;
  const ev = evaluateAt(evalPrice, arv, rehab, rent, a, i);

  // Seasoning / eligibility flags
  if (a.holdMonths < a.cashOutSeasoningMonths) {
    flags.push({
      level: "risk",
      code: "unseasoned",
      message: `Refi at ${a.holdMonths} mo is before ${a.cashOutSeasoningMonths}-mo seasoning; lender value capped at cost basis`,
    });
  }
  if (ev.cashOut.limitedBy === "dscr") {
    flags.push({ level: "risk", code: "dscr_limited", message: "Refi loan is limited by DSCR, not LTV — rent is the constraint" });
  }
  if (ev.cashOut.limitedBy === "cash_flow") {
    flags.push({
      level: "info",
      code: "cash_flow_limited",
      message: "Refi loan sized below max LTV to hold the minimum monthly cash flow",
    });
  }
  if (rehab > arv * 0.35) {
    flags.push({ level: "risk", code: "heavy_rehab", message: "Rehab exceeds 35% of ARV — confirm scope with contractor bid" });
  }
  if (rent / arv < 0.008) {
    flags.push({ level: "risk", code: "low_rent_ratio", message: `Rent-to-value ${(100 * rent / arv).toFixed(2)}% is below 0.8%` });
  }

  // Sensitivity at the evaluated price
  const stressCases: { label: string; arv: number; rehab: number; rent: number }[] = [
    { label: "ARV −10%", arv: arv * 0.9, rehab, rent },
    { label: "Rehab +20%", arv, rehab: rehab * 1.2, rent },
    { label: "Rent −10%", arv, rehab, rent: rent * 0.9 },
    { label: "Combined", arv: arv * 0.9, rehab: rehab * 1.2, rent: rent * 0.9 },
  ];
  // A lower appraisal doesn't lower the tax or insurance bill: hold those at base.
  const stressInputs: DealInputs = { ...i, taxesMonthlyOverride: ev.op.taxes, insuranceMonthlyOverride: ev.op.insurance };
  const stress: StressResult[] = stressCases.map((s) => {
    const e = evaluateAt(evalPrice, s.arv, s.rehab, s.rent, a, stressInputs).cashOut;
    return {
      label: s.label,
      cashRemainingInDeal: e.cashRemainingInDeal,
      monthlyCashFlow: e.monthlyCashFlow,
      dscr: e.dscr,
      passes: e.dscr >= 1.0 && e.monthlyCashFlow >= 0,
    };
  });

  // Verdict
  const reasons: string[] = [];
  let verdict: BrrrrResult["verdict"] = "pass";
  if (mao == null) {
    verdict = "fail";
    reasons.push("No purchase price satisfies DSCR and cash-flow minimums at this rent");
  } else if (hasPrice && evalPrice > mao) {
    // Above MAO = negotiate down to MAO, unless the gap is unrealistic to close.
    const over = evalPrice - mao;
    verdict = over > mao * 0.3 ? "fail" : "review";
    reasons.push(`Price is $${round(over).toLocaleString("en-US")} above maximum allowable offer`);
  }
  if (ev.cashOut.dscr < a.dscrMin) {
    verdict = "fail";
    reasons.push(`DSCR ${ev.cashOut.dscr.toFixed(2)} below ${a.dscrMin.toFixed(2)} minimum`);
  }
  const failedStress = stress.filter((s) => !s.passes && s.label !== "Combined");
  if (failedStress.length && verdict === "pass") {
    verdict = "review";
    reasons.push(`Fails stress test: ${failedStress.map((s) => s.label).join(", ")}`);
  }
  if (!hasPrice && verdict === "pass") {
    verdict = "review";
    reasons.push("Awaiting seller price");
  }
  if (flags.some((f) => f.code === "heavy_rehab") && verdict === "pass") {
    verdict = "review";
    reasons.push("Heavy rehab scope needs verification");
  }
  const buyBox = evaluateBuyBox(arv, rehab, rent, ev.cashOut, a, ev.costs.allInCost);
  const misses = buyBox.filter((b) => !b.pass);
  // Cash-out play: lender limits only, all cash back, non-negative cash flow.
  const co: Assumptions = { ...a, targetDscr: a.dscrMin, minMonthlyCashFlow: 0, maxCashLeftInDeal: 0 };
  const coMao = solveMaxAllowableOffer(arv, rehab, rent, co, i);
  const coEval = evaluateAt(evalPrice, arv, rehab, rent, co, i).cashOut;
  const cashOutPlay = {
    mao: coMao,
    qualifies: hasPrice && coEval.cashRemainingInDeal <= 0.5 && coEval.monthlyCashFlow >= 0 && coEval.dscr >= a.dscrMin - 1e-9,
    cashBack: Math.max(0, -coEval.cashRemainingInDeal),
    monthlyCashFlow: coEval.monthlyCashFlow,
    dscr: coEval.dscr,
  };

  if (misses.length) {
    const missText = misses.map((m) => m.label.toLowerCase()).join(", ");
    if (cashOutPlay.qualifies && verdict !== "fail") {
      verdict = "pass";
      reasons.length = 0;
      reasons.push(`Cash-out play: about $${round(cashOutPlay.cashBack).toLocaleString("en-US")} back at refi with $${round(cashOutPlay.monthlyCashFlow).toLocaleString("en-US")}/mo cash flow — rare; outside buy box (${missText})`);
    } else {
      if (verdict === "pass") verdict = "review";
      reasons.push(`Outside buy box: ${missText}`);
    }
  }
  if (verdict === "pass" && misses.length === 0) reasons.push("Inside buy box; meets cash-left, DSCR and cash-flow criteria with stress margin");

  const dealScore = scoreDeal({ mao, price: hasPrice ? evalPrice : null, arv, s: ev.cashOut, stress, a });

  return {
    engineVersion: ENGINE_VERSION,
    complete: true,
    flags,
    costs: ev.costs,
    operating: ev.op,
    cashOut: ev.cashOut,
    rateTerm: ev.rateTerm,
    primary: ev.cashOut,
    maxAllowableOffer: mao,
    recommendedOffer: mao != null ? recommendOpeningOffer(mao, hasPrice ? i.purchasePrice! : null) : null,
    stress,
    dealScore,
    verdict,
    verdictReasons: reasons,
    buyBox,
    inBuyBox: misses.length === 0,
    cashOutPlay,
  };
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Evaluates the owner's buy box at the analyzed price. */
export function evaluateBuyBox(arv: number, rehab: number, rent: number, s: RefiScenario, a: Assumptions, allInCost: number): BuyBoxCheck[] {
  const rentPct = (rent / arv) * 100;
  const forced = arv - allInCost;
  const dscrTarget = Math.max(a.dscrMin, a.targetDscr);
  return [
    { code: "arv_range", label: "ARV range", target: `${usd(a.buyBoxMinArv)}–${usd(a.buyBoxMaxArv)}`, actual: usd(arv), pass: arv >= a.buyBoxMinArv && arv <= a.buyBoxMaxArv },
    { code: "rent_ratio", label: "Rent ratio", target: `≥ ${a.buyBoxMinRentPct.toFixed(2)}%`, actual: `${rentPct.toFixed(2)}%`, pass: rentPct >= a.buyBoxMinRentPct - 1e-9 },
    { code: "rehab", label: "Rehab", target: `≤ ${usd(a.buyBoxMaxRehab)}`, actual: usd(rehab), pass: rehab <= a.buyBoxMaxRehab },
    { code: "forced_equity", label: "Forced equity", target: `≥ ${a.buyBoxMinForcedEquityPct}% of ARV`, actual: `${usd(forced)} (${((forced / arv) * 100).toFixed(1)}%)`, pass: (forced / arv) * 100 >= a.buyBoxMinForcedEquityPct - 1e-9 },
    { code: "cash_left", label: "Cash left in deal", target: `≤ ${usd(a.maxCashLeftInDeal)}`, actual: usd(Math.max(0, s.cashRemainingInDeal)), pass: s.cashRemainingInDeal <= a.maxCashLeftInDeal + 0.5 },
    { code: "cash_flow", label: "Cash flow", target: `≥ ${usd(a.minMonthlyCashFlow)}/mo`, actual: `${usd(s.monthlyCashFlow)}/mo`, pass: s.monthlyCashFlow >= a.minMonthlyCashFlow - 0.5 },
    { code: "dscr", label: "DSCR", target: `≥ ${dscrTarget.toFixed(2)}`, actual: Number.isFinite(s.dscr) ? s.dscr.toFixed(2) : "∞", pass: s.dscr >= dscrTarget - 1e-9 },
  ];
}

/**
 * 0–100 deterministic score. Components:
 *  - Price spread vs MAO (40): price at MAO −15% of ARV or better → full marks
 *  - DSCR margin (20): 1.0 → 0, 1.6+ → full
 *  - Cash flow (20): $0 → 0, $500+/mo → full
 *  - Stress resilience (20): 5 per passing stress case
 */
export function scoreDeal(p: {
  mao: number | null;
  price: number | null;
  arv: number;
  s: RefiScenario;
  stress: StressResult[];
  a: Assumptions;
}): number {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  let spread = 0;
  if (p.mao != null) {
    const price = p.price ?? p.mao;
    spread = clamp(0.5 + (p.mao - price) / (p.arv * 0.15) / 2);
  }
  const dscr = clamp((p.s.dscr - 1.0) / 0.6);
  const cf = clamp(p.s.monthlyCashFlow / 500);
  const stress = p.stress.filter((s) => s.passes).length / Math.max(p.stress.length, 1);
  return Math.round(spread * 40 + dscr * 20 + cf * 20 + stress * 20);
}

/* ───────────────────────── Flip pathway ───────────────────────── */

export interface FlipResult {
  complete: boolean;
  flags: Flag[];
  salePrice: number | null;
  sellingCosts: number | null;
  costs: CostBreakdown | null;
  netProfit: number | null;
  roi: number | null;
  annualizedRoi: number | null;
  maxAllowableOffer: number | null;
  rule70: number | null;
  verdict: "pass" | "review" | "fail";
}

export function analyzeFlip(i: DealInputs, a: Assumptions): FlipResult {
  const flags: Flag[] = [];
  if (!i.arv || i.arv <= 0) flags.push({ level: "missing", code: "arv_missing", message: "After-repair value is required" });
  if (i.rehab == null || i.rehab < 0) flags.push({ level: "missing", code: "rehab_missing", message: "Rehab estimate is required" });
  if (flags.length) {
    return {
      complete: false,
      flags,
      salePrice: null,
      sellingCosts: null,
      costs: null,
      netProfit: null,
      roi: null,
      annualizedRoi: null,
      maxAllowableOffer: null,
      rule70: null,
      verdict: "review",
    };
  }
  const arv = i.arv!;
  const rehab = i.rehab!;
  const sellingCosts = arv * pct(a.flipSellingCostsPct);
  const profitAt = (p: number) => {
    const c = computeCosts(p, rehab, a, a.flipHoldMonths);
    return { c, profit: arv - sellingCosts - c.allInCost };
  };
  let lo = 0;
  let hi = arv;
  let mao: number | null = null;
  if (profitAt(0).profit >= a.flipMinProfit) {
    while (hi - lo > 1) {
      const mid = (lo + hi) / 2;
      if (profitAt(mid).profit >= a.flipMinProfit) lo = mid;
      else hi = mid;
    }
    mao = Math.floor(lo);
  }
  const price = i.purchasePrice && i.purchasePrice > 0 ? i.purchasePrice : mao ?? 0;
  const { c, profit } = profitAt(price);
  const roi = c.cashInvested > 0 ? profit / c.cashInvested : null;
  return {
    complete: true,
    flags,
    salePrice: arv,
    sellingCosts,
    costs: c,
    netProfit: profit,
    roi,
    annualizedRoi: roi != null ? roi / (a.flipHoldMonths / 12) : null,
    maxAllowableOffer: mao,
    rule70: arv * 0.7 - rehab,
    verdict: mao == null ? "fail" : profit >= a.flipMinProfit ? "pass" : profit > 0 ? "review" : "fail",
  };
}
