# Module Migration Plan

Date: 2026-07-22
Status: **Planning document only. No code has been moved, renamed, or modified to produce this plan.**
Based on: [`docs/MODULE_ARCHITECTURE_AUDIT.md`](./MODULE_ARCHITECTURE_AUDIT.md) (2026-07-22) — read that first for the *why*; this document is the *how*, phase by phase, file by file.

Target end-state per the brief: each module becomes self-contained under `/modules/<name>/{pages,components,hooks,services,types,styles,utilities,state,tests}`, with only genuine framework-level code (`shared/`, `components/ui`, `lib` platform primitives, auth, database, design-system) remaining outside module folders.

**Constraint that shapes every phase below:** this app uses the Next.js **Pages Router**, which is filesystem-routed. `pages/**` and `pages/api/**` files cannot physically move into `modules/<name>/pages/` — Next.js will stop finding the route. The pattern used throughout this plan is: the file under `pages/` becomes a **thin re-export wrapper** (a few lines: import the real page component from `modules/<name>/` and render it), while the actual implementation — components, hooks, lib/services, types, state, styles — moves fully into `modules/<name>/`. This is the only way to satisfy both "self-contained module" and "Next.js can still find the route."

---

## 0. Migration Mechanics (applies to every phase — not repeated per-module)

### 0.1 Pre-flight housekeeping (do once, before Phase 1)

These aren't required for any single phase to succeed, but doing them first removes noise from every phase's verification step:

1. **Path alias check.** `jsconfig.json` defines `@/* → ./*`, but `tsconfig.json` (which coexists and has no `paths`/`baseUrl`) is what Next.js/TypeScript tooling will actually honor when both files are present. Only 8 import sites across 4 files use `@/`. Before relying on aliases for the migration, either (a) move the `paths` mapping into `tsconfig.json` and confirm `npm run build` + `npm run typecheck` still pass, or (b) don't introduce new `@/modules/...` aliases until that's confirmed — use relative imports for the migration instead. **Do not assume the alias works without testing it first.**
2. **Archive orphaned scratch directories** identified in the audit (§2.3): `.history/`, `tmp/`, `recovery/`, `.codex-tmp/`, `website-builder-sites-backup-stage1-20260606-101444/`, `website-builder-sites-project-backup-recovery-20260607-064606/`, root `2208a52a-8175-477e-823c-fc6de7fe4afe/`. Zero code references confirmed. Move out of the repo (or to a clearly-labeled `_archive/` outside the build path) rather than deleting outright, in case they hold undocumented value.
3. **Decide the fate of confirmed dead code** so it doesn't get dragged into a module folder and mistaken for something load-bearing: `zustand`/`@reduxjs/toolkit` (unused deps — remove from `package.json` or actually wire them up, don't carry the ambiguity forward), `components/ui/BackArrow.js`, `components/ui/card.js`, `components/lists/EditListModal.js`, `lib/twilio/token.js`, `components/nodes/NodeDrawer.js`, `components/nodes/EmailEditorModal.js`, `components/estimate-builder/takeoff-engine/workbook/TakeoffEngineWorkbookPage.jsx`, `lib/db/supabase.js`.
4. **Do not consolidate the 5 Supabase client wrappers as part of this migration.** It's tempting to fix while touching every module, but it's an orthogonal, repo-wide change that touches ~230 files — bundling it with a module move makes both harder to review and rollback independently. Track it as its own follow-up initiative.

### 0.2 Standard per-phase procedure

1. Branch: `migrate/phase-<n>-<module-name>` off `main`.
2. `git mv` every file (never copy+delete) so history follows the file.
3. Update the confirmed cross-module import edges for that phase (listed per-phase below) — these are the only import paths that need semantic changes; everything else is depth-recalculation from the physical move (mechanical, do with a careful find/replace per directory, or a small codemod script — do **not** hand-edit hundreds of relative imports one at a time).
4. Leave a **thin re-export shim** at every old `components/`/`lib/`/`hooks/` path for one full release cycle: `export { default } from "../../modules/<name>/..."`. This means any import you missed keeps working (with a `console.warn` if you want visibility) instead of breaking the build silently, and gives you a real signal (the warn firing) before you delete the shim.
5. Run the full test gate (§0.3).
6. Deploy to a preview/staging environment (Vercel preview deployment, given `.vercel/` is present) before merging to `main`.
7. Merge, monitor, then — after the grace period — delete the shims in a small follow-up commit and re-run the test gate once more to confirm nothing still depended on them.

### 0.3 Standard testing checklist (run for every phase)

