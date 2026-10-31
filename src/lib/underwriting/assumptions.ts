import { z } from "zod";

/**
 * Editable lender + market assumptions. Percentages are stored as plain
 * percentages (6.75 = 6.75%) because that is how they are edited in the UI.
 *
 * Defaults combine the owner's brief (LTV / DSCR / haircut / rate) with the
 * owner-calibrated cost figures carried over from the original DealVelocity
 * analyzer (purchase closing $1,864, refi closing 3.25% + $4,039, taxes 1.00%
 * and insurance 0.62% of value per year, 8% vacancy, 5% maintenance, 5% CapEx).
 */
export const assumptionsSchema = z.object({
  // Refinance
  cashOutLtvPct: z.number().min(0).max(100),
  rateTermLtvPct: z.number().min(0).max(100),
  rateTermEligible: z.boolean(),
  refiRatePct: z.number().min(0).max(25),
  refiAmortYears: z.number().int().min(5).max(40),
  refiClosingPct: z.number().min(0).max(10),
  refiClosingFixed: z.number().min(0),
  appraisalFee: z.number().min(0),
  cashOutSeasoningMonths: z.number().int().min(0).max(24),
  dscrMin: z.number().min(0.5).max(3),
  rentHaircutPct: z.number().min(0).max(50),

  // Acquisition + rehab
  purchaseClosingCosts: z.number().min(0),
  rehabContingencyPct: z.number().min(0).max(100),
  holdMonths: z.number().int().min(1).max(36),

  // Acquisition financing (private / hard money)
  acquisitionFinancing: z.enum(["private", "cash"]),
  privateRatePct: z.number().min(0).max(30),
  privatePointsPct: z.number().min(0).max(10),
  privateLoanToCostPct: z.number().min(0).max(100),

  // Operating
  taxesPctOfValue: z.number().min(0).max(10),
  insurancePctOfValue: z.number().min(0).max(10),
  vacancyPct: z.number().min(0).max(50),
  maintenancePct: z.number().min(0).max(50),
  capexPct: z.number().min(0).max(50),
  managementPct: z.number().min(0).max(50),
  utilitiesMonthly: z.number().min(0),
  hoaMonthly: z.number().min(0),

  // Investment criteria
  maxCashLeftInDeal: z.number().min(0), // owner capital allowed to stay in after refi
  minMonthlyCashFlow: z.number(),
  targetDscr: z.number().min(0.5).max(3), // owner's DSCR target (lender minimum is dscrMin)

  // Buy box (screening). Deals outside it are flagged for review, never auto-passed.
  buyBoxMinArv: z.number().min(0),
  buyBoxMaxArv: z.number().min(0),
  buyBoxMinRentPct: z.number().min(0).max(5), // monthly rent as % of ARV
  buyBoxMaxRehab: z.number().min(0),
  buyBoxMinForcedEquityPct: z.number().min(0).max(100), // (ARV − all-in) ÷ ARV

  // Flip pathway
  flipSellingCostsPct: z.number().min(0).max(20),
  flipHoldMonths: z.number().int().min(1).max(36),
  flipMinProfit: z.number().min(0),
});

export type Assumptions = z.infer<typeof assumptionsSchema>;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  cashOutLtvPct: 75,
  rateTermLtvPct: 80,
  rateTermEligible: true,
  refiRatePct: 6.75,
  refiAmortYears: 30,
  refiClosingPct: 3.25,
  refiClosingFixed: 4039,
  appraisalFee: 0,
  cashOutSeasoningMonths: 6,
  dscrMin: 1.2,
  rentHaircutPct: 10,

  purchaseClosingCosts: 1864,
  rehabContingencyPct: 10,
  holdMonths: 6,

  acquisitionFinancing: "private",
  privateRatePct: 12,
  privatePointsPct: 2,
  privateLoanToCostPct: 100,

  taxesPctOfValue: 1.0,
  insurancePctOfValue: 0.62,
  vacancyPct: 8,
  maintenancePct: 5,
  capexPct: 5,
  managementPct: 0,
  utilitiesMonthly: 0,
  hoaMonthly: 0,

  // Owner's buy box, calibrated on 906 N Pershing (bought $70K, $15K rehab,
  // appraised $114K, rent $1,250): up to $20K left in, $300+/mo cash flow.
  maxCashLeftInDeal: 20000,
  minMonthlyCashFlow: 300,
  targetDscr: 1.35,

  buyBoxMinArv: 90000,
  buyBoxMaxArv: 170000,
  buyBoxMinRentPct: 0.9,
  buyBoxMaxRehab: 50000, // value-add welcome; MAO already prices the rehab
  buyBoxMinForcedEquityPct: 15,

  flipSellingCostsPct: 8,
  flipHoldMonths: 6,
  flipMinProfit: 25000,
};

