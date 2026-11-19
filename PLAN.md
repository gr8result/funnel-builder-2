# AI Take-off: plan to a production-ready version 1

**Updated:** 19 November 2026, against `WORKFLOW.md` (the agreed job flow and its decisions D1–D7).

**Rules for this plan:**
- If a task here conflicts with `WORKFLOW.md`, stop and ask.
- Every task is sized for one session and has a "done when" line.
- Nothing merges to `main` until the owner has reviewed it and the tests pass.
- Every session ends with a commit and push of its own branch.
- Each module works only in its own worktree: Take-off in `E:\dev\gr8\takeoff`, Selections in `E:\dev\gr8\selections` and Quotation in `E:\dev\gr8\quotation`. `E:\dev\gr8\integration` is never edited by a session, and port 3000 is the owner's.

See `AUDIT.md` for the findings behind each task.

## Decisions

| Topic | Decision | Source |
|---|---|---|
| One job record | The take-off reads and writes the same job record as every other module (one `job_id`, status `lead → estimate → pre-contract → contracted → live`). It never keeps its own copy of a job. | WORKFLOW rule 1 |
| Company isolation | Every row of job data carries `workspace_id` (a workspace is a company), enforced by Supabase RLS. There is no separate `company_id`. | WORKFLOW rule 2, D7 |
| Job data in the browser | None. The only exception is a short-lived cache, separated by company and user, cleared on logout. | Owner, rule 5 |
| Plan files | A private Supabase Storage bucket, separated by company, with a per-company storage quota and automatic clean-up of temporary renders. Builder-owned cloud storage (Drive / OneDrive / Dropbox) is Later. | D1 |
| Roles | Admin, Estimator, Viewer and Client, mapped from today's eight roles as below (approved 19 November 2026, with builder = Admin). | D2 |
| Edit lock | One editor per job module at a time; others read-only. The lock expires after 15 minutes of no activity, with a heartbeat while active. An Admin can take over; the previous user's unsaved changes are saved as a draft, not lost. | D3 |
| Paid AI | In V1, off by default; only an Admin can enable it. A per-company monthly limit, configurable, stored in Supabase. The hourly limit is held in the database, not server memory. | Owner |
| AI cost | Tokens reported by the provider × a per-model price, stored in a settings table only GR8 super-admins can edit. Raw token counts are stored as well as cost. Every AI run is logged with company, user and cost. | D4, owner |
| Browser-only jobs | A button, not automatic. On first login after the update, list the jobs found in this browser with their company; the user uploads them one at a time; the local copy is kept until the server confirms the save. | D5 |
| Test plans | Only plans GR8 owns or has written permission to use (the owner owns Liberty, Jesmond and the other test plans). They are kept in private storage, never in the repo. | D6 |
| `/api/ai/plan-detect` | Removed completely. | Owner |
| Scanned plans | Skipped in V1, with a clear message to the builder. | Owner |
| Errors | Logged to a Supabase table in V1. | Owner |
| CI | GitHub Actions. | Owner |
| Commits | Take-off work is on `feature/ai-takeoff-v1`. The owner reviews before anything merges to `main`. | Owner |

### Roles: approved mapping (19 November 2026)

Today the code barely tells these roles apart. They are all in one list of roles that may use the commercial screens (`lib/commercialAccess.js`). Only owner and admin get extra rights (editing estimate formulas). The meanings below are what each role is for, based on its name and the WORKFLOW.

| Today's role | What it is for | Who would have it | Proposed take-off role |
|---|---|---|---|
| owner | The account holder: the building company's principal, who pays for the account | Company director or owner | **Admin** |
| admin | Runs the company's account: settings, users, approvals | Office manager, operations manager | **Admin** |
| builder_admin | The builder's lead person on jobs, with full job rights | Senior builder, construction manager | **Admin** |
| builder | A builder working jobs end to end: plans, estimates, selections approvals | Site or project builder | **Admin** |
| estimator | Measures plans and prepares estimates and quotes | Estimator, quantity surveyor | **Estimator** |
| builder_staff | Office staff who prepare documents and enter data | Contract administrator, office assistant | **Estimator** |
| interior_designer | Helps clients choose finishes in Selections; needs to see room sizes and quantities | In-house or contracted designer | **Viewer** |
| sales | Handles leads and presentations; needs to see estimates, does not edit them | Sales consultant | **Viewer** |
| (client portal user) | The homeowner: sees their own job's selections and documents only | Client | **Client** (no take-off access) |

