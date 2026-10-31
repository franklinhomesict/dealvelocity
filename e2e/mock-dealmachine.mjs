// Local stand-in for the DealMachine v2 API used by e2e tests and offline dev.
// Response shapes mirror responses captured from the live account (free endpoints).
// Run: node e2e/mock-dealmachine.mjs  (port 4010) — base URL http://localhost:4010/v1
import http from "node:http";

const PORT = Number(process.env.MOCK_DM_PORT ?? 4010);
const KEY = "dm_sk_live_test";
let creditsUsed = 0;
const charged = new Set(); // DealMachine dedupes charges per record per billing cycle

const streets = ["S Millwood St", "S Vine St", "W Maple St", "N Grove St", "E Lincoln St", "S Seneca St", "N Hillside St", "E Harry St"];
const prop = (i, enriched) => {
  const base = {
    dm_property_id: `prop_${90000 + i}`,
    full_address: `${1800 + i * 4} ${streets[i % streets.length]} Wichita, KS 672${13 + (i % 4)}`,
    address: `${1800 + i * 4} ${streets[i % streets.length]}`,
    city: "Wichita", state: "KS", zip: `672${13 + (i % 4)}`,
    latitude: 37.66 + i / 1000, longitude: -97.36 - i / 1000,
    num_bedrooms: 2 + (i % 3), num_bathrooms: 1 + (i % 2), living_area_sqft: 900 + i * 37,
  };
  if (!enriched) return base;
  return {
    ...base, property_type: "Single Family", year_built: 1940 + (i % 30), estimated_value: 110000 + i * 2500,
    estimated_equity_percentage: 40 + (i % 60), estimated_equity_amount: 60000 + i * 1000, estimated_repair_cost: 18000 + (i % 7) * 4000,
    assessed_total_value: 70000 + i * 900, last_sale_price: 30000 + i * 800, last_sale_date: "2006-04-12T00:00:00.000Z",
    owner_1_full_name: `TEST OWNER ${i}`, is_vacant_home: i % 2 === 0, has_absentee_owners: i % 3 === 0, is_pre_probate: i % 5 === 0,
  };
};
const TOTAL = 40;

function charge(ids) {
  let used = 0, dedup = 0;
  for (const id of ids) charged.has(id) ? dedup++ : (charged.add(id), used++);
  creditsUsed += used;
  return { used, properties: used, people: 0, deduplicated: dedup, licensed: 0 };
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname.replace(/^\/v1/, "");
    if (path === "/__reset") return (creditsUsed = 0, charged.clear(), send(res, 200, { ok: true }));
    if (req.headers.authorization !== `Bearer ${KEY}`) return send(res, 401, { error: { message: "invalid api key" } });
    let body = {};
    if (req.method === "POST") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    }
    if (path === "/whoami") return send(res, 200, { authenticated: true, organization: { name: "Home Buyers ICT (mock)" }, authentication: { type: "api_key" } });
    if (path === "/usage")
      return send(res, 200, {
        plan: { name: "Mock", is_paid: true }, billing_cycle: { start: new Date(Date.now() - 5 * 864e5).toISOString(), end: new Date(Date.now() + 25 * 864e5).toISOString() },
        credits: { included: 20000, total_available: 20000 - creditsUsed, total_cap: 25000, remaining: 20000 - creditsUsed, used: creditsUsed, monthly_remaining: 20000 - creditsUsed, additional_remaining: 0, breakdown: { properties: creditsUsed, people: 0 } },
      });
    if (path === "/properties/search/count") return send(res, 200, { total_properties: TOTAL, total_people: 0, total_results: TOTAL });
    if (path === "/properties/search") {
      const per = Math.min(body.per_page ?? 25, 100);
      const page = body.page ?? 1;
      const pages = Math.ceil(TOTAL / per);
      if (body.estimate_cost)
        return send(res, 200, { totals: { properties: TOTAL, people: 0 }, pagination: { page: 1, per_page: per, total_results: TOTAL, total_pages: pages, has_next_page: pages > 1 }, estimated_credits: { this_page: per, total_all_pages: TOTAL, breakdown: { properties: per, people: 0, already_accessed: 0 } } });
      const rows = Array.from({ length: Math.max(0, Math.min(per, TOTAL - (page - 1) * per)) }, (_, k) => prop((page - 1) * per + k, true));
      return send(res, 200, { data: rows, pagination: { page, per_page: per, total_results: TOTAL, total_pages: pages, has_next_page: page < pages }, credits: charge(rows.map((r) => r.dm_property_id)) });
    }
    if (path === "/lists") return send(res, 200, { data: [{ list_id: "list_mock_1", name: "🔥 Mock BRRRR list", source_type: "properties", build_type: "prospect", status: "idle", total_count: 12 }], pagination: { page: 1, per_page: 100, total: 1, has_more: false } });
    if (path === "/prospects") {
      const per = Number(url.searchParams.get("per_page") ?? 25);
      const page = Number(url.searchParams.get("page") ?? 1);
      const total = 12;
      const rows = Array.from({ length: Math.max(0, Math.min(per, total - (page - 1) * per)) }, (_, k) => {
        const p = prop(100 + (page - 1) * per + k, false);
        return { id: `prospect_${p.dm_property_id}`, record_type: "property", record_id: p.dm_property_id, lifecycle: "active", favorite: false, status: null, source: "list", record: { address: p.address, city: p.city, state: p.state, zip: p.zip, latitude: p.latitude, longitude: p.longitude }, tags: [], created_at: new Date().toISOString() };
      });
      return send(res, 200, { data: rows, pagination: { page, per_page: per, total, has_more: page * per < total } });
    }
    const m = path.match(/^\/properties\/prop_(\d+)$/);
    if (m) {
      const i = Number(m[1]) - 90000;
      const enrich = url.searchParams.get("enrich") !== "false";
      return send(res, 200, { data: prop(i, enrich), credits: enrich ? charge([`prop_${m[1]}`]) : { used: 0, properties: 0, people: 0, deduplicated: 0, licensed: 0 } });
    }
    if (path === "/properties/comps") {
      const id = body.property_ids?.[0];
      const comps = [0, 1, 2, 3, 4].map((k) => ({ dm_property_id: `prop_7${k}000`, address: `${2000 + k * 10} S Comp St`, sale_price: 120000 + k * 6000, sale_date: `2026-0${k + 3}-15`, num_bedrooms: 3, num_bathrooms: 1, living_area_sqft: 1000 + k * 20, distance_miles: 0.2 + k / 10, status: "sold" }));
      comps.push({ dm_property_id: "prop_79999", address: "2100 S Listing St", list_price: 175000, num_bedrooms: 3, num_bathrooms: 2, living_area_sqft: 1100, distance_miles: 0.6, status: "active" });
      return send(res, 200, { data: [{ subject_id: id, comps }], credits: charge([`comps_${id}`]) });
    }
    send(res, 404, { error: { message: `mock: no route ${req.method} ${path}` } });
  })
  .listen(PORT, () => console.log(`mock DealMachine on :${PORT}`));
