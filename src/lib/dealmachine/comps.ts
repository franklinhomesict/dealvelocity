/** Parsing comps responses and deriving a comps-based ARV suggestion. */

export interface Comp {
  sourceRef: string | null;
  address: string;
  status: "sold" | "active" | "pending";
  price: number | null;
  date: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  distanceMiles: number | null;
  raw: Record<string, unknown>;
}

const n = (v: unknown) => {
  const x = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? x : null;
};
const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (o[k] != null && o[k] !== "") return o[k];
  return null;
};

/** Finds comp records anywhere in the response (shape not yet verified against a paid call). */
export function parseComps(resp: unknown): Comp[] {
  const found: Record<string, unknown>[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 5 || !v) return;
    if (Array.isArray(v)) {
      const objs = v.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
      if (objs.length && objs.every((o) => pick(o, "address", "full_address") && pick(o, "sale_price", "last_sale_price", "price", "list_price", "listing_price") != null)) {
        found.push(...objs);
        return;
      }
      objs.forEach((o) => walk(o, depth + 1));
    } else if (typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach((x) => walk(x, depth + 1));
    }
  };
  walk(resp, 0);
  return found.map((o) => {
    const statusRaw = String(pick(o, "status", "comp_type", "listing_status", "market_status") ?? "sold").toLowerCase();
    const status = statusRaw.includes("pend") || statusRaw.includes("contingent") ? "pending" : statusRaw.includes("active") || statusRaw.includes("listing") ? "active" : "sold";
    const d = pick(o, "sale_date", "last_sale_date", "date", "list_date", "listing_date");
    return {
      sourceRef: (pick(o, "dm_property_id", "property_id", "id") as string | null) ?? null,
      address: String(pick(o, "address", "full_address")),
      status,
      price: n(pick(o, "sale_price", "last_sale_price", "price", "list_price", "listing_price")),
      date: d ? new Date(String(d)).toISOString().slice(0, 10) : null,
      beds: n(pick(o, "num_bedrooms", "bedrooms", "beds")),
      baths: n(pick(o, "num_bathrooms", "bathrooms", "baths")),
      sqft: n(pick(o, "living_area_sqft", "sqft", "square_feet", "building_sqft")),
      yearBuilt: n(pick(o, "year_built")),
      distanceMiles: n(pick(o, "distance_miles", "distance")),
      raw: o,
    };
  });
}

export interface ArvSuggestion {
  arv: number;
  method: "median_ppsf" | "median_price";
  compsUsed: number;
  medianPpsf: number | null;
  low: number;
  high: number;
}

/**
 * Suggested ARV from SOLD comps only (active/pending asks aren't evidence of value).
 * Median $/sqft × subject sqft when sqft is known on both sides, else median price.
 * Requires at least 3 sold comps; returns null otherwise rather than guessing.
 */
export function suggestArv(comps: Pick<Comp, "status" | "price" | "sqft">[], subjectSqft: number | null): ArvSuggestion | null {
  const sold = comps.filter((c) => c.status === "sold" && c.price && c.price > 10_000);
  if (sold.length < 3) return null;
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const withSqft = sold.filter((c) => c.sqft && c.sqft > 300);
  if (subjectSqft && withSqft.length >= 3) {
    const ppsf = withSqft.map((c) => c.price! / c.sqft!);
    const med = median(ppsf);
    const q = [...ppsf].sort((a, b) => a - b);
    const lo = q[Math.floor(q.length * 0.25)];
    const hi = q[Math.min(q.length - 1, Math.floor(q.length * 0.75))];
    return { arv: Math.round((med * subjectSqft) / 500) * 500, method: "median_ppsf", compsUsed: withSqft.length, medianPpsf: Math.round(med), low: Math.round(lo * subjectSqft), high: Math.round(hi * subjectSqft) };
  }
  const prices = sold.map((c) => c.price!);
  const s = [...prices].sort((a, b) => a - b);
  return { arv: Math.round(median(prices) / 500) * 500, method: "median_price", compsUsed: sold.length, medianPpsf: null, low: s[Math.floor(s.length * 0.25)], high: s[Math.min(s.length - 1, Math.floor(s.length * 0.75))] };
}