---

## A. Secure the work and the workspace

- [x] **A1. Commit the current take-off work to `feature/ai-takeoff-v1` and push.**
  *Done:* `7bbedf6`, 39 take-off files.
- [x] **A0. Remove plan images from the branch.** *Done 19 November 2026:* history rewritten from `6d47a4c` onwards without `artifacts/takeoff-reference-corrections-20261116/`, the PLAN.md commit message fixed, `artifacts/` added to `.gitignore` (`3c3513a`), force-pushed.
  Original note: Earlier commit `6d47a4c` (17 November) added six PNG crops of the Jesmond drawing and a reference JSON taken from it, under `artifacts/takeoff-reference-corrections-20261116/`. They reached GitHub with the push of this branch on 19 November. Rewrite the branch history without them and force-push the feature branch, with the owner's approval. Add `artifacts/` plan outputs to `.gitignore` rules that stop it happening again.
  *Done when:* no commit on `feature/ai-takeoff-v1` contains drawing images or plan-derived files, and a check in CI fails if one is added.
- [ ] **A0b. Drive E: dropped out on 19 November.** The owner reconnected it, is checking its health and has copied the project folder; work stays on E:. Uncommitted Selections and Quotation work was pushed to `feature/client-selections-v1` and `feature/quotation-v1` (and three Standard Inclusions files to `wip/standard-inclusions-20261119`) so there is an off-drive copy.
  Original note: Disk errors were logged at 06:37 on 19 November, and files under `supabase/migrations` cannot be read ("the device is not ready"). Move work off E: (see the worktree proposal) and verify the repository against GitHub before any more work there.
  *Done when:* each module has a working copy on a healthy drive, `git fsck` is clean, and uncommitted work from E: is either committed or backed up and verified.
- [x] **A2. Production build of the branch.** *Done 20 November 2026:* `npm run build` passes (246 pages). The build had been failing since `c21178c` (12 November) because `builderMirrorRate` was imported but never committed; it is now on this branch, identical to the Selections branch's copy. Take-off suite 105/105; accuracy unchanged (Liberty 98.7/98.6/99.8, 32/33, 15/15; Jesmond lower 82.0/97.2/99.9, 19/21, 12/12; upper 93.8/91.7/94.8, 18/23, 8/9). Tests now read private reference data through `GR8_PRIVATE_TEST_DATA` (`scripts/lib/privateTestData.mjs`), so a worktree without `artifacts/` can run them.
  *Done when:* `npm run build` passes on `feature/ai-takeoff-v1`, with lint and types, off port 3000.
- [x] **A3. Browser acceptance on the branch.** *Done 20 November 2026,* from `E:\dev\gr8\takeoff` on the A2 build, with zero paid requests in every run:
  - Sunshine Cove fresh job: 103 walls, 31 openings, 3 floor areas, 20 rooms; identical after save and reopen; the quotation stays gated.
  - Sunshine Cove copy of the owner's saved job: re-measured (76 unapproved items replaced), Bedroom 4 picked from the list and approved, identical after save and reopen.
  - Liberty and Jesmond: full acceptance passed.

  Reports are kept outside the repo. The vector harness now reads its references through `GR8_PRIVATE_TEST_DATA`.

