export const BUILTIN_VIEWS: { id: string; name: string; query: Record<string, string> }[] = [
  { id: "active", name: "Active", query: { stage: "new,contacting,qualified,underwriting,offer,negotiating,under_contract" } },
  { id: "hot", name: "Hot", query: { stage: "new,contacting,qualified,underwriting,offer,negotiating", temp: "hot" } },
  { id: "ready", name: "Ready for offer", query: { stage: "qualified,underwriting", sort: "score" } },
  { id: "contract", name: "Under contract", query: { stage: "under_contract" } },
  { id: "all", name: "All", query: {} },
];
