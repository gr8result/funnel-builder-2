# Unauthenticated API Route Triage

**Read-only audit. No route file, Supabase file or environment file was changed.**

- Produced: 2026-09-04
- Repository: `E:/dev/funnel-builder-clean`
- Branch: `safety/pre-takeoff-cleanup-2026-09-01`
- HEAD at audit: `1cdab216d19a33782077826a6b2ab51cd91e039e`
- Plan-update commit: `4b8500835cfda25ff53bb461956361f88b5e303f`
- M1 implementation commit: `1cdab216d19a33782077826a6b2ab51cd91e039e`
- Precedes: M2 (enforcement adoption). No security wrapper has been applied.

## Protected pre-existing work — untouched

| Item | Count |
|---|---:|
| Staged entries (all deletions) | 25 |
| Unstaged changes | 207 |
| Untracked files | 1,033 |
| **Supabase working-tree changes** | **114** (62 untracked, 51 deleted, 1 modified) |
| **Deleted Supabase migrations** | **51** |

None of these were restored, staged, committed, edited or deleted. No Supabase file was read for
modification. This audit added exactly one file: this report.

---

## 1. Executive risk summary

### 1.1 A correction to the previously reported figures

The earlier count of "421 authenticated / 89 unauthenticated" was **too generous**. The detection
pattern used to produce it included `service_role` and `supabaseAdmin` — those indicate *privileged
database access that bypasses RLS*, which is close to the opposite of authentication.

Re-measured against genuine authentication signals only (`getUser`, `getSession`, `withAdmin`,
`withWorkspace`, `requireUser`, `requireAuth`, `Authorization`, `getServerSession`):

