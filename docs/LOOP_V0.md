# Loop v0: the smallest extension that runs one complete acquisition loop

> **Question (Codex):** What is the smallest extension of our existing code that can run the complete loop, using external services wherever practical?
> **Answer:** Keep the existing app as the command center and the deal record. Add **six thin pieces**. Use external services for sending email, texting and AI. Defer everything else in `PRODUCT_BASELINE_V2.md` until the pilot shows where the bottleneck is.

## The loop and what runs each step

| # | Loop step | Existing code (reuse) | New: smallest addition | External service |
|---|---|---|---|---|
| 1 | Find a focused group of sellers | DealMachine client, import jobs, dedupe, mapper, screening analyses, lead import script | A **saved search** that runs weekly, plus **contact enrichment** for the top N leads (skip trace is included in the owner's plan) | DealMachine |
| 2 | Eligible outreach | Leads, activities, tasks | **(a) Cold email:** push leads into a cold-email platform campaign; receive replies by webhook. **(b) Owner calls:** a daily call list in the app with `tel:` links and one-tap dispositions (no telephony build) | Cold-email platform (warm-up, sending, unsubscribe and bounce handling) [VERIFY vendor and price]; the owner's own phone |
| 3 | AI handles replies and qualification | Activity timeline | **Conversation inbox + AI responder.** Each inbound reply is stored, then Claude (with tools: read property, read analysis, read the knowledge doc) drafts the answer. **Mode 1:** the owner taps "send." **Mode 2,** after QA: auto-send for information and qualification messages. The AI asks permission before texting; once granted → Twilio SMS | Claude API; the email platform's reply API; Twilio (SMS only after consent) |
| 4 | Gather enough to analyze | Engine, analyses, DealMachine panel and comps | An **intake checklist** the AI fills from the conversation (condition, timeline, price, mortgage, occupancy, photos link), plus **engine defaults updated to the owner's verified lenders** | DealMachine comps |
| 5 | Bring the owner a proposed deal | Analysis panel, offers approval gate | A **Deal Brief**: one page plus an email/push alert. It shows the conversation summary, evidence with sources, the engine's routes and MAO, the risks, and a proposed opening offer and ceiling for owner approval | — |
| 6 | Track through signing and closing | Pipeline, offers, transactions table (unused) | **Fix the stage gate** (approval ≠ contract ≠ closing); a minimal **transaction record** (contract date, EMD, inspection, title, closing date, and the signed PDF upload); deadline reminders | — |

**Cross-cutting minimums (non-negotiable even in v0):**
- **Opt-out and suppression list.** One table, checked before every send.
- **No cold SMS, and no AI voice outbound.**
- **The owner approves before any binding offer.**
- **All numbers come from the engine.**
- **Kill switch** for AI auto-send.
- **Every AI message is logged** with what it was based on.

Two engine defects are fixed in v0 because they affect deal decisions:
- the cash-out override that erases risk reasons;
- the contract/closed gate.

## Hosting for v0
**Recommendation:** Vercel Pro (~$20/mo; Hobby is non-commercial) plus a managed Postgres free tier (e.g., Neon) [VERIFY current terms].
- Webhooks run as API routes.
- **Vercel Cron** runs a small job processor every few minutes: weekly searches, sending AI replies, reminders.
- **Oracle can wait until real-time voice is needed.**

## Explicitly deferred until the pilot shows a need
- The parties / contact-method / permission-event model (v0 uses existing contacts plus a suppression table and a simple text-consent record).
- Envelope negotiation by AI.
- AI voice and voice cloning.
- SMS campaigns.
- Capacity controller.
- Prioritization scoring beyond sorting.
- E-sign.
- Multi-user and SaaS.

## Pilot: 30 days, one list
- **List:** one focused list, e.g., 500–1,000 Wichita owners matching the buy box with stacked distress signals.
- **Measure, by week:**
  - emails delivered, bounced, unsubscribed;
  - replies and positive replies;
  - owner calls made and contacts reached;
  - leads qualified;
  - Deal Briefs produced;
  - offers presented, contracts signed, closings;
  - owner minutes per Deal Brief.
- **Decision at day 30:** the weakest step tells us what to build next. That might be:
  - volume → more lists or channels;
  - contact quality → data and verification;
  - conversation quality → AI tuning or voice;
  - pricing → underwriting;
  - financing → lender work;
  - follow-through → transaction automation.

## Owner decisions needed to start
1. Cold-email platform and a **separate sending domain** (e.g., `homebuyersict-offers.com`). The domain needs warm-up time before volume.
2. Hosting: **Vercel Pro + managed Postgres** (recommended) vs. continuing with Oracle.
3. AI price authority (Question 14).
4. AI replies: **approve each one at first, switching to auto-send after N good replies** (recommended), or auto-send from day one.

## Decision log
- **Nov 2, 2026, mailbox:** the app connects **directly** to `ian@homebuyersict.com` with its own Google sign-in (OAuth), stored server-side and never in code.
  - The app's built-in AI (provider is swappable: Claude or ChatGPT) reads, drafts and sends through the app's policy gate, approval mode and logs.
  - The coding assistants' own connectors stay on the TenanTurn / Franklin Homes accounts.
  - Cold outreach sends from a separate look-alike domain. Replies and negotiations move to `ian@homebuyersict.com`.
- **Nov 2, 2026, price authority:** **for now, the owner gives every number.** The AI gathers information and shows the owner the engine's MAO and a suggested offer, but it does not state prices to sellers. Once the owner has verified that the MAO is reliable on real deals, the AI may quote up to the MAO (owner-approved per deal).
- **Nov 2, 2026, mailbox confirmed by the owner:** the machine sends and receives as **ian@homebuyersict.com**, which the owner opens in **Gmail**. Not yet established: whether this is a Google Workspace account or a Gmail account set up to send as a custom domain. That determines how the app signs in. The next step is a test-inbox demonstration, with no live list and no purchases.
