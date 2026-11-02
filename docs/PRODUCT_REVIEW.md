# Home Buyers ICT · Acquisition OS: Product Review and Gap Analysis

> **Purpose of this document:** a complete, honest breakdown of what this app is meant to do, what is built, what is missing, and where the logic may be wrong. It is written so another reviewer (human or AI) can attack it and find holes.
>
> **Reviewer instructions:**
> - Assume nothing here is correct. Challenge the business logic, the compliance assumptions, the underwriting math and the architecture.
> - Statements marked **[VERIFY]** are assumptions or facts we have not confirmed.
> - Nothing in this document is legal advice. Every compliance item needs to be confirmed with a Kansas attorney before any outbound texting or calling goes live.

---

## 1. The business

- **Who:** Home Buyers ICT LLC, a buy-and-hold investor in Wichita, KS (owner: Ian). Also active in Wellington, KS.
- **Strategy:** BRRRR (Buy, Rehab, Rent, Refinance, Repeat).
  - Buy distressed or value-add single-family houses below market.
  - Rehab them to force appreciation.
  - Rent them out.
  - Refinance with a DSCR or bank loan to pull most of the cash back out.
  - Repeat.
- **Goal of the app:** produce a steady, repeatable flow of off-market rental deals. The flow is: find owners, contact them, follow up until they're ready, analyze the deal, make an owner-approved offer, close, track the rental.

### 1.1 Benchmark deals (the owner's real rentals)

| Property | Purchase | Rehab | Appraisal | Rent | Notes |
|---|---|---|---|---|---|
| 906 N Pershing, Wichita | $70,000 | $15,000 | $114,000 | $1,250/mo | **Ideal BRRRR.** Lower ARV, strong cash flow, repeatable. |
| 1914 S Prescott Cir, Wichita | $125,000 | $15,000 | $240,000 | $1,900/mo | **Cash-out play.** Took cash out at refi. Great, but rare and not repeatable. |
| Wellington, KS (×3) | 2 bought at $15,000 each | ? | ? | ? | Cheap purchase, "good rent." Details not yet entered. |

### 1.2 Buy box (owner-stated)

These are the current defaults, in `src/lib/underwriting/assumptions.ts`.

**Buy box:**
- ARV between $90,000 and **$170,000**.
- Monthly rent at least 0.9% of ARV.
- Rehab up to $50,000. Value-add and forced appreciation are wanted.
- Forced equity at least 15% of ARV.

**Investment criteria:**
- At most **$20,000** of owner cash left in the deal after the refinance.
- Cash flow at least **$300/month** after the refinance.
- Target DSCR **1.35**. The lender minimum is set to 1.20.

**Refinance assumptions:**
- 75% LTV cash-out or 80% LTV rate-and-term.
- 6.75% interest, 30-year term.
- 6-month seasoning.