- [x] **A4. Separate working copies per module (git worktrees).** *Done 19 November 2026:* `E:\dev\gr8\integration` (`integration/v1`, from `main`), `E:\dev\gr8\takeoff`, `E:\dev\gr8\selections` and `E:\dev\gr8\quotation`, each with its own `.env` copies and its own `npm ci`.
  *Done when:* Take-off, Selections and Quotation sessions each work in their own folder on their own branch, and no two sessions share a checkout.

## B. One job record, job storage on the server, edit lock

- [ ] **B1. Take-off on the shared job record.** Tables for the take-off record and BOQ, keyed by `job_id` and the company id, tied to a plan revision, with RLS. They follow the platform's existing job and company tables rather than creating a take-off-only job. Includes the migration and RLS policies; nothing is applied to production without approval.
  *Done when:* the migration runs on a local Supabase, and a two-company RLS test shows neither company can read or write the other's take-off, BOQ or plan revisions.
- [ ] **B2. Plan files in a private bucket.** Plan PDFs and page images go in a company-separated private Supabase Storage bucket, with a per-company quota and automatic clean-up of temporary renders.
  *Done when:* uploads over quota are refused with a clear message, temporary renders older than the clean-up age are removed by a scheduled job, and company A cannot fetch company B's files.
- [ ] **B3. Save and open the take-off through the server.** The browser no longer writes job data to IndexedDB or localStorage.
  *Done when:* a take-off saved in browser A opens in browser B (a different profile) with its plan, and a browser storage inspection after saving shows no job data.
- [ ] **B4. Short-lived cache, scoped and cleared:** keyed by company and user, with an expiry, cleared on logout.
  *Done when:* after logout the cache is empty, and company B in the same browser never sees company A's cache.
- [ ] **B5. "Move jobs from this browser" button (D5).** On first login after the update, list the jobs found in this browser with their company. The user uploads them one at a time, and the local copy is kept until the server confirms the save. Then remove the old browser stores:
  - plan images;
  - recent take-off jobs;
  - recovery snapshots;
  - the legacy `estimate-builder-template-db` readers.

  *Done when:* an existing local job uploads intact (identical counts after reopening from the server), a failed upload keeps the local copy, and the old stores are no longer read or written afterwards.
- [ ] **B6. Edit lock per job module (D3).** The lock is held in the database (job, module, user, heartbeat, expiry). It expires after 15 minutes with no heartbeat. Others open the module read-only and see who holds it. An Admin can take over, and the previous holder's unsaved changes are saved as a draft. The server refuses saves without the lock.
  *Done when:* a two-browser test shows the read-only view, a refused save without the lock, a lock released after 15 minutes of inactivity, and an Admin takeover that leaves the previous user's changes as a recoverable draft.
- [ ] **B7. Read-only mode in the take-off screen:** every editing control is disabled without the lock or the right role.
  *Done when:* a browser test in read-only mode finds no enabled editing control and makes no write request.
- [ ] **B8. Plan revisions (WORKFLOW rule 4).** Each plan set has a revision (Rev A, B, C…). A new revision re-runs the take-off and shows what changed (quantities added, removed or changed), and flags the quote lines and selections that used changed quantities.
  *Done when:* uploading Rev B of a test plan shows a change list against Rev A, and the affected quote lines are flagged, not silently changed.

## C. Roles

- [ ] **C1. Role model:** Admin, Estimator, Viewer and Client per company member, stored in Supabase, with today's roles mapped as signed off above.
  *Done when:* each member resolves to exactly one of the four, and a migration test covers the mapping.
- [ ] **C2. Enforce roles on the server:**
  - **Viewer:** read only.
  - **Estimator:** can measure and save, but cannot approve or send to quote.
  - **Admin:** can do everything.
  - **Client:** has no take-off access.

  *Done when:* an API test per role gets 403 on every action the role may not do and success on the rest.
- [ ] **C3. Enforce roles in the screen:** Approve, Confirm & Lock, Send to Quote and Enable AI appear only for Admins; Viewers get the read-only screen.
  *Done when:* browser tests as Estimator and Viewer find no controls beyond their rights.

## D. Paid AI: controls, limits and logging

