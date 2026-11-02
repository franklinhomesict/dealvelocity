import type { LeadStage } from "@/db/schema";

export const STAGES: { id: LeadStage; label: string; short: string; terminal?: boolean }[] = [
  { id: "new", label: "New", short: "New" },
  { id: "contacting", label: "Contacting", short: "Contact" },
  { id: "qualified", label: "Qualified", short: "Qualified" },
  { id: "underwriting", label: "Underwriting", short: "Underwrite" },
  { id: "offer", label: "Offer", short: "Offer" },
  { id: "negotiating", label: "Negotiating", short: "Negotiate" },
  { id: "under_contract", label: "Under contract", short: "Contract" },
  { id: "closed", label: "Closed", short: "Closed", terminal: true },
  { id: "dead", label: "Dead", short: "Dead", terminal: true },
];

export const ACTIVE_STAGES = STAGES.filter((s) => !s.terminal).map((s) => s.id);
export const stageLabel = (s: LeadStage) => STAGES.find((x) => x.id === s)?.label ?? s;
export const stageIndex = (s: LeadStage) => STAGES.findIndex((x) => x.id === s);

/** Days in stage after which a lead is considered stuck. */
export const STUCK_AFTER_DAYS: Partial<Record<LeadStage, number>> = {
  new: 2,
  contacting: 5,
  qualified: 3,
  underwriting: 3,
  offer: 4,
  negotiating: 7,
};

export const PROPERTY_TYPES = {
  single_family: "Single family",
  duplex: "Duplex",
  triplex: "Triplex",
  fourplex: "Fourplex",
  townhouse: "Townhouse",
  condo: "Condo",
  mobile: "Mobile home",
  land: "Land",
  other: "Other",
} as const;

export const OCCUPANCY = {
  owner_occupied: "Owner occupied",
  tenant_occupied: "Tenant occupied",
  vacant: "Vacant",
  unknown: "Unknown",
} as const;

export const CONDITION = {
  turnkey: "Turnkey",
  light: "Light rehab",
  moderate: "Moderate rehab",
  heavy: "Heavy rehab",
  teardown: "Teardown",
  unknown: "Unknown",
} as const;

export const SOURCES = {
  manual: "Manual entry",
  dealmachine: "DealMachine",
  inbound_call: "Inbound call",
  referral: "Referral",
  sample: "Sample data",
} as const;
