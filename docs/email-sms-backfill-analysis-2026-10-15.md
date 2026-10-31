# Email & SMS — contact and workspace backfill analysis (read-only), 2026-10-15

**Source.** `scripts/analyze-marketing-backfill-readonly.mjs`, run against production on 2026-10-15. It made GET requests only and wrote nothing. The output held counts, column names and UUIDs, with no emails or phone numbers, and was kept outside the repository.

**SQL.** `supabase/review/central_contacts_backfill_draft.sql` (review draft, **not applied**). It runs after `central_contacts_migration_draft.sql`.

**Tests.**
- `scripts/test-marketing-backfill.mjs`: 10 sections, on a production-shaped isolated database.
- `scripts/test-email-sms-e2e.mjs`: 10 scenarios.

## 1. What production actually contains

| Table | Rows | `workspace_id` today | Can be assigned with certainty | Quarantined (reason) |
|---|---|---|---|---|
| leads | 36 | all 36 set | — | — |
| lead_lists | 7 | column does not exist yet | 5 | 2 (owner in 2 workspaces) |
| email_lists | 7 | column does not exist yet | 5 | 2 (owner in 2 workspaces) |
| subscribers | 3 | column does not exist yet | 0 | 2 (user has no workspace), 1 (owner in 2 workspaces) |
| form_submissions | 2 | column does not exist yet | 0 | 1 (no user), 1 (owner in 2 workspaces) |
| email_broadcasts | 10 | all NULL | 9 | 1 (owner in 2 workspaces) |
| email_sends | 229 | all NULL | 56 | 173 (owner in 2 workspaces) |
| sms_sent_history | 63 | all NULL | 54 | 9 (owner in 2 workspaces) |
| email_campaigns_queue | 27 | column does not exist yet | 6 | 21 (owner in 2 workspaces) |
| sms_queue | 0 | — | — | — |
| crm_tasks / crm_pipelines (CRM; not touched) | 40 / 6 | 30 / 0 set | — | reported only |

**Users.** 556 users have exactly one active workspace. One user, `35ab846e-0764-498b-b1f8-7d2cf27d85a5`, is active in two workspaces and owns nearly all of the ambiguous rows.

**Consent evidence.** There is none.
- Production `leads` has no consent or opt-out columns; it has only `unsubscribed_at`, and every value is NULL.
- No `email_sends` row is marked unsubscribed, spam-reported or bounced.
- `email_events` is empty.

**Never recorded.** STOP replies and SendGrid events have never been stored in production:
- The old STOP handler updated `leads.sms_opt_out`, `opted_out` and `mobile`, none of which exist.
- The old event webhook inserted columns `email_events` doesn't have, and it checked an HMAC signature, but SendGrid signs with ECDSA.

## 2. Schema facts that changed the drafts

| Finding | Effect | Fix |
|---|---|---|
| `contacts`, `sms_messages`, `telephony_numbers`, `gantt_contacts` and `sms_inbound_numbers` do not exist | No collision with the new tables, but no inbound-number→builder mapping exists anywhere | `sms_inbound_numbers` created by the migration and filled by hand (activation step C4) |
| `leads` has `phone` only (no `mobile`, `sms_opt_out`, `opted_out`) | `record_sms_opt_out`, `send-single` and `flush-queue` referenced missing columns | References removed; `sms_opt_out` added by the migration |
| `crm_tasks.contact_id` holds **lead** ids (35 of 40 rows) | A `contacts` foreign key would make those tasks fail on their next update | `crm_tasks` excluded from the foreign-key step (CRM owns the column) |
| `email_sends` has a `send_id` column | Clashed with a variable in the event function, so the function errored | Variable renamed; caught by the production-shaped test |
| `email_suppressions` exists (`user_id, email_lower, reason`; 0 rows) | Reused instead of adding a competing table | Workspace and evidence columns added |
| `lead_lists` and `email_lists` share all 7 ids | Memberships use `lead_lists`, as the broadcast UI does | — |

