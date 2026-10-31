# Landing Pages Release Readiness

## Campaign-quality continuation (24 October 2026)

- Pre-launch, sales, booking, download and subscription objectives are explicit interview options. Legacy pre-launch campaign names/prompts resolve to registration intent without rewriting their stored briefs.
- Generation now plans an audience-specific problem/solution/benefit strategy and image direction before writing copy. Supplied capabilities receive a dedicated explanation section and explicit availability labels; unconfirmed readiness is not represented as available.
- Generic first-screen language triggers one bounded copy revision. Generation reports remaining quality issues and image failures; publish checks surface actionable warnings.
- Hero layouts support editable cinematic full-bleed dark/light overlays, product/context compositions, split layouts and typography-led statements. Responsive compositions use the same renderer in the editor and public page.
- Quick and guided generation offer an explicit paid-image opt-in (one image per generation, only when no image is supplied). Replacement/regeneration remains explicit. Assets are uploaded to the existing workspace storage path, not left at expiring provider URLs. Generated illustrations carry a visible concept-image disclosure.
- Image model is configurable with `LANDING_PAGE_IMAGE_MODEL` (default `gpt-image-1.5`); copy model remains configurable with `LANDING_PAGE_AI_MODEL` (default `gpt-4.1-mini`). No automatic paid image retry is performed.
- Pre-launch forms default to name, email, business name, optional phone and registration/demo preference. The demo CTA preselects that preference. Existing submission JSON and the existing CRM note synchronisation retain the intent and campaign attribution; no database migration is needed. Consent covers the stated request only.
- Original campaign briefs, published documents and unrelated manual edits are not rewritten. Duplicate generation is rejected before provider calls; explicit regeneration retains version history and does not publish.
- Focused acceptance script: `scripts/test-landing-page-campaign-quality.mjs`. It uses the existing isolated PGlite Supabase emulator, real application routes, real browser rendering and CRM synchronisation. First run requires `LP_QUALITY_REAL_AI=1`; cached provider bytes are explicitly labelled as replays. An image-attempt ledger prevents unapproved repeat requests. `LP_QUALITY_KEEP=1` keeps only this local demonstration running.
- Acceptance screenshots, accepted document, provider evidence and CRM evidence are written under `artifacts/landing-pages-campaign-quality/`. These are local test assets, not a production campaign or deployment.

Provider verification and final acceptance results must be read from that run's evidence, not inferred from fixture tests. The first `gpt-image-1` request was rejected by the provider as an unavailable model; the user authorised one additional attempt using `gpt-image-1.5`. Neither fixture imagery nor a cached replay counts as a new real-provider success.

The approved `gpt-image-1.5` request succeeded, returning a 1536 x 1024 JPEG that was uploaded and fetched from isolated asset storage. Provider request ID and token usage are in `image-provider.json`; original returned bytes are retained as `real-provider-hero.jpg`. The image budget was two attempts total: one provider rejection and one successful generation. All subsequent visual iterations reuse those verified bytes without another image-provider call. A further concrete-value copy revision is recorded separately in `copy-quality-provider.json`.

Final focused validation: 29 model checks and 28 isolated API scenario groups passed. The separate GR8 browser acceptance passed at 1440 x 1000 and 390 x 844, including registration and demo submissions, CRM notes/attribution, image loading, manual non-hero editing, saving, reopening and isolated republishing. Manual image upload/replacement was also exercised through the real editor, saved and reopened; unrelated sections were compared, then the disclosed concept image was restored and republished. Results are in `results.json` and `crm-evidence.json`. The local demonstration is not a campaign saved into the production account.

The older full fixture-browser runner hit a cold compilation/navigation timeout before completing its first group; it is not reported as passing. The focused GR8 runner was made hydration-aware and verified the actual first-screen image and complete registration action rather than relying only on viewport size or screenshot entropy. Scoped lint passed with existing image/autofocus warnings; no production build or deployment was run.

## Status

The preserved campaign-first implementation was extended, not rebuilt. Development and isolated acceptance are complete for this continuation. This is **not a release approval**: the live migration, backup verification, authenticated intended-environment acceptance and successful production build remain gates.

