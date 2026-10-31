import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a DealMachine webhook signature (HMAC-SHA256 with the per-webhook
 * signing secret). Accepts either a bare hex/base64 digest of the raw body or a
 * Stripe-style `t=<unix>,v1=<hex>` header signed over `${t}.${body}`. Timestamps
 * older than the tolerance are rejected to prevent replay.
 *
 * NOTE: the exact header name/format must be confirmed against DealMachine's
 * webhook docs before go-live; both common schemes are supported.
 */
export function verifySignature(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const eq = (a: string, b: string) => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  };
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2)).filter((p) => p.length === 2)) as Record<string, string>;
  if (parts.t && (parts.v1 || parts.sha256)) {
    const t = Number(parts.t);
    if (!Number.isFinite(t) || Math.abs(nowSec - t) > toleranceSec) return false;
    const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
    return eq(expected, parts.v1 ?? parts.sha256);
  }
  const sig = header.replace(/^sha256=/, "").trim();
  const hex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const b64 = createHmac("sha256", secret).update(rawBody).digest("base64");
  return eq(hex, sig) || eq(b64, sig);
}

export interface DmWebhookEvent {
  id: string;
  type: string;
  occurred_at: string;
  data: { prospect?: { record_type: string; record_id: string; record?: { address: string; city: string; state: string; zip: string }; tags?: { name: string }[] }; item?: { record_type: string; record_id: string }; list?: { id: string; name: string } };
}

export function parseEvents(body: unknown): DmWebhookEvent[] {
  if (!body || typeof body !== "object") return [];
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  return events.filter((e): e is DmWebhookEvent => !!e && typeof e === "object" && typeof (e as DmWebhookEvent).id === "string" && typeof (e as DmWebhookEvent).type === "string");
}
