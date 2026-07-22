# Module Architecture Audit

Date: 2026-07-22
Status: **Read-only analysis. No code was modified to produce this report.**
Supersedes: the 2026-07-21 draft of this file, which was explicitly conservative ("several broad read-only scans timed out... run madge/dependency-cruiser to confirm exact import edges before migration"). This version replaces those assumptions with grep-verified `file:line` evidence gathered across seven targeted scans of the live route tree, component tree, and lib tree.

---

## 1. Executive Summary

This is a Next.js 15 **Pages Router** application (`pages/*`, no `app/*` directory) that has grown from a funnel builder into a ten-plus-product commercial platform: Estimate Builder/Takeoff, Website Builder, CRM/Email/Automation, Telephony/SMS, Social Media, Freedom Trader/Terminal/Portfolio (trading & investment), Vendor/Affiliate/Marketplace, Gantt/Scheduling, Standard Inclusions, Founding Growth Partner, Calendar/Booking, and Billing — all sharing one `pages/`, `components/`, `lib/`, and `hooks/` tree, one Supabase project, and one deploy.

**The core finding:** module boundaries are inconsistent, not absent. Some modules (Founding Growth Partner, Freedom Trader, Website Builder) are already almost fully self-contained and could be extracted into `/modules/<name>` with very little risk. Others (CRM, Email/Automation, Estimate Builder/Takeoff) have real cross-module code dependencies — not just shared routing — that must be resolved *before* a physical move, or the move will break call sites silently.

The single most urgent structural problem is **Estimate Builder / Takeoff Engine**: git status shows an active, in-progress rebuild where an entire richer TypeScript detection/rendering subsystem (`takeoff-engine/{detections,interactions,processing,rendering,persistence}`) was deleted this session while a parallel, independently-evolved system (`ai-takeoff/`) is being edited simultaneously. Two competing takeoff implementations currently coexist. This module should not be touched for migration until that rebuild lands and one implementation wins.

A second notable finding: the previously-documented "GlobalTextEditor" unified text-styling system (`components/text-editor/`, `lib/text-editor/`) is fully built but **has zero importers anywhere outside its own directory and three owning hooks**. Website Builder, Email, and Image Editor each still use their own local, disconnected text controls. This system is dead weight in its current form, not shared infrastructure — see §6.

Third: `zustand` and `@reduxjs/toolkit` are installed dependencies with **zero usage in source** anywhere in the repo. No global client state library is actually wired up; all "global state" is React Context (one provider: `AuthContext`), direct Supabase reads in `useEffect`, or hand-rolled `localStorage` persistence.

---

## 2. Current Architecture

### 2.1 Platform shape

- Router: Next.js Pages Router. `pages/` = 762 files, `pages/api/` = 489 files.
- `pages/modules/<name>/` = the de facto module namespace for authenticated product areas (accounting, affiliates, agency, billing, builders, business-automation, calendar, communities, construction, email, estimate-builder, freedom-portfolio, funnels, gantt, hr, integrations, jobboard, phone, pipelines, production, projects, social_media, subaccounts, tools, vendor, webinars, website-builder).
- Implementation code for each module is **not** colocated with its route folder — it lives in flat, cross-cutting `components/<domain>/`, `lib/<domain>/`, `hooks/<domain>/` directories, which is the root cause of the ownership ambiguity this audit was commissioned to investigate.
- `context/AuthContext.js` is the only React Context provider in the app; it wraps everything in `pages/_app.js`.
- No `app/` router, no React Query/SWR, no wired-up Zustand or Redux store despite both being dependencies.

### 2.2 Application flow

1. Route resolves under `pages/*` or `pages/modules/<name>/*`.
2. `pages/_app.js` mounts global CSS + `AuthProvider`.
3. Module/auth gating: `pages/modules/_guard.js` (`useModuleGuard`), `hooks/useWorkspace`.
4. Page file imports a large feature component from `components/<domain>/` (often a single "workbook"/"canvas" god-component — e.g. `EstimateBuilderWorkbook.js`, `visual-builder.js` at 3,800+ lines).
5. Feature component imports services from `lib/<domain>/` — frequently instantiating its **own** Supabase client rather than sharing one (see §6.4).
6. Client calls hit `pages/api/<domain>/*`, which independently create Supabase clients, run business logic, and touch third-party APIs (Stripe, Twilio, SendGrid, SMSGlobal, OpenAI).

