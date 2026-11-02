# Home Buyers ICT: AI Acquisition Operating System, Product Baseline v2

> **Status:** draft baseline for joint review (Claude Code ⇄ Codex), reflecting the owner's clarification of November 2, 2026. This is not code.
> **Supersedes:** the product boundary, roadmap and "AI out of scope" positions in `PRODUCT_REVIEW.md` and `SPEC_RELEASE_1.md`. The **guardrail** sections of `SPEC_RELEASE_1.md` (financial definitions, evidence, permissions, execution, roles) remain in force, as corrected in Appendix A.
> **Labels:**
> - **[VERIFY]**: legal, provider or price facts that need a primary source or attorney.
> - **[ASSUMPTION]**: a planning number to be calibrated in the pilot.
>
> Neither label may be hard-coded as fact.

---

## 1. Purpose

**One piece of software the owner uses to get houses.**

The software:
- sources opportunities;
- runs permitted outreach;
- answers seller calls and texts;
- qualifies sellers and follows up;
- gathers evidence;
- underwrites scenarios;
- negotiates within owner-approved limits;
- prepares the deal for owner review before signing;
- then drives the transaction to closing and learns from the results.

**Central design question:** how does the system consistently move qualified opportunities toward acquisition while needing **progressively less owner time per closed property**?

### North-star metrics
1. Closed acquisitions per month that meet the owner's criteria. Target: **2–3/mo now**, with a path to **20–30/mo**.
2. **Owner minutes per closed deal**, trending down.
3. Underwriting accuracy: projected vs. actual rehab, rent and refinance.
4. Acquisition cost per closed deal.

### What "SaaS-level" means here
- **Engineering standard (committed):**
  - reliable: monitored, with retries and no lost messages;
  - secure: role-based access, encryption, audit trail, secrets handled properly;
  - observable: dashboards, alerts and AI conversation logs;
  - recoverable: off-site backups with restore drills;
  - scalable: queue-based, so volume can grow without rewrites.
- **Commercial multi-tenant product (owner decision, §12):** selling the software to other investors is a separate decision. It needs billing, onboarding, tenant isolation and support.
  - **Recommendation:** run it single-tenant for Home Buyers ICT, but put an `organization_id` on core tables from the next migration. It's cheap now and expensive later.

### Non-negotiable controls
- **The owner approves before anything binding.**
- No AI or automation ever signs, accepts a binding offer, or moves money.
- **All numbers come from the deterministic engine.** The AI never invents a price, rent, ARV or cost.
- Every fact the AI uses is **source-backed**, and evidence can be traced.
- Outreach goes only to audiences that are **technically, provider- and legally eligible** (§6).
- Any AI voice is **transparently identified as AI**. Voice cloning is limited to **the owner's own voice, with written authorization**.

---

## 2. System architecture (logical)

```
┌──────────────────────── Owner / team surfaces ────────────────────────┐
│ Mobile daily queue · Exception queue · Approvals · Deal room · Copilot │
└───────────────────────────────▲───────────────────────────────────────┘
                                │ only judgment work reaches humans
┌───────────────────────── AI agents (bounded) ─────────────────────────┐
│ Sourcing analyst · Seller representative (voice/SMS/email) ·           │
│ Evidence assembler · Negotiator (within envelope) · Transaction        │
│ coordinator · Internal Q&A copilot · Conversation QA reviewer          │
└───────────────▲───────────────────────────────────────▲───────────────┘
   tools only   │                                       │ retrieval w/ citations
┌───────────────┴─────── Deterministic core ────────────┴───────────────┐
│ Underwriting engine (routes, MAO, stress, liquidity) · Policy gate     │
│ (permission, suppression, DNC, quiet hours, budget, kill switch) ·     │
│ Workflow/state machine · Durable job worker · Capacity controller      │
└───────────────▲───────────────────────────────────────────────────────┘
┌───────────────┴──────────────── Data & knowledge ─────────────────────┐
│ PostgreSQL: parties, properties, opportunities, conversations,         │
│ evidence, approvals, transactions, actuals · pgvector "AI memory":     │
│ business knowledge + per-party conversation memory (cited) · files     │
└───────────────▲───────────────────────────────────────────────────────┘
┌───────────────┴──────────────── Integrations ─────────────────────────┐
│ DealMachine · Twilio (voice, SMS, numbers) · Speech (STT/TTS/clone) ·  │
│ Claude API · Gmail/Workspace · Google Calendar · E-sign · Rent/comps   │
│ data · County records · JobTread (rehab) · Object storage              │
└────────────────────────────────────────────────────────────────────────┘
```

**Rule:** AI agents act **only through typed tools** exposed by the deterministic core. An agent cannot write directly to the database, send without the policy gate, or compute a price itself.

---

## 3. DealMachine as the sourcing and contact backbone

