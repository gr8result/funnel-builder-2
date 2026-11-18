# AI Take-off: plan to a production-ready version 1

**Ordering:** safety first, then data separation, then cost, then accuracy and UX, then release. Each task is sized for one session and has a "done when" line. See `AUDIT.md` for the reasons behind each task. This plan is a draft until the questions at the end are answered.

## A. Secure the work that exists

- [ ] **A1. Commit the current take-off work on a feature branch.** Review the 110+ uncommitted take-off files, split them into logical commits (engine rules, room-schedule rules, UI overview and re-measure, relink fix, test harnesses) and leave other modules' files alone.
  *Done when:* `git status` shows no uncommitted take-off files, the branch is pushed only after your approval, and the 105-script suite passes on the committed tree.
- [ ] **A2. Production build of the committed tree.**
  *Done when:* `npm run build` passes, with lint and types, run off port 3000.
- [ ] **A3. Re-prove the browser acceptance on the current build:**
  - Sunshine Cove fresh job;
  - Sunshine Cove job copy;
  - Liberty;
  - Jesmond.

  *Done when:* all four pass with zero paid requests, and the report files are saved.

## B. Data separation between companies

- [ ] **B1. Scope the take-off's browser stores by workspace:**
  - plan images (`gr8-takeoff-plan-assets-v1`);
  - recent take-off jobs;
  - recovery snapshots.

  Use `browserTenantKey`. Read each legacy unscoped store once, only for jobs whose `workspaceId` matches the signed-in workspace.
  *Done when:* a test with two workspaces in one browser profile shows neither can list or open the other's take-off, plan images or recovery copies.
- [ ] **B2. Stop listing jobs from the legacy unscoped `estimate-builder-template-db`** in `jobPersistence.js` (listing, recovery and backup functions), or filter them by workspace.
  *Done when:* the same two-workspace test covers the recovery and backup screens.
- [ ] **B3. Put the take-off analysis route behind `withWorkspace`** (it currently uses `withAuth`) and send the workspace id from the client.
  *Done when:* a request without membership of the named workspace gets 403, and existing local and paid flows still pass.
- [ ] **B4. Role checks on take-off actions:** decide which roles can measure, approve and send to the quote (see questions), and enforce them in the screen and on the server routes that write commercial data.
  *Done when:* a viewer-role test user can open the take-off read-only and cannot approve or send to the quote.

## C. Cost control

- [ ] **C1. Remove `pages/api/ai/plan-detect.js`** (no callers).
  *Done when:* the route returns 404 and no code references it.
- [ ] **C2. Store AI usage per company:** a usage table (workspace, user, job, pages, model, tokens, estimated cost, time), written by the analysis route.
  *Done when:* each paid page analysis writes one row, and a test checks the row.
- [ ] **C3. Company budget and limits enforced from that table**, not from memory: monthly page and dollar budget, plus the hourly limit.
  *Done when:* a company over budget gets a clear refusal before any provider call, and the limit holds across server restarts.
- [ ] **C4. Show the cost of a paid run** before authorising (an estimate from the page count) and after it (actual).
  *Done when:* the confirmation shows an estimate and the run summary shows the amount actually charged.

## D. No data loss

- [ ] **D1. Automatic backup reminder and export** for Local Only jobs: a prompt to export a `.gr8job` after a take-off run or approval, plus a visible "last backup" date.
  *Done when:* a job with unexported take-off changes shows the reminder, and export plus import round-trips identical counts.
- [ ] **D2. Plan images saved with the job for reopening on another computer:** either include them in the job package or relink by file automatically.
  *Done when:* a job saved on browser A opens with its plan on browser B (shared storage or `.gr8job`) without manual relinking.
- [ ] **D3. Remove the one-off recovery routes and legacy recovery readers** once B1 and B2 have migrated them: `restored-takeoff.js`, `johnson-takeoff-recovery-preview.js` and the legacy recovery database readers.
  *Done when:* the routes are gone and the recovery tests still pass, or are retired with a note.

## E. Measurement accuracy

- [ ] **E1. Scale safety check:** after calibration, compare the calibrated scale with every readable printed dimension and with the sheet's printed scale ratio; warn on a disagreement over 2%.
  *Done when:* a deliberately wrong calibration on a test plan is flagged before measuring.
- [ ] **E2. Parapets and walls over a lower roof:** walls bounding only a roof or outside area on an upper floor are held for review rather than counted.
  *Done when:* Mountain Creek first floor is within ±2% of the printed area and the reference plans are unchanged.