| Measure | Count |
|---|---:|
| Total API routes | 510 |
| Routes with a genuine authentication signal | **372** |
| Routes with **no** genuine authentication | **138** |
| — of those, with no auth reference of any kind (this report's primary scope) | 89 |
| — of those, previously miscounted as authenticated | 49 |
| Of the 49, using a service-role client with **no session and no signature check** | **34** |

So the exposed surface is **138 routes, not 89**. The 89 are classified in full in §2; the additional
49 are covered in §3.

### 1.2 The single most serious finding

**`/api/freedom/[resource]` — one unauthenticated endpoint exposing 36 database tables to full CRUD.**

- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE` (file lines 62, 93, 100, 118)
- Database client: `supabaseAdmin` from `lib/freedom-terminal/core` — **service role, bypasses RLS**
- Authentication: **none**
- Tables reachable via the `FREEDOM_TABLES` map (36): `markets, countries, sectors, industries,
  companies, company_import_jobs, company_competitors, company_products, revenue_segments,
  live_prices, historical_prices, financials, earnings, earnings_reports, analyst_estimates,
  valuation_models, valuation_methods, valuation_method_outputs, company_scores, freedom250,
  research_notes, ai_research_reports, committee_reviews, technical_analysis, news_articles,
  watchlists, watchlist_items, alerts, portfolios, portfolio, portfolio_holdings, transactions,
  cash_balance, performance_history, company_documents, background_jobs`

`portfolios`, `portfolio_holdings`, `transactions`, `cash_balance` and `performance_history` are
financial position records. Anyone who can reach the URL can read, modify or delete them.

### 1.3 Freedom is worse than previously reported

The earlier statement was "32 of 33 Freedom routes are unauthenticated". Measured against genuine
auth signals, the true figure is **33 of 33**. The one route previously counted as authenticated
matched only on `supabaseAdmin`. See §4.

### 1.4 What is already correct

Not everything unauthenticated is wrong. Verified as properly protected:

- **All 9 cron endpoints enforce `CRON_SECRET`** — checked, not merely referenced.
- **`/api/webhooks/sendgrid-events` verifies its HMAC signature** and returns `401` on failure
  (`verifySignature`, line 38; enforced line 82).
- **`/api/webhooks/facebook` verifies `hub.verify_token`** against `META_WEBHOOK_VERIFY_TOKEN`.

### 1.5 Risk tally across the 89

| Factor | Count |
|---|---:|
| Write or delete data with no authentication | **23** |
| Send email or SMS with no authentication | 12 |
| Use a service-role client | 30 |
| Accept a workspace / account / user id from the caller | 4 |
| Call a paid third-party API | 8 |
| Verify a signature or server secret | 12 |
| Tracked in git but absent from disk | 1 |

---

## 2. Complete 89-route classification

Legend — **Svc-role** ⚠ uses a service-role client (bypasses RLS) · **Caller ID** ⚠ accepts a
workspace/account/user id from the request · **Sends** ✉ sends email or SMS.

| # | Route | Methods | Writes | Svc-role | Caller ID | Sends | Classification | Entitlement | Risk |
|---:|---|---|---|:-:|:-:|:-:|---|---|---|
| 1 | `/api/affiliate/send-confirmation` | POST | – | – | – | ✉ | auth required | `affiliate_management` | high |
| 2 | `/api/automation/engine/kick` | POST | **update** | ⚠ | – | – | cron (server secret) | – | low |
| 3 | `/api/automation/engine/sendgrid-event` | POST | **update** | ⚠ | – | – | webhook (signature) | – | high |
| 4 | `/api/automation/engine/tick` | - | **upsert, insert, update** | ⚠ | – | – | cron (server secret) | – | low |
| 5 | `/api/automation/engine/trigger-scan` | POST | – | ⚠ | – | – | cron (server secret) | – | low |
| 6 | `/api/automation/flows/[id]/reset` | POST | **delete** | ⚠ | – | – | uncertain/manual review | – | medium |
| 7 | `/api/billing/get-prices` | GET | – | – | – | – | auth required | – | high |
| 8 | `/api/billing/modules` | POST | – | – | – | – | auth required | – | high |
| 9 | `/api/calendar/get-user-by-username` | GET | – | ⚠ | – | – | uncertain/manual review | – | medium |
| 10 | `/api/calendar/process-reminders` | - | **insert, update** | ⚠ | – | ✉ | cron (server secret) | – | low |
| 11 | `/api/calendar/reschedule-booking` | POST | **update** | ⚠ | – | – | uncertain/manual review | – | medium |
| 12 | `/api/calendar/send-reminders` | - | **update** | ⚠ | – | – | cron (server secret) | – | low |
| 13 | `/api/calendar/send-verify-code` | POST | – | – | – | – | uncertain/manual review | – | medium |
| 14 | `/api/contacts/[id]` | - | – | – | – | – | auth + entitlement | `leads` | high |
| 15 | `/api/crm/ai-analyze-lead` | POST | – | – | – | – | intentionally public | – | low |
| 16 | `/api/cron/automation-tick` | - | – | – | – | – | cron (server secret) | – | low |
| 17 | `/api/cron/process-campaign-queue` | - | – | – | – | – | cron (server secret) | – | low |
| 18 | `/api/email/automations/scheduler` | - | – | – | – | – | cron (server secret) | – | low |
| 19 | `/api/email/campaigns/worker` | - | – | – | – | – | cron (server secret) | – | low |
| 20 | `/api/email/process-autoresponder-queue` | - | – | – | – | – | uncertain/manual review | – | medium |
| 21 | `/api/email/process-campaign-queue-impl` | - | – | – | – | – | uncertain/manual review | – | medium |
| 22 | `/api/email/process-campaign-queue` | - | – | – | – | – | uncertain/manual review | – | medium |
| 23 | `/api/email/process-queue` | - | – | – | – | – | uncertain/manual review | – | medium |
| 24 | `/api/form-submit` | POST | **insert** | ⚠ | – | – | intentionally public | – | medium |
| 25 | `/api/forms/webhook` | - | – | – | – | – | uncertain/manual review | – | medium |
| 26 | `/api/founding-growth-partner/guide` | GET | – | – | – | – | uncertain/manual review | – | medium |
| 27 | `/api/founding-growth-partner/interest` | POST | **insert** | ⚠ | – | – | intentionally public | – | medium |
| 28 | `/api/freedom-investment/portfolio` | POST, GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 29 | `/api/freedom-investment/scanner` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 30 | `/api/freedom-investment/watchlist` | GET, POST | – | – | – | – | auth + entitlement | `freedom` | critical |
| 31 | `/api/freedom-portfolio/quote` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 32 | `/api/freedom-portfolio/watchlist` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 33 | `/api/freedom-trader/analysis` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 34 | `/api/freedom-trader/history` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 35 | `/api/freedom-trader/market-data-audit` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 36 | `/api/freedom-trader/notifications` | GET, PATCH, POST | – | – | – | – | auth + entitlement | `freedom` | critical |
| 37 | `/api/freedom-trader/stock-analysis` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 38 | `/api/freedom-trader/twelve-data-test` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 39 | `/api/freedom-trader/watchlist` | POST, PATCH, GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 40 | `/api/freedom/analyse-company` | POST | – | – | – | – | auth + entitlement | `freedom` | critical |
| 41 | `/api/freedom/committee` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 42 | `/api/freedom/history` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 43 | `/api/freedom/import-company` | GET, POST | – | – | – | – | auth + entitlement | `freedom` | critical |
| 44 | `/api/freedom/quotes` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 45 | `/api/freedom/test-finnhub` | - | – | – | – | – | auth + entitlement | `freedom` | critical |
| 46 | `/api/freedom/valuation` | GET | – | – | – | – | auth + entitlement | `freedom` | critical |
| 47 | `/api/hello` | - | – | – | – | – | uncertain/manual review | – | medium |
| 48 | `/api/lead` | POST | **insert** | – | – | – | intentionally public | – | medium |
| 49 | `/api/lead/submit` | POST | **upsert** | ⚠ | ⚠ | – | intentionally public | – | medium |
| 50 | `/api/lists/[id]` | - | – | – | – | – | auth + entitlement | `leads` | high |
| 51 | `/api/lists/intake/[listId]` | POST | **update, insert** | ⚠ | – | – | auth + entitlement | `leads` | high |
| 52 | `/api/marketplace-user-upsert` | POST | **insert** | – | – | – | uncertain/manual review | – | medium |
| 53 | `/api/marketplace-user` | POST | – | – | – | – | uncertain/manual review | – | medium |
| 54 | `/api/notify-signup` | POST | – | – | – | ✉ | uncertain/manual review | – | medium |
| 55 | `/api/ping` | - | – | – | – | – | uncertain/manual review | – | medium |
| 56 | `/api/product-library/approved-client-selection-catalogue` | GET | – | – | ⚠ | – | auth + entitlement | `product_library_read` | high |
| 57 | `/api/send-verification-email` | POST | – | – | – | ✉ | uncertain/manual review | – | medium |
| 58 | `/api/smsglobal/dlr` | GET | **insert, update** | ⚠ | – | – | webhook (signature) | – | high |
| 59 | `/api/smsglobal/sms-inbound` | GET | **insert, update** | ⚠ | – | – | webhook (signature) | – | high |
| 60 | `/api/social/cron/process-queue` | - | – | – | – | – | uncertain/manual review | – | medium |
| 61 | `/api/social/cron/process-schedule` | - | – | – | – | – | uncertain/manual review | – | medium |
| 62 | `/api/social/cron/refresh-tokens` | GET, POST | **update** | ⚠ | – | – | cron (server secret) | – | low |
| 63 | `/api/social/oauth/meta/callback` | - | **update, insert** | – | – | – | webhook (signature) | – | high |
| 64 | `/api/social/oauth/tiktok/callback` | - | **update, insert, upsert** | – | – | – | webhook (signature) | – | high |
| 65 | `/api/standard-inclusions/import-powerpoint` | POST | – | – | – | – | auth + entitlement | `standard_inclusions` | medium |
| 66 | `/api/standard-inclusions/onlyoffice/file` | GET | – | – | – | – | webhook (signature) | – | low |
| 67 | `/api/telephony/SmsComposer` | - | – | – | – | – | webhook (signature) | – | high |
| 68 | `/api/telephony/_twilio` | - | – | – | – | ✉ | webhook (signature) | – | high |
| 69 | `/api/telephony/sms-delivery-webhook` | - | – | – | – | – | webhook (signature) | – | high |
| 70 | `/api/templates/ping` | - | – | ⚠ | – | – | obsolete/delete candidate | – | medium |
| 71 | `/api/track/c` | - | – | – | – | – | intentionally public | – | low |
| 72 | `/api/track/convert` | POST | – | – | – | – | intentionally public | – | low |
| 73 | `/api/track/open` | - | – | – | – | – | intentionally public | – | low |
| 74 | `/api/track/render-thumbnail` | POST | – | – | – | – | intentionally public | – | low |
| 75 | `/api/twilio/callback-status` | POST | **update, insert** | ⚠ | ⚠ | ✉ | webhook (signature) | – | high |
| 76 | `/api/twilio/recording-callback` | POST | **update** | ⚠ | – | ✉ | webhook (signature) | – | high |
| 77 | `/api/twilio/recording-status` | - | **update, insert** | ⚠ | ⚠ | ✉ | webhook (signature) | – | high |
| 78 | `/api/twilio/voice-complete` | POST | – | – | – | ✉ | webhook (signature) | – | high |
| 79 | `/api/twilio/voice-inbound` | - | – | – | – | ✉ | webhook (signature) | – | high |
| 80 | `/api/webhooks/facebook-data-deletion` | GET, POST | – | – | – | – | webhook (signature) | – | high |
| 81 | `/api/webhooks/facebook` | GET, POST | – | – | – | – | webhook (signature) | – | low |
| 82 | `/api/webhooks/sendgrid-events` | POST | **update, insert** | ⚠ | – | ✉ | webhook (signature) | – | low |
| 83 | `/api/website-builder/emergency-page-draft` | - | – | – | – | – | auth + entitlement | `website_builder` | medium |
| 84 | `/api/website-builder/local-bus/[...path]` | - | – | – | – | – | auth + entitlement | `website_builder` | medium |
| 85 | `/api/website-builder/local-mail/[...path]` | - | – | – | – | – | auth + entitlement | `website_builder` | medium |
| 86 | `/api/website-builder/local-project-repair` | GET | – | – | – | – | auth + entitlement | `website_builder` | medium |
| 87 | `/api/website/contact-form-email` | POST | – | – | – | ✉ | intentionally public | – | low |
| 88 | `/api/website/lead-capture` | POST | **insert** | ⚠ | – | – | intentionally public | – | medium |

**Route 89 of 89:** `pages/api/affiliate/links,.js` — tracked in git but **deleted from disk** in the working tree (a filename containing a comma, from commit `76571f0`). No content to audit. **Classification: obsolete / delete candidate.** Confirm the deletion should be committed.

---

## 3. Cross-check findings from the other 421 routes

### 3.1 Service-role access with no authentication — 34 routes

These were previously counted as authenticated. They use a service-role or admin Supabase client
(bypassing RLS) with **no session check and no signature verification**. This is the largest
correction in this audit.

```
account/start-signup-phone-verification   marketplace-password-reset/confirm
affiliate/check-status                    marketplace-password-reset/request
affiliate/confirm-email                   marketplace/affiliate-access
affiliate/login                           marketplace/course-vendor-context
affiliate/status                          marketplace/vendor-digital-products
auth/send-2fa                             marketplace/vendor-physical-products
auth/verify-2fa                           standard-inclusions/onlyoffice/callback
calendar/public-page-data                 twilio/status-callback
email/automations/doctor                  website/track-visit
email/subscribe                           funnels/public-page
email/unsubscribe                         forms/submit
freedom-trader/alerts                     freedom-trader/paper-settings
freedom-trader/check-alerts               freedom-trader/positions
freedom-trader/paper-account              freedom-trader/setups
freedom-trader/paper-monitor              freedom/[resource]
freedom-trader/paper-orders               freedom/jobs/run
freedom/research                          freedom/score-history
```

Several are legitimately public and merely need their scope narrowed rather than a login
(`email/unsubscribe`, `forms/submit`, `calendar/public-page-data`, `funnels/public-page`,
`website/track-visit`). Others are not: `auth/send-2fa` and `auth/verify-2fa` are authentication
primitives; `marketplace-password-reset/*` are credential-reset flows; `affiliate/login` issues
access. Each needs individual review before M2.

### 3.2 Authentication without workspace scoping

`lib/withWorkspace.js` (132 lines) verifies workspace **membership only** — it contains no plan,
module or entitlement check. Every route wrapped in it therefore authenticates and scopes to a
workspace, but never asks whether that workspace *bought* the module.

### 3.3 Authentication without entitlement checks

**All 510 routes.** Zero consult a plan or module entitlement. This is the gap M1 built the resolver
to close and M2 will adopt.

### 3.4 Caller-supplied identifiers not verified

| Route | Accepts | Risk |
|---|---|---|
| `/api/lead/submit` | `workspace_id` | Writes a lead into a caller-named workspace |
| `/api/product-library/approved-client-selection-catalogue` | `organisationId`, `workspaceId` | Returns catalogue data for a caller-named org |
| `/api/twilio/callback-status` | `user_id` | Writes call records against a caller-named user |
| `/api/twilio/recording-status` | `user_id`, `account_id` | Writes call records against a caller-named account |

The Twilio pair are webhooks and should derive identity from a verified signature, never from the
request body.

### 3.5 Webhooks that authenticate a user instead of verifying a provider signature

None found doing the wrong thing. The problem is the reverse: most webhook-shaped routes verify
**nothing at all** — see §6.

### 3.6 Inconsistent protection across methods

`/api/freedom/[resource]` is the clearest case: a single handler serves `GET`, `POST`, `PUT`, `PATCH`
and `DELETE` with identical (absent) protection, so read and destructive access are equally open.
`/api/freedom-trader/alerts` behaves the same way across `GET|POST|PATCH|DELETE`.

---

## 4. Freedom security table — all 33 routes

**Genuine authentication: 0 of 33.** No Freedom route touches `accounts`, `profiles` or `workspaces`,
so there is no per-user or per-workspace isolation either. Every route below requires the `freedom`
entitlement once M5B lands.

| Route | Methods | Tables touched | Writes | Svc-role | Third party | Risk |
|---|---|---|---|:-:|---|---|
| `freedom/[resource]` | GET, POST, PUT, PATCH, DELETE | **36 tables via FREEDOM_TABLES** | insert, update, delete | ⚠ | – | **critical** |
| `freedom/jobs/run` | POST | background_jobs, watchlist_items, alerts | upsert, insert | ⚠ | – | critical |
| `freedom/score-history` | GET, POST, PUT | freedom_score_history, freedom_score_calibration | insert | ⚠ | – | high |
| `freedom/research` | GET, POST | freedom_research | upsert | ⚠ | – | high |
| `freedom-trader/paper-orders` | GET, POST, PATCH | freedom_trade_events, freedom_paper_positions, freedom_paper_orders, freedom_paper_accounts, freedom_paper_trades | insert, update | ⚠ | – | critical |
| `freedom-trader/paper-settings` | GET, POST | freedom_paper_orders, freedom_paper_trades, freedom_paper_positions, freedom_paper_accounts | **delete**, update | ⚠ | – | critical |
| `freedom-trader/positions` | GET, POST, PATCH | open_positions, closed_trades, pending_trades, trade_alerts | insert, update | ⚠ | – | critical |
| `freedom-trader/paper-account` | GET | freedom_paper_accounts, freedom_paper_positions, freedom_paper_orders, freedom_paper_trades | insert | ⚠ | – | high |
| `freedom-trader/paper-monitor` | POST | freedom_paper_orders | insert | ⚠ | – | high |
| `freedom-trader/alerts` | GET, POST, PATCH, DELETE | pending_trades, trade_alerts | insert, update, **delete** | ⚠ | – | critical |
| `freedom-trader/setups` | GET, POST | pending_trades | insert | ⚠ | **accepts caller id** | high |
| `freedom-trader/check-alerts` | POST | trade_alerts | update | ⚠ | – | high |
| `freedom-trader/scanner` | POST | – | **delete** | – | twelvedata.com | high |
| `freedom-trader/notifications` | GET, PATCH, POST | – | – | – | `FREEDOM_SMS_BEARER_TOKEN` | high |
| `freedom-trader/watchlist` | POST, PATCH | – | – | – | – | medium |
| `freedom-trader/analysis` | GET | – | – | – | – | medium |
| `freedom-trader/history` | GET | – | – | – | – | medium |
| `freedom-trader/stock-analysis` | GET | – | – | – | – | medium |
| `freedom-trader/market-data-audit` | GET | – | – | – | – | medium |
| `freedom-trader/alpaca-test` | GET | – | – | – | – | low — delete candidate |
| `freedom-trader/twelve-data-test` | GET | – | – | – | twelvedata.com | low — delete candidate |
| `freedom/quotes` | GET | – | – | – | finnhub.io (`FINNHUB_API_KEY`) | high — paid API |
| `freedom/history` | GET | – | – | – | query1.finance.yahoo.com | medium |
| `freedom/valuation` | GET | – | – | – | – | medium |
| `freedom/committee` | GET | – | – | – | – | medium |
| `freedom/analyse-company` | POST | – | – | – | – | high |
| `freedom/import-company` | GET, POST | – | – | – | – | high |
| `freedom/test-finnhub` | – | – | – | – | finnhub.io | low — delete candidate |
| `freedom-portfolio/quote` | GET | – | – | – | finnhub.io (`FINNHUB_API_KEY`) | high — paid API |
| `freedom-portfolio/watchlist` | GET | – | – | – | finnhub.io (`FINNHUB_API_KEY`) | high — paid API |
| `freedom-investment/portfolio` | GET, POST | – | – | – | – | high |
| `freedom-investment/scanner` | GET | – | – | – | – | medium |
| `freedom-investment/watchlist` | GET, POST | – | – | – | – | medium |

**Paid-API abuse exposure:** four unauthenticated routes call Finnhub or Twelve Data using
server-held API keys. Anyone can drive billable usage.

**Freedom code was not modified.**

---

## 5. Critical unauthenticated write routes

23 of the 89 write or delete data with no authentication. Ranked by consequence.

| Route | Writes | Tables | Why it matters |
|---|---|---|---|
| `/api/freedom/[resource]` | insert, update, delete | 36 tables | Full CRUD over the entire Freedom schema |
| `/api/automation/engine/tick` | upsert, insert, update | automation_flows, automation_flow_runs, leads, automation_email_queue, automation_email_sends | Drives the automation engine and can send email. **Cron secret enforced** — acceptable |
| `/api/automation/flows/[id]/reset` | **delete** | automation_flow_runs, automation_flow_members, automation_email_queue | Destroys flow history for any flow id. **No cron secret check found** |
| `/api/lists/intake/[listId]` | update, insert | list_api_keys, subscribers | Writes subscribers into any list id; uses an API-key table |
| `/api/lead/submit` | upsert | workspaces, leads | Writes into a **caller-supplied** `workspace_id` |
| `/api/marketplace-user-upsert` | insert | **users** | Creates user records unauthenticated |
| `/api/social/oauth/meta/callback` | update, insert | social_accounts, social_oauth_states | OAuth callback writing account tokens |
| `/api/social/oauth/tiktok/callback` | update, insert, upsert | social_accounts, social_oauth_states, social_oauth_tokens | As above, including token storage |
| `/api/twilio/callback-status` | update, insert | leads, crm_calls | Writes against a **caller-supplied** `user_id`; no signature check |
| `/api/twilio/recording-status` | update, insert | crm_calls | Writes against **caller-supplied** `user_id`/`account_id` |
| `/api/twilio/recording-callback` | update | crm_calls, leads | No Twilio signature validation |
| `/api/smsglobal/sms-inbound` | insert, update | telephony_numbers, leads, sms_messages | Inbound SMS writes leads; no signature |
| `/api/smsglobal/dlr` | insert, update | sms_delivery_receipts, sms_messages | Delivery receipts; no signature |
| `/api/webhooks/sendgrid-events` | update, insert | email_events, email_sends, email_campaigns_sends | **Signature verified** — acceptable |
| `/api/automation/engine/sendgrid-event` | update | email_sends, automation_flow_runs | Second SendGrid consumer, **no signature check** |
| `/api/calendar/process-reminders` | insert, update | bookings, email_sends | Sends mail via SendGrid. Cron secret present |
| `/api/calendar/send-reminders` | update | bookings, profiles | **Cron secret enforced** — acceptable |
| `/api/calendar/reschedule-booking` | update | bookings, services | Reschedules any booking; service role, no auth |
| `/api/social/cron/refresh-tokens` | update | social_accounts | **Cron secret enforced** — acceptable |
| `/api/form-submit` | insert | form_submissions | Public form intake — acceptable, needs rate limiting |
| `/api/lead` | insert | pages, leads | Public lead capture — acceptable, needs rate limiting |
| `/api/website/lead-capture` | insert | website_leads | Public lead capture — acceptable, needs rate limiting |
| `/api/founding-growth-partner/interest` | insert | founding_growth_partner_enquiries | Public enquiry form — acceptable, needs rate limiting |

**Highest priority for M2:** `freedom/[resource]`, `automation/flows/[id]/reset`,
`marketplace-user-upsert`, `lists/intake/[listId]`, `lead/submit`, and the four Twilio/SMSGlobal
webhooks.

---

## 6. Webhook and cron classification

### 6.1 Cron endpoints — all correctly protected

Each was checked for actual enforcement, not merely a reference to the variable.

| Route | Server secret enforced |
|---|:-:|
| `/api/cron/automation-tick` | yes |
| `/api/cron/process-campaign-queue` | yes |
| `/api/automation/engine/tick` | yes |
| `/api/automation/engine/kick` | yes |
| `/api/automation/engine/trigger-scan` | yes |
| `/api/calendar/send-reminders` | yes |
| `/api/calendar/process-reminders` | yes |
| `/api/email/campaigns/worker` | yes |
| `/api/email/automations/scheduler` | yes |
| `/api/social/cron/refresh-tokens` | yes |

**Recommendation:** keep as cron endpoints with no login. Confirm the shared secret is rotated and
held only by the scheduler.

### 6.2 Webhooks — provider signature verification

| Route | Provider | Verification | Action |
|---|---|---|---|
| `/api/webhooks/sendgrid-events` | SendGrid | HMAC verified, `401` on failure | None — correct |
| `/api/webhooks/facebook` | Meta | verify-token challenge checked | None — correct |
| `/api/automation/engine/sendgrid-event` | SendGrid | **none** | Add HMAC verification |
| `/api/twilio/callback-status` | Twilio | **none** | Add `validateRequest` |
| `/api/twilio/recording-callback` | Twilio | **none** | Add `validateRequest` |
| `/api/twilio/recording-status` | Twilio | **none** | Add `validateRequest` |
| `/api/twilio/voice-inbound` | Twilio | **none** | Add `validateRequest` |
| `/api/twilio/voice-complete` | Twilio | **none** | Add `validateRequest` |
| `/api/smsglobal/sms-inbound` | SMSGlobal | **none** | Add signature or IP allowlist |
| `/api/smsglobal/dlr` | SMSGlobal | **none** | Add signature or IP allowlist |
| `/api/social/oauth/meta/callback` | Meta OAuth | state table present | Verify `state` is consumed once |
| `/api/social/oauth/tiktok/callback` | TikTok OAuth | state table present | Verify `state` is consumed once |

---

## 7. Admin and affiliate findings

### 7.1 Admin

No `pages/api/admin/*` route appears in the 89 — all use the `withAdmin` HOC. Two notes:

- `/api/_debug-env` is wrapped in `withAdmin` and returns only a boolean plus a six-character prefix
  of a public builder key. Low risk, but it is a diagnostic endpoint that should not exist in
  production. **Recommend deletion.**
- `withAdmin` should be re-read during M2 to confirm it validates a role rather than merely a session.

### 7.2 Affiliate — commissions and payouts

| Route | Finding |
|---|---|
| `/api/affiliate/send-confirmation` | Sends email unauthenticated; no rate limit |
| `/api/affiliate/login` | Issues access using a service-role client, no session |
| `/api/affiliate/check-status`, `/status`, `/confirm-email` | Service-role reads, no auth |
| `pages/api/affiliate/links,.js` | Tracked but deleted from disk; filename contains a comma |

Commission and payout routes sit in the authenticated 372, but none checks entitlement. Given money is
involved, this group deserves review in the same batch as the unauthenticated affiliate routes.

---

## 8. Recommended M2 implementation batches, ordered by risk

| Batch | Scope | Routes | Rationale |
|---|---|---:|---|
| **M2.1** | Freedom lockdown | 33 | Highest severity. Authenticate all, then apply `freedom`. `freedom/[resource]` first |
| **M2.2** | Unauthenticated writes | 23 | Stops anonymous data mutation |
| **M2.3** | Webhook signatures | 10 | Twilio, SMSGlobal, second SendGrid consumer |
| **M2.4** | Service-role without session | 34 | The miscounted set from section 3.1; includes auth and password-reset primitives |
| **M2.5** | Caller-supplied identifiers | 4 | Derive identity server-side instead |
| **M2.6** | Entitlement adoption | ~372 | Apply the resolver to authenticated routes, module by module |
| **M2.7** | Delete obsolete | 5 | `_debug-env`, `alpaca-test`, `twelve-data-test`, `test-finnhub`, `affiliate/links,.js` |

M2.1 through M2.3 close active exposure and should not wait on the entitlement rollout.

---

## 9. Routes that must remain public

| Route(s) | Why | Condition |
|---|---|---|
| `/api/lead`, `/api/lead/submit`, `/api/form-submit`, `/api/forms/submit`, `/api/website/lead-capture`, `/api/founding-growth-partner/interest` | Lead capture from public marketing pages | Rate limiting; server-derived workspace, never caller-supplied |
| `/api/email/unsubscribe` | Legal requirement; must work from an email link | Signed token in the link |
| `/api/email/subscribe` | Public opt-in | Rate limiting and double opt-in |
| `/api/track/*` (4 routes) | Open and click tracking pixels | No personal data in responses |
| `/api/calendar/public-page-data`, `/api/calendar/get-user-by-username` | Public booking pages | Return only the fields needed to render |
| `/api/funnels/public-page`, public website reads | Published site rendering | Published content only |
| `/api/webhooks/*`, `/api/twilio/*`, `/api/smsglobal/*` | Provider callbacks | **Signature verification instead of login** |
| `/api/cron/*` and the engine ticks | Scheduler-invoked | Server secret — already enforced |

---

## 10. Routes requiring manual business decisions

| # | Question | Why it needs an owner decision |
|---|---|---|
| 1 | Is Freedom's data shared by design today? | 33 routes have no tenancy. Determines whether M5A backfills one workspace or many |
| 2 | `/api/marketplace-user-upsert` creates users unauthenticated — is this the intended signup path? | Determines public-with-verification versus authenticated |
| 3 | `/api/affiliate/login` issues access via service role | Needs a defined session model before it can be wrapped |
| 4 | `/api/marketplace-password-reset/*` | Credential reset flow; confirm the token model before changing |
| 5 | `/api/lists/intake/[listId]` uses `list_api_keys` | Is this a public intake API for customers? If so it needs documented key auth, not a login |
| 6 | `/api/standard-inclusions/onlyoffice/callback` | OnlyOffice document callback; confirm the expected verification |
| 7 | Delete `/api/_debug-env` and the four Freedom test endpoints? | Recommend yes |
| 8 | Commit the deletion of `pages/api/affiliate/links,.js`? | Tracked, absent from disk, comma in filename |
| 9 | Which routes may keep service-role access after M2? | Some legitimately need it; each should be justified |

---

## 11. Confirmation of no changes

- **No application file was changed.** No route file was edited, wrapped or moved.
- **No security wrapper was applied.** M2 has not begun.
- **The entitlement resolver was not altered.**
- **No Supabase file was restored, staged, committed, edited or deleted.** The 114 pre-existing
  Supabase changes and 51 deleted migrations are exactly as found.
- **No migration was applied.**
- **No environment file was opened.** No secret was read, printed or copied. Where this report names a
  variable it names only the identifier as it appears in source code, never a value.
- **No module file was moved.**
- **Nothing was pushed or deployed.**
- The 25 pre-existing staged entries remain staged and untouched.

### Method and limits

Classification is derived from static analysis of route source: HTTP method comparisons, `.from()`
table references, insert/update/upsert/delete calls, service-role client usage, request body and query
identifier reads, signature and secret checks, and outbound host names. Static analysis can miss
protection applied indirectly — through middleware, a wrapper imported under an alias, or a helper
that returns early. Every route marked **critical** in sections 4 and 5 was additionally opened and
read. Routes classified `uncertain/manual review` are those where the static signals were
insufficient; they should be read individually before M2 touches them.