Branch: `fix/freedom-stage2-foundation`. Recovery HEAD: `05962e578ff8e6f7151f3d7a81350b58ef2a248d`. No commit, push, merge, production migration or deployment was performed. Protected jobs were not opened or changed. The existing port 3000 server was not restarted. Tests started and stopped only their own isolated processes.

## Changes Since Recovery

- OpenAI calls expose request-scoped provider, actual model, response ID, finish outcome, token usage and duration, without credentials. Truncated, empty and invalid responses cannot be reported as successful generation.
- Configured editing now prefers OpenAI proposals; built-in editing remains the outage fallback. Negated instructions such as "do not change the images" no longer trigger image replacement.
- Generation and editing prompts favour factual, brief-specific copy and short hero headings rather than generic headings or unsupported claims.
- The existing browser script has an opt-in genuine provider mode, adaptive interview handling, preview/accept checks, non-hero preservation checks, save/refresh/reopen checks and provider/cost evidence. Historical recovery artifacts are preserved in place.
- Headless screenshots use software rendering, font/frame synchronization and a pixel-entropy gate. Earlier blank captures are retained as failed visual evidence, not passed off as design acceptance.
- Added one Vercel CRM retry schedule without replacing the seven existing schedules. Worker authentication uses a constant-time comparison, refuses absent/wrong secrets and unsupported methods, and disables caching.
- Added scheduled failure/recovery tests across two tenants sharing an email address, including repeated worker invocations and checks against duplicate CRM leads and notes.
- Sales Funnels now offers the new AI campaign page experience first, including an entry on its creation screen. Existing multi-step wizard, GrapesJS templates, editor URLs and published `/p/<slug>` URLs remain unchanged.

## Files Edited

- `lib/landing-pages/ai.js`
- `lib/landing-pages/aiEdit.js`
- `pages/api/landing-pages/campaigns/[id].js`
- `pages/api/landing-pages/pages/[id].js`
- `pages/api/landing-pages/cron-sync.js`
- `scripts/test-landing-page-model.mjs`
- `scripts/test-landing-page-api.mjs`
- `scripts/test-landing-page-browser.mjs`
- `pages/modules/funnels/index.js` (shared)
- `pages/modules/funnels/new.js` (shared)
- `vercel.json` (shared)
- This document; generated evidence is under `artifacts/landing-pages-e2e/`.

The migration was reviewed and tested but not edited or applied. Existing shared changes in navigation, Leads, layout, application initialization, packages and Next configuration were preserved.

## Shared-File Coordination

The supplied `GR8_Result_Master_Platform_Integration_Register.xlsx` was inspected read-only. Its Landing Pages entry is unassigned; it does not identify a file-level owner for the funnel screens or Vercel configuration. This continuation used the user's explicit authorization for these exact integrations. Both funnel files were clean immediately before editing, and Vercel configuration was clean before the schedule addition. No competing change to these three files was observed.

No acknowledgement from a separate funnel or deployment owner is claimed. Their integration review remains required before committing or deployment. The supplied register was not overwritten, and this document is not a replacement coordination register or lock.

## Genuine OpenAI Evidence

Campaign: **Build Your Dream Home in 2027**. Business: **Example Residential Builders**. Audience: **Residential homebuilding customers in South East Queensland**. Offer: **Free initial building consultation**. Other fictional test inputs include contact details, homebuilding services, strengths and an existing local home photograph. No testimonials or licence credentials were supplied or invented.

Final evidence directory:

`artifacts/landing-pages-e2e/real-ai-2026-10-15T19-12-23-412Z/`

- `results.json`: 13/13 browser groups covering all 18 acceptance requirements.
- `provider-evidence.json`: six successful OpenAI requests, including interview extraction, page generation and hero editing; model `gpt-4o-mini-2024-07-18`; no provider fallback in the final run.
- `accepted-document.json`: the saved document after AI acceptance and reopening.
- `02-editor-generated.png`: generated page in the editor.
- `03-ai-proposal.png`: proposed hero edit before acceptance.
- `04-editor-desktop.png`, `04-editor-mobile.png`: accepted editor views.
- `05-public-desktop.png`, `06-public-mobile.png`: complete published-page screenshots.
- `05-public-desktop-viewport.png`, `06-public-mobile-viewport.png`: inspectable first-viewport crops.
- `07-enquiry-thank-you.png`, `08-campaign-enquiries.png`, `09-crm-lead.png`: isolated submission and CRM evidence.