### 2.3 Non-source directories found during the scan

The repo root also contains a substantial amount of non-live scratch/backup material that is **not part of the module architecture** but adds noise to any future migration:

| Directory | Status | Evidence |
|---|---|---|
| `.history/`, `tmp/`, `recovery/`, `.codex-tmp/` | Orphaned, zero code references | grep across `pages/`, `components/`, `lib/` returns nothing |
| `website-builder-sites-backup-stage1-20260606-101444/` | Orphaned, one-off manual snapshot | zero references in `lib/` or `pages/api/` |
| `website-builder-sites-project-backup-recovery-20260607-064606/` | Orphaned, one-off manual snapshot | zero references |
| `2208a52a-8175-477e-823c-fc6de7fe4afe/` (root) | Orphaned as a **folder**; its UUID is used elsewhere only as a data value (a project ID / storage path string in `pages/api/website-builder/projects.js`, `lib/website-builder/publishConfig.js`, etc.), never as a filesystem import | not read by any live `import`/`require` |
| `website-builder-sites/` | **Live runtime data root** | `lib/website-builder/siteStorage.js:6` resolves it via `process.env.WEBSITE_BUILDER_SITES_DIR` (default `path.join(process.cwd(), "website-builder-sites")`) |
| `website-builder-backups/` | **Live runtime data root** | `lib/website-builder/backupStorage.js:4-5`, same pattern |
| root `standard-inclusions/` (distinct from `components/standard-inclusions`) | **Live, imported** | `lib/standard-inclusions/masterTemplate.js:1` imports `../../standard-inclusions/premier-inclusions-template.full.json` |

