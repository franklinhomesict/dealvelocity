import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { DealMachineClient, DealMachineError, receipt, pageSizeFor } from "./client";
import { mapDmProperty, mapPropertyType, propertyPatch } from "./mapper";
import { parseComps, suggestArv } from "./comps";
import { verifySignature, parseEvents } from "./webhook";
import { checkCredits, DEFAULT_CREDIT_SETTINGS } from "./budget";

// Real (free) response captured from the live account: GET /properties/{id}?enrich=false
const BASE = {
  dm_property_id: "prop_56241764",
  full_address: "1901 S Millwood St Wichita, KS 67213",
  address: "1901 S Millwood St",
  city: "Wichita",
  state: "KS",
  zip: "67213",
  latitude: 37.660404,
  longitude: -97.360257,
  num_bedrooms: 3,
  num_bathrooms: 1,
  living_area_sqft: 996,
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("client", () => {
  const mk = (f: typeof fetch, onCall = vi.fn()) =>
    new DealMachineClient({ apiKey: "dm_sk_live_test", baseUrl: "https://dm.test/v1", fetch: f, onCall, sleep: async () => {} });

  it("sends bearer auth and logs the credit receipt", async () => {
    const f = vi.fn(async () => json(200, { data: BASE, credits: { used: 0, properties: 0, people: 0, deduplicated: 0, licensed: 0 } }));
    const onCall = vi.fn();
    const r = await mk(f as unknown as typeof fetch, onCall).propertyBase("prop_56241764");
    expect(r.data.address).toBe("1901 S Millwood St");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://dm.test/v1/properties/prop_56241764?enrich=false&contact_audience=none");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer dm_sk_live_test");
    expect(onCall).toHaveBeenCalledWith(expect.objectContaining({ operation: "property_base", status: 200, credits: expect.objectContaining({ used: 0 }) }));
  });

  it("retries 429 and 5xx, then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(json(429, { error: "slow down" }, { "retry-after": "1" })).mockResolvedValueOnce(json(502, {})).mockResolvedValueOnce(json(200, { total_properties: 372, total_people: 172, total_results: 372 }));
    const r = await mk(f as unknown as typeof fetch).count([{ type: "zip_code", code: "67213" }], []);
    expect(r.total_properties).toBe(372);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("does not retry 401 and explains the problem", async () => {
    const f = vi.fn(async () => json(401, { error: { message: "invalid key" } }));
    await expect(mk(f as unknown as typeof fetch).whoami()).rejects.toThrow(/API key/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("gives up after max retries", async () => {
    const f = vi.fn(async () => json(503, {}));
    await expect(mk(f as unknown as typeof fetch).whoami()).rejects.toBeInstanceOf(DealMachineError);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("refuses to construct without an API key", () => {
    expect(() => new DealMachineClient({ apiKey: "" })).toThrow(/not configured/);
  });

  it("extracts credit receipts only when present", () => {
    expect(receipt({ credits: { used: 25, deduplicated: 3 } })).toMatchObject({ used: 25, deduplicated: 3 });
    expect(receipt({ data: [] })).toBeNull();
  });
});

describe("mapper", () => {
  it("maps the live base record", () => {
    const m = mapDmProperty(BASE);
    expect(m).toMatchObject({ sourceRef: "prop_56241764", street: "1901 S Millwood St", city: "Wichita", zip: "67213", beds: 3, baths: "1.0", sqft: 996, latitude: "37.660404" });
    expect(m.estimatedValue).toBeNull();
    expect(m.distressFlags).toEqual([]);
  });

  it("maps enriched fields, estimates and distress flags", () => {
    const m = mapDmProperty({ ...BASE, estimated_value: "142000", estimated_repair_cost: 31000, estimated_equity_percentage: 88.4, is_vacant_home: true, has_absentee_owners: true, is_pre_probate: true, property_type: "Single Family", owner_1_full_name: "ESTATE OF J DOE", last_sale_date: "2004-06-01T00:00:00Z", last_sale_price: 0 });
    expect(m.estimatedValue).toBe(142000);
    expect(m.estimatedEquityPercent).toBe("88.40");
    expect(m.distressFlags).toEqual(["vacant", "absentee", "probate"]);
    expect(m.occupancy).toBe("vacant");
    expect(m.propertyType).toBe("single_family");
    expect(m.lastSalePrice).toBeNull(); // $0 non-arm's-length transfer is not a price
    expect(m.lastSaleDate).toBe("2004-06-01");
  });

  it("maps multi-family by unit count", () => {
    expect(mapPropertyType("Multi Family", 2)).toBe("duplex");
    expect(mapPropertyType([5], 4)).toBe("fourplex");
    expect(mapPropertyType("Vacant Land", null)).toBe("land");
  });

  it("rejects records without an address", () => {
    expect(() => mapDmProperty({ dm_property_id: "prop_1" })).toThrow(/missing an address/);
  });

  it("never overwrites manually entered values, but fills blanks and refreshes estimates", () => {
    const m = mapDmProperty({ ...BASE, estimated_value: 140000 });
    const patch = propertyPatch(m, { beds: 4, baths: null, sqft: 1100, occupancy: "unknown", units: 1 }, false);
    expect(patch.beds).toBeUndefined();
    expect(patch.sqft).toBeUndefined();
    expect(patch.baths).toBe("1.0");
    expect(patch.estimatedValue).toBe(140000);
  });

  it("DealMachine-sourced records take DealMachine values", () => {
    const patch = propertyPatch(mapDmProperty(BASE), { beds: 4 }, true);
    expect(patch.beds).toBe(3);
  });
});

describe("comps", () => {
  const resp = {
    data: [
      {
        subject_id: "prop_1",
        comps: [
          { dm_property_id: "prop_a", address: "1 A St", sale_price: 120000, sale_date: "2026-05-01", living_area_sqft: 1000, distance_miles: 0.3, status: "sold" },
          { dm_property_id: "prop_b", address: "2 B St", sale_price: 130000, sale_date: "2026-06-01", living_area_sqft: 1000, status: "sold" },
          { dm_property_id: "prop_c", address: "3 C St", sale_price: 140000, sale_date: "2026-07-01", living_area_sqft: 1000, status: "sold" },
          { dm_property_id: "prop_d", address: "4 D St", list_price: 199000, living_area_sqft: 1000, status: "active" },
        ],
      },
    ],
  };
  it("parses nested comp arrays", () => {
    const c = parseComps(resp);
    expect(c).toHaveLength(4);
    expect(c[3].status).toBe("active");
    expect(c[0].distanceMiles).toBe(0.3);
  });
  it("suggests ARV from sold comps only (median $/sqft × subject sqft)", () => {
    const s = suggestArv(parseComps(resp), 1100)!;
    expect(s.method).toBe("median_ppsf");
    expect(s.compsUsed).toBe(3);
    expect(s.medianPpsf).toBe(130);
    expect(s.arv).toBe(143000);
  });
  it("returns null with fewer than 3 sold comps", () => {
    expect(suggestArv([{ status: "sold", price: 100000, sqft: 900 }, { status: "active", price: 1, sqft: 1 }], 1000)).toBeNull();
  });
});

describe("webhooks", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ events: [{ id: "evt_1", type: "prospect.added", occurred_at: "2026-10-31T00:00:00Z", data: {} }] });
  it("accepts a valid hex HMAC and rejects tampering", () => {
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifySignature(body, sig, secret)).toBe(true);
    expect(verifySignature(body + " ", sig, secret)).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
  });
  it("accepts timestamped signatures and rejects replays", () => {
    const t = 1_800_000_000;
    const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    expect(verifySignature(body, `t=${t},v1=${sig}`, secret, t + 10)).toBe(true);
    expect(verifySignature(body, `t=${t},v1=${sig}`, secret, t + 3600)).toBe(false);
  });
  it("parses event batches", () => {
    expect(parseEvents(JSON.parse(body))).toHaveLength(1);
    expect(parseEvents({ nope: 1 })).toEqual([]);
  });
});

describe("credit guard", () => {
  const s = { ...DEFAULT_CREDIT_SETTINGS, paidEnabled: true };
  it("blocks when paid requests are switched off", () => {
    expect(checkCredits({ settings: DEFAULT_CREDIT_SETTINGS, usedThisCycle: 0, liveRemaining: 1000, requested: 1 }).ok).toBe(false);
  });
  it("enforces per-import cap, monthly budget and live balance", () => {
    expect(checkCredits({ settings: s, usedThisCycle: 0, liveRemaining: null, requested: 251, isImport: true })).toMatchObject({ ok: false });
    expect(checkCredits({ settings: s, usedThisCycle: 1900, liveRemaining: null, requested: 150 })).toMatchObject({ ok: false });
    expect(checkCredits({ settings: s, usedThisCycle: 0, liveRemaining: 5, requested: 10 })).toMatchObject({ ok: false });
    expect(checkCredits({ settings: s, usedThisCycle: 100, liveRemaining: 5000, requested: 100, isImport: true })).toEqual({ ok: true });
  });
});

describe("pagination", () => {
  it("chooses page sizes that keep offset pagination aligned", () => {
    expect(pageSizeFor(0, 25)).toBe(25);
    expect(pageSizeFor(25, 15)).toBe(5); // 25 fetched, 15 left → pages of 5 (page 6..8)
    expect(pageSizeFor(50, 25)).toBe(25);
    expect(pageSizeFor(7, 25)).toBe(7);
    expect(pageSizeFor(13, 10)).toBe(1);
  });
  it("never skips or repeats records across a partial last page", () => {
    const seen: number[] = [];
    let offset = 0;
    const max = 40;
    while (offset < max) {
      const per = pageSizeFor(offset, Math.min(25, max - offset));
      const page = offset / per + 1;
      for (let k = (page - 1) * per; k < page * per; k++) seen.push(k);
      offset += per;
    }
    expect(seen).toEqual(Array.from({ length: 40 }, (_, i) => i));
  });
});