Final usage: 3,683 input tokens and 1,235 output tokens. Estimated final-run cost: **USD 0.00129345**. All six real-AI attempts together: approximately **USD 0.00638430**. Estimate basis: USD 0.15 input / USD 0.60 output per million `gpt-4o-mini` tokens, excluding cache discounts; this is not an invoice or independently verified current account billing.

Earlier attempts exposed an adaptive-interview test assumption, the negated-image intent bug, blank headless captures and a case-sensitive upload filename assertion. These artifacts remain available in earlier timestamped directories. The final run has no provider errors or fallback. An existing `BrowserDialer.js` error remains in the isolated Leads setup without Twilio; it is explicitly excluded from Landing Pages errors, not claimed fixed or verified live.

### Visual Review

Compared with the supplied `premium-builder-platform-landing-page.zip` source reference: the result preserves Plus Jakarta Sans typography, strong headline hierarchy, restrained section rhythm and warm accent calls to action. Real home photography replaces the reference's SaaS dashboard illustration. The reference's decorative blobs and its software-specific composition were not reproduced. The accepted hero is "Custom Homes for South East Queensland"; the offer and year sit in supporting copy.

Desktop/mobile screenshots were inspected, not just DOM assertions. The test also checks loaded images, working section links, no mobile horizontal overflow and a minimum readable body-text size. The existing design system remains in use; no model upgrade was needed after prompt improvements. Brand styling and image choice remain editable by the builder.

## Automatic CRM Recovery

Schedule: `30 2 * * *` UTC at `/api/landing-pages/cron-sync`. This daily schedule is compatible with Vercel Hobby as well as paid plans. Hobby may invoke within the scheduled hour, so this is **not a five-minute recovery SLA**: a transient failure can wait roughly a day. Source: https://vercel.com/docs/cron-jobs/usage-and-pricing.

For production low-latency recovery, the deployment owner should verify Pro/Enterprise and approve changing only this schedule to `*/5 * * * *`, or configure an approved external authenticated scheduler. The current plan has not been verified. No paid-plan upgrade or external scheduler was provisioned.

The scheduled worker requires `Authorization: Bearer <CRON_SECRET>` and a nonempty server-side secret. The local secret is configured, but production configuration is unverified. Never put it in client code or screenshots. Fifty pending submissions are processed per invocation; the existing ten-attempt cap remains. Persistent failures beyond that cap remain durably visible for operator investigation. Daily batch capacity and exhausted-attempt alerts must be reviewed against the actual production enquiry volume.

Isolated tests prove that an unavailable CRM does not lose the submission, unauthenticated calls cannot drain it, later authenticated worker execution recovers it without a Retry click, matching is workspace-bound, and a repeated execution creates no additional lead or enquiry note. Actual Vercel delivery, real-database concurrency and production logs are still deployment acceptance gates.

## Migration Review

Migration: `supabase/migrations/20261014000100_landing_page_campaigns.sql`.

- Additive to the existing platform: creates six Landing Pages tables and new `lp_*` helpers, indexes, triggers and policies. It does not rewrite or delete existing CRM/customer rows on application. Re-running replaces the module's own functions, triggers and policies.
- Workspace foreign keys bind campaigns/pages/versions/submissions to their tenant. RLS requires active workspace membership for campaign/page management and read access to module history, events, submissions and audit records. Anonymous direct table access is not granted by these policies.
- Clients cannot directly insert submissions or invoke `lp_sync_submission`; sync execution is revoked from public, anonymous and authenticated roles and granted to service role. Server routes perform workspace membership checks.
- CRM synchronization is a security-definer function with a fixed search path. It locks the submission and a workspace/email advisory key, preserving idempotency and serializing contact matching. Existing nonblank names, phone numbers and source are retained; campaign tags and enquiry notes are appended.
- Existing `leads` and `lead_notes` are reused; no second contact database is introduced. Invalid submissions are recorded or refused honestly rather than reporting a lost enquiry as successful.
- Isolated tests apply the migration twice and exercise tenant-bound foreign keys, RLS, function permissions, email matching, preservation of existing customer fields and duplicate protection.