export const ASSUMPTION_META: Record<
  keyof Assumptions,
  { label: string; group: string; unit: "%" | "$" | "mo" | "yr" | "x" | "bool" | "enum"; help?: string }
> = {
  cashOutLtvPct: { label: "Cash-out LTV", group: "Refinance", unit: "%" },
  rateTermLtvPct: { label: "Rate-and-term LTV", group: "Refinance", unit: "%" },
  rateTermEligible: { label: "Rate-and-term available", group: "Refinance", unit: "bool" },
  refiRatePct: { label: "Refi interest rate", group: "Refinance", unit: "%" },
  refiAmortYears: { label: "Amortization", group: "Refinance", unit: "yr" },
  refiClosingPct: { label: "Refi closing (% of loan)", group: "Refinance", unit: "%" },
  refiClosingFixed: { label: "Refi closing (fixed)", group: "Refinance", unit: "$" },
  appraisalFee: { label: "Appraisal fee", group: "Refinance", unit: "$", help: "If not already in fixed refi closing" },
  cashOutSeasoningMonths: {
    label: "Cash-out seasoning",
    group: "Refinance",
    unit: "mo",
    help: "Before this, lender value is capped at documented cost basis",
  },
  dscrMin: { label: "Minimum DSCR", group: "Refinance", unit: "x" },
  rentHaircutPct: { label: "Lender rent haircut", group: "Refinance", unit: "%" },
  purchaseClosingCosts: { label: "Purchase closing costs", group: "Acquisition", unit: "$" },
  rehabContingencyPct: { label: "Rehab contingency", group: "Acquisition", unit: "%" },
  holdMonths: { label: "Months to refinance", group: "Acquisition", unit: "mo" },
  acquisitionFinancing: { label: "Acquisition financing", group: "Acquisition", unit: "enum" },
  privateRatePct: { label: "Private money rate", group: "Acquisition", unit: "%" },
  privatePointsPct: { label: "Private money points", group: "Acquisition", unit: "%" },
  privateLoanToCostPct: { label: "Private loan-to-cost", group: "Acquisition", unit: "%" },
  taxesPctOfValue: { label: "Property tax (% of value / yr)", group: "Operating", unit: "%" },
  insurancePctOfValue: { label: "Insurance (% of value / yr)", group: "Operating", unit: "%" },
  vacancyPct: { label: "Vacancy", group: "Operating", unit: "%" },
  maintenancePct: { label: "Maintenance", group: "Operating", unit: "%" },
  capexPct: { label: "CapEx reserve", group: "Operating", unit: "%" },
  managementPct: { label: "Property management", group: "Operating", unit: "%" },
  utilitiesMonthly: { label: "Owner-paid utilities", group: "Operating", unit: "$" },
  hoaMonthly: { label: "HOA", group: "Operating", unit: "$" },
  maxCashLeftInDeal: { label: "Max cash left in deal", group: "Criteria", unit: "$", help: "Owner capital allowed to remain after the refinance" },
  minMonthlyCashFlow: { label: "Minimum cash flow / mo", group: "Criteria", unit: "$" },
  targetDscr: { label: "Target DSCR", group: "Criteria", unit: "x", help: "Your target; the lender minimum is set under Refinance" },
  buyBoxMinArv: { label: "Min ARV", group: "Buy box", unit: "$" },
  buyBoxMaxArv: { label: "Max ARV", group: "Buy box", unit: "$" },
  buyBoxMinRentPct: { label: "Min rent (% of ARV / mo)", group: "Buy box", unit: "%" },
  buyBoxMaxRehab: { label: "Max rehab", group: "Buy box", unit: "$" },
  buyBoxMinForcedEquityPct: { label: "Min forced equity (% of ARV)", group: "Buy box", unit: "%", help: "ARV minus all-in cost: the value your rehab creates" },
  flipSellingCostsPct: { label: "Selling costs", group: "Flip", unit: "%" },
  flipHoldMonths: { label: "Flip hold period", group: "Flip", unit: "mo" },
  flipMinProfit: { label: "Minimum flip profit", group: "Flip", unit: "$" },
};

export function resolveAssumptions(stored: unknown): Assumptions {
  const parsed = assumptionsSchema.partial().safeParse(stored ?? {});
  return { ...DEFAULT_ASSUMPTIONS, ...(parsed.success ? parsed.data : {}) };
}