This is a good candidate for a cheap, near-zero-risk cleanup pass (archival, not deletion, if there's any doubt) once the audit is approved — but it is out of scope for this read-only phase.

---

## 3. Route Map

Format per module: `URL → Route file → Main component → Shared/framework deps it pulls in`.

### Estimate Builder / Takeoff
| URL | Route | Main component | Shared deps |
|---|---|---|---|
| `/modules/estimate-builder` | `pages/modules/estimate-builder/index.js` | `components/estimate-builder/EstimateBuilderWorkbook.js` | `document-engine/{templates,core}`, `standard-inclusions/OnlyOfficePresentationEditor`, `ai-takeoff/{AIPlanTakeoffPage,pdfPlanRendering}` |
| `/dev/takeoff-engine-test` | `pages/dev/takeoff-engine-test.jsx` | `takeoff-engine/viewer/TakeoffViewer.jsx` | `takeoff-engine/{import,analysis,core,state}` (dev-only, separate code path from the live workbook) |
| `/modules/construction` | `pages/modules/construction/index.js` | (hub page) | `context/AuthContext`, **`lib/estimate-builder/developerBypass`** (reaches into a module-private helper) |

### Website Builder
| URL | Route | Main component | Shared deps |
|---|---|---|---|
| `/modules/website-builder` | `pages/modules/website-builder/index.js` | (project list) | `lib/website-builder/{projectStore,remoteProjects,templates,launchSelfHostedBuilder,mediaAssets}` |
| `/modules/website-builder/visual-builder` | `pages/modules/website-builder/visual-builder.js` (3,806 lines) | `components/website-builder/PageBuilderCanvas.js` (dynamic import) | `lib/website-builder/{mediaAssets,chaiStudio,publishConfig,projectStore,pageBlockComponents,accordionPanels,footerNavigation,videoHero,remoteProjects}` |
| `/[slug]`, `/sites/[...slug]` | `pages/[slug].js`, `pages/sites/[...slug].js` | `PublishedWebsiteRenderer` | `lib/website-builder/{publishConfig,publicationStore}` — public site rendering, high blast radius |

### CRM / Email / Automation / Lists
| URL | Route | Main component | Shared deps |
|---|---|---|---|
| `/leads` | `pages/leads.js` | `components/crm/{SubscriberAvatar,LeadDetailsModal}` | `hooks/useWorkspace`, `utils/avatar`, `utils/supabase-client` |
| `/modules/email` | `pages/modules/email/index.js` | (dashboard, inline JSX) | `utils/supabase-client`, `data/pricing` |
| `/modules/email/automation` | `pages/modules/email/automation/index.js` | `components/nodes/{Trigger,Email,Delay,Condition}Node(Drawer)` | — |
| `/modules/email/crm/*` | `pages/modules/email/crm/{calls,deals,kanban,pipelines,quotes,teams,workspace,sms-marketing}.js` | CRM UI **embedded inside the Email module's route tree** | blurs Email/CRM ownership — see §4.3 |

### Investment / Trading (three parallel systems)
| URL | Route | Main component | Shared deps |
|---|---|---|---|
| `/freedom-trader/*` | `pages/freedom-trader/{index,alerts,positions,portfolio,trades,settings,market-opportunities}.js` | `components/freedom-trader/{PaperAccountBar,PaperOrderTicket}` | `lib/freedom-trader/{localPaperStore,marketData,paperTrading,twelveData}`; own API: `pages/api/freedom-trader/*` (13 routes) |
| `/freedom/*` | `pages/freedom/*` | (legacy research/scoring UI) | `lib/freedom-terminal/{adaptiveBuyScore,analysisEngine,core,importEngine}`; own API: `pages/api/freedom/*` |
| `/modules/freedom-portfolio` | `pages/modules/freedom-portfolio/index.js` | (watchlist tool) | own API: `pages/api/freedom-portfolio/{quote,watchlist}.js` |

### Vendor / Affiliate / Marketplace, Founding Growth Partner, Account
| URL | Route | Main component | Shared deps |
|---|---|---|---|
| `/modules/vendor`, `/modules/affiliates/*` | 15 pages | `components/vendor/VendorUserBanner.js` | `utils/supabase-client` |
| `/founding-growth-partner/*` | `pages/founding-growth-partner/{index,[agencySlug]}.js` | `FoundingGrowthPartnerPage.jsx` | `lib/founding-growth-partner/content.js` — fully self-contained, own API |
| `/account` | `pages/account/index.js`, `pages/admin/business-profile-vaults.js` | `BusinessProfileVault.js` | own API: `pages/api/account/business-profile-vault.js` |

### API route groupings (489 files under `pages/api/`)
CRM/contacts, Funnels, Email, SMS/Telephony, Calendar/Booking, Billing/Payments (Stripe/PayPal), Website Builder, Estimate/Construction, Vendor/Marketplace/Affiliates, Jobboard, Integrations/Automation, Social, Courses/Media, Auth/Account/Admin, Ops/Infra (cron/webhooks), and a non-production Dev/Debug group (`pages/api/dev`, `debug*`, `diag*`, `fix-*.js`). The Dev/Debug and `pages/dev`/`pages/qa`/`pages/draft` routes are live, reachable routes, not dead code — but they are internal tooling and should be gated behind the same auth pattern as the rest of the app if they aren't already.

---

## 4. Dependency Analysis

### 4.1 Confirmed cross-module code imports (not just navigation links)

| From | To | Evidence | Verdict |
|---|---|---|---|
| `components/estimate-builder/EstimateBuilderWorkbook.js:31-35` | `components/document-engine/{templates,core}`, `components/standard-inclusions/OnlyOfficePresentationEditor` | direct import | Expected — document-engine has exactly one consumer (see §4.2) |
| `pages/modules/construction/index.js:8` | `lib/estimate-builder/developerBypass` | direct import | **Boundary violation** — a route hub outside the estimate-builder module reaches into its private lib helper |
| `components/crm/LeadDetailsModal.js:20` | `components/telephony/BrowserDialer` | direct import | Real coupling: CRM's dialer UI depends on Telephony |
| `lib/crm/writebacks.js` | CRM contact timeline | Email module writes email-open/click events into CRM state | Intentional marketing-suite coupling (acceptable if scoped deliberately) |
| `lib/lists/crm-sync.js` | `leads`, `lead_lists`, `lead_list_members` tables | Lists ↔ CRM bridge | Same — intentional, but currently implicit (table-level, no shared types) |
| `pages/modules/email/crm/*` | CRM UI | route-embedding | Ownership ambiguity: is this Email's module or CRM's? |

No genuine cross-imports were found between: Estimate Builder ↔ Website Builder, Estimate Builder ↔ CRM/Email, Website Builder ↔ CRM/Email, Freedom Trader/Terminal/Portfolio ↔ any other module, Founding Growth Partner ↔ anything. These pairs are already clean.

### 4.2 "Shared" components that are actually single-consumer

These live in top-level shared-looking folders (`components/`) but are imported by exactly one module today:

| Folder | Real consumer(s) | Should live under |
|---|---|---|
| `components/document-engine/` (35 files) | `components/estimate-builder/` only (+ QA pages testing the same feature) | `components/estimate-builder/document-engine/` |
| `components/gantt/` + `lib/gantt/` + `hooks/gantt/` (21 files) | `pages/modules/gantt/` only | its own `modules/gantt/` |
| `components/nodes/` (10 files) | `pages/modules/email/automation/` only | `modules/email/automation/nodes/` |
| `components/standard-inclusions/` + `lib/standard-inclusions/` | `components/estimate-builder/` only (one-way) | `modules/estimate-builder/standard-inclusions/` |
| `components/text-editor/` + `lib/text-editor/` | **nobody** (see §6) | undecided — currently dead |

### 4.3 Duplicated / parallel logic (the real "why fixing one module breaks another" risk)

1. **Takeoff, twice.** `components/estimate-builder/ai-takeoff/` (live, wired into the workbook) and `components/estimate-builder/takeoff-engine/` (reduced to a dev-only sandbox after this session's deletions) independently implement PDF rendering, orientation detection, and plan-coordinate math. `takeoff-engine/workbook/TakeoffEngineWorkbookPage.jsx` has **zero importers anywhere** — fully orphaned.
2. **Gantt, twice.** `components/gantt/` (standalone module, used by `/modules/gantt`) and `components/estimate-builder/gantt/` (`GanttBuilderPage.jsx`, `GanttChart.jsx`, `AIScheduleService.js`) are two unrelated implementations that never import each other.
3. **Trading/Investment, three times.** Freedom Trader (paper trading, active development), Freedom Terminal (legacy company research/scoring, consumed by `pages/freedom/*`), and Freedom Portfolio (a third, smaller watchlist tool) are siblings that were never merged, each with its own API surface.
4. **Supabase client instantiation, five ways.** `utils/supabase-client.js`, `utils/supabase-admin.js`, `lib/supabaseAdmin.js`, `services/supabaseClient.js`, `lib/db/supabase.js` each independently call `createClient(...)`. On top of that, `createClient(` appears in **~230 files total**, overwhelmingly individual `pages/api/**` route handlers each creating their own client rather than importing a shared one.
5. **Twilio token generation, duplicated.** `lib/twilio/token.js` (`createVoiceToken`) has zero importers; `pages/api/telephony/voice-token.js:41-53` reimplements the identical `AccessToken`/`VoiceGrant` logic inline instead.

### 4.4 Circular imports

**None found.** No A→B→A cycle was identified in any of the seven scans. The real risk in this codebase is not circularity — it's **directional leakage** (a hub page reaching into a module's private lib, e.g. `construction/index.js` → `lib/estimate-builder/developerBypass`) and **undeclared duplication** (§4.3), both of which are more dangerous for a folder-based module migration because there's no import error to catch the mistake — the code will simply keep working from the old path.

### 4.5 Modules that should never depend on each other directly (recommended allow-list boundary)

- Estimate Builder/Takeoff ⟷ Website Builder — no current coupling, keep it that way.
- Website Builder ⟷ CRM/Email — no current coupling, keep it that way.
- Freedom Trader/Terminal/Portfolio ⟷ any commerce module — no current coupling, keep it that way.
- CRM → Telephony is acceptable as a one-way dependency (CRM consumes a Telephony widget); Telephony must never import CRM.
- Email → CRM (route-embedding) should be resolved explicitly: either CRM keeps full ownership and Email links to it, or the shared parts become a genuine `modules/crm-email-shared/` library — not both blurred as today.

---

## 5. Module Independence Scores

Scores reflect: (a) how many *genuine code imports* cross the module's boundary in either direction, (b) internal duplication/instability, (c) how cleanly the module's own routes/lib/components already align. 100 = fully extractable today with an import allow-list and nothing else.

| Module | Score | Why |
|---|---|---|
| **Founding Growth Partner** | **95%** | Zero cross-module imports found in either direction; owns pages, API, and lib cleanly. Best first-migration candidate. |
| **Freedom Trader** | 80% | Zero cross-module coupling; own API namespace and test file. Currently under active development (git status shows same-session edits) — stable in structure, not in code churn. |
| **Freedom Terminal** | 75% | Zero cross-module coupling, but is a legacy sibling of Freedom Trader never merged with it — independence is real, cohesion with "Investment/Trading" as a single product concept is not. |
| **Freedom Portfolio** | 75% | Small, clean, zero coupling. |
| **Account** | 75% | Clean single-purpose module (`BusinessProfileVault`), own API. |
| **Vendor/Affiliate/Marketplace** | 70% | Internally cohesive (`VendorUserBanner` reused across its own 15 pages — intra-module, not cross-module), own API namespaces. |
| **Website Builder** | 65% | Zero *outbound* coupling to other feature modules (confirmed for estimate-builder/crm/document-engine/text-editor). But its `lib/` is *inbound*-consumed very broadly (`pages/[slug].js`, `middleware.js`, `pages/pricing.js`, `pages/modules/funnels/new.js`, QA pages) — extractable, but needs a defined public interface so those callers don't reach into internals. |
| **Gantt (standalone module)** | 55% | Single consumer, clean internally, but duplicated by an unrelated implementation inside Estimate Builder (§4.3) — the module itself is fine, the *product concept* is fragmented. |
| **Telephony/SMS** | 55% | Own large API surface, but is directly imported by CRM (`LeadDetailsModal` → `BrowserDialer`), and has dead/duplicated token logic. |
| **Estimate Builder** | 50% | Consumes document-engine and standard-inclusions, both single-consumer today (low real risk), but is leaked into by `construction/index.js`, and its own AI-Takeoff/Takeoff-Engine sub-areas are internally duplicated and mid-rebuild. |
| **Email** | 45% | Embeds CRM's own route tree (`pages/modules/email/crm/*`) inside itself — the module boundary with CRM is not actually drawn yet. |
| **Standard Inclusions** | 45% | Clean one-way dependency *of* Estimate Builder — good in isolation, but only makes sense as a nested sub-module, not a top-level independent product. |
| **Automation** | 40% | Tightly coupled to Email (shares `components/nodes/`, no independent identity yet). |
| **CRM** | 40% | Imports Telephony directly; is itself imported into by Email's route tree; `SendToAutomationPanel` bridges into Automation. |
| **Takeoff Engine** (as a future standalone module, separate from Estimate Builder) | 25% | Actively being rebuilt this session; two competing implementations coexist; one whole subsystem (`workbook/TakeoffEngineWorkbookPage.jsx`) is orphaned. Lowest score in the audit — do not migrate until stabilized. |

**Not deep-audited this pass** (preliminary estimates only — recommend a dedicated follow-up scan before relying on these): Social Media (~65%, own `lib/social/` adapters, no coupling observed but not exhaustively checked), Calendar/Booking (~70%, own API/lib, not exhaustively checked), Project Hub / Builders / Production / Jobboard (~50%, several `pages/modules/builders/*` pages appeared to be thin wrappers that mostly link out to `/modules/estimate-builder` rather than containing independent logic — this needs a dedicated pass to confirm), Billing/Pricing (functions more as a cross-cutting shared concern than a standalone product module — see §6).

---

## 6. Shared Components Inventory

| Component/folder | Who uses it | Should remain shared? |
|---|---|---|
| `context/AuthContext.js` | Mounted globally in `pages/_app.js`; directly consumed by ~10 files (a few top-level pages, 3 in estimate-builder, 2 in vendor) | **Yes** — genuine framework-level auth state |
| `utils/supabase-client.js`, `utils/supabase-admin.js` | Broadly, across nearly every module | Yes, but **consolidate** — currently 5 parallel Supabase client files doing the same job (§4.3) |
| `hooks/useWorkspace` | `pages/dashboard.js`, `pages/leads.js`, `pages/modules/builders/boq.js`, others | Yes — framework-level workspace/auth gate |
| `pages/modules/_guard.js` (`useModuleGuard`) | Module route gating | Yes — framework-level |
| `components/ui/AIWriterAssist.js` | `pages/modules/funnels/edit/[id].js`, `pages/modules/social_media/ads.js` (2 modules) | Borderline — keep, low risk |
| `components/ui/BackArrow.js`, `components/ui/card.js` | **Zero importers found** | No — dead code, candidates for deletion (not part of this read-only phase) |
| `components/text-editor/*`, `lib/text-editor/*` ("GlobalTextEditor") | **Zero importers outside its own directory + 3 owning hooks.** Not used by Website Builder (which has its own local `RichText.js`), Email, or Image Editor. | **Currently neither shared nor module-specific — it's unwired.** Either finish the integration (wire it into the editors it was designed for) or don't count it as shared infrastructure yet. |
| `components/document-engine/*` | Estimate Builder only (+ QA) | No — move into Estimate Builder module |
| `components/gantt/*`, `lib/gantt/*`, `hooks/gantt/*` | `/modules/gantt` only | No — move into its own `modules/gantt/`, resolve duplication with `components/estimate-builder/gantt` |
| `components/nodes/*` | Email/Automation only (`NodeDrawer.js`, `EmailEditorModal.js` have zero importers — dead) | No — move into Email/Automation module |
| `components/vendor/VendorUserBanner.js` | 15 pages, all within Vendor/Affiliate | No — intra-module reuse, move into Vendor module |
| `components/billing/PlatformPricingPlans.js`, `components/pricing/*` | Website Builder pricing pages **and** the Billing module | Yes — genuinely cross-cutting commercial concern |
| `components/crm/SubscriberAvatar.js` | `pages/leads.js` (CRM) and `pages/modules/communities/index.js` (Communities) | Mild cross-module use — worth watching, not urgent |

---

## 7. Global State and Shared Persistence

- **React Context:** one provider, `AuthContext` (`{ user, session, loading }`), mounted in `_app.js`. No context is consumed below the page level — components never read auth directly, they receive it via props or make their own Supabase calls.
- **Zustand:** installed (`package.json`), **zero usage anywhere in source**. Dead dependency.
- **Redux Toolkit:** installed, **zero usage anywhere in source**. Dead dependency.
- **React Query / SWR:** absent from `package.json` and source. All data fetching is manual `fetch`/Supabase calls inside `useEffect`.
- **Supabase:** `createClient(` appears in ~230 files (~159 `pages/api/**` handlers instantiating per-request, 51 in `scripts/`, 9 in `lib/`). No enforced singleton pattern — see §4.3 for the 5 parallel client wrapper files.
- **`lib/db/supabase.js`:** a CRM data adapter with automatic offline fallback (Supabase if env vars are set, else `localStorage` `crm_contacts_v1`). **Zero other files import it** — it's a second, disconnected CRM persistence path that nothing actually calls; the live CRM goes through `pages/api/crm/*` instead.
- **localStorage/sessionStorage:** no `document.cookie`/`cookies()` usage found in `components/`/`lib/`. `localStorage` is used in 15 component files (heaviest in `components/website-builder/PageBuilderCanvas.js` — dozens of keys for project/asset/template/backup state) plus `lib/website-builder/projectStore.js` (client-side project persistence) and `lib/crm/writebacks.js`. Two entries are worth flagging as business-state-in-the-browser risk rather than a technical bug: `components/Layout.js` stores a `gr8:setup:done` onboarding-complete flag and an `xchange_user_code` vendor identity code client-side — both look like they should be server-side/per-account state rather than per-device.

---

## 8. Risk Assessment

**High risk**
- Estimate Builder / Takeoff — active mid-rebuild, two competing implementations, orphaned subsystem, module boundary already leaked into by `construction/index.js`.
- Website Builder — not risky *internally*, but has the widest blast radius of any module if moved carelessly: public site rendering (`pages/[slug].js`, `pages/sites/[...slug].js`), `middleware.js`, and even the Funnels module all import its `lib/` directly.
- CRM ↔ Telephony hard dependency (`LeadDetailsModal` → `BrowserDialer`) — moving either module without accounting for the other breaks the dialer feature silently (no import error, since paths would just need updating).

**Medium risk**
- Email/Automation/CRM route-embedding (`pages/modules/email/crm/*`) — ownership is genuinely ambiguous today; needs an explicit decision before either module moves.
- Gantt duplication (two independent implementations) — not urgent to fix, but migrating one without addressing the other will cement the fragmentation.
- The 5-way duplicated Supabase client pattern — no single migration breaks from this, but every module migration will need to decide which client file it takes with it.

**Low risk**
- Founding Growth Partner, Freedom Trader/Terminal/Portfolio (once their current edits settle), Vendor/Affiliate, Account — all show zero confirmed cross-module code imports.
- The orphaned backup/scratch directories (§2.3) — no code depends on them; safe to archive independent of any module migration.

---

## 9. Migration Strategy

Recommended order, safest first:

**Phase 1 — Founding Growth Partner.** Zero coupling, small surface, proves out the `/modules/<name>` pattern end-to-end (pages + API + lib + components) with near-zero risk.

**Phase 2 — Account, Vendor/Affiliate/Marketplace.** Self-contained, only intra-module reuse (`VendorUserBanner`), moderate size. Second proof point, slightly larger.

**Phase 3 — Freedom Trader, Freedom Terminal, Freedom Portfolio.** Each individually clean, but migrate together and use the move as the forcing function to decide whether these three become one `modules/investment/` or stay separate — don't migrate them into three more disconnected folders. Wait for current active edits to settle first.

**Phase 4 — Telephony, then CRM.** Move Telephony first (nothing depends on it moving), then CRM, updating the one known cross-import (`BrowserDialer`) as a deliberate, tracked step rather than an accidental break.

**Phase 5 — Email, Automation, Lists, Social.** Requires an explicit decision on the Email/CRM route-embedding (§4.3, §8) before the physical move — resolve ownership on paper first, then move.

**Phase 6 — Website Builder.** Structurally ready, but must ship a defined public interface (a small set of exported functions/types) for the external callers (`pages/[slug].js`, `middleware.js`, Funnels, pricing pages) before the folder moves, so those stay working through the migration.

**Phase 7 — Gantt, Document Engine, Standard Inclusions.** Resolve the Gantt duplication and fold Document Engine/Standard Inclusions into Estimate Builder as nested sub-modules (they have no independent identity — they're single-consumer libraries).

**Phase 8 — Estimate Builder / Takeoff.** Last, and only once the in-progress takeoff rebuild lands and the ai-takeoff/takeoff-engine duplication is resolved to one implementation. This is the largest, most actively-changing, and currently least-independent module in the platform (25–50% depending on sub-area) — migrating it mid-rebuild would mean migrating a moving target.

**Why this order:** it front-loads modules with zero confirmed cross-imports (so the folder-move step itself can't silently break another module), saves the modules with real code coupling for the middle (where the team will already have migration muscle memory from Phases 1–3), and puts the least stable, highest-file-count module last, after its own internal rebuild is done — moving a module while it's mid-rewrite means auditing a target that changes under you.

---

## 10. Recommended First Migration Candidate

**Founding Growth Partner.**

**Why first:** it is the only module in this audit with *zero* confirmed cross-module imports in either direction, a small and fully self-contained file set, and no involvement in any current active-development churn (unlike Estimate Builder/Takeoff and Freedom Trader, both of which show same-session edits in git status). It's the lowest-possible-risk way to validate the `/modules/<name>` folder shape, the import allow-list mechanism, and the build/deploy pipeline change before attempting a module with real coupling.

**Files that would move** (when migration is later approved — not done now):
- `components/founding-growth-partner/FoundingGrowthPartnerPage.jsx` → `modules/founding-growth-partner/components/`
- `lib/founding-growth-partner/content.js` → `modules/founding-growth-partner/lib/`
- `pages/founding-growth-partner/index.js`, `pages/founding-growth-partner/[agencySlug].js` → stay as thin Next.js page files that import from `modules/founding-growth-partner/` (Pages Router requires route files to physically live under `pages/`)
- `pages/api/founding-growth-partner/guide.js`, `pages/api/founding-growth-partner/interest.js` → same pattern, thin re-exports under `pages/api/`

**Dependencies that must be preserved:** none of the module-internal ones change. The only shared/framework dependency to keep working is whatever Supabase client and auth check these API routes currently use — confirm at migration time which of the 5 client wrappers they call and don't change it as part of the same commit as the folder move.

**Risks:** minimal. The only thing to verify post-move is that Next.js still resolves the physical page/API files correctly (Pages Router routing is filesystem-based, so `pages/founding-growth-partner/*` and `pages/api/founding-growth-partner/*` must stay where Next.js can find them, importing logic from the new `modules/` location rather than containing it).

---

## 11. Estimated Effort and Milestones

| Phase | Modules | Rough effort | Milestone |
|---|---|---|---|
| 1 | Founding Growth Partner | 0.5–1 day | Folder pattern + allow-list proven |
| 2 | Account, Vendor/Affiliate | 1–2 days | Second data point on medium-size modules |
| 3 | Freedom Trader/Terminal/Portfolio | 2–4 days | Decide 1-vs-3 folder structure; investment product boundary set |
| 4 | Telephony → CRM | 3–5 days | Cross-module dependency (BrowserDialer) tracked and preserved |
| 5 | Email/Automation/Lists/Social | 5–8 days | Email/CRM route-embedding resolved on paper and in code |
| 6 | Website Builder | 4–6 days | Public interface shipped; external callers unaffected |
| 7 | Gantt/Document Engine/Standard Inclusions | 3–5 days | Gantt duplication resolved; nested under Estimate Builder |
| 8 | Estimate Builder/Takeoff | 8–12+ days, **after** current rebuild lands | Single takeoff implementation; module fully self-contained |

These are rough sizing estimates for planning purposes, not commitments — each phase should get its own focused scan (import graph tool: `madge` or `dependency-cruiser`) immediately before execution to catch any drift from this snapshot.

---

## 12. Conclusion

No code was changed to produce this report. The platform's architecture problem is real but tractable: there are no circular dependencies, the genuinely cross-cutting shared code (auth context, Supabase clients, workspace hooks) is a small, identifiable set, and roughly a third of the modules are already independent enough to move with low risk today. The two areas that need attention *before* any migration — not during — are the Estimate Builder/Takeoff rebuild (let it finish and consolidate to one implementation) and the Email/CRM route-embedding (make an ownership decision on paper). Everything else in this report is either safe to move now (Phases 1–3) or has a clearly named, single dependency to account for when its turn comes (Phases 4–7).

**Awaiting approval before any migration work begins.**
