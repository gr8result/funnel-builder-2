# Email & SMS — activation plan, 2026-10-15

Nothing in this document has been applied. DNS, provider settings, environment variables, migrations and deployments all need your approval. Related: [backfill analysis](email-sms-backfill-analysis-2026-10-15.md), [recovery status](email-sms-recovery-2026-10-15.md).

## Local revalidation, 2026-10-16

- All eight isolated Email/SMS suites pass; the real-handler E2E suite passes 11 scenarios.
- `pages/api/automation/engine/sendgrid-event.js` now returns 410 and points to the signed `/api/webhooks/sendgrid-events` endpoint. The production change still requires an approved deployment.
- SMSGlobal inbound callbacks with invalid phone numbers now return 422 rather than acknowledging an unstored message. Storage errors remain non-OK so SMSGlobal can retry.
- Public DNS still returns Cloudflare proxy IPs for both DKIM names, and `em4245.gr8result.com` is still nonexistent. No DNS was changed.
- The local environment has no SendGrid webhook key or SMSGlobal webhook secret configured. It exposes one linked Supabase project but no staging-specific URL/key, so a suitable isolated staging database cannot be confirmed from this checkout.
- No migration, provider setting, DNS record, deployment, or live send was changed.

## 1. Cloudflare DNS changes for review (`gr8result.com`)

Taken from SendGrid's API (read-only, 2026-10-15) and public DNS (Cloudflare resolver 1.1.1.1).

| # | Type | Name | Target (exact) | Proxy status | Today | Change |
|---|---|---|---|---|---|---|
| 1 | CNAME | `em4245` | `u57013854.wl105.sendgrid.net` | **DNS only** | record missing | **Add** |
| 2 | CNAME | `s1._domainkey` | `s1.domainkey.u57013854.wl105.sendgrid.net` | **DNS only** | Proxied: resolves to Cloudflare proxy IPs `104.21.36.224` / `172.67.200.6` | Set to DNS only and confirm the target |
| 3 | CNAME | `s2._domainkey` | `s2.domainkey.u57013854.wl105.sendgrid.net` | **DNS only** | Proxied (same IPs) | Set to DNS only and confirm the target |

**Leave unchanged for now:**
- SPF (`v=spf1 … ?all`): SendGrid's SPF sits on `em4245`, the return-path domain.
- DMARC (`p=none`): add a `rua=` reporting address and move to `p=quarantine` after two weeks of aligned reports.

**After the change:**
1. `nslookup -type=CNAME s1._domainkey.gr8result.com 1.1.1.1` should return the SendGrid target. Repeat for `s2` and `em4245`.
2. In SendGrid, go to Settings → Sender Authentication → `gr8result.com` and click **Verify**.

**Two other authenticated domains in the same SendGrid account:**
- `waiteandsea.com.au` is correct (DNS-only CNAMEs). Use it as the working reference.
- `easywaybuildingbrokers.com.au` is SendGrid's **default** domain and is **invalid**: all three records are missing. Its DNS is not on Cloudflare (nameservers `ns1/ns2.premium.exchange`). Either add `em8289`, `s1._domainkey` and `s2._domainkey` there (targets as in rows 1–3), or make `gr8result.com` the default in SendGrid.

## 2. Provider configuration (needs approval)

| Item | Exact action |
|---|---|
| SendGrid event webhook | It already exists, is signed, and posts to `https://funnel-builder-2.vercel.app/api/webhooks/sendgrid-events`. Copy its **public key** (Mail Settings → Event Webhooks → Gr8 Webhook → Signature verification) into Vercel env `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY`. Remove the unused `SENDGRID_EVENT_WEBHOOK_SECRET`. Confirm `funnel-builder-2.vercel.app` is the production deployment. Enable the `group_unsubscribe` event. |
| SMSGlobal inbound and receipts | Set Vercel env `SMSGLOBAL_WEBHOOK_SECRET`. SMSGlobal callbacks are plain GET, so also set `SMSGLOBAL_WEBHOOK_QUERY_TOKEN_ENABLED=true`. Then set the incoming-SMS and DLR URLs in SMSGlobal to `…/api/smsglobal/sms-inbound?webhook_token=<secret>` and `…/api/smsglobal/dlr?webhook_token=<secret>`. |
| STOP reply numbers | Branded sender IDs cannot receive replies, so each builder that sends marketing SMS needs a **dedicated SMSGlobal virtual mobile number** that receives STOP. Insert one `sms_inbound_numbers` row per number (`workspace_id`, `phone_e164`). Until a builder has one, `flush-queue` refuses its marketing SMS. A number shared between builders can't be mapped (unique index); a STOP to it holds that phone in every workspace. |
| Scheduler secret | `CRON_SECRET` is already set locally; set the same value wherever the scheduler runs (section 3). |

