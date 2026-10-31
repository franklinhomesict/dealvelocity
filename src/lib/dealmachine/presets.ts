import type { Filter } from "./client";

/** Motivated-seller signals exposed in the import builder → DealMachine filter IDs (verified via /filters). */
export const SIGNALS: { id: string; label: string; filter: Filter }[] = [
  { id: "vacant", label: "Vacant", filter: { filter_id: "is_vacant_home", operator: "is_boolean", value: true } },
  { id: "absentee", label: "Absentee owner", filter: { filter_id: "has_absentee_owners", operator: "is_boolean", value: true } },
  { id: "probate", label: "Probate", filter: { filter_id: "is_pre_probate", operator: "is_boolean", value: true } },
  { id: "tax_delinquent", label: "Tax delinquent", filter: { filter_id: "is_tax_delinquent", operator: "is_boolean", value: true } },
  { id: "preforeclosure", label: "Pre-foreclosure", filter: { filter_id: "is_preforeclosure", operator: "is_boolean", value: true } },
  { id: "tired_landlord", label: "Tired landlord", filter: { filter_id: "has_tired_landlords", operator: "is_boolean", value: true } },
  { id: "high_equity", label: "50%+ equity", filter: { filter_id: "estimated_equity_percentage", operator: "greater_than_or_equal", value: 50 } },
  { id: "free_and_clear", label: "Free & clear", filter: { filter_id: "is_free_and_clear", operator: "is_boolean", value: true } },
];

export const TYPES: { id: string; label: string; optionId: number }[] = [
  { id: "sfr", label: "Single family", optionId: 1 },
  { id: "multi", label: "Multi-family", optionId: 5 },
  { id: "townhouse", label: "Townhouse", optionId: 2 },
];

export function buildFilters(signals: string[], types: string[]): Filter[] {
  const f = SIGNALS.filter((s) => signals.includes(s.id)).map((s) => s.filter);
  const opts = TYPES.filter((t) => types.includes(t.id)).map((t) => t.optionId);
  if (opts.length) f.push({ filter_id: "property_type", operator: "contains_any", value: opts });
  return f;
}