## 3. Backfill rules (deterministic)

1. **Ownership.** A legacy row gets a workspace only when its `user_id` has exactly one active membership, or when an operator records a decision in `marketing_backfill_owner_decisions` (with written evidence) and the user is a member of that workspace. Everything else goes to `marketing_backfill_quarantine` with a reason. A `workspace_id` that is already set is never overwritten; disagreements are quarantined.
2. **Contacts.** One contact per lead, linked both ways (`contact_sources`, `leads.contact_id`). There is no email or phone merging, because families and businesses share identifiers.
3. **Lists.** `leads.list_id` becomes a membership only if the list is in the lead's workspace. Memberships are created as **pending, with no lawful basis**.
4. **Consent.** **No grants are created.** Opt-out evidence is carried over:
   - `leads.unsubscribed_at` becomes an unsubscribe event;
   - `email_sends` unsubscribe, spam and bounce flags become events and workspace suppressions.

   Sources are tagged `backfill:`, so they can never count as a verified opt-in.
5. **Logging and rollback.** Every change is logged (`marketing_backfill_changes`, `marketing_backfill_created`). `marketing_backfill_rollback(run_id)` restores the exact prior values, cast to each column's real type. It refuses once backfilled contacts carry live history (non-backfill consent events, deliveries or provider events), because that history must be kept.

## 4. Validation (`marketing_backfill_validate(run_id)`; every row must pass)

- Every workspace-scoped lead has exactly one contact link, and `leads.contact_id` matches it.
- Contacts stay in their lead's workspace; memberships only link lists of the same workspace.
- The backfill granted no marketing permission.
- No existing `workspace_id` was overwritten.
- Every unassigned legacy row is in quarantine.
- An opt-out was carried over for every unsubscribed lead.

## 5. What the backfill means for sending

**After the backfill, no one is marketable by email or SMS**, because production holds no evidence of consent. Scheduled broadcasts will report "No list contacts currently have valid email marketing permission" until consent is recorded with a lawful basis (for example a web form that stores its evidence reference).

The legacy immediate-send paths (`send-broadcast`, autoresponders, automations, SMS queue) read the projected lead flags, so they stop too. That's intended. Approving how consent is collected is a decision for you (blocker B2 in the activation doc).

## 6. Legacy broadcasts without a workspace (task 2)

- 9 of 10 broadcasts are assigned deterministically. The tenth (owner in two workspaces) stays quarantined until an owner decision is recorded.
- **RLS:** the migration adds a RESTRICTIVE policy on `email_broadcasts`. A row is visible or editable only by its own user, inside a workspace that user is an active member of. Rows with a NULL workspace are invisible to everyone. Restrictive policies are ANDed with existing ones, so this can only narrow access.
- **Application changes:**
  - The broadcast list's legacy "NULL workspace" fallback is removed.
  - Edit, delete, resend and import are all workspace-scoped; resend has no fallback to the request's workspace.
  - `send-broadcast` refuses when the row isn't in the workspace.
  - `log-broadcast`, which took `userId` from the request body, is retired (410).
- **Tests:** another builder cannot view, edit, create into, schedule or cancel; the quarantined row is hidden even from its owner.

## 7. Operator procedure (staging first)

```sql
-- after the migration draft:
\i supabase/review/central_contacts_backfill_draft.sql
-- optional, only with written evidence:
insert into marketing_backfill_owner_decisions (user_id, table_name, workspace_id, decided_by, evidence)
values ('35ab846e-0764-498b-b1f8-7d2cf27d85a5', '*', '<workspace id>', '<name>', '<why this workspace owns the legacy marketing data>');
select marketing_backfill_run('<operator>', 'staging');
select * from marketing_backfill_validate('<run id>');           -- all passed = true
select table_name, reason, count(*) from marketing_backfill_quarantine where run_id = '<run id>' group by 1, 2;
-- if anything is wrong, before go-live:
select marketing_backfill_rollback('<run id>');
```
