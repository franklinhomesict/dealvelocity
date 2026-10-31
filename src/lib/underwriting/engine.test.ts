import { describe, it, expect } from "vitest";
import {
  analyzeBrrrr,
  analyzeFlip,
  monthlyPayment,
  principalForPayment,
  computeCosts,
  solveMaxAllowableOffer,
  recommendOpeningOffer,
} from "./engine";
import { DEFAULT_ASSUMPTIONS as A, type Assumptions } from "./assumptions";

const deal = { purchasePrice: 62000, arv: 145000, rehab: 32000, monthlyRent: 1350 };

describe("amortization", () => {
  it("matches a standard 30-yr payment", () => {
    expect(monthlyPayment(100_000, 6.75, 30)).toBeCloseTo(648.6, 1);
    expect(monthlyPayment(120_000, 0, 30)).toBeCloseTo(333.33, 2);
  });
  it("principalForPayment is the inverse of monthlyPayment", () => {
    const p = monthlyPayment(108_750, 6.75, 30);
    expect(principalForPayment(p, 6.75, 30)).toBeCloseTo(108_750, 4);
  });
  it("returns 0 for non-positive inputs", () => {
    expect(monthlyPayment(0, 7, 30)).toBe(0);
    expect(principalForPayment(-5, 7, 30)).toBe(0);
  });
});

describe("cost stack", () => {
  it("includes contingency, closing, points, carry and holding T&I", () => {
    const c = computeCosts(60_000, 30_000, A);
    const financed = 60_000 + 30_000 + 3_000; // 10% contingency
    expect(c.rehabContingency).toBe(3_000);
    expect(c.acquisitionLoan).toBe(financed);
    expect(c.points).toBeCloseTo(financed * 0.02);
    expect(c.interestCarry).toBeCloseTo(financed * 0.01 * 6);
    expect(c.holdingTaxesInsurance).toBeCloseTo(((60_000 * 0.0162) / 12) * 6);
    expect(c.allInCost).toBeCloseTo(financed + 1864 + c.points + c.interestCarry + c.holdingTaxesInsurance);
    expect(c.cashInvested).toBeCloseTo(c.allInCost - c.acquisitionLoan);
  });
  it("cash purchase has no acquisition loan or financing cost", () => {
    const c = computeCosts(60_000, 30_000, { ...A, acquisitionFinancing: "cash" });
    expect(c.acquisitionLoan).toBe(0);
    expect(c.points).toBe(0);
    expect(c.interestCarry).toBe(0);
    expect(c.cashInvested).toBeCloseTo(c.allInCost);
  });
});