Read-only schema probes on the configured host `bvtxfphktypdqmlnveqf.supabase.co` returned HTTP 200 for the referenced workspace, membership, lead and lead-note columns. All six module tables still return `PGRST205`. Migration history is not exposed through REST. The configured project is **not yet the user-approved production target**, and a recoverable backup has **not** been verified.

The database owner must additionally confirm actual SQL types, constraints, service-role table privileges, `auth.uid()`, `gen_random_uuid()`, advisory-lock support and module-name collisions using direct SQL/catalog inspection. REST column checks and minimal PGlite CRM fixtures do not certify all production constraints or existing triggers.

### Execution Plan: Approval Required

1. Confirm the project reference, environment, database host and organization with the owner. Record a target fingerprint without credentials. Confirm module tables and helper names do not belong to an independently deployed version.
2. Verify a current database backup/PITR recovery point, retention and access. Restore it to an isolated database and demonstrate recovery, including CRM tables. Record the recovery point and responsible operator; backup existence alone is insufficient.
3. Inspect dependency types/constraints and existing CRM triggers directly. Capture baseline row counts and selected test-workspace CRM snapshots. Verify service-role grants and anonymous/authenticated permissions.
4. Obtain explicit written approval identifying this migration, exact database target and verified recovery point. Review shared funnel/config changes with the integration owner. No step here authorizes production execution.
5. Apply the unchanged migration with the approved migration runner in a transaction where supported. Record its checksum and migration version in the authoritative history; do not emulate completion by creating arbitrary history entries. Refresh/verify PostgREST schema visibility and permissions.
6. Before exposing creation links in production, execute authenticated acceptance in a dedicated approved test workspace: owner/member access, other-tenant denial, genuine generation/edit/save/reopen, public publishing, consent/attribution, CRM existing-contact matching, concurrent duplicate requests, scheduled failure/recovery, republish and unpublish. Use fictional records only and retain an approved cleanup plan.
7. Confirm production `OPENAI_API_KEY`, optional model setting, `LANDING_PAGE_FORM_SECRET`, `CRON_SECRET`, Supabase service-role credentials and public base URL server-side. Check function duration budgets against provider latency. Confirm the Vercel plan and recovery schedule. Re-run a successful full production build before approved deployment.

### Rollback and Recovery Plan

- If application fails within the migration transaction, roll back that transaction and verify the existing schema/CRM baseline. Do not continue a partially applied migration silently.
- Before any module data exists, the DBA may approve a dependency-reviewed reversal of only the new module objects, in reverse dependency order. Never use a broad `CASCADE` or drop shared workspace/CRM objects. Reconcile migration history through the approved runner.
- After any real enquiry exists, use an application rollback/disablement or forward fix first. Stop only the new worker schedule through the deployment owner, retain submissions and versions, and preserve the public URL/data recovery plan. Do not drop module tables or delete CRM leads/notes to "undo" migration.
- CRM sync can enrich pre-existing contacts; blindly deleting matching contacts or stripping tags would corrupt customer data. Any restoration must use reviewed snapshots/backups and account for legitimate changes made after the recovery point.
- Full database restoration requires a separate explicit approval, tested restore procedure and reconciliation of later customer activity. The application backup is not a substitute for a database backup.

## Validation and Production Build

| Check | Result |
| --- | --- |
| Model/provider/funnel contracts | PASS: 16 checks |
| API, scheduled recovery and CRM | PASS: 19 scenarios |
| Migration and RLS | PASS: all isolated checks |
| Genuine OpenAI browser acceptance | PASS: 13 groups covering 18 requirements |
| Fallback browser regression | PASS: 13 groups covering 18 requirements |
| Focused module + shared funnel lint | PASS: zero errors, seven pre-existing image/link warnings |
| Editor diagnostics for changed code | No errors reported |
| Full production build | BLOCKED: worker heap exhaustion around 4 GB; exit 134 |
| Intended-environment authenticated acceptance | BLOCKED: live schema unavailable and approval pending |