- [ ] **D1. Remove `/api/ai/plan-detect` completely.**
  *Done when:* the file is gone, the route returns 404, and nothing references it.
- [ ] **D2. AI off by default, Admin-only switch,** stored per company in Supabase; the server refuses paid requests when it is off.
  *Done when:* with the switch off a paid request gets 403, and only an Admin sees and changes the switch.
- [ ] **D3. Model price table (D4):** per-model input and output prices, editable only by GR8 super-admins.
  *Done when:* a builder Admin cannot read or change it through the API, and a super-admin can.
- [ ] **D4. AI run log:** one row per run with company, user, job, plan revision, pages, model, raw input and output tokens, cost (tokens × price at the time), status and time. Failed runs are logged too.
  *Done when:* each paid run writes one row with raw tokens and cost, a failed run writes a row marked failed, and tests check both.
- [ ] **D5. Limits from the database:** the per-company monthly limit (configurable by an Admin) and the hourly limit per user and company, both counted from the run log.
  *Done when:* a company over its monthly limit, or a user over the hourly limit, is refused before any provider call, and the limits hold across server restarts and instances.
- [ ] **D6. Route tied to the company:** the analysis route moves from `withAuth` to `withWorkspace`.
  *Done when:* a request without membership of the named company gets 403.
- [ ] **D7. Cost shown to the Admin:** an estimate before authorising, the actual cost after the run, and month-to-date use against the limit.
  *Done when:* the confirmation and the run summary show those figures from the price table and the log.

## E. BOQ → Quotation Builder (WORKFLOW section 3)

- [ ] **E1. BOQ line contract.** Each line carries `job_id`, `plan_revision`, trade, item, unit, quantity, room or area, source (measured / scaled / allowance) and confidence. Only approved quantities are included.
  *Done when:* a test builds the BOQ for a sample job and every line has all fields.
- [ ] **E2. Price book mapping.** Each BOQ line maps to a price book item or cost code; unmapped lines are flagged, never dropped. This is shared with the Quotation Builder, so coordinate with its session.
  *Done when:* sending a BOQ with an unmapped line shows it as flagged in the quote, and the line count in the quote equals the BOQ's.
- [ ] **E3. Re-send without duplicates:** re-sending after a plan revision updates matched lines and lists the differences.
  *Done when:* sending Rev A then Rev B of a test plan leaves one line per item, with a difference list.

## F. Scanned plans, errors, audit, CI

- [ ] **F1. Scanned sheets:** skipped, with a plain message saying what was skipped, why, and what to do.
  *Done when:* an image-only sheet shows the message on that sheet and in the run summary, and nothing is measured on it.
- [ ] **F2. Error log table in Supabase:** client and server errors with company, user, job, page and message; no plan images, tokens or keys; RLS by company.
  *Done when:* forced client and server errors each create one row, readable only by their company.
- [ ] **F3. Approval audit (WORKFLOW rule 3):** who approved, rejected or edited each room, wall sheet and opening, and when, kept on the server with the job.
  *Done when:* the Takeoff Schedule shows "approved by X on date" for each approved quantity, surviving save and reopen.
- [ ] **F4. GitHub Actions for the take-off suite:** the node test scripts on every push and pull request; no browser, no plans.
  *Done when:* a run passes on the branch, and a deliberately broken rule fails it.
- [ ] **F5. Private reference plans for accuracy checks:** stored privately and fetched by CI with a secret; the accuracy check fails below today's figures; a check fails if drawings appear in the repo.
  *Done when:* CI runs the accuracy check from private storage, and `git ls-files` contains no drawings or plan-derived files.

## G. Measurement accuracy

- [ ] **G1. Scale safety check:** compare the calibration with readable printed dimensions and the printed scale ratio; warn on a disagreement over 2%.
  *Done when:* a deliberately wrong calibration on a test plan is flagged before measuring.
- [ ] **G2. Parapets and walls over a lower roof** held for review on upper floors.
  *Done when:* Mountain Creek first floor is within ±2% of its printed area, and the reference figures are unchanged.