**Acquisition financing:**
- Private money at 12%, 2 points, 6-month hold. **[VERIFY: is this the owner's real financing, or is it cash?]**

**Calibration check:** using these defaults, the engine gives 906 N Pershing a maximum offer of $72,602 and a verdict of "pass." The real purchase was $70,000, so the engine agrees with a deal the owner knows was good.

---

## 2. What the app is supposed to be (the full vision)

A self-hosted acquisition CRM plus deal-analysis platform. It must not depend on GoHighLevel, Supabase, n8n, Zapier or Make.

| Phase | Scope | Status |
|---|---|---|
| 1 | **CRM.** Leads, properties, contacts, pipeline (Kanban), tasks, activity timeline, saved views, auth and roles, audit log | ✅ Built |
| 2 | **DealMachine integration.** Search and count (free), imports with credit budget caps, enrichment, comps, webhooks | ✅ Built |
| 3 | **Underwriting.** Deterministic BRRRR engine: max allowable offer (MAO), refi sizing, DSCR, stress tests, buy box, deal score, cash-out play detection | ✅ Built |
| 4 | **Communications ("lead machine").** SMS, email, click-to-call, unified inbox, follow-up sequences, compliance gate | ❌ Placeholder page only |
| 5 | **AI voice.** Inbound answering and qualification, call summaries | ❌ Placeholder |
| 6 | **Offers and contracts.** Offer letters and purchase agreements, **owner approval required before anything binding is sent**, e-sign | ❌ Partial: offers table exists, no documents or e-sign |
| 7 | **Production.** Self-hosted on Oracle Cloud Always Free with Docker, Postgres, Caddy HTTPS and nightly backups | 🟡 Stack built and tested locally; server not created yet (Oracle capacity) |

**Stack:**
- Next.js 15 (App Router, server actions), React 19, TypeScript.
- Tailwind; Drizzle ORM; PostgreSQL 16.
- Docker Compose for deployment.

**Where to look:**
- Database schema: `src/db/schema.ts`
- Underwriting engine: `src/lib/underwriting/engine.ts`
- DealMachine integration: `src/lib/dealmachine/*`
- Deployment: `deploy/` and `docs/SELF_HOSTING.md`

---

## 3. The core problem this review is about

**The app can find and analyze deals, but it cannot yet generate them.** Deals come from:
1. Contacting a large number of the *right* owners,
2. following up consistently over weeks or months, and
3. responding and making offers fast when someone is ready.

Phases 1 to 3 cover finding and analyzing. Phase 4, the lead machine, is the part that actually produces rentals, and it is also the part with the most legal and operational risk.

### 3.1 The lead machine funnel (to be validated)

Every number below is an **illustrative placeholder [VERIFY]**. The app should measure the real ones and replace them.

```
Owners targeted (list)            1,000 / month
→ Skip-traced with a phone/email     ~70%   = 700        [VERIFY hit rate]
→ Reached (answered / replied)       ~10%   = 70         [VERIFY by channel]
→ Interested / motivated             ~15%   = ~10
→ Qualified + underwritten           ~50%   = ~5
→ Offer made                         ~60%   = ~3
→ Accepted / closed                  ~15%   = ~0.5 deal / month
```

**Implication:** about one deal a month likely needs on the order of 1,000 to 2,000 targeted owners a month, with multi-touch follow-up. A one-time batch of 21 leads cannot produce consistent deals.

**Reviewer question:** is this funnel shape realistic for off-market SFR in Wichita? What should we measure first?

---

## 4. Proposed Phase 4 design: the lead machine

### 4.1 Channels

| Channel | Use | Provider | Est. cost **[VERIFY]** |
|---|---|---|---|
| Direct mail | Cold first touch at scale | DealMachine mail (already integrated vendor) | ~$0.50–$1.00 per piece |
| Cold calling | Owner manually calls from the app (click-to-call, one at a time) | Twilio Voice (bridges to owner's cell) | ~$1–2/mo per number + ~1–2¢/min |
| SMS | **Replies and consented follow-up only** (see §5) | Twilio Messaging + A2P 10DLC registration | ~$1–2/mo per number + ~1¢ per segment + registration fees |
| Email | Cold-capable first touch and follow-up | Google Workspace / Gmail API, on a separate sending subdomain | ~$0 to Workspace seat |
| Inbound | Seller calls or texts the number from mail; web form | Twilio number + simple landing page | included |

### 4.2 Features

1. **Unified inbox.** All texts, emails, calls and voicemails for a contact appear in one thread, linked to the property and lead timeline.
2. **Click-to-call.**
   - Owner clicks Call; Twilio rings the owner's cell first, then connects to the seller.
   - The caller ID is the business number. The call is logged with its duration and outcome.
   - Optional recording, controlled by consent rules (§5.4).
3. **Follow-up sequences.** Multi-step cadences, for example: Day 0 letter, Day 3 call, Day 10 email, Day 30 letter, then monthly.
   - **Auto-stop** on reply, an opt-out, a stage change, or "dead."
4. **Tasks and reminders.** Call queues ("12 calls due today"), with push or email notifications to the owner's phone.
5. **Skip tracing.** Through DealMachine (paid). Contacts get a source, a confidence score and a date. Wrong numbers get flagged.
6. **Compliance gate.** A single function that every outbound message and call must pass through (§5). It is not optional and cannot be bypassed from the UI.
7. **Global kill switch.** One toggle stops all outbound communication immediately. This already exists in the planned design and must ship.
8. **Templates.** Merge fields (first name, street) and spintax-free plain language. The opt-out language is enforced by the system.
9. **Lead scoring.** Combines distress signals (vacant, tax-delinquent, probate, absentee, equity) with engagement (replied, answered, opened) to rank a daily "who to call" list.
10. **KPI dashboard.**
    - Cost per lead, cost per conversation, cost per offer and cost per deal.
    - Each broken down by list and channel.
    - Speed-to-lead.
    - Follow-up compliance (did every hot lead get touched on schedule?).

### 4.3 Data model additions (proposed)

- `phone_numbers`: Twilio numbers, purpose, 10DLC campaign ID.
- `conversations`, `messages` (direction, channel, status, provider SID, segments, cost), `calls` (duration, recording URL, outcome, disposition).
- `sequences`, `sequence_steps`, `enrollments` (state machine: active / paused / completed / stopped_reason).
- `consent_events`: an append-only log of who consented, to what, when, how, and with what evidence. `contacts.sms_consent` already exists, but a single field is not an audit trail.
- `suppression_list`: phone numbers or emails that must never be contacted (opt-outs, DNC hits, litigators, attorney-represented, deceased, wrong number).
- `dnc_checks`: number, registry result, checked_at. Results must be re-checked periodically.
- `templates`, `campaigns` (list, channel, and spend tracking).
- Webhook routes for Twilio (inbound SMS, status callbacks, voice) with signature verification. The existing DealMachine webhook already follows this pattern.

### 4.4 Infrastructure dependency

Inbound texts, calls and delivery receipts require the app to be **online 24/7 at a public HTTPS URL**. The Phase 7 server is therefore a hard prerequisite for Phase 4 going live, not just a nice-to-have.

---

## 5. Compliance: the biggest holes (needs a lawyer)

> These are the areas most likely to cost real money. TCPA damages are **$500 to $1,500 per call or text**, and a class action over a batch of cold texts can be ruinous. **[VERIFY all with a Kansas attorney.]**

### 5.1 Cold texting skip-traced numbers (highest risk)

- Twilio's Acceptable Use Policy and US carrier A2P 10DLC rules **require opt-in consent** for application-to-person texting.
  - "We buy houses" cold-texting campaigns are commonly **rejected at 10DLC registration**, or filtered and suspended by carriers later.
  - **[VERIFY current Twilio/carrier stance.]**
- TCPA risk depends on whether the sending system counts as an "autodialer." After *Facebook v. Duguid* (2021), the federal definition is narrow. However, **several states have broader "mini-TCPA" laws**, for example Florida and Oklahoma (a neighboring state).
  - Many absentee owners of Wichita houses **live out of state**, so the owner's state law may apply. **[VERIFY]**
- **Proposed rule:**
  - No automated cold texting.
  - SMS is only sent to contacts who (a) texted or called in first, or (b) gave documented consent.
  - Cold outreach uses mail, manual calls and email instead.
  - **Reviewer: challenge this. Is there a compliant way to do cold SMS at scale, and is it worth the risk?**

### 5.2 Do Not Call

- The National DNC Registry restricts "telephone solicitations."
  - Whether an offer **to buy** a house (as opposed to selling something) counts as a solicitation is **not settled**; courts have gone both ways. **[VERIFY]**
- Kansas has its own No-Call Act (K.S.A. 50-670). **[VERIFY whether it adds a separate list or rules beyond the federal registry.]**
- **Proposed rule:** scrub every number against the National DNC (and the state list if separate) before any call, and re-scrub every 31 days. Check the **Reassigned Numbers Database** to reduce wrong-party risk. Maintain an internal DNC list.

### 5.3 Calling hours and identification

- Only contact between 8 a.m. and 9 p.m. in the **recipient's** local time zone. Absentee owners may be in other time zones.
- Identify the caller and the business on every call and message.

### 5.4 Call recording

- Kansas is a one-party-consent state **[VERIFY]**.
  - But calls to owners in **two-party-consent states** (e.g., California, Florida, Washington, Illinois…) require everyone's consent.
  - **Proposed rule:** either always play a recording disclosure, or disable recording when the number's state is unknown or two-party.

### 5.5 Email (CAN-SPAM + Gmail bulk-sender rules)

- Cold commercial email is legal under CAN-SPAM if it includes accurate headers, a physical postal address and a working unsubscribe that is honored within 10 business days.
- Gmail/Yahoo bulk-sender requirements (2024) apply above roughly 5,000 messages a day: SPF, DKIM, DMARC, one-click unsubscribe, and a spam complaint rate below 0.3%.
- **Practical risks:**
  - Skip-traced email addresses are often stale, which leads to bounces, which damages domain reputation.
  - Send from a **separate subdomain** (e.g., `mail.homebuyersict.com`), warm it up slowly, and cap daily volume.
  - **Never risk the main domain.**

### 5.6 AI voice (Phase 5)

- The FCC ruled in February 2024 that AI-generated voices are "artificial or prerecorded voice" under the TCPA.
  - **Outbound AI calls to cell phones therefore require prior express (written, for telemarketing) consent.** **[VERIFY]**
- **Proposed rule:** AI is used for **inbound only** (answering the mail-response number, qualifying the seller, booking a callback), with disclosure that the caller is speaking with an AI. **Phase 5 scope should change accordingly.**

### 5.7 Fair housing and fair dealing

- Lead targeting must not use protected classes, including proxies such as targeting by neighborhood demographics.
- Messaging to elderly, probate or distressed owners must not be deceptive or high-pressure. For example, no "we can save your home from foreclosure" claims.
  - Kansas foreclosure-rescue laws may apply to preforeclosure outreach. **[VERIFY]**
- Probate leads: contact the personal representative, not just "heirs" at random.

### 5.8 Data privacy and security

- Skip-trace data is personal data. Keep it out of Git (already done: `data/private/` is gitignored), encrypt backups, and restrict access by role.
- Keep a retention policy: purge dead leads' contact data after N months?

---

## 6. Holes in the underwriting logic

| # | Hole | Why it matters | Proposed fix |
|---|---|---|---|
| U1 | **Rent screening ratio comes from 2 properties** (1.1% Pershing, 0.79% Prescott) | Imported leads assume rent = % of DealMachine value, which may be badly wrong by neighborhood | Rent comps per lead (Zillow rent Zestimate / Rentometer / local PM data), and require a verified rent before an offer |
| U2 | **ARV = DealMachine estimated value** | AVMs on distressed houses are often off by 15–30%; they value the house as-is, not after repair | Require 3 sold comps (renovated, ≤0.5 mi, ≤6 mo) before an offer; store the comps used |
| U3 | **Flat $15k rehab** on screening | Value-add houses (the owner's preference) often need $30–60k; this overstates MAO on the best leads | Rehab estimator by condition tier, square footage and line items; walkthrough required before an offer |
| U4 | **DSCR loan minimum loan amount** | Many DSCR lenders have a $75k–$100k minimum loan **[VERIFY]**. Wellington $15k houses (ARV maybe $60–90k) may be unrefinanceable with DSCR; 75% of $90k = $67.5k | Add `lenderMinLoan` to assumptions; flag deals below it; model a local bank/portfolio lender as an alternative refi |
| U5 | **Property tax = 1.00% of value** | Sedgwick County effective rates may be higher, and assessed value resets after sale/rehab **[VERIFY]** | Use actual county tax and mill levy by address; project post-rehab reassessment |
| U6 | **Insurance = 0.62% of value** | Kansas hail and wind premiums have risen sharply; landlord policies with wind/hail deductibles are expensive **[VERIFY]** | Use a real quote per property type; add wind/hail deductible reserve |
| U7 | **Management = 0%** | Fine while self-managing, but at scale (10+ doors) the owner's time isn't free; lenders may impute it | Default 8–10% in stress case, or show "self-managed" vs "managed" side by side |
| U8 | **Appraisal risk** | The refi appraisal decides everything; a low appraisal traps cash | Stress case already lowers ARV, but show "appraisal needed to hit target" as a headline number |
| U9 | **Seasoning and rate changes during hold** | 6 months of private money at 12%; rates can move | Current stress cases are only ARV −10%, rehab +20%, rent −10% and combined (`engine.ts`). **No refi-rate stress and no hold-time overrun.** Add +1% rate and +3 months hold |
| U10 | **Vacancy/turnover** | 8% vacancy may be light for lower-ARV Wichita houses with higher turnover | Calibrate from the owner's actual rent rolls |
| U11 | **Wellington is a different market** | Smaller town, thinner comps, different rents and lender appetite | Separate assumption set per market (Wichita vs Wellington) |
| U12 | **Buy box rejects the owner's own Wellington deals** | ARV min $90k likely excludes $15k Wellington houses the owner says are good | Market-specific buy boxes; or a "cash-flow hold (no refi)" pathway that doesn't require BRRRR to work |
| U13 | **No "cash purchase, no refi" pathway** | Cheap houses may be best held free-and-clear or with a small bank loan, not BRRRR'd | Add hold-strategy comparison: BRRRR vs cash hold vs flip vs wholetail |

---

## 7. Holes in the product and CRM

| # | Hole | Proposed fix |
|---|---|---|
| P1 | **No consistent lead flow**: the 21 leads were one manual batch | Saved DealMachine searches that run weekly with a credit cap and auto-import to "New" |
| P2 | **No list stacking** (vacant + absentee + tax-delinquent + high equity) | Score by overlapping signals; DealMachine filters already support most of these |
| P3 | **No drive-for-dollars mode** | Mobile page: add a property by GPS/address with photos and a condition rating; DealMachine's app does this, so maybe just import from it |
| P4 | **No mobile-first workflow** | The owner works from a phone; call queue, inbox and lead page must work one-handed |
| P5 | **No notifications** | New reply, inbound call, task due: push or email to the owner |
| P6 | **No speed-to-lead** | Inbound seller replies need a response within minutes; alerts plus an auto-acknowledgement for consented contacts |
| P7 | **No seller qualification script** | Guided call form: motivation, timeline, condition, price expectation, mortgage owed, decision-makers. Feeds lead score and underwriting |
| P8 | **No offer documents** (Phase 6) | Offer letter / LOI generation, owner approval gate (already a hard rule), Kansas purchase agreement template reviewed by attorney, e-sign |
| P9 | **No post-close tracking** | Rehab budget vs actual, refi outcome, actual rent: feed real numbers back to calibrate assumptions (closing the loop) |
| P10 | **No deal source attribution** | Every deal tagged to list, channel and campaign so spend can be judged |
| P11 | **Contacts per property** | Multiple owners, heirs, spouses, POA; one property can have many contacts and phone numbers with different statuses |
| P12 | **Duplicate owners** across many properties (portfolio landlords) | Group by owner entity; one conversation, many properties: these are often the best sellers |
| P13 | **Agent/MLS channel ignored** | Some deals come from agents (MLS fixer-uppers, pocket listings); a simple agent CRM list and offer tracking may be cheap wins |
| P14 | **No team roles in practice** | Acquisitions and viewer roles exist; if a VA or caller is added, they need limited permissions and call-recording review |

---

## 8. Holes in operations and infrastructure

| # | Hole | Proposed fix |
|---|---|---|
| O1 | **Single server, backups on the same server** | Off-site copy: Oracle Object Storage (free 20 GB) or download weekly; test restore monthly |
| O2 | **No uptime monitoring** | Free external monitor (e.g., UptimeRobot free tier) hitting `/api/health` with email/SMS alert **[VERIFY free terms]** |
| O3 | **Oracle Always Free capacity and reclamation** | Pay As You Go upgrade (still $0 within limits) plus $1 budget alert; document how to move to a ~$5–6/mo VPS if Oracle becomes unreliable |
| O4 | **Secrets management** | `.env.production` root-only on the server; never in Git or chat; rotate if exposed |
| O5 | **Twilio/DealMachine spend runaway** | Daily and monthly spend caps enforced in code, plus provider-side limits; the global kill switch |
| O6 | **No error tracking** | Log to file plus a simple admin "errors" page; optionally a free tier of an error tracker |
| O7 | **One person knows how it works** | Runbook in `docs/` (setup, restore, rotate keys, kill switch) |

---

## 9. Proposed build order (to be challenged)

1. **Phase 7: get the server live.** Inbound comms need it.
2. **Phase 4a: compliance foundation.** Suppression list, consent events, DNC scrub integration, quiet hours, kill switch, and the compliance gate function, with tests.
3. **Phase 4b: calling.** Click-to-call through Twilio with outcomes, call queue, notes and recording rules. Manual dialing, one at a time.
4. **Phase 4c: inbound number + inbox.** The mail piece's phone number rings or forwards to the owner, and texts land in the inbox. This is consented by definition, since the seller initiated.
5. **Phase 4d: direct mail campaigns** through DealMachine, with cost tracking and a unique tracking number per campaign.
6. **Phase 4e: email sequences** from a warmed subdomain.
7. **Phase 4f: SMS to consented contacts only**, after 10DLC approval.
8. **Underwriting fixes:** U1–U4, U11–U13 first, because they change which leads are worth calling.
9. **Phase 6:** offers and contracts with the owner approval gate.
10. **Phase 5:** inbound-only AI receptionist.

---

## 10. Open decisions for the owner

1. Real acquisition financing: private money at 12%, or cash?
2. Monthly budget for lead generation (mail, skip tracing, phone numbers).
3. Who makes the calls: the owner, a VA, or both?
4. Is the owner willing to skip cold SMS (higher legal risk) in favor of mail + calls + email?
5. Wellington property details (3 rentals): purchase, rehab, rent and value, to build a Wellington buy box.
6. Business domain for the app and email (e.g., `homebuyersict.com`).
7. Kansas real estate attorney to review: outreach plan, DNC position, recording, and the purchase agreement template.

---

## 11. Questions for the reviewer

1. Is cold-texting skip-traced numbers ever defensible for a small investor in 2026, or is "mail + call + email, SMS only after consent" the right call?
2. Does an offer to *buy* a house count as a "telephone solicitation" under the federal DNC rules? What's the safest practical position?
3. What is wrong with the funnel math in §3.1? What should be measured first?
4. What underwriting assumptions in §1.2 and §6 look wrong for Wichita/Wellington SFR in 2026?
5. Is the BRRRR-only engine the wrong frame for $15k Wellington houses? What should the hold-strategy comparison look like?
6. What is missing from the Phase 4 data model (§4.3) that will hurt later?
7. Is self-hosting on Oracle Always Free a good idea for a system that must receive calls and texts 24/7, versus a ~$5–6/mo VPS?
8. What single feature would most increase deals closed per month?
