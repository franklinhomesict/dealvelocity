# Acquisition OS: Release 1 Specification Amendment (Draft for review)

> **Status:** proposal under joint review (Claude Code ⇄ Codex). This is not code.
> **Code snapshot reviewed:** `83080d6` on branch `ccr-c122f836-2aie2x`. The application code is unchanged since `be187c4`; only docs changed after that.
> **Supersedes:** §4, §9 and the release plan in `PRODUCT_REVIEW.md` wherever they conflict.
> Items marked **[VERIFY]** need a primary source or attorney confirmation. **Nothing marked [VERIFY] may be hard-coded as fact.** Each one becomes a labeled, owner-editable policy rule (§7.4).

---

## 0. Status vocabulary and current inventory

Two independent labels are used:
- **Implementation:** `absent` · `schema only` · `partial workflow` · `complete workflow`
- **Verification:** `untested` · `automated checks` · `manually exercised` · `production validated`

At this snapshot, nothing is `production validated`; the app has not been deployed for real use.

| Capability | Implementation | Verification | Notes |
|---|---|---|---|
| Auth: sessions, roles (owner / acquisitions / viewer), lockout, audit log | complete workflow | automated checks (e2e) + manually exercised | Role enforcement exists per action; no role matrix spec yet (§9) |
| Properties, leads, Kanban pipeline, activity timeline | complete workflow | automated checks + manually exercised | One lead per property in practice |
| Stage gate to `under_contract`/`closed` | partial workflow, **defective** | automated checks do not cover the defect | Any approved offer satisfies it (§3) |
| Tasks / next action | partial workflow | automated checks | `tasks` table + `leads.next_action*`; no queue |
| Attention list (dashboard) | partial workflow | automated checks + manually exercised | Seed of the daily queue; not mobile-first, no notifications |
| Contacts + consent fields | schema only | untested | One phone, one email and one `sms_consent` per contact; one contact per lead |
| Underwriting engine (BRRRR, MAO bisection, stress, buy box, cash-out play, flip) | complete workflow for one global financing route | automated checks (32 unit tests) | Calibrated to 2 owner deals only; verdict defect (§6.6) |
| Analysis snapshots (immutable rows, engine version, inputs incl. assumptions) | complete workflow | automated checks | Screening analyses are marked only inside the `inputs` JSON |
| Versioned assumption sets | complete workflow | automated checks | One global set; no per-market or per-lender profiles |
| Offer approval (request / approve / reject) | partial workflow | automated checks | No sent / countered / accepted recording; approval bound to amount + analysis only |
| Transactions | schema only | untested | Nothing writes to it |
| DealMachine import jobs (count, estimate, owner-approved credits, resumable slices) | complete workflow | automated checks (mock API) | Live API used only via the import script and connector, not the in-app job |
| DealMachine webhook ingestion (signature, dedupe) | partial workflow | automated checks (mock) | — |
| Lead import script (`scripts/import-leads.ts`) | complete workflow | manually exercised (local Docker) | 21 leads |
| Self-hosting stack (Compose, Caddy, backups, restore) | complete workflow | manually exercised (local, incl. restore) | Not deployed; backups are on the same host |
| Communications, worker, permissions, documents, closing records | absent | untested | — |

---

## 1. Product boundary

**Release 1 covers:** sourcing → contact → qualification → underwriting → owner-approved offer → executed agreement → due diligence → closing → capture of rehab, rent and refinance **actuals**.

**In release 1:**
- Manual outreach: click-to-call, one-to-one email, and SMS **within permitted conversations only**.
- Inbound handling.
- A mobile daily queue.
- Manual (external) document signing.
- Tracking of external mail batches.

**Out of release 1:**
- Automated sequences and cold campaigns.
- E-sign.
- Direct-mail orchestration.
- Lead scoring beyond simple sorting.
- AI of any kind.
- Property management and construction management (beyond capturing actuals).
- Flip and wholetail expansion. The existing flip math stays but is not extended.

**Permanently out of scope (business choice):** outbound AI voice.

**Success measure:** closed acquisitions that meet the owner's criteria, with actuals that confirm or correct the underwriting.

