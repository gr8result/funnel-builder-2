-- REVIEW PLAN ONLY. This file is intentionally non-destructive and contains no DROP statements.
-- Do not run as a rollback script.
--
-- Safe rollback sequence if the additive draft migration is approved and later needs reversal:
-- 1. Disable the new contact read/write path in the application and stop contact cutover jobs.
-- 2. Keep legacy module reads/writes active. Do not clear sessions, local storage, or legacy rows.
-- 3. Snapshot/export contacts, source/membership/consent rows, scheduled broadcast rows,
--    delivery attempts, SMS receipts and all populated contact_id values. Keep exports under
--    the builder's approved retention policy.
-- 4. Inspect these counts before authorizing any schema rollback:

select 'contacts' as table_name, count(*) as row_count from public.contacts
union all
select 'contact_sources', count(*) from public.contact_sources
union all
select 'contact_list_memberships', count(*) from public.contact_list_memberships
union all select 'contact_consent_events', count(*) from public.contact_consent_events
union all select 'email_broadcast_deliveries', count(*) from public.email_broadcast_deliveries
union all select 'email_broadcast_delivery_attempts', count(*) from public.email_broadcast_delivery_attempts
union all select 'sms_delivery_receipts', count(*) from public.sms_delivery_receipts;

-- 5. Review per-table linked-reference counts. Run only for tables confirmed to exist:
-- select 'leads' as table_name, count(*) filter (where contact_id is not null) as linked_rows from public.leads
-- union all select 'subscribers', count(*) filter (where contact_id is not null) from public.subscribers
-- union all select 'website_subscribers', count(*) filter (where contact_id is not null) from public.website_subscribers
-- union all select 'form_submissions', count(*) filter (where contact_id is not null) from public.form_submissions
-- union all select 'bookings', count(*) filter (where contact_id is not null) from public.bookings
-- union all select 'sms_sent_history', count(*) filter (where contact_id is not null) from public.sms_sent_history
-- union all select 'crm_tasks', count(*) filter (where contact_id is not null) from public.crm_tasks;
--
-- 6. A schema rollback that drops contact_id columns or new tables is NOT approved by this plan.
--    It would destroy provenance, consent evidence, memberships, or links created after cutover.
-- 7. Only after the application is reverted, exports are verified, all owners approve, and legal
--    retention requirements are checked may a separate reviewed script remove unused constraints,
--    policies, columns, and tables. Never remove the lead-row consent/opt-out columns
--    (leads.email_marketing_*, sms_marketing_*, sms_opt_out): they hold opt-out evidence the senders rely on.
--    To stop the projection only, drop trigger contact_consent_events_project_to_leads; the flags it set stay.
