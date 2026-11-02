/**
 * DealMachine REST client (API v2, https://api.v2.dealmachine.com/v1).
 *
 * - Bearer API key from server env only (DEALMACHINE_API_KEY, prefix dm_sk_live_).
 * - Client-side rate limit under the documented 60 req/min.
 * - Retries 429/5xx/network errors with backoff. All requests here are reads
 *   or credit-metered lookups that DealMachine deduplicates within a billing
 *   period, so a retry cannot double-charge for the same record.
 * - Every call reports its credit receipt to `onCall` for usage tracking.
 *
 * Response shapes were confirmed against the live account where free:
 * count, cost estimate, prospects, lists, unenriched property, webhook events.
 * Search pages, enrichment and comps follow the same conventions but are
 * parsed defensively until verified with a paid call.
 */

export const DM_DEFAULT_BASE = "https://api.v2.dealmachine.com/v1";

export type Location =
  | { type: "zip_code" | "state" | "county" | "city"; code: string }
  | { type: "radius"; latitude: number; longitude: number; radius_miles: number };

export interface Filter {
  filter_id: string;
  operator?: string;
  value: unknown;
}

export interface CreditReceipt {
  used: number;
  properties?: number;
  people?: number;
  deduplicated?: number;
  licensed?: number;
}

/** A DealMachine property record: flat object keyed by DealMachine field IDs. */
export type DmProperty = { dm_property_id: string; address?: string; city?: string; state?: string; zip?: string } & Record<string, unknown>;

export interface DmProspect {
  id: string;
  record_type: "property" | "person";
  record_id: string;
  lifecycle: string;
  source: string;
  record: { address: string; city: string; state: string; zip: string; latitude?: number; longitude?: number };
  tags: { id: string; name: string }[];
  created_at: string;
}

export interface CallLog {
  operation: string;
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
  credits: CreditReceipt | null;
  error?: string;
}

export class DealMachineError extends Error {
  constructor(message: string, public status: number | null, public retryable: boolean) {
    super(message);
  }
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  onCall?: (log: CallLog) => void | Promise<void>;
  maxRetries?: number;
  requestsPerMinute?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Fields requested on enrichment / paid search. Kept small: credits are per record, not per field. */
export const PROPERTY_FIELDS = [
  "num_bedrooms", "num_bathrooms", "living_area_sqft", "lot_size_sqft", "year_built", "property_type", "num_units",
  "estimated_value", "estimated_equity_amount", "estimated_equity_percentage", "estimated_repair_cost",
  "assessed_total_value", "last_sale_price", "last_sale_date", "tax_amount", "parcel_number_raw",
  "owner_1_full_name", "owner_2_full_name", "is_owner_occupied", "has_absentee_owners", "has_out_of_state_owners",
  "is_vacant_home", "is_pre_probate", "is_tax_delinquent", "is_preforeclosure", "has_tired_landlords",
  "is_free_and_clear", "is_owned_by_trust", "is_corporate_owned", "building_condition",
];

export class DealMachineClient {
  private base: string;
  private f: typeof fetch;
  private sent: number[] = [];
  private sleep: (ms: number) => Promise<void>;