---

## 2. Data model (minimum additions)

| Entity | Purpose / key rules |
|---|---|
| `parties` | A person or organization (LLC, trust, estate). Never merged automatically on name or phone match. |
| `party_merge_decisions` | Reviewed, reversible merges: `merged_into`, reviewer, reason, timestamp. |
| `property_parties` | Property ↔ party with a role (vested owner, heir, spouse, POA, agent, occupant), interest %, **source** and **verification status** (`unverified` / `verified` + verification record). |
| `contact_methods` | A phone or email belonging to a party. Validity status (unknown / valid / wrong party / disconnected / bounced), source, confidence, timezone (if known). |
| `permission_events` | Append-only (§7). |
| `suppressions` | Derived plus manual. Method-level and party-level. |
| `opportunities` | Replaces "lead" conceptually. Has a stage, owner user, next action and due date. Can be linked to a predecessor (`previous_opportunity_id`) when a dead or nurture opportunity is reopened. |
| `opportunity_properties` / `opportunity_parties` | One negotiation can cover several properties and several parties. |
| `conversations` | Actual participants and endpoints (our number or address ↔ their number or address). `party_id` and `opportunity_id` are **nullable**, so an unknown inbound caller is supported and linked later. |
| `messages`, `calls` | Direction, channel, provider ID, status history, cost, disposition, recording reference (only if recording is permitted). |
| `offer_versions` | Immutable. Includes price, EMD, closing date, contingencies, other terms, the linked `analysis_id`, the document template version, and the **included properties with per-property allocations** (`offer_version_properties`). Any change creates a new version. |
| `approvals` | Owner approval of exactly one `offer_version`. Void automatically when a newer version supersedes it. |
| `documents` | Kind, version, SHA-256, generating `offer_version` and template version, or "external upload". |
| `deliveries` | Which document version was delivered, to whom, by what channel, when, and by whom. |
| `verifications` | Requirement code, outcome (satisfied / not satisfied / not applicable), checked by, checked at, note, evidence references, `superseded_by`. **An upload alone never satisfies a requirement.** |
| `transactions` + `milestones` | Executed-agreement record, deadlines (EMD, inspection, title, financing, closing), amendments, cancellation. |
| `closing_records` | Closing date, final price, settlement statement document, funds and deed confirmation (verifications). |
| `decisions` | Owner risk acknowledgments and criterion exceptions, each with a reason. They reference analysis findings and never modify them. |
| `actuals` | Rehab cost, completion date, rent achieved, refinance terms and appraisal. These feed calibration. |
| `lender_profiles`, `market_profiles`, `capital_snapshots` | §5. |
| `policy_rules` | Owner-only, versioned, with effective date, source, label and audit (§7.4). |
| `jobs` / `outbox`, `worker_heartbeats` | §8. |
| `mail_batches` | Vendor, list, count, cost, send date, tracking number. Responses are attributed through the tracking number. |

**Today's model:** a single contact per lead, single-valued phone, email and consent fields, and one lead per property.
- **Awkward but possible today:** one owner with several properties (a duplicate contact row per lead).
- **Cannot be represented reliably today:**
  - several people holding interests in one property;
  - per-method validity and permission;
  - one negotiation covering several properties;
  - a reopened opportunity with its history kept;
  - unknown inbound callers.

**Migration (backfill):**
- Each contact → one party.
- Its phone and email → contact methods, with `validity=unknown` and `source=legacy`.
- Each lead → one opportunity.
- `properties.owner_name` → a `property_parties` row with `source=dealmachine_owner_name` and `verification=unverified`. **This is never treated as verified ownership.**

---

## 3. Lifecycle and transitions

**Stages:** `New → Contacting → Qualified → Offer → Under contract → Closed`. The terminal or side stages are `Nurture` and `Dead`.

**Offer sub-status** (derived from the latest offer version): `drafting` · `awaiting approval` · `approved, not sent` · `awaiting seller` · `counter received (review)` · `accepted, awaiting signature`.

Appointment, inspection, title, financing, appraisal and closing readiness are **milestones or tasks**, not stages.