describe("BRRRR analysis", () => {
  it("flags missing inputs and never guesses", () => {
    const r = analyzeBrrrr({ purchasePrice: 60000, arv: null, rehab: null, monthlyRent: 1200 }, A);
    expect(r.complete).toBe(false);
    expect(r.verdict).toBe("review");
    expect(r.maxAllowableOffer).toBeNull();
    expect(r.flags.map((f) => f.code)).toEqual(expect.arrayContaining(["arv_missing", "rehab_missing"]));
  });

  it("uses 75% cash-out LTV on ARV when seasoned and LTV-bound", () => {
    const r = analyzeBrrrr({ ...deal, monthlyRent: 2000 }, A);
    expect(r.cashOut!.limitedBy).toBe("ltv");
    expect(r.cashOut!.loanAmount).toBeCloseTo(145_000 * 0.75);
    expect(r.cashOut!.closingCosts).toBeCloseTo(145_000 * 0.75 * 0.0325 + 4039);
  });

  it("cash remaining = cash invested − (net proceeds − payoff)", () => {
    const r = analyzeBrrrr(deal, A);
    const s = r.cashOut!;
    expect(s.cashRemainingInDeal).toBeCloseTo(r.costs!.cashInvested - (s.loanAmount - s.closingCosts - s.payoff));
  });

  it("MAO is the break point of the criteria", () => {
    const r = analyzeBrrrr(deal, A);
    const mao = r.maxAllowableOffer!;
    expect(mao).toBeGreaterThan(0);
    const at = analyzeBrrrr({ ...deal, purchasePrice: mao }, A).cashOut!;
    const above = analyzeBrrrr({ ...deal, purchasePrice: mao + 50 }, A).cashOut!;
    expect(at.cashRemainingInDeal).toBeLessThanOrEqual(-A.targetCashOut + 1);
    expect(above.cashRemainingInDeal).toBeGreaterThan(-A.targetCashOut);
  });

  it("higher target cash-out lowers MAO", () => {
    const base = solveMaxAllowableOffer(145000, 32000, 1350, A, deal)!;
    const greedy = solveMaxAllowableOffer(145000, 32000, 1350, { ...A, targetCashOut: 20000 }, deal)!;
    expect(greedy).toBeLessThan(base);
    expect(base - greedy).toBeGreaterThan(15000);
  });

  it("MAO is monotonic in ARV", () => {
    const a = solveMaxAllowableOffer(130000, 30000, 1300, A, deal)!;
    const b = solveMaxAllowableOffer(150000, 30000, 1300, A, deal)!;
    expect(b).toBeGreaterThanOrEqual(a);
  });

  it("DSCR constrains the loan when rent is weak", () => {
    const r = analyzeBrrrr({ ...deal, monthlyRent: 800 }, { ...A, minMonthlyCashFlow: 0 });
    expect(r.cashOut!.limitedBy).toBe("dscr");
    expect(r.cashOut!.dscr).toBeGreaterThanOrEqual(A.dscrMin - 1e-6);
  });

  it("sizes the loan down to protect minimum cash flow", () => {
    const r = analyzeBrrrr({ ...deal, monthlyRent: 1150 }, { ...A, minMonthlyCashFlow: 250 });
    expect(r.cashOut!.limitedBy).toBe("cash_flow");
    expect(r.cashOut!.monthlyCashFlow).toBeCloseTo(250, 4);
  });

  it("applies the lender rent haircut to DSCR", () => {
    const r = analyzeBrrrr(deal, A);
    expect(r.operating!.qualifyingRent).toBeCloseTo(1350 * 0.9);
    expect(r.cashOut!.dscr).toBeCloseTo(r.operating!.qualifyingRent / r.cashOut!.monthlyPITI);
  });

  it("caps unseasoned cash-out value at cost basis", () => {
    const a: Assumptions = { ...A, holdMonths: 3, cashOutSeasoningMonths: 6 };
    const r = analyzeBrrrr(deal, a);
    expect(r.cashOut!.valueBasis).toBeCloseTo(62000 + 32000 + 3200);
    expect(r.flags.some((f) => f.code === "unseasoned")).toBe(true);
  });

  it("rate-and-term never returns cash to the owner", () => {
    const r = analyzeBrrrr({ ...deal, monthlyRent: 2000 }, A);
    expect(r.rateTerm!.cashToOwnerAtRefi).toBeLessThanOrEqual(0.01);
    expect(r.rateTerm!.loanAmount).toBeLessThanOrEqual(145000 * 0.8 + 0.01);
  });

  it("rate-and-term respects actual payoff override", () => {
    const r = analyzeBrrrr({ ...deal, monthlyRent: 2000, loanPayoffOverride: 50000 }, A);
    expect(r.rateTerm!.payoff).toBe(50000);
    expect(r.rateTerm!.limitedBy).toBe("payoff");
    expect(r.rateTerm!.netProceeds).toBeCloseTo(50000, 0);
  });

  it("never passes a price above MAO, even with strong cash flow", () => {
    const r0 = analyzeBrrrr(deal, A);
    const r = analyzeBrrrr({ ...deal, purchasePrice: r0.maxAllowableOffer! + 5000 }, A);
    expect(r.verdict).not.toBe("pass");
    expect(r.verdictReasons.join(" ")).toMatch(/above maximum allowable offer/);
  });

  it("fails when no price can satisfy DSCR + cash flow", () => {
    const r = analyzeBrrrr({ ...deal, monthlyRent: 300 }, A);
    expect(r.maxAllowableOffer).toBeNull();
    expect(r.verdict).toBe("fail");
  });

  it("stress cases are each worse than base", () => {
    const r = analyzeBrrrr(deal, A);
    for (const s of r.stress) {
      expect(s.cashRemainingInDeal).toBeGreaterThanOrEqual(r.cashOut!.cashRemainingInDeal - 1);
    }
    expect(r.stress).toHaveLength(4);
  });

  it("score is bounded and better deals score higher", () => {
    const good = analyzeBrrrr({ ...deal, purchasePrice: 45000 }, A).dealScore!;
    const bad = analyzeBrrrr({ ...deal, purchasePrice: 95000 }, A).dealScore!;
    expect(good).toBeGreaterThan(bad);
    expect(good).toBeLessThanOrEqual(100);
    expect(bad).toBeGreaterThanOrEqual(0);
  });

  it("opening offer is below MAO, rounded to $500, and never above asking", () => {
    expect(recommendOpeningOffer(70_123, null)).toBe(63_000);
    expect(recommendOpeningOffer(70_123, 55_000)).toBe(55_000);
  });
});

describe("flip pathway", () => {
  it("MAO yields the minimum profit", () => {
    const r = analyzeFlip({ purchasePrice: null, arv: 180000, rehab: 40000, monthlyRent: null }, A);
    expect(r.maxAllowableOffer).not.toBeNull();
    expect(r.netProfit!).toBeGreaterThanOrEqual(A.flipMinProfit - 1);
    expect(r.netProfit!).toBeLessThan(A.flipMinProfit + 50);
    expect(r.rule70).toBe(180000 * 0.7 - 40000);
  });
  it("requires ARV and rehab", () => {
    const r = analyzeFlip({ purchasePrice: 1, arv: 0, rehab: null, monthlyRent: null }, A);
    expect(r.complete).toBe(false);
    expect(r.verdict).toBe("review");
  });
});
