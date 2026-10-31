# Email & SMS Marketing — recovery and status, 2026-10-15

> **Superseded in part (later on 2026-10-15).** A read-only production analysis corrected several assumptions below. Current state:
> - [backfill analysis](email-sms-backfill-analysis-2026-10-15.md)
> - [activation plan, DNS sheet, scheduler options and blockers](email-sms-activation-2026-10-15.md)
>
> Corrections:
> - `lib/smsglobal/legacyOptOut.mjs` was **removed**: production `leads` has no opt-out columns, so it could never work. STOP now goes through the durable `sms_inbound_events` inbox.
> - SendGrid lists `gr8result.com` as valid, but public DNS shows the DKIM records proxied and the return-path record missing.
> - Test suites are now 8: add `test-marketing-backfill` and `test-email-sms-e2e`; `test-smsglobal-legacy-opt-out` was removed.

Branch `fix/freedom-stage2-foundation`, HEAD `05962e5`. All Email/SMS work is uncommitted. Nothing was sent, applied, deployed or changed in DNS.

## What exists

| Area | Files | State |
|---|---|---|
| Persistent broadcast scheduler | `lib/email/persistentBroadcastScheduler.mjs`, `lib/email/scheduledBroadcastRepository.mjs` | Built, tested against the real draft SQL |
| Schedule / cancel / cron tick | `pages/api/email/schedule-broadcast.js`, `cancel-scheduled-broadcast.js`, `broadcast-scheduler-tick.js` | Built; fail closed until flags are set |
| Broadcast UI | `pages/modules/email/broadcast/index.js` (schedule submit), `view.js` (Scheduled badge, Cancel schedule, workspace-scoped list) | Wired |
| SMSGlobal receipts / STOP | `pages/api/smsglobal/secure-dlr.js`, `secure-inbound.js` (re-exported by `dlr.js`, `sms-inbound.js`), `lib/smsglobal/legacyOptOut.mjs` | Built; need `SMSGLOBAL_WEBHOOK_SECRET` |
| Schema | `supabase/review/central_contacts_migration_draft.sql` + `central_contacts_rollback_plan.sql` | Review draft, **not applied** |

## Changed in this session

- **One consent model.** The draft now includes the `leads.*_marketing_*` columns the existing senders already read (previously in a separate "superseded" proposal). A trigger projects each `contact_consent_events` row onto linked lead rows: deny by default, latest event wins, channels independent, and a later grant never clears a STOP (`sms_opt_out`).
- **STOP handling fixed.** Before: the new inbound handler returned 503 until the schema existed (STOPs lost), and afterwards wrote only consent events, which the SMS senders do not read. Now:
  - schema live → `record_sms_opt_out` RPC: consent events plus the workspace's lead rows (including leads not yet linked to a contact), atomically and idempotently;
  - schema not live → legacy behaviour, scoped to the single builder owning the inbound number; ambiguous numbers update nothing; failures return 503 so SMSGlobal retries.
- **Three draft defects fixed** (each would have failed the migration): `sms_inbound_numbers` was never created; duplicate auto-named `attempt_count` check constraint; attempts FK referenced `(workspace_id, id)` on deliveries with no unique key.
- Broadcast list scoped to the active workspace (plus legacy rows with no `workspace_id`); stray code removed from the broadcast form.

## Tests (all isolated, no network or live database)

| Script | Result |
|---|---|
| `scripts/test-persistent-broadcast-scheduler.mjs` | 9/9 pass |
| `scripts/test-smsglobal-webhook-security.mjs` | 5/5 pass |
| `scripts/test-central-contacts-migration.mjs` (new, PGlite, real scheduler + repository) | 8/8 sections pass |
| `scripts/test-smsglobal-legacy-opt-out.mjs` (new) | 3/3 pass |
| `test-marketing-consent`, `test-sms-sender-id`, `test-email-verified-sender` | pass |

Local dev server smoke test (no credentials): tick/schedule/cancel → 401; inbound/DLR → 503 "secret not configured"; tick with `CRON_SECRET` → 503 "disabled". Authenticated browser test of the schedule flow is not possible until the migration is applied, because the schedule API refuses without the schema.

## SendGrid domain authentication — cause found

`gr8result.com` DNS is on Cloudflare. `s1._domainkey` and `s2._domainkey` resolve to Cloudflare proxy IPs (`104.21.36.224`, `172.67.200.6`) instead of CNAMEs to SendGrid. The records are **Proxied (orange cloud)**, so receivers and SendGrid's verifier cannot see the DKIM keys.

Fix (needs approval, done in Cloudflare): set `s1._domainkey`, `s2._domainkey` and the SendGrid `em####` return-path CNAME to **DNS only**, then press Verify in SendGrid → Sender Authentication. SPF (`?all`) and DMARC (`p=none`) do not block this; tighten them after DKIM verifies.

## Vercel scheduler — proposal only (`vercel.json` not edited; shared file)

Every existing cron is daily, which suggests the Hobby plan. Hobby rejects crons that run more than once a day, and that rejection fails the deployment. Options:

1. **Pro plan:** add `{ "path": "/api/email/broadcast-scheduler-tick", "schedule": "*/5 * * * *" }`. Vercel sends `GET` with `Authorization: Bearer $CRON_SECRET`, which the tick already accepts.
2. **Stay on Hobby:** call the same URL every 5 minutes from Supabase `pg_cron` + `pg_net` or a GitHub Actions schedule, sending the same bearer header.

## Activation order (each step needs approval)

1. Fix Cloudflare DKIM records; verify domain in SendGrid.
2. Review and apply the migration to staging, then production; run the rollback plan's count queries first.
3. Backfill `contacts`, `contact_sources`, list memberships and consent evidence (separate reviewed plan; not drafted here). Map `telephony_numbers` → `sms_inbound_numbers`.
4. Set `SMSGLOBAL_WEBHOOK_SECRET` (and `SMSGLOBAL_WEBHOOK_QUERY_TOKEN_ENABLED=true` if SMSGlobal can only pass it as `?webhook_token=`), then update the callback URLs in SMSGlobal. **Do this before deploying this tree:** without it, inbound STOP replies return 503.
5. Set `MARKETING_CONTACTS_SCHEMA_READY=true`; test with `EMAIL_BROADCAST_SCHEDULER_ENABLED=true` + `EMAIL_BROADCAST_PROVIDER_MODE=mock` in staging.
6. Production sending: `EMAIL_BROADCAST_PROVIDER_MODE=sendgrid_live` and `EMAIL_BROADCAST_PRODUCTION_APPROVED=true`, plus the cron from the section above.

## Still open

- Contact backfill plan (step 3).
- SendGrid Event Webhook (bounces, spam reports → consent events) is not built.
- Re-subscribing someone after STOP needs a deliberate admin path; the trigger intentionally won't do it.
- The draft is not re-runnable: `add constraint` and `create policy` have no guards. Apply once, inside its transaction.