- [ ] **G3. Room labels crossed by door swings** read correctly (PWD and WC on Sunshine Cove).
  *Done when:* they are named, with no new false names on the reference plans.

## H. Builder UX

- [ ] **H1. Finish the room overview:**
  - small-room labels on hover;
  - next and previous room;
  - Admin-only "approve all clean rooms on this sheet".

  *Done when:* all 20 Sunshine Cove rooms can be reviewed from the list, in the browser.
- [ ] **H2. Measuring off the main thread** (web worker).
  *Done when:* no frame over 200 ms while measuring a 15-page plan.
- [ ] **H3. One "what needs doing" list** agreeing with the quotation gate.
  *Done when:* a test shows the list and the gate's blockers always match.

## I. Release

- [ ] **I1. Staging with two test companies,** each with Admin, Estimator, Viewer and Client users.
  *Done when:* each role can do exactly its permitted actions, the edit lock and Admin takeover work, and neither company sees the other's data or files.
- [ ] **I2. Builder guide and release notes.**
  *Done when:* a builder new to the tool reaches a quotation on a sample plan by following the guide.

---

## Proposal: one git worktree per module (for approval)

Today Take-off, Client Selections and Quotation sessions all edit one checkout on drive E:. Their uncommitted changes mix, a branch switch moves everyone, and E: is failing.

1. **Location: `E:\dev\gr8\`** (owner's decision: no space on C: or Google Drive; E: is backed up by the owner).
2. **One clone with worktrees.** Clone `funnel-builder-2` once to `E:\dev\gr8\integration` (the integration copy, on `recovery/live-snapshot-20261031` or its successor; no session edits it directly). Then add one worktree per module, each on its own branch:
   - `git worktree add E:\dev\gr8\takeoff feature/ai-takeoff-v1`
   - `git worktree add E:\dev\gr8\selections feature/client-selections-v1`
   - `git worktree add E:\dev\gr8\quotation feature/quotation-v1`
3. **Move the uncommitted work first.** The Selections and Quotation sessions commit their uncommitted files from E: to their own feature branches (or a verified backup is taken) before E: is retired. Only files each session owns go into its branch.
4. **Per-worktree setup.** Its own `npm install` (no shared `node_modules` junction: removing a worktree with a junction once deleted shared packages) and its own git-ignored `.env.local` copy. Its own dev server port: port 3000 stays the owner's; for example take-off 3101, selections 3102, quotation 3103. Run only one or two at a time, because of memory.
5. **Shared files.** Files several modules touch, such as `hooks/estimate-builder/useEstimateBuilderWorkbook.js`, `EstimateBuilderWorkbook.js` and Supabase migrations, change only through small pull requests into the integration branch, one module at a time, recorded in the shared-file register.
6. **Merging.** Each module branch merges to the integration branch by pull request after its tests pass, then to `main` after the owner's review.
7. **Each session is told its folder.** For example, "Take-off: work only in `E:\dev\gr8\takeoff`".

---

## Later (not in V1)

- Measuring scanned (image-only) plans.
- Merging simultaneous edits (V1 uses the edit lock).
- Plans linked from the builder's own Google Drive, OneDrive or Dropbox.
- Builder-hosted storage through the `lib/job-storage` job server.
- Server-side background processing for long paid runs.
- Automatic scale from outlined-text dimensions.
- Elevation and section reading (wall heights, roof pitch).
- Trade symbols beyond the current electrical points.
- Removing the raster pipeline and other unused geometry modules.
- Auto-updating the quote after a plan revision (V1 shows the changes only).
- Purchase orders and progress claims from the take-off and quote (live job stage).

---

## Open questions

All four earlier questions are answered (roles approved with builder = Admin; images removed; worktrees on E:; keep `workspace_id`).

1. Approve the plan for splitting the six non-take-off commits into their own pull requests, and the take-off branch being rebuilt on `main` with only take-off commits.