| # | Action | Prerequisites | Role | Evidence | Records created |
|---|---|---|---|---|---|
| T1 | Create opportunity | Property identified (address/APN) | owner, acq | — | opportunity, activity |
| T2 | → Contacting | ≥1 contact method **or** mail batch attribution | owner, acq | — | activity |
| T3 | → Qualified | Right-party conversation logged; motivation, timeline and condition captured; **price = amount / "seller declined" / "unknown"** | owner, acq | Call/message record linked to a party with role vested owner or authorized | stage change, qualification snapshot |
| T4 | → Offer (drafting) | Offer version exists, linked to a **preliminary**-level analysis (§4) | owner, acq | — | offer_version |
| T5 | Request approval | §4 "indicative offer" checklist satisfied, or each gap acknowledged by the owner where allowed | owner, acq | verifications | approval request |
| T6 | Approve | Request is pending; owner has reviewed the routes, findings and liquidity status | **owner only** | Acknowledgments for blocking findings (§6.5) | approval → that exact offer_version |
| T7 | Send / deliver | A valid approval for **this exact version**; template is in approved status; signing parties identified | owner, acq | Document hash matches the approved version | document, delivery |
| T8 | Record counter | — | owner, acq | Seller's terms recorded | new offer_version (status: counter received). **Any prior approval does not carry over.** |
| T9 | → Under contract | Signed agreement uploaded; **terms match an approved offer_version**; signatures of **all vested owners** verified | Recording: owner, acq · **Verification: owner** (or a designated role) | Verifications: signatures, terms match, signing authority | transaction, milestones (EMD, inspection, title, financing, closing) |
| T10 | Release contingency / proceed to close | §4 "proceed to closing" checklist; a **final**-level analysis shows the chosen route still feasible | **owner only** | verifications, final analysis | decision record |
| T11 | → Closed | Closing record complete: settlement statement reviewed and matching; funds and deed confirmed; **wiring instructions verbally verified with the title company at a known phone number** | Verification: owner | verifications | closing_record; actuals tasks scheduled |
| T12 | → Nurture | Reason + reactivation date | owner, acq | — | Queue item on the reactivation date |
| T13 | → Dead | Reason code (disqualified, lost to price, lost to competitor, unreachable, not owner, DNC, other) | owner, acq | — | — |
| T14 | Reopen | From Nurture or Dead | owner, acq | — | New opportunity with `previous_opportunity_id`, or the same one reactivated (when < N days) |
| T15 | Cancel transaction | Reason; EMD disposition recorded | **owner** | — | milestone and transaction status update |

Backward moves are allowed, logged, and **never void evidence records**.

---

## 4. Evidence checklists by action

Each item is a `verification` (who, when, outcome). "Owner-acknowledgeable" means the owner can proceed past a gap with a written reason, recorded as a `decision`.

| Action | Minimum evidence | Acknowledgeable? |
|---|---|---|
| **Prioritize a lead** (screening) | Property identity; source estimates (value, rent, condition signals) labeled as estimates | n/a |
| **Request approval: indicative / conditional offer** (preliminary) | 1. Right-party conversation. 2. Owner of record matched to county record (user-checked). 3. ARV support: ≥3 selected sold comps or a broker opinion. 4. Rent support: ≥1 rent comp or a property-manager opinion. 5. Rehab: walkthrough or photos plus a line-item estimate. 6. Financing route and lender profile chosen. 7. Capital snapshot ≤30 days old. | 2–5 and 7: yes. 1 and 6: no |
| **Send proposal / agreement** | Valid approval of the exact version; template status approved (§10); signing parties identified from `property_parties`; inspection and title contingencies present unless the owner records an exception | Contingency omission: owner exception only |
| **Commit under executed agreement** | Signed document; all vested owners' signatures verified; terms match the approved version; EMD deadline set | No |
| **Release contingencies / proceed to close** (final) | Inspection done; contractor bid replaces the estimate (→ new analysis); title commitment reviewed with exceptions resolved; lender term sheet or cash confirmation; final analysis route feasible; liquidity verified | Title exceptions: no. Others: owner decision with reason |

