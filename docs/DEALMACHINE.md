# DealMachine integration (Phase 2)

## Setup
1. DealMachine → Settings → Developer → create an API key (`dm_sk_live_…`).
2. Server env: `DEALMACHINE_API_KEY` (required), `DEALMACHINE_WEBHOOK_SECRET` (after registering the webhook), optional `DEALMACHINE_API_URL`.
3. In the app: Prospecting → Credits → set a monthly budget and per-import cap, then switch **Paid requests** on (owner only). It is **off by default**.
4. Webhook URL to register in DealMachine: `https://<your-domain>/api/webhooks/dealmachine`, events `prospect.added`, `list.item_added` (others are stored, not acted on).

## What uses credits
| Action | Cost | Gate |
|---|---|---|
| Count, cost estimate, lists, saved prospects, unenriched property facts, webhook events | Free | none |
| Paid search import | ~1 credit per property (DealMachine dedupes within a billing cycle) | free count + estimate → **owner approval of the exact credit amount** → budget guard → never exceeds approved credits |
| Enrich one property | 1 credit | confirm dialog + budget guard |
| Comps for one property | 1 credit | confirm dialog + budget guard |
| Owner phone/email | — | **never requested**: every call sends `contact_audience: "none"` |

Budget guard order: paid switch → per-import cap → app monthly budget (credits logged in `api_calls` since cycle start) → live account balance from `/usage`.

## Data handling
- Dedupe: DealMachine ID first, then normalized address. Re-imports update, never duplicate.
- Manually entered values are never overwritten; DealMachine only fills blanks. Modeled values (estimated value, equity, repair cost) live in `estimated_*` columns and are labeled as estimates. County-record values carry a "Record" label.
- Imported properties get a lead in **New** ("Review and underwrite"). Nothing triggers outreach.
- Imports run in resumable 45-second slices (offset cursor + row lock), so a crash or timeout resumes without re-charging. Phase 4 moves this onto the durable job queue.

## Verification status
Confirmed against the live Home Buyers ICT account (free calls only, 0 credits spent): authentication, usage, filter/field IDs, `POST /properties/search/count`, search cost estimate, lists, prospects, unenriched property record shape, webhook event shapes.

**Not yet verified against the live API** (implemented to the same conventions, parsed defensively, covered by mock tests):
- Paid search page and enriched property responses (expected: same flat field-ID record as the free lookup, plus a `credits` receipt).
- Comps endpoint path/shape (`POST /properties/comps` assumed).
- Address enrichment path (`POST /enrich/address` assumed) — only used for manual properties with no DealMachine ID.
- Webhook signature header name and scheme (HMAC-SHA256; both raw-body and `t=…,v1=…` schemes accepted; header configurable via `DEALMACHINE_SIGNATURE_HEADER`).

One approved enrichment + one comps call (≤ 2 credits) will confirm the paid shapes.

## Local development
`node e2e/mock-dealmachine.mjs` serves a mock API on :4010 with the captured shapes. Point `DEALMACHINE_API_URL=http://localhost:4010/v1` and `DEALMACHINE_API_KEY=dm_sk_live_test` at it.