- [ ] `npm run typecheck` — zero errors (this alone catches most broken import paths in `.ts`/`.tsx` files)
- [ ] `npm run build` — zero errors (catches broken imports in `.js`/`.jsx` too, since webpack resolves them at build time)
- [ ] `npm run lint`
- [ ] `grep -r` for the **old** path of every moved file across the whole repo — must return zero hits outside the shim files themselves
- [ ] Start the dev server and manually load every route belonging to the module (routes listed per phase below) — confirm 200/expected-redirect, not a 500 or blank screen
- [ ] Manually exercise the module's primary user flow once end-to-end (not just "page loads") — e.g. for CRM: open a lead, send an SMS via the dialer, log an automation hand-off
- [ ] Specifically re-test every confirmed **reverse dependent** call site listed for that phase (these are the ones that don't error at build time in an obvious way if you get the relative path math wrong, since JS import resolution failures during dev can be silent-ish until the route is hit)
- [ ] Run any existing automated tests that touch the module (listed per phase where they exist)
- [ ] Confirm the Vercel preview build succeeds before promoting to `main`

### 0.4 Standard rollback strategy

- Each phase lives on its own branch and, once merged, its own mergeable commit range — `git revert <merge-commit>` undoes an entire phase cleanly if a problem surfaces post-deploy, because `git mv` preserves history and a revert simply moves everything back.
- Tag `pre-phase-<n>` on `main` immediately before merging each phase, as a named rollback point independent of having to find the right merge commit under pressure.
- Because shims are left in place for a full release cycle (§0.2 step 4), a missed import doesn't cause an outage — it logs a warning and keeps working, which turns "emergency rollback" into "scheduled fix" for anything except the cross-module edges called out explicitly per phase.
- Do not delete the old physical location until: the shim's console.warn has not fired in production for the full grace period, AND the full test gate has been re-run.

### 0.5 Standard success criteria (definition of done for a phase)

- All items in §0.3 pass.
- Old paths fully removed (shims deleted) with no remaining references.
- No new circular imports introduced (spot-check with `madge --circular` if available, or manually trace the module's new external-facing imports).
- The module's independence score (per the audit) moves toward 100% — specifically, the cross-module import count for that module drops to only the intentionally-kept edges.

### 0.6 Framework-level code that must NEVER move into a module folder

Per the audit's Shared Component Inventory — these stay in place across every phase:

- `context/AuthContext.js`, `pages/_app.js`
- `hooks/useWorkspace`, `pages/modules/_guard.js` (`useModuleGuard`)
- Supabase client wrappers (`utils/supabase-client.js`, `utils/supabase-admin.js`, `lib/supabaseAdmin.js`, `services/supabaseClient.js`) — see §0.1.4, don't touch during migration, just import from wherever they already live
- `iconMap` and other genuinely cross-cutting UI primitives
- `components/billing/PlatformPricingPlans.js`, `components/pricing/*` (used by both Website Builder and the Billing module — genuine shared commercial concern)

---

## Phase 1 — Founding Growth Partner

**Independence score: 95% → target 100%. Zero confirmed cross-module imports in either direction. This is the proof-of-concept phase — its entire purpose is to validate §0's mechanics on the lowest-risk module before anything with real coupling is attempted.**

### Files to move

```
components/founding-growth-partner/FoundingGrowthPartnerPage.jsx
components/founding-growth-partner/FoundingGrowthPartnerPage.module.css
lib/founding-growth-partner/content.js
```
→ into `modules/founding-growth-partner/{components,styles,lib}/`

Stay as thin wrappers under `pages/` (Next.js routing requirement):
```
pages/founding-growth-partner/index.js
pages/founding-growth-partner/[agencySlug].js
pages/api/founding-growth-partner/guide.js
pages/api/founding-growth-partner/interest.js
```

### New folder structure
```
modules/founding-growth-partner/
  components/FoundingGrowthPartnerPage.jsx
  styles/FoundingGrowthPartnerPage.module.css
  services/content.js        (was lib/founding-growth-partner/content.js)
```

### Imports that must change
None cross-module. Only internal relative-path recalculation between the moved files themselves, and the four `pages/` wrapper files' import of the moved component/service.

### Shared dependencies to keep in place
Whatever Supabase client and auth check `pages/api/founding-growth-partner/*.js` currently use — confirm which of the wrapper files (§0.6) it is, and don't change it as part of this move.

### Testing checklist
Apply §0.3. Routes to manually verify: `/founding-growth-partner`, `/founding-growth-partner/[any-agency-slug]`, and both API routes (submit a guide request and an interest form).

### Success criteria
Apply §0.5. No reverse-dependent call sites exist for this module, so this phase should be the cleanest possible run of the checklist — if anything unexpected breaks here, it's a signal to fix the migration *mechanics* (§0) before attempting a harder phase.

---

## Phase 2 — Account, Vendor / Affiliate / Marketplace

**Independence scores: Account 75%, Vendor/Affiliate/Marketplace 70%. Second proof point at moderate size; `VendorUserBanner` reuse here is intra-module (confirmed — all 15 consumers are inside this same module), not cross-module, so it moves as a unit.**

### 2a. Account — files to move
```
components/account/BusinessProfileVault.js
```
→ `modules/account/components/BusinessProfileVault.js`

Stay as thin wrappers under `pages/`:
```
pages/account/index.js
pages/admin/business-profile-vaults.js
pages/api/account/business-profile-vault.js
```

### 2b. Vendor/Affiliate/Marketplace — files to move
```
components/vendor/VendorUserBanner.js
lib/affiliate/adapter.js
lib/affiliate/adapters/mock.js
lib/affiliate/affiliatePayouts.js
```
→ `modules/vendor/{components,services}/`

Stay as thin wrappers under `pages/` and `pages/api/`:
```
pages/modules/affiliates/index.js
pages/modules/affiliates/affiliate-marketplace/affiliate_analytics.js
pages/modules/affiliates/affiliate-marketplace/affiliate_applications.js
pages/modules/affiliates/affiliate-marketplace/approved-offers.js
pages/modules/affiliates/affiliate-marketplace/offers/apply.js
pages/modules/affiliates/merchant/commissions.js
pages/modules/vendor/index.js
pages/modules/vendor/courses/index.js
pages/modules/vendor/digital/index.js
pages/modules/vendor/physical/index.js
pages/modules/vendor/affiliates/active_affiliates.js
pages/modules/vendor/affiliates/manage-products/{TabbedSectors,edit-product-details,index,my-products,performance-reports,set-application-status,submit,upload-assets,vendor-applications}.js

pages/api/affiliate/*.js  (21 files: applications, apply, approve, approved, auto-approve, check-status,
  commissions, confirm-email, create-affiliate, ensure-link, links,.js, list-applications, login,
  notify-vendor, offers, product-assets, programs, send-confirmation, status, update-application-status)
pages/api/marketplace/*.js  (7 files: affiliate-access, course-vendor-context, vendor-access,
  vendor-affiliate-products, vendor-digital-products, vendor-physical-products, vendor-upload-product-image)
pages/api/vendor/*.js  (11 files: create-agreement, ensure-profile, find-agreement, get-vendor,
  lookup-account, lookup-or-create-user, resolve-marketplace-user, send-verification,
  update-agreement-token, verify-affiliate, verify)
```

Note: `pages/api/affiliate/links,.js` has a stray comma in its filename — flag for cleanup during the move, not before (don't rename files as a drive-by during an unrelated read-only phase; note it here so whoever executes Phase 2 fixes it deliberately).

### New folder structure
```
modules/account/
  components/BusinessProfileVault.js
modules/vendor/
  components/VendorUserBanner.js
  services/{adapter.js, affiliatePayouts.js, adapters/mock.js}
```

### Imports that must change
No confirmed cross-module code imports either direction for Account or Vendor/Affiliate/Marketplace. Only internal relative-path recalculation.

### Testing checklist
Apply §0.3. Routes: all 15 vendor/affiliate pages listed above, `/account`, `/admin/business-profile-vaults`. Exercise one real flow: submit an affiliate application and approve it as a vendor.

### Success criteria
Apply §0.5.

---

## Phase 3 — Investment / Trading (Freedom Trader, Freedom Terminal, Freedom Portfolio)

**Independence scores: Freedom Trader 80%, Freedom Terminal 75%, Freedom Portfolio 75%. All individually clean (zero cross-module imports confirmed), but they are three parallel, never-merged systems. Use this phase to make an explicit decision, not just a folder move. Wait for the current active development (git status shows same-session edits under `pages/freedom-trader/`) to settle before starting.**

### Decision required before moving files
Should these become one `modules/investment/` with three sub-areas, or three separate `modules/freedom-trader/`, `modules/freedom-terminal/`, `modules/freedom-portfolio/`? Given they share no code today and serve different purposes (active paper trading vs. legacy company research/scoring vs. a small watchlist), three separate module folders is the lower-risk choice — it doesn't force an integration decision that hasn't been made on the product side. This plan assumes **three separate folders**; revisit if the product direction says otherwise.

### Files to move
```
components/freedom-trader/PaperAccountBar.js
components/freedom-trader/PaperOrderTicket.js
lib/freedom-trader/localPaperStore.js
lib/freedom-trader/marketData.js
lib/freedom-trader/paperTrading.js
lib/freedom-trader/twelveData.js
test/freedom-paper-trading.test.js
```
→ `modules/freedom-trader/{components,services,tests}/`

```
lib/freedom-terminal/adaptiveBuyScore.js
lib/freedom-terminal/analysisEngine.js
lib/freedom-terminal/core.js
lib/freedom-terminal/importEngine.js
```
→ `modules/freedom-terminal/services/`

Stay as thin wrappers under `pages/` and `pages/api/`:
```
pages/freedom-trader/{index,alerts,positions,portfolio,trades,settings,market-opportunities}.js
pages/freedom-trader/company/[symbol].js
pages/api/freedom-trader/*.js  (13 files)

pages/freedom/{index,score-calibration}.js
pages/freedom/company/[symbol].js
pages/api/freedom/*.js  (10 files, incl. jobs/run.js)

pages/modules/freedom-portfolio/index.js
pages/api/freedom-portfolio/{quote,watchlist}.js
```

### New folder structure
```
modules/freedom-trader/
  components/{PaperAccountBar.js, PaperOrderTicket.js}
  services/{localPaperStore.js, marketData.js, paperTrading.js, twelveData.js}
  tests/freedom-paper-trading.test.js
modules/freedom-terminal/
  services/{adaptiveBuyScore.js, analysisEngine.js, core.js, importEngine.js}
modules/freedom-portfolio/
  (thin — currently just page + 2 API routes; add components/services here only when it grows)
```

### Imports that must change
None cross-module — confirmed zero imports linking these three systems to each other or to any other module.

### Testing checklist
Apply §0.3, plus: **run `node --test test/freedom-paper-trading.test.js`** (moved to `modules/freedom-trader/tests/`, update the `package.json` `test:freedom-paper` script path) as part of the gate, not just a manual page load. Routes: all `freedom-trader/*`, `freedom/*`, `freedom-portfolio` pages.

### Success criteria
Apply §0.5, plus: the `test:freedom-paper` npm script still passes after its path update.

---

## Phase 4 — Telephony, then CRM

**Independence scores: Telephony 55%, CRM 40%. Two sub-phases, in order, because of one confirmed hard dependency: `components/crm/LeadDetailsModal.js:20` imports `components/telephony/BrowserDialer`. Move Telephony first (nothing depends on Telephony moving) so CRM's migration has a stable, already-moved target to point its one cross-import at.**

### 4a. Telephony — files to move
```
components/telephony/BrowserDialer.js
components/telephony/SmsComposer.js
lib/twilio/token.js          (dead code — see §0.1.3; either delete or fix pages/api/telephony/voice-token.js
                               to actually import it, as a deliberate decision made during this move, not before)
lib/smsglobal/index.js
lib/smsglobal/http.js
lib/smsglobal/macAuth.js
lib/smsglobal/create-sender-id.js
lib/smsglobal/create-subaccount.js
lib/smsglobal/topup-subaccount.js
lib/smsglobal/INTEGRATION_GUIDE.md
lib/smsglobal/SUBACCOUNT_SETUP.md
```
→ `modules/telephony/{components,services,docs}/`

Stay as thin wrappers under `pages/api/`:
```
pages/api/telephony/*.js  (11 files)
pages/api/twilio/*.js  (13 files)
pages/api/smsglobal/*.js  (12 files)
pages/modules/integrations/sms-clients/index.js
pages/modules/phone/calls.js
```

### 4b. CRM — files to move
```
components/crm/CallNowModal.js
components/crm/CallsNotificationBell.js
components/crm/CallsWidget.js
components/crm/GlobalDialer.js
components/crm/LeadDetailsModal.js
components/crm/LeadInfoCard.js
components/crm/LeadMessagesBar.js
components/crm/SendToAutomationPanel.js
components/crm/SubscriberAvatar.js
lib/crm/writebacks.js
lib/crm/writebacks.demo.js
```
→ `modules/crm/{components,services}/`

`lib/db/supabase.js` is confirmed dead (zero importers) — do not move it into the module; resolve per §0.1.3 (delete, or explicitly wire it up if there's a reason to keep an offline-fallback CRM path).

Stay as thin wrappers under `pages/`:
```
pages/leads.js
pages/api/crm/*.js  (12 files/paths)
```

### New folder structure
```
modules/telephony/
  components/{BrowserDialer.js, SmsComposer.js}
  services/{token.js, smsglobal/*}
modules/crm/
  components/{CallNowModal.js, CallsNotificationBell.js, CallsWidget.js, GlobalDialer.js,
              LeadDetailsModal.js, LeadInfoCard.js, LeadMessagesBar.js,
              SendToAutomationPanel.js, SubscriberAvatar.js}
  services/writebacks.js
```

### Imports that must change (the one that matters)
`components/crm/LeadDetailsModal.js:20` — currently `import BrowserDialer from "../telephony/BrowserDialer"`. After Phase 4a, this becomes `import BrowserDialer from "../../telephony/components/BrowserDialer"` (or the module's public entry point if `modules/telephony/index.js` is introduced as a barrel — recommended, so CRM doesn't reach into Telephony's internal file layout). **This is the one line in this entire plan most likely to silently break if the path math is done by hand instead of verified with a build.**

Also: `components/crm/SubscriberAvatar.js` is used by both `pages/leads.js` (CRM, moving) and `pages/modules/communities/index.js` (Communities, not in scope for this phase) — after the move, `communities/index.js` needs its import path updated too even though Communities itself isn't migrating yet.

### Testing checklist
Apply §0.3. Specifically: open a lead in `/leads`, click through to the browser dialer (the exact cross-module call site), and confirm a call can still be initiated. Also load `/modules/communities` to confirm `SubscriberAvatar` still resolves.

### Success criteria
Apply §0.5, plus: the CRM→Telephony dependency is now an explicit, documented import through a module entry point rather than a relative reach into another module's internals.

---

## Phase 5 — Email, Automation, Lists, Social

**Independence scores: Email 45%, Automation 40%, CRM-adjacent Lists ~50%, Social ~65% (preliminary). Largest phase by file count (~277 files across components/lib/pages/api). Requires an ownership decision on paper before any file moves, because `pages/modules/email/crm/*` currently embeds CRM UI inside the Email route tree — a real ambiguity, not just a path to update.**

### Decision required before moving files
`pages/modules/email/crm/{call-log,calls,deals,index,kanban,pipelines/index,quotes,reports,sms-dashboard,sms-marketing/index,tasks/index,teams,workspace}.js` — is this CRM functionality that happens to be routed under `/modules/email/crm/`, or is it Email-specific CRM-lite tooling? Recommendation: since Phase 4 already moved the real CRM module, treat these as **CRM module pages that should route under `/modules/crm/*`** going forward, with redirects from the old `/modules/email/crm/*` URLs for any bookmarked/linked traffic. Moving them without this decision just relocates the ambiguity into the new folder structure.

### Files to move
```
components/email/editor2/{EmailEditor.jsx, emailEditorApi.js, AiGenerateModal.jsx,
  AiImageModal.jsx, ImageEditModal.jsx, ImageLibraryModal.jsx}
components/automation/{ColorPalette.js, FlowMembersModal.js, NodeColorModal.js}
components/nodes/{ConditionNode.js, ConditionNodeDrawer.js, DelayNode.js, DelayNodeDrawer.js,
  EmailNode.js, EmailNodeDrawer.js, TriggerNode.js, TriggerNodeDrawer.js}
  (NodeDrawer.js, EmailEditorModal.js are dead — see §0.1.3, do not carry forward without a decision)
components/emoji/{EmojiPicker.js, emojiLibrary.js}
components/lists/EditListModal.js   (dead — see §0.1.3)
lib/email/{blockSchema.js, broadcastSender.js, send-broadcast.js, sendBookingConfirmation.js,
  sendBookingReminder.js, sendProviderBookingNotification.js, unsubscribe.js}
lib/automation/processBookingReminders.js
lib/campaigns/{campaignAPI.js, campaignScheduler.js, campaignTypes.js, supabaseClient.js}
lib/lists/crm-sync.js
lib/social/{apiUtils.js, auth.js, botProcessor.js, checkSocialLimit.js, facebook.js, linkedin.js,
  pinterest.js, platformCredentials.js, tiktok.js, tokenCrypto.js, x.js, youtube.js}
```
→ split across `modules/email/`, `modules/automation/`, `modules/social/`, `modules/lists/`

Stay as thin wrappers under `pages/` and `pages/api/` (full list — this is the largest single file set in the plan, enumerate directly rather than move-then-discover-a-miss):
```
pages/modules/email/{index,new,compose,thumbnail,previews}.js
pages/modules/email/analytics/summary.js
pages/modules/email/automation/index.js
pages/modules/email/autoresponders/{index,open}.js
pages/modules/email/billing/email-plans.js
pages/modules/email/broadcast/{import,index,view}.js
pages/modules/email/campaigns/{index,new}.js
pages/modules/email/editor/index.js
pages/modules/email/lists/{index,new,pipeline}.js
pages/modules/email/reports/{all,index}.js
pages/modules/email/reports/{automations,autoresponders,broadcasts,calls,campaigns,sms}/index.js
pages/modules/email/templates/{import,new,select,select.module.css,bulk-upload-templates.mjs}
  + pages/modules/email/templates/import/**  (static HTML/image template assets — move as a unit, no code changes)
pages/modules/email/crm/*  (13 files — pending the decision above; either re-routed to /modules/crm/*
  with redirects, or moved to modules/email/ if the decision is to keep them Email-owned)

pages/api/email/*.js  (56 files)
pages/api/automation/*.js  (29 files, incl. engine/ subfolder)
pages/api/lists/*.js  (7 files)

pages/modules/social_media/{ads,calendar-day,calendar,campaigns,connect-complete,create,
  dashboard,images,import-token,inbox,review,roi,schedule,setup}.js
pages/api/social/*.js  (43 files, incl. oauth/ and cron/ subfolders)
```

### New folder structure
```
modules/email/
  components/editor2/*
  services/{blockSchema.js, broadcastSender.js, send-broadcast.js, sendBooking*.js, unsubscribe.js}
modules/automation/
  components/{ColorPalette.js, FlowMembersModal.js, NodeColorModal.js, nodes/*}
  services/processBookingReminders.js
modules/lists/
  services/crm-sync.js
modules/social/
  services/{apiUtils.js, auth.js, botProcessor.js, checkSocialLimit.js, platformCredentials.js,
            tokenCrypto.js, platforms/{facebook,linkedin,pinterest,tiktok,x,youtube}.js}
modules/campaigns/
  services/{campaignAPI.js, campaignScheduler.js, campaignTypes.js, supabaseClient.js}
  (kept separate from modules/email/ since campaigns/ already serves multiple channels — confirm at
   migration time whether this should nest under email or stay a peer module)
```

### Imports that must change
- `pages/modules/email/automation/index.js:27-35` → all 8 `components/nodes/*` imports need updating to `modules/automation/components/nodes/*`.
- `lib/crm/writebacks.js` (now in `modules/crm/services/`, moved in Phase 4) is called from the Email send pipeline — confirm the exact call site during Phase 5 execution (this is an Email→CRM edge that must keep working across two separate phases; re-verify it wasn't missed since Phase 4 already moved the CRM side).
- `lib/lists/crm-sync.js` (moving to `modules/lists/`) touches `leads`/`lead_lists`/`lead_list_members` tables directly via Supabase — no code import to CRM, so no path change needed here, just confirm table access still works (this is data coupling, not code coupling).
- Every `pages/modules/email/crm/*` file's imports depend entirely on the ownership decision above — do not guess; resolve on paper first.

### Testing checklist
Apply §0.3. Given the size of this phase, split verification into three passes: (1) Email — compose and send a test broadcast, confirm it logs a writeback into CRM; (2) Automation — build a simple flow with a Trigger→Delay→Email node chain and confirm it still enrolls/ticks; (3) Social — confirm at least one OAuth connect flow (`pages/api/social/oauth/*/start.js`) still redirects correctly, since these are easy to silently break with a relative-path miss.

### Success criteria
Apply §0.5, plus: the Email/CRM route-embedding ambiguity is resolved in the code (not just documented) — either redirects are in place from `/modules/email/crm/*` to `/modules/crm/*`, or the pages are deliberately kept in `modules/email/`.

---

## Phase 6 — Website Builder

**Independence score: 65%. Zero outbound coupling to other feature modules (confirmed), but the widest inbound blast radius of any module in the app — public site rendering, middleware, and even the Funnels module import its `lib/` directly. The risk here is not "will this module work," it's "will everything that reads from it still compile."**

### Files to move
```
components/website-builder/PageBuilderCanvas.js
components/website-builder/WebsiteBlockRenderer.js
components/website-builder/WebsitePreviewSurface.js
components/website-builder/gridIconLibrary.js
components/website-builder/page-builder/{pbCanvasComponents,pbEditorUtils,pbPropertiesPanels,pbStyles}.js
components/website-builder/website-renderer/{BackToTopButton,wbAnimations,wbBlockComponents,wbVariantStyles}.js
lib/website-builder/{accordionPanels,backupStorage,chaiStudio,documentVersion,footerNavigation,
  launchSelfHostedBuilder,mediaAssets,pageBlockComponents,projectStore,publicationStore,
  publishConfig,puckStudio,remoteProjects,siteStorage,subscribers,supabaseSiteStorage,
  templateBlueprints,templateLibraryAssets,templateProfiles,templates,videoHero}.js
lib/website-builder/page-blocks/{blockDefaults,blockDefinitions,blockTypes,competitorComparison,index}.js
lib/website-builder/template-blueprints/{core,industryBlueprints,serviceFirm,tradeShowcase}.js
lib/website-builder/external-templates/**  (static template assets — move as a unit)
modules/website-builder/blocks/accordion/AccordionBlock.js   (already misplaced under root-level modules/ — consolidate)
modules/website-builder/utils/inlineHtml.js                  (same)
```
→ into a single, consistent `modules/website-builder/{components,services,blocks,utils}/`

Stay as thin wrappers under `pages/` and `pages/api/`:
```
pages/modules/website-builder/{backups,cards,domains,index,new,preview,prices,visit-report,visual-builder}.js
pages/modules/website-builder/project/[id]/{index,preview,canvas.bak}.js
pages/api/website-builder/*.js  (14 files)
pages/api/website/*.js  (13 files)
pages/api/websites/*.js  (4 files)
pages/sites/[...slug].js
```

**Not moving (external callers — update their import paths, do not relocate them):**
```
pages/[slug].js
middleware.js
pages/pricing.js
pages/index.js
pages/assets.js
pages/dev/icon-library.js
pages/modules/funnels/new.js
lib/assetLibrary.js
components/qa/WebsiteFooterNavigationQaClient.js
```

### New folder structure
```
modules/website-builder/
  components/{PageBuilderCanvas.js, WebsiteBlockRenderer.js, WebsitePreviewSurface.js,
              gridIconLibrary.js, page-builder/*, website-renderer/*}
  services/{projectStore.js, publicationStore.js, publishConfig.js, remoteProjects.js,
            siteStorage.js, supabaseSiteStorage.js, backupStorage.js, mediaAssets.js,
            subscribers.js, documentVersion.js, chaiStudio.js, puckStudio.js}
  blocks/{page-blocks/*, template-blueprints/*, accordion/AccordionBlock.js}
  content/{templates.js, templateBlueprints.js, templateLibraryAssets.js, templateProfiles.js,
           footerNavigation.js, videoHero.js, accordionPanels.js, pageBlockComponents.js}
  utils/inlineHtml.js
  assets/external-templates/**
```

### Imports that must change (the external callers — this is the real work of this phase)
Every file in the "Not moving" list above imports from `lib/website-builder/*` or `components/website-builder/*` today and must be updated to the new `modules/website-builder/` paths:
- `pages/[slug].js`, `pages/sites/[...slug].js` → `{publishConfig, publicationStore}`
- `middleware.js` → confirm exact import (site/domain resolution)
- `pages/pricing.js`, `pages/index.js`, `pages/assets.js` → confirm exact imports
- `pages/dev/icon-library.js` → icon library
- `pages/modules/funnels/new.js:12` → confirm exact import
- `lib/assetLibrary.js:28` → confirm exact import
- `components/qa/WebsiteFooterNavigationQaClient.js:4` → footer nav

Recommendation: introduce a single `modules/website-builder/index.js` **public barrel** exporting exactly what these external callers need, rather than having 8 external files each import a different internal path — this turns "8 files to fix if internals shuffle again" into "1 file."

`lib/website-builder/siteStorage.js` and `backupStorage.js` resolve their data directories via `path.join(process.cwd(), ...)`, which is anchored to the repo root, not the file's own location — confirm this still resolves correctly after the file moves (it should, since `process.cwd()` doesn't change), but verify explicitly rather than assuming.

### Testing checklist
Apply §0.3, with priority on the external callers, not the module's own pages: load a **published website** via `pages/[slug].js` and `pages/sites/[...slug].js`, confirm `middleware.js` domain routing still works, confirm `pages/pricing.js` renders its plan cards, confirm Funnels' "new" flow that references website-builder still works, and run the QA page (`pages/qa/website-footer-navigation.js`) which specifically exists to test footer nav.

### Success criteria
Apply §0.5, plus: all 8 external caller files import through the new public barrel (or updated direct paths, confirmed working) with zero remaining references to the old `lib/website-builder/` or `components/website-builder/` locations outside shims.

---

## Phase 7 — Gantt, Document Engine, Standard Inclusions

**Independence scores: Gantt (standalone) 55%, Document Engine ~30% (as a would-be independent module — it's really a single-consumer library), Standard Inclusions 45%. All three are single-consumer today (Estimate Builder is the one real consumer of Document Engine and Standard Inclusions; the standalone Gantt module is its own single route). Nest Document Engine and Standard Inclusions *under* Estimate Builder rather than giving them independent top-level module folders — they have no independent product identity. Resolve the Gantt duplication (a second, unrelated Gantt implementation exists inside Estimate Builder) as part of this phase, before Phase 8 touches Estimate Builder again.**

### 7a. Gantt (standalone module) — files to move
```
components/gantt/{ConstructionEstimateWorksheet,EstimateWorksheetSection,EstimateWorksheetV2,
  EstimateWorksheetV3,EstimateWorksheetV4,GanttPageLayout,GanttSchedulePlannerModal,
  WindowDoorSchedule,ganttStyles}.js
hooks/gantt/{useConstructionEstimateWorksheet,useEstimateWorksheetV2,useEstimateWorksheetV3,
  useEstimateWorksheetV4,useGanttPlanner}.js
lib/gantt/{dateUtils,exportUtils,scheduleEngine,taskUtils}.js
lib/gantt/templates/{baseTemplates,complexityRules,tradeCategories}.js
```
→ `modules/gantt/{components,hooks,services}/`

Stay as thin wrappers:
```
pages/modules/gantt/{index,[id]}.js
pages/api/gantt/{send-delay-update,send-work-orders}.js
```

**Before moving:** decide whether `components/estimate-builder/gantt/{AIScheduleService,GanttBuilderPage,GanttChart,ScheduleReviewTable,ganttTypes,ganttUtils}.js` (the parallel implementation inside Estimate Builder) merges into this module, gets deleted, or is deliberately kept as a distinct Estimate-Builder-internal scheduling feature with a different name to stop the two "Gantt" systems being confused. This plan does not move those files — that decision belongs to Phase 8 (Estimate Builder) or a dedicated consolidation task, but it must be made before Phase 8 starts, not during it.

### 7b. Document Engine — files to move (nest under Estimate Builder)
```
components/document-engine/core/{documentState,historyEngine,layerEngine,objectEngine,pageEngine,selectionEngine}.js
components/document-engine/editor/DocumentPageBuilder.jsx
components/document-engine/export/pdfRenderer.js
components/document-engine/fields/{dynamicFields,workbookFieldResolver}.js
components/document-engine/objects/{dividerObject,dynamicFieldObject,iconObject,imageObject,
  logoObject,qrObject,shapeObject,signatureObject,tableObject,textObject}.js
components/document-engine/renderer/{documentRenderer,objectRenderer,pageRenderer}.jsx
components/document-engine/templates/{aboutTemplate,acceptanceTemplate,coverTemplate,
  premierInclusionsMasterTemplate,pricingTemplate,standardInclusionsTemplate}.js
components/document-engine/tests/*.test.mjs
components/document-engine/DOCUMENT_ENGINE_ARCHITECTURE.md
```
→ `modules/estimate-builder/document-engine/{core,editor,export,fields,objects,renderer,templates,tests}/`

### 7c. Standard Inclusions — files to move (nest under Estimate Builder)
```
components/standard-inclusions/{OnlyOfficePresentationEditor.jsx, StandardInclusionsDocument.jsx,
  StandardInclusionsPageShell.jsx, standardInclusionsData.js, standardInclusions.module.css}
components/standard-inclusions/pages/Page0{1..6}*.jsx
lib/standard-inclusions/{masterTemplate,onlyoffice}.js
```
→ `modules/estimate-builder/standard-inclusions/{components,services}/`

Root `standard-inclusions/` (data JSON, confirmed live-imported by `lib/standard-inclusions/masterTemplate.js`) and `public/standard-inclusions/` (static assets) move alongside as `modules/estimate-builder/standard-inclusions/assets/` and stay served from `public/` respectively (Next.js requires static assets to remain under `public/` to be servable — do not move `public/standard-inclusions/`, only reference it).

Stay as thin wrappers:
```
pages/api/standard-inclusions/onlyoffice/{callback,config,export-pdf,file,upload-pptx}.js
pages/qa/standard-inclusions-editor.js
pages/qa/standard-inclusions-phase1.js
```

### Imports that must change
- `components/estimate-builder/EstimateBuilderWorkbook.js:31-35` → update all 5 imports (`document-engine/templates`, `document-engine/core`×2, `standard-inclusions/OnlyOfficePresentationEditor`) to the new nested paths. Since Document Engine and Standard Inclusions are moving to *live inside* the Estimate Builder module folder itself, these become shorter relative imports, not longer ones — a rare case in this plan where the path gets simpler.
- `components/estimate-builder/standard-inclusions/{standardInclusionsCompat.js:1, StandardInclusionsPreview.jsx:2-3}` → same nested-path update.
- `pages/qa/standard-inclusions-editor.js:2-3`, `pages/qa/standard-inclusions-phase1.js:2` → update to new nested paths.
- `lib/standard-inclusions/masterTemplate.js:1` → its import of root `standard-inclusions/premier-inclusions-template.full.json` needs re-pointing if that data directory also moves; if it stays at repo root (simpler, since it's pure data with one consumer), only the consumer's relative path changes, not the data's location.

### Testing checklist
Apply §0.3, plus explicitly run `components/document-engine/tests/*.test.mjs` (now under `modules/estimate-builder/document-engine/tests/`) as part of the gate — these are the only existing automated tests for this subsystem. Load `/modules/estimate-builder`, generate a document through the workbook, and confirm the Standard Inclusions brochure pages still render. Run both `pages/qa/standard-inclusions-*` pages manually.

### Success criteria
Apply §0.5, plus: the Gantt duplication decision (merge/delete/rename) is made and recorded before Phase 8 begins — do not carry an undecided duplication into the largest, riskiest phase.

---

## Phase 8 — Estimate Builder / Takeoff

**Independence score: 50% (Estimate Builder core), 25% (Takeoff sub-area). Largest, most actively-changing module in the platform. Gate condition: do not start this phase until the in-progress rebuild (git status currently shows deletions across `takeoff-engine/{detections,interactions,processing,rendering,persistence}` alongside active edits to `ai-takeoff/`) has landed and one takeoff implementation has won. Migrating a module that is simultaneously being rewritten means the file list below will already be stale by the time you execute it — re-run the audit's file inventory immediately before starting this phase, don't rely on this snapshot.**

### Files to move (snapshot as of this audit — re-verify before executing)
```
components/estimate-builder/EstimateBuilderWorkbook.js
components/estimate-builder/ai-takeoff/**                    (20 files — confirm this is still the
                                                                live implementation, not takeoff-engine,
                                                                before moving)
components/estimate-builder/project-estimate/**              (40 files)
components/estimate-builder/gantt/**                          (6 files — pending the Phase 7 decision)
components/estimate-builder/takeoff-engine/**                 (36 files remaining after this session's
                                                                deletions — confirm which parts, if any,
                                                                are still live vs. dev-sandbox-only;
                                                                components/estimate-builder/takeoff-engine/
                                                                workbook/TakeoffEngineWorkbookPage.jsx is
                                                                confirmed orphaned — do not move it, resolve
                                                                per §0.1.3 instead)
lib/construction-estimation/**                                (31 files: engines, assemblies/, data/, schemas/)
lib/estimate-builder/developerBypass.js
hooks/estimate-builder/useEstimateBuilderWorkbook.js
```
→ `modules/estimate-builder/{components,services,hooks}/`, with `document-engine/` and `standard-inclusions/` already nested here from Phase 7.

Stay as thin wrappers:
```
pages/modules/estimate-builder/{buy-credits,index,payment,recover-template,register-job}.js
pages/editor/[id].js   (confirm this page's actual relationship to estimate-builder before assuming
                        it belongs here — the audit found no direct reference; verify at execution time)
pages/dev/takeoff-engine-test.jsx   (dev-only — decide whether this survives the rebuild or is retired)
pages/api/project-estimate/**  (5 files: instances/[id], instances/index, templates/[id],
                                 templates/[id]/versions, templates/index)
pages/api/builders/**  (5 files — convert-to-live-project, proposal-document-{export,remove,upload},
                        sync-commercial-snapshot)
pages/api/production/team-members.js
```

### Imports that must change
- `pages/modules/construction/index.js:8` → `import { estimateJobsRemainingLabel, isDeveloperAccount } from "../../../lib/estimate-builder/developerBypass"` becomes a pointer into `modules/estimate-builder/services/developerBypass.js`. This is the one confirmed reverse-dependency for this entire module and it originates from **outside** the module (a hub page) — the exact kind of edge that's easy to miss because it isn't inside the folder you're moving.
- Internal cross-references between `EstimateBuilderWorkbook.js` and the now-nested `document-engine/`/`standard-inclusions/` folders (already updated in Phase 7 — re-verify they still resolve after this phase's additional moves change the relative depth again).

### Testing checklist
Apply §0.3, plus: run every existing test file in scope (`components/estimate-builder/ai-takeoff/*.test.mjs`, `components/estimate-builder/takeoff-engine/tests/*.test.mjs` for whichever implementation survived the rebuild, `components/document-engine/tests/*.test.mjs` again since paths shifted once more). Manually run a full estimate-builder workflow end to end: create a job, run a takeoff on an uploaded plan, generate a document, confirm `/modules/construction` (the reverse dependent) still shows the correct developer-bypass labeling.

### Success criteria
Apply §0.5, plus: exactly one takeoff implementation remains (the ai-takeoff/takeoff-engine duplication from the audit is resolved, not just relocated), and `TakeoffEngineWorkbookPage.jsx` and any other confirmed-orphaned files from the pre-flight list are not present in the new module folder.

---

## Overall Definition of Done (all 8 phases)

- Every module listed in the audit's independence-score table has moved to `modules/<name>/`, with only thin routing wrappers remaining under `pages/`/`pages/api/`.
- `components/`, `lib/`, and `hooks/` at the repo root contain only the framework-level items from §0.6 plus anything explicitly identified as genuinely cross-cutting during a phase (e.g. the Website Builder public barrel's consumers, if any residual shared piece is deliberately kept out of a module).
- All shims introduced in each phase have been deleted, and their removal was verified against a clean test gate (§0.3) with zero remaining old-path references.
- No phase's rollback tag (`pre-phase-<n>`) has been used — if one was, that phase's postmortem should be folded back into this plan before the next phase starts.
- The Gantt duplication, the Email/CRM route-embedding, and the ai-takeoff/takeoff-engine duplication — the three "resolve, don't just relocate" items called out above — are each resolved to a single implementation, not merely present in two different new folders.

**No migration work begins until this plan and the underlying audit are reviewed and approved.**
