import { verifySignature, parseEvents } from "@/lib/dealmachine/webhook";
import { ingestWebhook } from "@/lib/dealmachine/service";

export const dynamic = "force-dynamic";
const MAX_BODY = 1_000_000;

/** DealMachine webhook receiver. Rejects unsigned/invalid requests; idempotent per event id. */
export async function POST(req: Request) {
  const secret = process.env.DEALMACHINE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "webhook not configured" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "payload too large" }, { status: 413 });
  const header = req.headers.get(process.env.DEALMACHINE_SIGNATURE_HEADER || "x-dealmachine-signature") ?? req.headers.get("x-webhook-signature");
  if (!verifySignature(raw, header, secret)) return Response.json({ error: "invalid signature" }, { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const events = parseEvents(body);
  const result = await ingestWebhook(events);
  return Response.json({ ok: true, ...result });
}
