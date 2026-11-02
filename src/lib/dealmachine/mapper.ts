/**
 * Maps DealMachine property records onto our properties table.
 *
 * Provenance rules:
 * - County-record fields (beds, baths, sqft, year, assessed value, last sale) are
 *   stored as record data.
 * - Modeled values (estimated value, equity, repair cost) go to `estimated_*`
 *   columns and are always labeled as estimates in the UI.
 * - On a property that was entered manually, DealMachine only fills blanks;
 *   it never overwrites a value a person typed.
 */
import type { DmProperty } from "./client";

type PropertyType = "single_family" | "duplex" | "triplex" | "fourplex" | "townhouse" | "condo" | "mobile" | "land" | "other";

export interface MappedProperty {
  sourceRef: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  latitude: string | null;
  longitude: string | null;
  propertyType: PropertyType | null;
  units: number | null;
  beds: number | null;
  baths: string | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  apn: string | null;
  ownerName: string | null;
  occupancy: "owner_occupied" | "tenant_occupied" | "vacant" | "unknown" | null;
  assessedValue: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  estimatedValue: number | null;
  estimatedRepairCost: number | null;
  estimatedEquityPercent: string | null;
  estimatedEquityAmount: number | null;
  distressFlags: string[];
}

const int = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
};
const dec = (v: unknown, digits = 2): string | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n.toFixed(digits) : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/** DealMachine returns booleans as true/false on free records and "Yes"/"No" on enriched ones. */
const bool = (v: unknown): boolean | null => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "yes" || t === "true" || t === "y") return true;
    if (t === "no" || t === "false" || t === "n") return false;
  }
  return null;
};
/** First non-empty value among field aliases (enriched records use different names). */
const first = (r: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (r[k] != null && r[k] !== "") return r[k];
  return null;
};
const date = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export const DISTRESS_LABELS: Record<string, string> = {
  vacant: "Vacant",
  absentee: "Absentee owner",
  out_of_state: "Out-of-state owner",
  probate: "Probate",
  tax_delinquent: "Tax delinquent",
  preforeclosure: "Pre-foreclosure",
  tired_landlord: "Tired landlord",
  free_and_clear: "Free & clear",
  trust: "Trust owned",
  corporate: "Corporate owned",
};

const FLAG_FIELDS: [string, string][] = [
  ["is_vacant_home", "vacant"],
  ["has_absentee_owners", "absentee"],
  ["has_out_of_state_owners", "out_of_state"],
  ["is_pre_probate", "probate"],
  ["is_tax_delinquent", "tax_delinquent"],
  ["is_preforeclosure", "preforeclosure"],
  ["has_tired_landlords", "tired_landlord"],
  ["is_free_and_clear", "free_and_clear"],
  ["is_owned_by_trust", "trust"],
  ["is_corporate_owned", "corporate"],
];

/** DealMachine property_type label (or option id) → our enum. Unit count refines multi-family. */
export function mapPropertyType(raw: unknown, units: number | null): PropertyType | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const label = typeof v === "number" ? ({ 1: "single family", 2: "townhouse", 3: "condominium", 4: "mobile home", 5: "multi family", 6: "vacant land" } as Record<number, string>)[v] : typeof v === "string" ? v.toLowerCase() : null;
  if (!label) return null;
  if (label.includes("single")) return "single_family";
  if (label.includes("town")) return "townhouse";
  if (label.includes("condo")) return "condo";
  if (label.includes("mobile")) return "mobile";
  if (label.includes("land")) return "land";
  if (label.includes("multi") || label.includes("apartment")) {
    if (units === 2) return "duplex";
    if (units === 3) return "triplex";
    if (units === 4) return "fourplex";
    return "other";
  }
  return "other";
}

export function mapDmProperty(r: DmProperty): MappedProperty {
  const street = str(r.address) ?? str(r.full_address)?.split(/\s+(?=[A-Z][a-z]+,\s*[A-Z]{2}\s+\d{5})/)[0] ?? null;
  if (!r.dm_property_id || !street || !str(r.city) || !str(r.zip)) {
    throw new Error(`DealMachine record ${r.dm_property_id ?? "(no id)"} is missing an address`);
  }
  const units = int(r.num_units);
  const owner = bool(first(r, "is_owner_occupied", "owner_occupied"));
  const vacant = bool(r.is_vacant_home);
  const absentee = bool(r.has_absentee_owners);
  return {
    sourceRef: String(r.dm_property_id),
    street: street,
    city: str(r.city)!,
    state: (str(r.state) ?? "KS").toUpperCase().slice(0, 2),
    zip: String(r.zip).slice(0, 5),
    latitude: dec(r.latitude, 6),
    longitude: dec(r.longitude, 6),
    propertyType: mapPropertyType(r.property_type, units),
    units: units && units > 0 ? units : null,
    beds: int(r.num_bedrooms),
    baths: dec(r.num_bathrooms, 1),
    sqft: int(r.living_area_sqft),
    lotSqft: int(r.lot_size_sqft),
    yearBuilt: int(r.year_built),
    apn: str(first(r, "parcel_number_raw", "apn")),
    ownerName: [str(r.owner_1_full_name), str(r.owner_2_full_name)].filter(Boolean).join(" & ") || null,
    occupancy: vacant ? "vacant" : owner ? "owner_occupied" : absentee ? "tenant_occupied" : null,
    assessedValue: int(first(r, "assessed_total_value", "total_assessed_value")),
    lastSalePrice: int(first(r, "last_sale_price", "last_sale_amount")) || null,
    lastSaleDate: date(r.last_sale_date),
    estimatedValue: int(r.estimated_value),
    estimatedRepairCost: int(r.estimated_repair_cost),
    estimatedEquityPercent: dec(r.estimated_equity_percentage),
    estimatedEquityAmount: int(r.estimated_equity_amount),
    distressFlags: FLAG_FIELDS.filter(([f]) => bool(r[f]) === true).map(([, k]) => k),
  };
}

/** Columns DealMachine may set. Undefined entries are left untouched. */
export function propertyPatch(m: MappedProperty, existing: Record<string, unknown> | null, fromDealMachine: boolean) {
  const fields = {
    latitude: m.latitude, longitude: m.longitude, propertyType: m.propertyType, units: m.units, beds: m.beds, baths: m.baths,
    sqft: m.sqft, lotSqft: m.lotSqft, yearBuilt: m.yearBuilt, apn: m.apn, ownerName: m.ownerName, occupancy: m.occupancy,
    assessedValue: m.assessedValue, lastSalePrice: m.lastSalePrice, lastSaleDate: m.lastSaleDate,
  } as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    const cur = existing?.[k];
    const blank = cur == null || cur === "" || (k === "occupancy" && cur === "unknown") || (k === "propertyType" && cur === "other") || (k === "units" && cur === 1);
    if (!existing || fromDealMachine || blank) out[k] = v;
  }
  // Estimates are DealMachine-owned columns and always refresh.
  for (const k of ["estimatedValue", "estimatedRepairCost", "estimatedEquityPercent", "estimatedEquityAmount"] as const) {
    if (m[k] != null) out[k] = m[k];
  }
  if (m.distressFlags.length || fromDealMachine) out.distressFlags = m.distressFlags;
  return out;
}