Production build command: `node node_modules/next/dist/bin/next build`, with `NEXT_DIST_DIR=.next-landing-pages-production-audit`. No clean/reset operation, active-server restart or shared Next/package configuration edit was used. The build emitted repository-wide existing warnings, then exhausted its default heap. Only 5.8 GB of physical RAM was free among active sessions; raising the heap was not safe. This does not establish that all remaining compilation/type/tracing gates would pass on a larger runner.

Use a dedicated sufficiently provisioned build runner, then identify any further failures by owning module. Do not mark the release successful from the isolated browser test or bypass lint/type checks to manufacture a green build.

## Exact Next Deployment Action

The next production action is **owner verification of the intended Supabase target and a demonstrated recoverable backup, followed by explicit migration approval**. In parallel, the integration owner can acknowledge the narrow shared-file diff, confirm cron cadence/plan and arrange a sufficiently provisioned build runner. Only after a successful build, approved migration and authenticated intended-environment acceptance should a separate deployment approval be requested.

## 24 October 2026 — Approved-design finishing check

The approved isolated GR8 Result candidate was not redesigned. Image sources, alt descriptions, section order, variants, theme, marketing text, buttons and forms were preserved. Browser acceptance confirms that its stored document is identical before and after the finishing save/reopen/assistant/republish round-trip.

### Caption behaviour

- New AI images carry internal `provenance: { kind: "ai-illustration", evidence: false }`, not an automatically visible disclaimer.
- The shared renderer suppresses legacy automatic decorative-image disclaimer text in the hero, feature cards, comparison imagery, image banners and enquiry imagery.
- Optional public editorial captions use `image.caption`. Existing meaningful editorial captions, including the actual-editor identification, remain supported.
- Provenance, alt text and optional captions survive manual image selection, campaign-media reuse, interview sanitisation, save/reopen and document composition. The AI copy/edit instructions continue to prohibit using illustrations as customer/project/product evidence.

### Final acceptance

| Requirement | Result |
| --- | --- |
| Caption removal | PASS: zero automatic image captions at desktop, tablet and mobile |
| Approved design preserved | PASS: approved document unchanged; caption rendering only |
| Responsive rendering | PASS: 1440x1000, 820x1180 and 390x844; all 12 images load; no horizontal overflow; first-screen registration CTA visible |
| Registration and demonstration CRM | PASS in isolated workspace: distinct intent, consent, campaign attribution, synced lead and CRM note |
| Editing/save/reopen/republish | PASS through actual editor, including accepted conversational-edit proposal followed by restoration of the approved headline |
| Other-business generation | PASS: separate fictional Paperbark Creative design-studio campaign, genuine provider proofreading/strategy/copy, relevant existing creative imagery, warm serif/red-brown presentation and no construction copy |
| Brief preservation/proofreading | PASS: public copy corrects "Website desgin" to "Website design"; original stored campaign brief retains the supplied wording |
| Focused regressions | PASS: 31 model checks and 28 API scenario groups; focused generator lint passes; JSX-inclusive lint reports zero errors and four existing native-image optimisation warnings |
| Production configuration/schema/permissions | PASS: read-only readiness command returned `ready: true`, with no failures |
| Overall production deployment readiness | FAIL / release blocked: no successful full production build verified; previous full build exhausted its heap. Only approximately 0.8 GB of free physical memory was available during this finishing check, so another full build was not safe on the shared machine. Intended-environment authenticated acceptance and owner target/backup verification remain unverified |

The earlier schema-unavailable result in this document is historical: the latest read-only configuration/schema/permission probe passes. This does not certify a production build, production form delivery, actual production tenant constraints or deployment approval. No migration, production campaign/customer write, deployment or process termination was performed.

No image-provider request was made for the finishing check. The design-studio check made three bounded real text-provider calls (proofreading, strategy and copy); later retries reused the recorded provider output. Its initial fixture run correctly refused generation without contact information; adding a synthetic fixture contact repaired that setup and the complete browser acceptance then passed.

Evidence is under `artifacts/landing-pages-campaign-quality/`: `visual-acceptance.json`, `visual-crm-evidence.json`, `visual-candidate-document.json`, final `visual-desktop*.png` and `visual-mobile*.png`, `new-business-acceptance.json`, `new-business-provider.json` and `new-business-*.png`. Both demonstration pages are local and isolated; none of these tests prove that the production environment works.