/** Credit guard evaluated before every credit-consuming DealMachine request. */
export interface CreditSettings {
  paidEnabled: boolean; // owner kill switch for paid data
  monthlyBudget: number; // app-level cap, below the plan allowance
  maxPerImport: number;
}

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = { paidEnabled: false, monthlyBudget: 2000, maxPerImport: 250 };

export function checkCredits(p: {
  settings: CreditSettings;
  usedThisCycle: number; // credits this app spent in the current cycle
  liveRemaining: number | null; // account balance from /usage, when known
  requested: number;
  isImport?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  const { settings: s, requested } = p;
  if (!s.paidEnabled) return { ok: false, reason: "Paid DealMachine requests are switched off in Settings." };
  if (requested <= 0) return { ok: true };
  if (p.isImport && requested > s.maxPerImport)
    return { ok: false, reason: `This import needs up to ${requested} credits; the per-import cap is ${s.maxPerImport}. Narrow the search or lower the record limit.` };
  const left = s.monthlyBudget - p.usedThisCycle;
  if (requested > left) return { ok: false, reason: `Monthly budget: ${left} of ${s.monthlyBudget} credits left, ${requested} needed.` };
  if (p.liveRemaining != null && requested > p.liveRemaining)
    return { ok: false, reason: `DealMachine account has ${p.liveRemaining} credits remaining, ${requested} needed.` };
  return { ok: true };
}