- [ ] **E3. Room labels crossed by door swings** (PWD, WC): erase the door arcs from the OCR crop using the vector arcs.
  *Done when:* PWD and WC on Sunshine Cove are named, with no new false names on the reference plans.
- [ ] **E4. Open-plan division (optional in V1):** offer the builder a one-click divider between named spaces in an open-plan room (kitchen / dining / family) rather than inventing walls.
  *Done when:* the builder can split the room with a drawn divider, and areas sum to the original.
- [ ] **E5. Accuracy regression in CI** (needs F1): the quick-accuracy check on the reference plans, with fixed thresholds.
  *Done when:* CI fails if wall recall, precision, openings or room matches drop below today's values.

## F. Tests, CI, monitoring

- [ ] **F1. CI workflow for the take-off suite:** run the 105 node test scripts on every push (no browser).
  *Done when:* a GitHub Actions run passes on the branch and a deliberately broken rule fails it.
- [ ] **F2. Error reporting:** add an error service (or a logging endpoint) for client crashes and server errors in the take-off and analysis routes, with no plan images or keys.
  *Done when:* a forced error appears in the service with job id and workspace id.
- [ ] **F3. Approval audit trail:** record who approved, rejected or edited each room, wall sheet and opening, and when.
  *Done when:* the Takeoff Schedule can show "approved by X on date" for each approved quantity, and it survives save and reopen.

## G. UX for builders

- [ ] **G1. Finish the room overview** (built today, uncommitted):
  - labels for very small rooms on hover;
  - keyboard next/previous room;
  - "approve all rooms on this sheet that have no review items".

  *Done when:* a builder can review all 20 Sunshine Cove rooms from the list without touching the plan, verified in the browser.
- [ ] **G2. Move measuring off the main thread:** run the wall and room detection in a web worker.
  *Done when:* the screen stays responsive (no frame over 200 ms) while measuring a 15-page plan.
- [ ] **G3. Clear "what needs doing" summary:** one list grouped by sheet (walls to check, rooms to approve, openings to confirm) with counts that reach zero.
  *Done when:* the quotation gate's blockers and this list always agree, by a test.

## H. Release

- [ ] **H1. Staging deployment** with a test workspace for each of two fake companies.
  *Done when:* both companies' staff can run a take-off, approve it and send it to the quote, and neither sees the other's data.
- [ ] **H2. Release notes and a builder guide** (how to calibrate, set levels, review, approve and back up).
  *Done when:* a builder new to the tool can follow the guide to a quotation on a sample plan.

---

## Later (not essential for version 1)

- **Scanned (image-only) plans:** a validated raster engine, or paid AI with strict review. Today they are skipped.
- **Real-time multi-user editing of one take-off:** a merge of approvals and edits instead of reopen-on-conflict.
- **A hosted cloud provider for builder storage** (S3, Azure or Backblaze) and automatic pull of newer revisions.
- **Server-side background processing** for long paid runs (a queue, resumable runs, email on completion).
- **Automatic scale from outlined-text dimensions** (reading dimension numbers by OCR).
- **Elevation and section reading** for wall heights, roof pitch and ceiling heights.
- **Electrical, plumbing and other trade symbols** beyond the current electrical points.
- **Removing the raster pipeline and other unused geometry modules** after a decision on scanned plans.
- **A priced BOQ document** of its own, separate from the Quotation Builder.

---

## Questions to answer before this plan is final

1. **Where should job documents live for V1?** Options:
   - each builder's browser (today) with mandatory backups;
   - the builder-hosted job server;
   - a GR8-hosted cloud store.

   This decides how much of section D and the Later items are V1.
2. **Roles:** which workspace roles may measure, approve and send take-off quantities to the quote? Is a read-only role needed?
3. **AI budget:** should paid AI be available in V1 at all, and if so what monthly limit per company (pages or dollars), and who may authorise it?
4. **Scanned plans:** is "skip and tell the builder" acceptable for V1, or must scanned plans be measurable?
5. **Error reporting:** is there an existing service account (Sentry or similar) to use, or should errors go to a Supabase table?
6. **CI:** is GitHub Actions the CI to use for the take-off suite, and may the reference plan PDFs be stored privately for accuracy checks (they are customer plans)?
7. **Commits:** may I commit the current take-off work to a feature branch (A1), and who reviews it before merging to `main`?