**SMSGlobal retry behaviour.** SMSGlobal's documentation says the callback URL must return the body "OK" within five seconds, and that otherwise "the request will be marked as incomplete and the process will be repeated" ([HTTP API](https://www.smsglobal.com/us/http-api/)). No page gives the number of retries or the interval.

- **How the handler relies on that:** it stores the message in one atomic database call (`ingest_sms_inbound`) **before** answering "OK"; storage errors and invalid phone numbers return non-OK responses.
- **Recommended:** ask SMSGlobal support for the retry schedule. Optionally add a daily reconciliation that pulls inbound messages from SMSGlobal's REST API (not built; the API endpoint is unverified).

## 3. Scheduler options (`/api/email/broadcast-scheduler-tick`, every 5 minutes)

The tick is safe to call twice or concurrently: each delivery is claimed atomically and an expired claim becomes "unknown", never a resend. A missed tick only delays sending.

| Option | Configuration | Cost | Reliability |
|---|---|---|---|
| **A. Vercel Pro cron** (recommended if you move to Pro) | Add to `vercel.json` `crons`: `{ "path": "/api/email/broadcast-scheduler-tick", "schedule": "*/5 * * * *" }`. Vercel sends `GET` with `Authorization: Bearer $CRON_SECRET`, which the tick accepts. | Pro is $20 per team member per month ([Vercel Pro](https://examples.vercel.com/docs/accounts/plans/pro)). 8,640 invocations a month, each billed as normal function usage ($0.60 per million beyond the allowance, per [Vercel cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)): negligible. | Per-minute precision on Pro. On **Hobby, any cron more frequent than daily fails the deployment** ([same page](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Do not add this line while on Hobby. |
| **B. Supabase `pg_cron` + `pg_net`** | `select cron.schedule('email-broadcast-tick', '*/5 * * * *', $$ select net.http_get(url := 'https://<production-domain>/api/email/broadcast-scheduler-tick', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))) $$);` with the secret stored in Supabase Vault. | Included in the Supabase plan. | Runs inside the database. `pg_net` is fire-and-forget (no retry, but the next tick catches up). **Free-plan projects are paused after 7 days of low activity** ([Supabase](https://supabase.com/docs/guides/platform/free-project-pausing.md)); on a paid plan this does not apply. |
| **C. GitHub Actions schedule** | A workflow with `on: schedule: - cron: '*/5 * * * *'` running `curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://<production-domain>/api/email/broadcast-scheduler-tick`. | Free within Actions minutes. | GitHub states scheduled runs "can be delayed during periods of high loads… some queued jobs may be dropped" ([GitHub docs](https://docs.github.com/en/enterprise-cloud@latest/actions/monitoring-and-troubleshooting-workflows/troubleshooting-workflows/about-troubleshooting-workflows)). Delays of 5–30 minutes are commonly reported. Acceptable only as a stop-gap. |

Recommendation: **A** if the team moves to Pro; otherwise **B** on a paid Supabase plan. Use C only temporarily.

## 4. Activation checklist

### A. Development (this session)
- [x] Persistent scheduler, schedule/cancel APIs, cron tick (mock and live provider modes)
- [x] One consent model; provider-verified opt-in is the only way to lift an opt-out
- [x] Signed SendGrid event webhook with ledger, idempotency and suppression
- [x] Durable SMS inbox, STOP/START handling, send-time STOP guard, opt-out footer
- [x] Broadcast workspace isolation (RLS restrictive policy, application scoping, `log-broadcast` retired)
- [x] Backfill and rollback drafts; read-only production analysis
- [x] Isolated tests: 8 suites, all passing (see the recovery doc)
- [x] `pages/api/automation/engine/sendgrid-event.js` is retired locally (410); SendGrid must use the signed `/api/webhooks/sendgrid-events` endpoint. Production behavior changes only after an approved deployment.

### B. Staging migration (approval required)
1. Create or confirm a staging Supabase project with a copy of the production schema.
2. Apply `central_contacts_migration_draft.sql` once (it is not re-runnable), then `central_contacts_backfill_draft.sql`.
3. Run `marketing_backfill_run` and check `marketing_backfill_validate` (all must pass); review the quarantine.
4. Run `node scripts/analyze-marketing-backfill-readonly.mjs` against staging and compare counts with the backfill analysis.
5. Deploy the branch to a preview pointing at staging with `MARKETING_CONTACTS_SCHEMA_READY=true`, `EMAIL_BROADCAST_SCHEDULER_ENABLED=true` and `EMAIL_BROADCAST_PROVIDER_MODE=mock`. Then run the signed-in browser flow: schedule, cancel, view list and edit.

### C. DNS and provider configuration (approval required)
1. Cloudflare changes from section 1, then Verify in SendGrid.
2. `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY` in Vercel; remove `SENDGRID_EVENT_WEBHOOK_SECRET`.
3. `SMSGLOBAL_WEBHOOK_SECRET` + `SMSGLOBAL_WEBHOOK_QUERY_TOKEN_ENABLED=true`; update both SMSGlobal callback URLs.
4. Per-builder STOP reply numbers in SMSGlobal, plus `sms_inbound_numbers` rows.
5. Scheduler option from section 3.

### D. Approved test sending (approval required)
1. Using an internal test workspace and your own inboxes and phones only, record consent with evidence, then schedule a broadcast for 10 minutes ahead.
2. Set `EMAIL_BROADCAST_PROVIDER_MODE=sendgrid_live` and `EMAIL_BROADCAST_PRODUCTION_APPROVED=true` on the test deployment only.
3. Confirm delivery, then mark it as spam or unsubscribe. Check that `email_provider_events` and `email_suppressions` update and that the next broadcast skips that address.
4. Send a test SMS, reply STOP, and check that `sms_inbound_events` records it and the next queued SMS is refused. Reply START and check that sending is allowed again.

### E. Production deployment (approval required)
1. Apply the migration to production, then the backfill (with the owner decision if you choose), and validate.
2. Deploy with `MARKETING_CONTACTS_SCHEMA_READY=true`. Leave scheduler delivery disabled until step 3.
3. Enable `EMAIL_BROADCAST_SCHEDULER_ENABLED=true`, `EMAIL_BROADCAST_PROVIDER_MODE=sendgrid_live`, `EMAIL_BROADCAST_PRODUCTION_APPROVED=true`, and the cron.
4. Watch the first scheduled run: `email_broadcast_deliveries` should show no rows in `unknown`, and `sms_inbound_events` no `unmapped` STOPs.

## 5. Blockers and the exact action to clear each

| # | Blocker | Action required |
|---|---|---|
| B1 | User `35ab846e-0764-498b-b1f8-7d2cf27d85a5` belongs to two workspaces and owns 173 sends, 1 broadcast, 2 lists of each type, 9 SMS and 21 queued emails | Decide which workspace owns that legacy marketing data (or leave it quarantined), and record it in `marketing_backfill_owner_decisions` with evidence |
| B2 | Production has no consent evidence, so after activation no one is marketable | Decide how consent is (re)collected (a web form that stores evidence; legal review of any inferred-consent position under the Spam Act 2003) |
| B3 | No inbound number can receive STOP | Provision a dedicated SMSGlobal virtual number per sending builder; approve the `sms_inbound_numbers` rows |
| B4 | SendGrid DKIM is broken by the Cloudflare proxy; the return-path record is missing; the default domain is invalid | Approve the section 1 changes |
| B5 | Event webhook can't verify until the key is set | Approve setting `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY` |
| B6 | A five-minute Vercel cron is unsupported on Hobby; the deployment plan cannot be determined from this repository | Confirm the plan, then choose Vercel Pro or a paid Supabase cron |
| B7 | No staging-specific Supabase URL/key is configured locally; the one linked project cannot be classified as isolated staging | Confirm a suitable staging project in Supabase before applying drafts |
| B8 | SMSGlobal's retry count is undocumented | Ask SMSGlobal support for the inbound callback retry schedule |
| B9 | Production must run the locally retired legacy route and the provider must target the canonical route | Deploy with approval and confirm SendGrid targets `/api/webhooks/sendgrid-events` |