  constructor(private o: ClientOptions) {
    if (!o.apiKey) throw new DealMachineError("DealMachine API key is not configured", null, false);
    this.base = (o.baseUrl ?? DM_DEFAULT_BASE).replace(/\/$/, "");
    this.f = o.fetch ?? fetch;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private async throttle() {
    const limit = this.o.requestsPerMinute ?? 50;
    const now = Date.now();
    this.sent = this.sent.filter((t) => now - t < 60_000);
    if (this.sent.length >= limit) await this.sleep(60_000 - (now - this.sent[0]) + 50);
    this.sent.push(Date.now());
  }

  async request<T>(operation: string, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const max = this.o.maxRetries ?? 3;
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      const started = Date.now();
      let status: number | null = null;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.o.timeoutMs ?? 30_000);
        const res = await this.f(this.base + path, {
          method,
          headers: { Authorization: `Bearer ${this.o.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: ctrl.signal,
        }).finally(() => clearTimeout(timer));
        status = res.status;
        const text = await res.text();
        const json = text ? safeJson(text) : null;
        if (!res.ok) {
          const msg = errorMessage(json) ?? `DealMachine ${res.status}`;
          const retryable = res.status === 429 || res.status >= 500;
          await this.o.onCall?.({ operation, method, path, status, durationMs: Date.now() - started, credits: null, error: msg });
          if (retryable && attempt < max) {
            const ra = Number(res.headers.get("retry-after"));
            await this.sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 500 * 2 ** attempt);
            continue;
          }
          throw new DealMachineError(friendly(res.status, msg), res.status, retryable);
        }
        await this.o.onCall?.({ operation, method, path, status, durationMs: Date.now() - started, credits: receipt(json) });
        return json as T;
      } catch (e) {
        if (e instanceof DealMachineError) throw e;
        const msg = e instanceof Error ? (e.name === "AbortError" ? "Request timed out" : e.message) : "Network error";
        await this.o.onCall?.({ operation, method, path, status, durationMs: Date.now() - started, credits: null, error: msg });
        if (attempt < max) {
          await this.sleep(500 * 2 ** attempt);
          continue;
        }
        throw new DealMachineError(`DealMachine unreachable: ${msg}`, null, true);
      }
    }
  }

  /* ── Free operations ── */
  whoami() {
    return this.request<{ authenticated: boolean; organization: { name: string } }>("whoami", "GET", "/whoami");
  }
  usage() {
    return this.request<DmUsage>("usage", "GET", "/usage");
  }
  count(locations: Location[], filters: Filter[]) {
    return this.request<{ total_properties: number; total_people: number; total_results: number }>("count", "POST", "/properties/search/count", { locations, filters });
  }
  estimateSearch(locations: Location[], filters: Filter[], perPage: number) {
    return this.request<{ totals: { properties: number }; estimated_credits: { this_page: number; total_all_pages: number; breakdown?: { already_accessed?: number } } }>(
      "estimate", "POST", "/properties/search",
      { locations, filters, fields: PROPERTY_FIELDS, contact_audience: "none", per_page: perPage, estimate_cost: true },
    );
  }
  lists(page = 1) {
    return this.request<{ data: { list_id: string; name: string; source_type: string; total_count: number; status: string }[]; pagination: { has_more: boolean } }>(
      "lists", "GET", `/lists?source_type=properties&per_page=100&page=${page}`,
    );
  }
  prospects(params: { listId?: string; page: number; perPage: number }) {
    const q = new URLSearchParams({ record_type: "property", page: String(params.page), per_page: String(params.perPage) });
    if (params.listId) q.set("list_id", params.listId);
    return this.request<{ data: DmProspect[]; pagination: { page: number; total: number; has_more: boolean } }>("prospects", "GET", `/prospects?${q}`);
  }
  /** Base fields only (address, coordinates, beds, baths, sqft). Free. */
  propertyBase(id: string) {
    return this.request<{ data: DmProperty; credits?: CreditReceipt }>("property_base", "GET", `/properties/${encodeURIComponent(id)}?enrich=false&contact_audience=none`);
  }

  /* ── Credit-consuming operations: callers must pass the budget guard first ── */
  searchPage(locations: Location[], filters: Filter[], page: number, perPage: number) {
    return this.request<{ data: DmProperty[]; pagination: { page: number; has_next_page: boolean; total_results: number }; credits?: CreditReceipt }>(
      "search", "POST", "/properties/search",
      { locations, filters, fields: PROPERTY_FIELDS, contact_audience: "none", page, per_page: perPage },
    );
  }
  enrichProperty(id: string) {
    const q = new URLSearchParams({ enrich: "true", contact_audience: "none", fields: PROPERTY_FIELDS.join(",") });
    return this.request<{ data: DmProperty; credits?: CreditReceipt }>("enrich", "GET", `/properties/${encodeURIComponent(id)}?${q}`);
  }
  enrichAddress(a: { street: string; city: string; state: string; zip: string }) {
    return this.request<{ data: DmProperty | null; credits?: CreditReceipt }>("enrich_address", "POST", "/enrich/address", { ...a, contact_audience: "none", fields: PROPERTY_FIELDS });
  }
  comps(propertyId: string, criteria: Record<string, unknown> = {}) {
    return this.request<unknown>("comps", "POST", "/properties/comps", {
      property_ids: [propertyId],
      criteria: { timeframe: "12months", include_active_listings: true, include_pending: true, match_property_type: true, limit: 25, sort_by: "match", ...criteria },
    });
  }
}

export interface DmUsage {
  plan: { name: string; is_paid: boolean };
  billing_cycle: { start: string; end: string };
  credits: { total_available: number; total_cap?: number; remaining: number; used: number; monthly_remaining: number; additional_remaining: number; breakdown: { properties: number; people: number } };
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return { raw: t.slice(0, 500) };
  }
}
function errorMessage(j: unknown): string | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const e = o.error as Record<string, unknown> | string | undefined;
  if (typeof e === "string") return e;
  if (e && typeof e.message === "string") return e.message;
  return typeof o.message === "string" ? o.message : null;
}
function friendly(status: number, msg: string) {
  if (status === 401) return "DealMachine rejected the API key (401). Check DEALMACHINE_API_KEY.";
  if (status === 402) return "DealMachine reports insufficient credits (402).";
  if (status === 403) return `DealMachine denied access (403): ${msg}`;
  if (status === 429) return "DealMachine rate limit reached. Try again shortly.";
  return msg;
}
/** Extracts the credit receipt DealMachine attaches to metered responses. */
export function receipt(j: unknown): CreditReceipt | null {
  if (!j || typeof j !== "object") return null;
  const c = (j as Record<string, unknown>).credits as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object" || typeof c.used !== "number") return null;
  return {
    used: c.used,
    properties: num(c.properties),
    people: num(c.people),
    deduplicated: num(c.deduplicated),
    licensed: num(c.licensed),
  };
}
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

/** Largest page size ≤ max that divides the offset (always ≥ 1). */
export function pageSizeFor(offset: number, max: number): number {
  if (offset === 0) return max;
  for (let p = max; p > 1; p--) if (offset % p === 0) return p;
  return 1;
}