A "preliminary" label never bypasses approval. **Any document that could create an obligation requires T6 approval of that exact version.**

---

## 5. Financial outputs (precise definitions)

**Per route** (route = strategy × lender profile):

| Output | Definition |
|---|---|
| Total project cost | purchase + purchase closing + rehab + contingency + acquisition points + acquisition interest + holding taxes, insurance and utilities during the hold |
| **Modeled owner contribution before refinance** | Total project cost − acquisition loan principal applied to costs. *(Today's `cashInvested`; renamed. It is not peak cash.)* |
| Disbursement model | Per funding source: `funded at closing` / `reimbursement draws` / `unknown`, plus the owner-entered maximum bridge (cash fronted before a draw is reimbursed) |
| **Liquidity requirement (conservative)** | Owner contribution + draw bridge (if `reimbursement` and the bridge is unknown, then the full rehab + contingency) + lender reserve months × PITIA + owner operating reserve. Reported **with its assumptions**. If the disbursement model is `unknown`, it is reported as **unverified**. |
| **Deployable capital** | Owner-entered cash available − protected reserve − commitments to other projects, **as of** the snapshot date |
| **Fundability** | `fundable` if liquidity requirement ≤ deployable capital and both are verified · `not fundable` · `unverified` (any input unknown or the snapshot is >30 days old) |
| Lender value basis | Appraised/ARV, or cost basis if unseasoned under that lender profile's rule |
| Lender maximum loan | min(LTV × basis, lender DSCR sizing, lender max loan); **ineligible** if below the lender minimum loan |
| Owner-sized loan | ≤ lender max, sized down to meet the owner cash-flow minimum or DSCR target (labeled as an owner choice) |
| Net refinance proceeds | Loan − refinance closing costs (percentage + fixed + appraisal, with no double counting; the source of the fixed amount is labeled) |
| Cash returned at refinance | Net proceeds − acquisition payoff (principal + any exit fee) |
| **Cash remaining invested** | Owner contribution − cash returned (negative = cash out) |
| Ongoing cash flow | NOI (rent − vacancy − maintenance − capex − management − utilities − HOA − taxes − insurance) − P&I. **Owner economics.** |
| Lender DSCR | Qualifying rent (after haircut) ÷ PITIA. **Lender qualification only.** |
| Route MAO | Highest price at which the route is feasible **and** the owner criteria pass (bisection) |
| Equity at refinance | Appraised value − new loan |

**Route types in release 1:**
1. BRRRR, DSCR cash-out
2. BRRRR, rate-and-term
3. BRRRR, local bank / portfolio (a configurable lender profile)
4. Cash hold, no refinance

Lender profiles (LTV caps, min and max loan, DSCR minimum, reserves, seasoning rule, rate, term, fees) and market profiles (Wichita, Wellington: buy box, taxes, insurance, vacancy) are configurable. **Unknown values are allowed and are flagged.** They are never silently defaulted.

---

## 6. Analysis dimensions and exception rules

The engine output is **immutable**. Evidence, decisions and exceptions are separate records (§2).

### 6.1 Dimensions (independent)
1. **Data validity:** missing or invalid inputs → `incomplete`.
2. **Evidence readiness:** per action (§4).
3. **Route feasibility:** per route, `feasible` / `ineligible` with stable codes.
4. **Owner criteria:** per criterion pass/miss, per market profile.
5. **Findings:** stable codes with a severity.
6. **Decisions and exceptions:** separate records referencing findings and criteria.

### 6.2 Summary (derived, never authoritative)
"Routes that work: X (why). Routes that don't: Y (code)." The next-step label is one of:
- `Needs data`
- `Needs evidence for <action>`
- `Needs owner decision`
- `Ready for <action>`
- `No feasible route`

There is **no property-level "fail"**. A lender coverage failure, an owner-preference miss and missing evidence each show their own code.

### 6.3 Finding codes and severity
- **`info`**: shown, never blocks.
- **`warning`**: requires an owner acknowledgment before T6.
- **`blocking`**: the action can't proceed until resolved with new evidence or a new analysis.

| Code | Severity |
|---|---|
| `ROUTE_BELOW_MIN_LOAN`, `ROUTE_DSCR_BELOW_LENDER_MIN`, `ROUTE_UNSEASONED_BASIS_CAPPED` | Route-level ineligibility (not a property finding) |
| `INFO_DSCR_LIMITED`, `INFO_OWNER_SIZED_LOAN`, `INFO_STRESS_COMBINED_FAIL` | info |
| `RISK_HEAVY_REHAB`, `RISK_LOW_RENT_RATIO`, `RISK_STRESS_ARV`, `RISK_STRESS_REHAB`, `RISK_STRESS_RENT`, `RISK_STRESS_RATE`, `RISK_STRESS_DELAY`, `RISK_PRICE_ABOVE_ROUTE_MAO`, `RISK_LIQUIDITY_UNVERIFIED` | warning |
| `RISK_LIQUIDITY_EXCEEDS_CAPITAL`, `DATA_*` | blocking |

### 6.4 Stress definition
Stress is applied to each feasible route at the evaluated price:
- ARV −10%
- rehab +20%
- rent −10%
- rate +1 point
- hold +3 months (extra interest and carry; seasoning re-checked)
- **combined:** all five at once

A stress case **survives** when lender DSCR ≥ 1.00, cash flow ≥ $0, and the liquidity requirement ≤ deployable capital (if known).
- A single-factor stress that does not survive → a `warning` finding.
- **Combined stress that does not survive → `INFO_STRESS_COMBINED_FAIL`.** It is a severe-downside indicator, always displayed on the approval screen with its numbers, and it requires no acknowledgment. The finding is defined, not silently excluded.

### 6.5 Exceptions
- **Cash-out play** is an *owner-criteria exception*. It is available when the route is feasible at the lender-sized loan with cash remaining ≤ $0 and cash flow ≥ $0.
  - It may waive **only** these criteria: `arv_range`, `rent_ratio`, `cash_flow`, `dscr_target`, `cash_left`.
  - It **never** waives findings or evidence.
  - The engine reports eligibility; using the exception is an owner `decision` at T6.
- **Risk acceptance:** an owner acknowledgment with a reason. The finding stays in the analysis.
- **Corrected input:** produces a new analysis. The old one is preserved.

### 6.6 Corrections to current code (once this spec is agreed)
- Remove the `reasons.length = 0` override and the "pass" coercion.
- Replace the single verdict with the §6.1 dimensions.
- Stop treating "no standard MAO" as a property failure.
- Split lender sizing from owner sizing.
- Add the rate and delay stresses.
- Add lender minimum loan and reserves.
- Rename `cashInvested`.
- Store the evidence level as a column, not inside the inputs JSON.

---

## 7. Communication permissions

### 7.1 Event history
`permission_events` is **strictly append-only**. Event types: grant, revoke, correct, evidence-added. Each event links:
- the contact method and party;
- the **business identity** (legal entity and DBA);
- the channel (voice, SMS, email);
- the **purpose** (`marketing_outreach`, `conversation_reply`, `transactional`, `call_recording`);
- effective time, source, evidence reference and recorded-by.

The current state per (method, channel, purpose) is **derived**: `unknown` · `granted` · `denied`. Unknown is never treated as granted.

### 7.2 Reply scope
An inbound message does **not** create unlimited reply permission. It opens a reply allowance governed by a policy rule:
- same channel;
- same conversation;
- topic-related;
- for N days;
- labeled as a business choice pending [VERIFY].

Marketing purposes require their own grant.

### 7.3 Opt-out
- STOP (or equivalent) → a revoke event for that channel's purposes, plus **immediate** suppression of the method.
- Execution-time checks (§8) cancel any queued jobs.
- No callback task is created automatically. A review task is created only when the opportunity is Under contract, or when the message contains other content (for example, a question).
- Provider auto-replies to STOP are handled per provider policy [VERIFY].

### 7.4 Policy rules
Owner-only access. Each rule has:
- a version, effective date, source and label: `legal requirement [VERIFY]`, `provider policy [VERIFY]` or `business choice`;
- a diff view and an audit trail.

Defaults are conservative. Normal users have no access, and no generic settings screen can weaken a rule.

Initial rules:
- quiet hours by recipient timezone (most restrictive if unknown);
- DNC scrub freshness;
- internal DNC;
- reply-window length;
- recording requires a disclosure (default: disclose always);
- no outbound to `unknown` permission for SMS marketing;
- daily send caps.

---

## 8. Durable execution

1. **Atomicity:** the business change and its outbox job are written in **one transaction**.
2. **States:** `pending → claimed(lease_until) → dispatching → succeeded | failed_retryable | failed_final | unknown | cancelled`.
3. **Claims:** `FOR UPDATE SKIP LOCKED`, with a lease expiry.
   - A crashed worker's `claimed` job is reclaimed after the lease expires.
   - A job found in `dispatching` after a crash goes to **`unknown`, never retry**.
4. **Retries:** bounded (e.g., 3, with exponential backoff), and **only** when the error proves the action did not complete (connection refused before send, validation rejection).
5. **Idempotency:**
   - *Local:* a unique key per business action (for example, an offer-delivery ID) prevents duplicate jobs.
   - *Provider:* Twilio Messaging and the Gmail API are not assumed to offer request idempotency [VERIFY]. So `unknown` outcomes are **never auto-resent**. They are reconciled from status callbacks or by provider lookup using our stored client reference, and a human resolves anything left over.
6. **Callbacks:**
   - Deduplicated on (provider, event or SID + status).
   - Statuses follow a precedence order (`queued < sent < delivered`; `failed`/`undelivered` are terminal). Regressions are ignored.
   - Events that arrive before their message record are stored and applied later.
7. **Execution-time checks** run immediately before dispatch: permission state, suppression, DNC freshness, quiet hours, budget, kill switch, opportunity state.
8. **Kill switch:**
   - Owner-only and audited.
   - Stops new claims and dispatches immediately; pending jobs stay paused.
   - **It cannot recall anything already accepted by a provider.** The UI says so and lists recent submissions.
9. **Health:**
   - A worker heartbeat row.
   - An admin page showing heartbeat age, overdue jobs, `unknown` outcomes and failures.
   - The uptime monitor checks an endpoint that includes heartbeat age.
10. **Inbound continuity:**
    - Provider-side voice fallback: a fallback URL pointing to provider-hosted call instructions that forward to the owner's cell and take voicemail [VERIFY]. It works when the app is down.
    - Missed SMS and voicemails are pulled through provider API reconciliation when the app recovers.

---

## 9. Roles (release-1 acceptance criteria, even when used solo)

| Capability | owner | acquisitions | viewer |
|---|---|---|---|
| Work opportunities, log calls and messages, draft offers, request approval, upload documents, record deliveries | ✔ | ✔ | — |
| Approve an offer version; acknowledge risk; grant exceptions; release contingencies; verify execution and closing | ✔ | — | — |
| Policy rules, kill switch, lender/market profiles, capital snapshots, assumptions | ✔ | — | — |
| View contact methods | ✔ | ✔ | masked |
| Export personal data | ✔ | — | — |
| Read pipeline, analyses, KPIs | ✔ | ✔ | ✔ |

---

## 10. Manual completion path (release 1)

- **Templates:** owner-uploaded and versioned. Each has a stated **purpose** (non-binding letter of intent vs. purchase agreement) and a review status (`draft` / `approved`, plus reviewer name and date; an attorney review is recommended). The system only fills fields; it never drafts legal terms. The title does not determine purpose; the template's recorded purpose does.
- **Generate** a document from an approved offer version → download (PDF + hash) → **record the external delivery** (version, channel, recipient).
- **Upload** the externally signed agreement → verifications (§4) → T9.
- **Mail batches:** vendor, list, count, cost, date, tracking number. Inbound calls and texts to that number are attributed to the batch.
- **SMS fallback if provider registration is delayed:** inbound texts may be received, but replies switch to call, voicemail or email until registration is approved [VERIFY whether unregistered numbers can send]. The queue shows "reply by call."

---

## 11. Release-1 acceptance scenarios

Each scenario runs as an automated e2e test against a mocked provider, plus one manual pass on the deployed server.

1. **Unknown inbound call, app down:** the provider fallback forwards to the owner's cell and takes voicemail. On recovery, the call and voicemail are reconciled into a conversation with no party; the user links it to a new party and property.
2. **Screening lead:** an imported lead shows evidence level `screening`. Approval request is **blocked**, with the §4 checklist displayed.
3. **Seller declines to give a price:** T3 succeeds with `price = declined`.
4. **Cash-out exception with heavy rehab:** routes show the DSCR cash-out route feasible and eligible for the exception. `RISK_HEAVY_REHAB` remains. T6 requires an owner acknowledgment, and the analysis is unchanged.
5. **Lender minimum loan:** Wellington at $70k ARV: the DSCR route is `ineligible (ROUTE_BELOW_MIN_LOAN)`, while the cash-hold route is feasible. The summary says so, and the property is not "failed."
6. **Liquidity unverified:** no capital snapshot → `fundable: unverified` → T6 requires an acknowledgment of `RISK_LIQUIDITY_UNVERIFIED`.
7. **Approval binding:** the owner approves v1; acquisitions changes the EMD → v2 is created, and v1's approval doesn't carry over; T7 for v2 is blocked until it's approved.
8. **Counteroffer:** the seller counters → v3 with status "counter received" → it appears in the queue as "counteroffer review."
9. **Executed agreement mismatch:** the uploaded signed price differs from the approved version → T9 blocked. Once matched and verified by the owner → Under contract, with milestones created and deadlines shown in the queue.
10. **Due diligence:** inspection + contractor bid → new final analysis; the route is still feasible; the owner releases contingencies (T10).
11. **Closing:** settlement statement verified; wiring instructions verbally verified; T11 → Closed; actuals tasks scheduled (rehab complete, lease signed, refinance).
12. **STOP:** a STOP reply → immediate suppression; a queued job for that method is cancelled at execution; no callback task is created (unless Under contract).
13. **Kill switch mid-dispatch:** the job in `dispatching` → `unknown`, with no resend. The UI states that submitted messages can't be recalled.
14. **Worker crash:** a claimed job's lease expires → reclaimed; a dispatching job → `unknown`. The admin page shows it.
15. **Duplicate or out-of-order callbacks:** a delivered status followed by a late "sent" → stays delivered; a duplicate event → ignored.
16. **Portfolio owner:** an LLC owns 3 properties → one party, one opportunity, a package offer version with per-property allocations preserved in the approved version.
17. **Nurture and reopen:** Nurture with a reactivation date → appears in the queue on that date. Reopening a dead opportunity links its predecessor and keeps the history.
18. **Roles:** a viewer sees masked contact methods; acquisitions cannot approve, release contingencies or change policy rules (server-enforced, not just hidden in the UI).
19. **Merge:** two parties share a phone number → a merge is suggested, but **not** applied without a reviewed decision. The merge is reversible.
20. **Daily queue (mobile):** shows calls due, callbacks, unread replies, approvals waiting, offers awaiting the seller, milestone deadlines, and nurture reactivations, sorted by due time, and works one-handed at phone width.

---

## 12. Owner decisions

**Design choices.** These are configurable with marked unknowns, so they don't block the spec:
- lender profiles (terms per lender);
- capital amounts and protected reserve;
- monthly lead budget;
- solo vs. VA;
- Wellington targets;
- reply-window length;
- recording on or off.

**Launch requirements.** These must be resolved before go-live or before relying on the output:
1. Real acquisition financing and at least one real lender profile, before trusting any approval.
2. A current capital snapshot, before any "fundable" label.
3. Attorney review of the outreach policy rules and the purchase-agreement template.
4. Provider account and messaging registration (or the §10 fallback).
5. Business identity: legal entity, DBA and postal address (CAN-SPAM).
6. National DNC registry access for Kansas area codes (316, 620) [VERIFY the free-area-code allowance and the registration process].
7. Domain, the deployed server, off-site backups and an uptime monitor.
