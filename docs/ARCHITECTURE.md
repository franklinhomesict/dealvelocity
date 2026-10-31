# Architecture & decisions

## Decisions
| Area | Choice | Why |
|---|---|---|
| App | Next.js 15 monolith, server components + server actions | One deployable, no separate API to secure; fast to iterate |
| Database | PostgreSQL 16, Drizzle ORM + SQL migrations (`drizzle/`) | Owned data, typed schema, plain SQL for reporting |
| Auth | Email/password (bcrypt 12), opaque session tokens stored as SHA-256 in `sessions`, httpOnly cookie, 5-attempt/15-min lockout | No third-party auth dependency or cost |
| Roles | `owner` (approvals, assumptions) · `acquisitions` (edit) · `viewer` (read-only) | Approval gate enforced server-side |
| Underwriting | Pure TypeScript functions, versioned (`brrrr-1.0.0`), every save is an immutable `analyses` row with inputs + assumptions | Deterministic, auditable, unit-tested; no AI arithmetic |
| Jobs (Phase 4+) | PostgreSQL-backed queue (pg-boss style) with idempotency keys | No Redis/n8n; retries can’t duplicate outbound messages |
| Hosting (recommended) | Render or Railway: web service + managed Postgres with PITR backups (~$25–45/mo to start) | Commercially licensed, 24/7, background workers supported |

## Underwriting model (BRRRR)
- All-in = price + rehab + contingency + purchase closing + points + interest carry + holding taxes/insurance.
- Refi loan = min(LTV × lender value, DSCR-supported loan, loan that preserves minimum cash flow). Unseasoned cash-out values the asset at cost basis. Rate-and-term is capped at payoff + costs (no cash to owner).
- DSCR uses rent after the lender haircut.
- **MAO** = highest price where cash left in deal ≤ −target cash-out, DSCR ≥ minimum and cash flow ≥ minimum (bisection, exact to $1).
- Stress cases: ARV −10%, rehab +20%, rent −10%, combined.
- Missing ARV / rehab / rent → verdict `review`, no MAO. Price above MAO is never `pass`.
- Defaults: 75% cash-out, 80% R&T, DSCR 1.20, 10% haircut, 6.75%; cost figures (closing $1,864, refi 3.25% + $4,039, tax 1.0%, insurance 0.62%) carried over from the original analyzer. All editable in Settings by the owner.

## Safety rules built in
- Offers require owner approval; approving does **not** send anything. Moving to Under contract/Closed requires an approved/accepted offer.
- Adding a phone number never starts outreach. Contacts carry consent status, source, timestamp and Do-Not-Contact.
- `EXTERNAL_ACTIONS_ENABLED=false` kill switch (wired to integrations as they land).
- Sample data flagged `is_sample` and labeled in the UI; seed refuses to run in production.
- Every mutation is zod-validated, role-checked and written to `audit_log`. Security headers set; no secrets in client bundles.

## Production readiness
Not yet production-ready. Outstanding before go-live (Phase 7): deploy + TLS, offsite backups with a tested restore, error monitoring, uptime alerts on `/api/health`, budget alerts, rate limiting on public webhooks, data export, password reset flow, security review.