DealMachine is already connected (API v2, owner's account).

| Capability | Use in the machine | Control |
|---|---|---|
| Property search, filters, counts (free) | Saved "buy box" searches run on a schedule (e.g., nightly): absentee, vacant, tax-delinquent, pre-foreclosure, probate, high equity, tired landlord, in target zips | Counting is free; retrieval is paid → budget (§9) |
| New-record detection + dedupe | Only records new or changed since the last run are imported. Dedupe by DealMachine ID → APN → normalized address | — |
| List stacking | Count the overlapping signals; stacked records are ranked higher | — |
| Enrichment / skip tracing (owner phones, emails, phone type, DNC flags where provided) | Contact methods are created with source, confidence and **permission = unknown** | **A monthly owner-set budget** replaces per-batch approval. Each batch is still estimated and logged |
| Comps, repair estimate, equity | Evidence inputs (labeled as estimates) | — |
| Direct-mail campaigns, designs, wallet | Mail batches launched from our app with a unique tracking number per campaign | Spend is checked against the budget and capacity (§9) |
| Lists, tags, prospects, notes | Two-way sync, so DealMachine's mobile app (driving for dollars) stays useful | — |
| Drives (driving for dollars) | Imported as sourced properties | — |
| Webhooks | Change events → re-evaluation | Signature verified, deduplicated (built) |

Phase 2 already built the client, the budget caps, the resumable import jobs and webhook verification. What's added is scheduling, a monthly enrichment budget, mail campaigns and two-way sync.

---

## 4. AI agents and their authority

### 4.1 Agents
| Agent | Job | Tools (examples) |
|---|---|---|
| **Sourcing analyst** | Runs saved searches, dedupes, stacks, requests enrichment within budget, explains why a record was ranked | DealMachine search/count/enrich, rank |
| **Seller representative** | Answers inbound calls and texts 24/7; runs permitted follow-up; qualifies; collects photos and documents; schedules walkthroughs and owner calls; presents indicative numbers **within the envelope** | Conversation send (via policy gate), calendar, intake link, engine read, envelope read |
| **Evidence assembler** | Gathers comps, rent comps, county and tax data, seller photos (vision-assisted condition notes), rehab ranges; lists what is missing; routes physical or judgment tasks to people | Data APIs, vision, task create |
| **Negotiator** | Handles counteroffers and objections inside the approved envelope; drafts the next offer version for approval when outside it | Envelope read, offer-version draft |
| **Transaction coordinator** | Tracks deadlines, chases title, lender, inspector and seller documents, sends reminders, prepares the closing checklist | Milestones, email, calendar, document requests |
| **Internal copilot** | Answers the owner's and team's questions ("what did the seller on Battin say about the roof?", "which deals need capital this month?"), always with citations; read-only | Retrieval, engine read, reports |
| **QA reviewer** | Scores every AI conversation (disclosure, accuracy against facts, policy, tone, missed escalation); samples for human review | Transcript read, findings write |

### 4.2 Authority matrix (seller representative + negotiator)

| Category | Allowed autonomously | Requires owner approval (or a pre-approved envelope) | Never |
|---|---|---|---|
| **Say** | Company facts from the knowledge base; process explanations; that it is an AI assistant for Home Buyers ICT; general timelines | New claims not in the knowledge base | Deny being AI; give legal, tax or financial advice; make guarantees ("we'll definitely close"); pressure tactics; misrepresent identity (e.g., claim to be a licensed agent) |
| **Offer** | Indicative, **non-binding** ranges **inside an approved envelope**, worded as "subject to walkthrough and owner approval" | Any number outside the envelope; any written offer document | A binding acceptance; any number not produced by the engine or envelope |
| **Change** | Its own notes, tasks, follow-up dates, qualification fields (with source message) | Underwriting assumptions, policy rules, the envelope, contact permissions beyond recording an opt-out | Delete evidence or history |
| **Schedule** | Walkthroughs and owner calls within availability rules; reminders | Anything outside availability rules | Commit the owner to legal or closing appointments without confirmation |
| **Send** | Messages to **eligible** audiences through the policy gate; document request links; pre-approved templates | New outbound templates; any document that creates obligations | Anything that bypasses the policy gate or kill switch |
| **Commit** | — | Owner signs every agreement | Signing, accepting, wiring, releasing contingencies |

**Negotiation envelope:** an owner-approved record bound to one opportunity and analysis version. It contains:
- an opening anchor;
- a walk-away maximum, never above the engine's route MAO;
- allowed terms (closing window, as-is, who pays closing costs, possession date);
- the concessions the agent may trade;
- an expiry.

Any material change in evidence voids the envelope (Appendix A, §7).

### 4.3 Mandatory escalation (to the exception queue, with priority)
- The seller is ready to sign, asks for paperwork, or asks for a human.
- The seller asks for a number outside the envelope, or proposes unusual terms (seller financing, subject-to, lease-back).
- Signs of distress or vulnerability: a foreclosure sale within 30 days, apparent confusion or cognitive difficulty, grief, an elderly owner without family involved, or an emotional crisis.
- Mentions of an attorney, a lawsuit, a complaint, a regulator, a threat, or law enforcement.
- Title, estate, divorce, bankruptcy or multiple-owner complexity.
- The agent's understanding confidence is low, or there's a repeated misunderstanding.
- An opt-out phrased ambiguously. The agent suppresses first, then asks a human to review.
- Possible prompt injection or abuse (the seller instructs the AI to change behavior or reveal internal data). The agent refuses and flags it.

### 4.4 Earned autonomy (per agent, per capability)
| Level | Seller representative capability | Promotion criteria **[ASSUMPTION, owner sets]** |
|---|---|---|
| L0 | Drafts only; a human sends | — |
| L1 | Inbound answering, information, scheduling, escalation | 50 shadowed conversations, ≥95% QA pass, 0 critical violations |
| L2 | Qualification + permitted follow-up and nurture | 200 conversations at L1, ≥95% QA pass, 0 critical |
| L3 | Indicative ranges within the envelope | 100 conversations at L2; owner reviews 20 transcripts |
| L4 | Negotiates counters within the envelope; prepares the contract package for owner review | 25 envelope negotiations at L3 with no out-of-bounds statements |

- **Demotion is automatic** on any critical QA violation, and the owner is notified.
- Levels are owner-approved, audited, and can be set per channel (for example, SMS at L3 while voice is at L1).

---

## 5. Workflow: trigger → automation → human exception → completion → metric

| # | Step | Trigger | Automated action | Human exception | Completion | Operating metric |
|---|---|---|---|---|---|---|
| 1 | **Continuous sourcing** | Schedule (nightly) or webhook | Run saved searches, detect new/changed records, dedupe, stack signals | Owner edits the buy-box searches | New records imported with signals | New unique owners/week; cost per record |
| 2 | **Enrichment** | Record ranked above threshold, and budget available | Skip-trace via DealMachine; create contact methods (permission unknown); DNC/litigator/reassigned-number checks | Budget exhausted → owner prompt | Contact methods with validity and eligibility | Hit rate; cost per reachable owner |
| 3 | **Prioritization** | New record, new evidence, or engagement event | Two separate scores: **investment fit** (engine screening + evidence confidence) and **seller engagement/likelihood** (signals + responses). Never blended into one hidden number | — | Ranked queue per campaign | Conversion by score band (calibration) |
| 4 | **Campaign outreach** | Capacity controller allows volume | Assign each owner to eligible channels (§6): mail batch, permitted SMS/email sequences, human dialer queue for cold calls | Template approval; campaign launch approval | Owner touched per plan, or exhausted | Delivered attempts; response rate by channel and list |
| 5 | **Inbound conversion** | Call, text, email or web form | AI answers in **under 1 minute** (disclosed), identifies the property, links or creates the party, starts qualification | Escalation triggers (§4.3) | Qualified, nurture, or dead (with reason) | Speed to response; answer rate; qualification rate |
| 6 | **Qualification** | Engaged seller | Collect motivation, timeline, condition, price (or "declined"), mortgage, decision makers; send a photo and document intake link | Complex situations | §3 T3 gate satisfied (SPEC_RELEASE_1) | % qualified; time to qualify |
| 7 | **Follow-up and nurture** | No response, "not now," or a reactivation date | Response-aware sequences; stop on reply; nurture cadence; reactivation on a date or new distress signal | Reply needing judgment | Re-engaged or exhausted | Re-engagement rate; deals from nurture |
| 8 | **Evidence assembly** | Qualified | Pull comps, rent comps, county and tax data; vision-assisted condition from seller photos; rehab range; a list of what's missing | Walkthrough (human or field rep), contractor bid | §4 preliminary checklist (Appendix A, §7) | Time from qualified to preliminary; % auto-assembled |
| 9 | **Progressive underwriting** | New or changed evidence | Engine re-runs all routes and stresses automatically; findings; liquidity check against capital | Owner decisions on warnings | Analysis at the right evidence level | Analysis cycle time; projected vs. actual error |
| 10 | **Walkthrough scheduling** | Preliminary analysis looks feasible | AI books a slot from field-rep availability; reminders; route planning | No-shows, access issues | Walkthrough done; photos and notes uploaded | Walkthroughs/week; show rate |
| 11 | **Offer preparation** | Evidence ready for an indicative offer | Draft the offer version + envelope from the engine route MAO and owner rules | **Owner approves the envelope** (mobile, one tap with summary) | Approved envelope | Time from qualified to approved offer; owner minutes per approval |
| 12 | **Negotiation** | Envelope approved | AI presents and negotiates within the envelope; logs every concession | Outside the envelope → owner | Verbal agreement within the envelope, or dead or nurture | Offer-to-agreement rate; rounds per deal |
| 13 | **Owner takeover + contract** | Seller agrees in principle | Prepare the contract package (reviewed template, filled), signing parties verified, summary memo | **The owner reviews, adjusts and signs**; seller signs (e-sign) | Executed agreement verified (T9) | Agreement-to-signature time |
| 14 | **Transaction coordination** | Executed agreement | Milestones, deadline reminders, chasing title, lender, inspector and seller documents; EMD tracking | Inspection judgment, title exceptions, renegotiation | Contingencies satisfied or released by the owner (T10) | On-time milestone %; fall-through rate and reasons |
| 15 | **Closing** | Clear to close | Checklist, settlement statement comparison, wire-verification reminder | **The owner authorizes funds**; wire verification by phone | Closing record (settlement, then deed recording tracked separately) | Contract-to-close days; close rate |
| 16 | **Actuals + improvement loop** | Rehab done, lease signed, refinance closed | Collect actuals (JobTread for rehab where used); compare to projections; produce recommendations | **The owner accepts or rejects** each recommendation; nothing changes silently | Assumption change proposals reviewed | Forecast error by input; cohort ROI |

**Cross-cutting:**
- an **exception queue** (one inbox for every human-needed item, prioritized by deadline and deal value);
- **QA review**;
- **capacity controller** (§9);
- **kill switch** (global, per channel, per campaign).

---

## 6. Outreach eligibility: capability vs. provider vs. legal

Every channel × audience pair carries **three separate flags**:
- **Technically capable** (we can build it).
- **Provider-eligible** (Twilio / carrier / email provider policy) [VERIFY].
- **Legally eligible** (TCPA, DNC, state law) [VERIFY, attorney].

The policy gate requires all three.

| Channel | Audience | Capable | Provider | Legal (working position, [VERIFY]) | Default |
|---|---|---|---|---|---|
| **AI voice, inbound** | Anyone who calls us | ✔ | ✔ | Disclose AI; recording only after the recording workflow is verified | **On** (after L1) |
| **AI voice, outbound** | Contacts with documented **prior express consent** covering artificial-voice calls (e.g., a web form with consent language naming Home Buyers ICT, or a seller who asked to be called) | ✔ | ✔ | FCC (2024): AI voices are "artificial voice" under the TCPA | On, **consented only** |
| AI voice, outbound | Skip-traced cold numbers | ✔ | ⚠ | **High risk / likely prohibited without consent** | **Off; cannot be enabled without an attorney opinion recorded** |
| **Bulk SMS** | Opted-in contacts (web form consent, texted us first and agreed, prior sellers who opted in) | ✔ | ✔ with 10DLC registration | Within consent scope; honor STOP | **On** |
| Bulk SMS | Skip-traced cold numbers | ✔ | ✖ (A2P policy requires opt-in) | High risk | **Off** |
| **Human calls (dialer queue, one-click, human speaks)** | Cold owners after DNC/litigator/reassigned scrub | ✔ | ✔ | DNC applicability to offers to buy is unsettled → scrub anyway | **On** |
| **Email sequences** | Cold owners (CAN-SPAM compliant, separate warmed subdomain) | ✔ | ✔ within volume and complaint limits | CAN-SPAM: address + unsubscribe | **On** |
| **Direct mail** (DealMachine) | Any owner | ✔ | ✔ | Truthful content; no deceptive "official notice" designs | **On** |
| Ringless voicemail | Cold owners | ✔ | ⚠ | Treated as calls by the FCC [VERIFY] | Off |

**Strategic consequence (the key unlock):**
- The highest-autonomy channels (AI voice, bulk SMS) are legal and provider-safe for **consented** audiences.
- So the machine should **manufacture consented demand**. Mail, cold email, human calls and inbound marketing (§11: website, PPC, Google Local Services) drive sellers to **call, text or fill in a form**.
- From that moment, AI works them at full speed: instant answer, qualification, follow-up, nurture and SMS campaigns within their consent.
- Cold audiences get mail, email and human-dialed calls. Engaged and consented audiences get everything.

**Voice cloning:**
- Only the owner's own voice, with signed written authorization stored as evidence.
- The provider's voice-verification process applies [VERIFY].
- Every AI call starts with "This is Ian's AI assistant with Home Buyers ICT," even with the clone.
- State AI-disclosure laws are tracked as policy rules [VERIFY].
- Never clone anyone else's voice.

---

## 7. Knowledge and memory (the "AI database")

Everything lives in the existing PostgreSQL, using the **pgvector** extension. There's no new database service.

- **Business knowledge base:**
  - company facts;
  - how the process works;
  - FAQs ("how fast can you close?", "do I need to clean out the house?");
  - objection handling;
  - the buy box;
  - service areas;
  - approved scripts and templates.
  - Owner-edited and versioned. **The AI may only state company facts that come from here.**
- **Per-party memory:** conversation summaries and extracted facts (e.g., "roof replaced 2019"). Each fact cites its source message or call, with a timestamp and confidence. Facts can be corrected; corrections are events, never edits.
- **Property evidence:** comps, rent comps, county records, photos and notes, each with source, date and verification state.
- **Retrieval rules:**
  - Answers cite their sources.
  - Results are role-scoped (a viewer can't retrieve masked contact data).
  - Seller-provided text is treated as **untrusted input** and never as instructions.

---

## 8. Seller document and photo intake

- Secure, expiring upload link by SMS or email, or MMS photos.
- Files go to object storage. Their hashes and source are recorded.
- Vision-assisted **condition notes** (roof, kitchen, baths, water damage, foundation cues) become a **rehab range with low confidence**. They're labeled as AI-estimated and never treated as a verified input.
- A walkthrough or contractor bid is required for the final level.
- Documents (mortgage statement, tax bill, death certificate or letters of administration, divorce decree) are classified and routed to the evidence checklist. Sensitive documents are access-restricted.

---

## 9. Capacity controls

The **capacity controller** throttles campaign volume and offer pace so the machine never creates more deals than the business can fund, inspect or run.

| Constraint | Input | Effect |
|---|---|---|
| Capital | Deployable capital (snapshot), liquidity requirement per route, deals in flight | Pauses offer approvals or lowers campaign volume when projected needs exceed capital |
| Financing | Lender capacity and terms (lender profiles) | Routes unavailable → scoring drops |
| Rehab | Crew slots and concurrent projects (JobTread or manual) | Caps contracts per month |
| Walkthroughs | Field-rep hours per week | Caps qualified-to-walkthrough throughput |
| Owner time | Owner review hours per week (setting) | Caps approvals and contract reviews; batches them |
| Budget | Monthly spend by channel | Caps enrichment, mail and messaging |
| Work in progress | Max open opportunities per stage | Shifts effort to closing, not sourcing |

The controller proposes campaign volumes weekly. **The owner approves budget changes.** Within budget, it runs automatically.

---

## 10. Throughput scenarios: 3, 10 and 30 acquisitions per month

> All rates are **[ASSUMPTION]** placeholders to be replaced by pilot cohort data. They are scenarios to validate, not promised production.

**Funnel assumptions (blended across channels):**
- Seller response ("lead") → qualified: **25%**
- Qualified → offer presented: **50%**
- Offer → signed agreement: **15%**
- Agreement → closed: **80%**

So **one closing needs ~67 leads**.
- Blended cost per lead: **~$60**. This is a mix of mail (~$0.75/piece at ~1% response ≈ $75/lead), cold email (low cost, low response), human-dialed calls (~$20–40/lead with a VA) and inbound PPC (~$100–200/lead) [VERIFY local pricing].

**Per-deal capital: the owner's verified financing**

Source: the owner's "Lending Products Reference" doc, the SB promissory notes, and the payoff and closing figures.

| Item | Verified terms |
|---|---|
| Purchase + rehab, primary | **CV3 bridge** via Christy (Planted Local Lending): 9–12% interest-only, quoted, not locked; **$350 per draw, reimbursement after paid invoices (the owner floats the rehab cash)**; up to 90% LTV with experience; no seasoning before refinance |
| Purchase + rehab, backup | **SB Investments (Brandon Lacey)**: 18%/yr (1.5%/mo), 0 points, ~$500 processing rolled into the loan, 3-month minimum, then daily proration, 6-month term, no prepayment penalty; **100% of purchase + rehab funded up front or in 2 draws**; interest due at payoff; extension at the lender's discretion. Capacity unknown; largest loan $140k (Prescott) |
| Purchase + rehab, other | Some lenders: 90% of purchase + 100% of rehab (owner pays ~10% down) |
| Refinance, default | **MyLoanPathway / CV3** via Christy: **6.37% 30-yr fixed**; fees ≈ **3.75% of the loan + $2,776**; up to **80% LTV cash-out**; **no seasoning**; lender DSCR minimum 0.8; **minimum loan $75k**; experience rule applies |
| Actual results | **Pershing:** $85k hard money → payoff $89,293 (≈ $4.3k interest) → $91,200 refinance at a $114k appraisal → **owner brought $6,259 to closing**. **Prescott:** $140k → payoff $147,192 → $180,000 refinance → **owner received $19,870**. Both bought 2/19/26 and refinanced 5/12/26 (**≈ 3 months**) |
| Taxes and insurance (actual) | Taxes 0.65–1.12% of value/yr (use county records; default 0.75%); insurance ≈ $734/yr on Pershing (~0.6%) |

**Per-deal capital (Pershing-like):**
- Owner cash ≈ **$0 at purchase** with SB, or the rehab float with CV3 draws (up to the rehab amount for a few weeks).
- About **–$6k to +$20k at refinance**.
- Lender capital ≈ **$85–95k for ~3 months**.

**Findings:**
- Owner liquidity is small. **The binding constraint is total lender capacity**, made up of each lender's dollar and loan-count limits, plus the **$75k minimum refinance loan** (which matters for cheap Wellington houses).
- **The engine defaults must change:**
  - hold 3 months, not 6;
  - seasoning 0;
  - refinance at 6.37% with the actual fee structure and 80% LTV;
  - taxes from county records;
  - acquisition-lender profiles for SB and CV3.

| Per month | **3 closings** | **10 closings** | **30 closings** |
|---|---|---|---|
| Leads needed | ~200 | ~670 | ~2,000 |
| Qualified opportunities | ~50 | ~167 | ~500 |
| Offers presented | ~25 | ~84 | ~250 |
| Signed agreements | ~4 | ~13 | ~38 |
| Lead-generation spend (@ $60/lead) | ~$12k | ~$40k | ~$120k |
| Skip trace + data | ~$0.5–1k | ~$2–3k | ~$6–10k |
| Telephony + AI (voice minutes, SMS, LLM) [VERIFY] | ~$0.5–1k | ~$2–4k | ~$6–12k |
| Deals in flight (≈3-month buy-to-refinance cycle + ~1 month to close) | ~12 | ~40 | ~120 |
| **Owner liquidity tied up** (rehab float on reimbursement loans + refinance cash-in; ~$0–15k per deal) | **~$0–180k** | **~$0–600k** | **~$0–1.8M** |
| **Hard-money capital in flight** (× ~$93k) | **~$1.1M** | **~$3.7M** | **~$11M** |
| Concurrent rehabs (~2-month rehab) | ~6 | ~20 | ~60 |
| Walkthroughs (≈ offers, 1.5 h each with driving) | ~38 h | ~126 h | ~375 h |
| Owner approvals + contract review (20 min/offer + 2 h/contract) | ~16 h | ~53 h | ~158 h → **must delegate** |
| Transaction coordination (4 h/deal) | ~12 h | ~40 h | ~120 h |
| Exception queue (10% of conversations × 15 min) | ~10 h | ~30 h | ~90 h |
| **Human team** | Owner + part-time field rep | Owner + acquisitions/field rep + transaction coordinator + rehab PM | Acquisitions manager, 3–4 field reps, 2–3 coordinators, rehab PMs, capital relations |

**Findings:**
1. **Capital, not leads, is the binding constraint above ~3/month.** About 10/mo needs roughly $3.7M of revolving hard-money capacity across lenders (at the owner's verified ~3-month cycle), plus a refinance lender willing to do ~10 loans/month. The roadmap therefore includes **capital tracking** (lender capacity and commitments) early, and a **capital-partner module** before scaling.
2. **Rehab capacity is next.** About 20–60 concurrent rehabs. The owner's construction business (Franklin Homes, JobTread) is an advantage; the integration is in the roadmap.
3. **Owner time stops scaling at around 10/mo** unless approvals move to envelopes and delegated authority with audit (a future owner decision).
4. **AI's biggest leverage** is in the speed and consistency of conversations, follow-up and evidence assembly: the steps with the highest volume and lowest judgment.

---

## 11. Technology the owner may not know about (and whether we use it)

| Technology | What it does for getting houses | Status |
|---|---|---|
| **Real-time voice AI** (speech-to-text + Claude + text-to-speech over Twilio Media Streams), or a voice-agent platform (e.g., Vapi, Retell) | An AI that answers and talks naturally on the phone 24/7 | Core. Decision §12: build on Twilio (more control, lower per-minute cost) vs. a platform (faster to ship) |
| **Voice cloning** (e.g., ElevenLabs) | The AI speaks in the owner's voice | With the authorization + disclosure rules above [VERIFY provider terms] |
| **pgvector** (Postgres extension) | The "AI database": semantic memory and cited answers without a new service | Core |
| **Claude API with tool use** | The agents' reasoning; the agents only act through our tools | Core |
| **Twilio A2P 10DLC registration** | Required for business texting from local numbers | Launch requirement |
| **Call tracking numbers** | A unique number per mail campaign or ad → attribution | Core |
| **DNC + litigator scrub + FCC Reassigned Numbers Database** | Reduces legal risk from calling the wrong or protected people | Core [VERIFY vendors and pricing] |
| **Seller website + Google Local Services Ads / PPC + Facebook lead ads** | **Consented inbound leads**, the fuel that lets AI work at full speed legally | Strongly recommended |
| **Wholesaler and agent deal-flow screening** | AI reads the deal emails wholesalers already send the owner (Gmail), extracts address and price, underwrites automatically, and alerts only on fits. No outreach compliance burden | **High-leverage, low-risk quick win** |
| **MLS / agent listing screening** | New fixer listings auto-underwritten | Via an agent partner or a feed [VERIFY access] |
| **Public-record distress feeds** (probate filings, code violations, utility shutoffs, evictions, tax-delinquent lists: Sedgwick County, City of Wichita) | Earlier and less-contacted leads than national lists | Phase 3+ [VERIFY availability] |
| **Rent data API** (e.g., RentCast) | Automated rent comps | Recommended [VERIFY pricing] |
| **E-sign** (Dropbox Sign / DocuSign API) | Fast signing; **the owner signs** | Phase D |
| **Vision models** | Condition notes from seller photos | Phase B/C |
| **JobTread integration** | Rehab budgets and actuals flow back into underwriting | Phase E |
| **Google Calendar** | Booking walkthroughs and owner calls | Phase B |

---

## 12. Roadmap: staged autonomy (dependency-ordered)

Each stage is usable on its own. Guardrails from Appendix A ship **with** the stage that needs them, not after.

| Stage | Delivers | Autonomy reached | Depends on |
|---|---|---|---|
| **0. Foundation** | Deployed server (paid VPS if Oracle capacity stays unavailable or once voice latency matters), off-site backups, monitoring; `organization_id`; parties/contact-method/opportunity migration; corrected engine (routes, solver, liquidity, stress, findings); durable worker; policy gate + permission events + suppressions; roles | — | Owner decisions D1–D4 |
| **A. Copilot + inbound AI (first usable milestone)** | Twilio numbers (tracked); **AI seller representative inbound at L1** (voice + SMS, disclosed); knowledge base + memory; internal Q&A copilot; exception queue; mobile daily queue; conversation QA; human dialer queue with one-click calling; wholesaler-email screening | AI answers every seller call and text instantly; the owner works only exceptions and calls the AI queues up | Stage 0, Twilio account, 10DLC submitted |
| **B. Qualification, evidence, underwriting automation** | AI qualification + nurture (L2); photo and document intake; evidence assembler (comps, rent, county, vision); progressive underwriting; walkthrough scheduling | Leads arrive qualified, with a preliminary analysis and a list of what's missing | A |
| **C. Continuous sourcing + campaigns** | Scheduled DealMachine searches, stacking, enrichment budget, mail campaigns via DealMachine, cold email sequences, consented SMS campaigns, prioritization, capacity controller, campaign KPIs | The machine fills its own pipeline within budget | B; 10DLC approved; sending domain warmed |
| **D. Offer, negotiation, contract prep** | Envelopes, AI indicative offers (L3) → negotiation (L4), offer versions, contract package, e-sign with the owner as signer | The owner's work per deal ≈ approve the envelope + review and sign | C; reviewed contract templates |
| **E. Transaction coordination + learning loop** | Milestone automation, document chasing, closing checklist, actuals (JobTread), cohort analytics, assumption recommendations | Contract → close runs itself; underwriting gets more accurate | D |
| **F. Scale** | Team roles and delegated authority, capital tracking and capital-partner module, multi-market profiles, outbound AI to consented audiences at scale; **commercial multi-tenancy if chosen** | 10–30/mo with a team | E + owner decisions |

**Pilot:** run Stages A–B for 60–90 days at 2–3 deals/month. Measure the §10 rates by cohort, then set the Stage C budgets from real numbers.

---

## 13. Owner decisions

**Before implementation:**
- **D1:** Private tool now, or a future commercial product? (Recommendation: private now, `organization_id` included.)
- **D2:** Hosting: keep trying Oracle Always Free (Pay As You Go upgrade), or pay ~$20–40/mo for a VPS sized for real-time voice?
- **D3:** Voice stack: build on Twilio + speech providers (control, cost), or use a voice-agent platform (speed)?
- **D4:** Starting monthly budgets for data/enrichment, mail, and telephony/AI.
- **D5:** Financing. **Partly answered:** hard money at 1.5%/mo, 3-month minimum, typically 100% financed. Still open:
  - Points, or any fees?
  - Is interest paid monthly or at payoff?
  - Are closing costs and rehab financed up front, or reimbursed in draws?
  - Loan caps (% of cost or % of ARV)?
  - Total lending capacity per lender (dollars and number of loans at once)?
  - Which refinance lender, and its terms?
  - Deployable cash and protected reserve.

**Before launch:**
- **L1:** Attorney review: outreach policy matrix (§6), AI disclosure script, recording workflow, voice-clone authorization, purchase agreement template, envelope wording ("non-binding").
- **L2:** Twilio account, business profile + 10DLC brand and campaign approval.
- **L3:** Business identity (legal entity, DBA, postal address) for CAN-SPAM and disclosures.
- **L4:** Sending domain or subdomain set up and warmed.
- **L5:** Knowledge-base content reviewed by the owner (company facts, FAQs, scripts).
- **L6:** DNC registry access for every area code actually called [VERIFY process and fees]; litigator and reassigned-number scrubbing.
- **L7:** Restore drill into a clean environment; uptime monitor live.
- **L8:** Autonomy promotion thresholds (§4.4) confirmed.

---

## Appendix A: Codex Round 3 corrections, disposition

All twelve are **accepted** (two with a modification). They amend `SPEC_RELEASE_1.md` as follows.

1. **Liquidity by action (accepted, strengthened):**
   - Indicative offer: unknown liquidity may be acknowledged.
   - Binding commitment: the owner explicitly reviews the funding obligations and financing contingencies. **If the agreement has no financing contingency, verified acquisition funds are required.**
   - Releasing financing protections or authorizing closing: verified funds, required reserves and a credible rehab funding plan are required.
   - An acknowledgment never changes a status from unverified to verified.
2. **Liquidity formula (accepted):**
   - Liquidity is computed at **funding checkpoints**: at purchase closing, before each draw reimbursement, and at refinance closing. The requirement is the **maximum cumulative cash deficit** across them.
   - The draw bridge covers only the lender-funded portion fronted by the owner.
   - **Reserves are held, not spent.** They are shown separately and never added to project cost or cash remaining invested.
3. **Cash hold and lender methods (accepted):**
   - Cash hold has no refinance outputs. It shows capital invested, reserves, cash yield and cash flow, judged against a **cash-hold capital limit** set by the owner.
   - Lender profiles carry a `calculation_method`. Release support: `dscr_pitia` and `ltv_only`. Anything else is **"manual verification required."**
4. **Route eligibility and MAO (accepted):**
   - Lender eligibility, feasibility at price and owner criteria are separate.
   - A cost-basis cap is a sizing input, not ineligibility.
   - **Solver:** scan the price grid (e.g., $500 steps from $0 to ARV), find feasible intervals, bisect the upper boundary of the highest interval, **verify the returned price**, and report "no MAO" only if no interval exists.
   - Regression test: a minimum-loan feasible interval.
5. **Stress reporting (accepted):** for each stress case, report:
   - route availability under the lender's actual rules;
   - cash required and cash left;
   - cash flow and coverage;
   - capital sufficiency (`sufficient` / `insufficient` / `unknown`).
   - There's no unqualified "survives" result. A refinance failure is shown prominently, even inside the informational combined case.
6. **Signatures, title, wire and closing (accepted):**
   - Signatures: "all legally necessary parties with verified signing authority," with evidence and escalation.
   - Title: requirements satisfied and remaining exceptions reviewed and accepted.
   - Wire verification happens **before authorizing a wire**, and is "not applicable" if no wire is sent.
   - Settlement completed is separate from deed recorded.
   - These are workflow definitions for attorney and title-company review.
7. **Evidence readiness derived (accepted):**
   - A snapshot stores its classification at creation.
   - **Readiness is derived** from verifications, their scope, age, expiry and supersession.
   - Approvals and envelopes stay historical. Supersession or revocation makes them unusable going forward without erasing history.
8. **Lifecycle edge cases (accepted):**
   - Nurture resumes the same opportunity.
   - Reopening a Dead opportunity requires an explicit choice: resume, or create a linked new one, with a reason.
   - Cancelling a transaction routes the opportunity to a chosen state.
   - Backward moves never undo executed agreements, closings, deliveries or suppressions.
   - Closed deals use a correction/reopen workflow.
   - **The displayed stage comes from the transaction while it is open, and from the closing record after closing.** Otherwise the opportunity controls it.
9. **Permission identity (accepted):**
   - Derived key: (endpoint, party, business identity, channel, purpose).
   - **Suppression is endpoint-level** and overrides all parties sharing the number.
   - Permission never transfers between people.
   - A reply window is a restriction, not an authorization.
   - **Recording stays disabled** until its workflow is verified.
   - DNC coverage follows the numbers actually called, nationwide.
10. **Worker semantics (accepted):**
    - The kill switch pauses future dispatches. In-flight jobs keep their real outcome (confirmed success stays success); the status is `unknown` only when the outcome is truly uncertain. The dispatch boundary is documented.
    - Callback transition rules are per provider and per channel; raw events are preserved; contradictory terminal events are flagged for investigation.
    - **No exactly-once claim** for external delivery.
11. **Testing (accepted):**
    - Unit and integration tests for calculations, gates, transitions, permissions and recovery.
    - A few e2e user journeys.
    - **Live controlled checks** for forwarding, callbacks, notifications and outage recovery.
    - A clean-environment restore before launch.
    - Added cases: duplicate-endpoint suppression, stale evidence, unavailable refinance, the MAO interval, cash-hold criteria, migration preservation.
    - **Package deals: no partial acceptance.** Any change to the included properties requires a new owner-approved version.
12. **Manageability (modified):**
    - Agreed: the entity list is logical. Constrained configuration, reviewed changes, manual actuals comparison and simple attribution (including "unknown") ship first.
    - **Modified:** owner clarification lifts the release-1 AI exclusion. The guardrails stay, but AI moves into Stage A.
