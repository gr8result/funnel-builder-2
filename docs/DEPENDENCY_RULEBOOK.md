# Dependency Rulebook

Date: 2026-07-22
Status: **Proposed architectural standard. No code has been moved or modified to produce this document.**
Depends on: [`docs/MODULE_ARCHITECTURE_AUDIT.md`](./MODULE_ARCHITECTURE_AUDIT.md) (the evidence), [`docs/MODULE_MIGRATION_PLAN.md`](./MODULE_MIGRATION_PLAN.md) (the sequencing).

**Purpose.** The audit found the problem (unclear module ownership); the migration plan found the path (how to move without breaking things). This document is the rule the project holds itself to *after* the migration, and starting **now**, for every new feature — so the platform doesn't drift back into the same shared-folder ambiguity six months from now. Once approved, this document is binding: any PR that violates it should fail review, and any exception must amend this document in the same PR (§9).

---

## 1. Permanently Shared Directories

These, and only these, are genuine framework-level code. Nothing else may live outside a module folder once the migration lands. Anything currently in `components/`, `lib/`, or `hooks/` at the repo root that is **not** on this list is module-owned code sitting in the wrong place, per the audit, and is scheduled to move under [`MODULE_MIGRATION_PLAN.md`](./MODULE_MIGRATION_PLAN.md).

| Directory | Contents | Rule |
|---|---|---|
| `context/AuthContext.js` | Global auth session state | May be imported by any module. Never import a module *into* it. |
| `pages/_app.js`, `pages/_document.js`, `pages/_error.js`, `middleware.js` | App shell, global bootstrap | Core platform files. May import a module's **public barrel only** (§3.3), never a module's internal path. |
| `utils/supabase-client.js`, `utils/supabase-admin.js` | The canonical Supabase clients | **Target end-state: exactly these two, one anon/browser and one admin/service-role.** `lib/supabaseAdmin.js` and `services/supabaseClient.js` are duplicate wrappers identified in the audit and must be retired into these two, not carried forward as a third and fourth option. No module may instantiate its own `createClient(...)`. |
| `hooks/useWorkspace.js` | Workspace/auth gating hook | Shared. Never module-specific logic. |
| `pages/modules/_guard.js` (`useModuleGuard`) | Module route gate | Shared. Every module's route wrapper uses this, none reimplement it. |
| `components/ui/` | Generic UI primitives with **2+ genuine cross-module consumers** | Anything with 0–1 consumers does not belong here (§8) — see `BackArrow.js`/`card.js` in the audit, both zero-consumer and slated for removal, not modules-folder relocation. |
| `components/billing/`, `components/pricing/` | Cross-cutting plan/pricing display | Confirmed used by both Website Builder and the Billing module — a genuine cross-cutting commercial concern, stays shared. |
| `iconMap` (wherever it currently resolves from) | Icon registry used across nearly every module route | Shared. |
| `shared/`, `lib/db/` *(future, once the current `lib/db/supabase.js` dead-code question is resolved per the migration plan)* | Reserved names for genuinely generic data-access helpers | Nothing module-specific may be added here without a documented second consumer first (§4). |
| `styles/` (global stylesheet entry points), `design-system/` *(if/when introduced)* | Global CSS, design tokens | Shared. Module-specific styles live in `modules/<name>/styles/`. |

**Anything not in this table is module-owned.** In particular — per the audit — `components/document-engine/`, `components/gantt/` + `lib/gantt/` + `hooks/gantt/`, `components/nodes/`, `components/text-editor/` + `lib/text-editor/`, `components/standard-inclusions/` + `lib/standard-inclusions/`, and `components/vendor/VendorUserBanner.js` are **not** shared — each has 0–1 real consumers today and belongs inside that consumer's module folder, not at the repo root.

---

## 2. Module Directory Convention

Every module lives at `modules/<name>/` using this fixed shape. Not every module needs every folder on day one — an empty folder is not required — but if a module has a given kind of code, it goes in the folder below, nowhere else.

```
modules/<name>/
  pages/          # page-level components rendered by the pages/ route wrapper (not routes themselves — see §3.3)
  components/     # module-internal UI components
  hooks/          # module-internal React hooks
  services/       # business logic, API clients, data-fetching (was scattered lib/<name>/)
  types/          # TS types/interfaces (or JSDoc typedefs for .js modules)
  styles/         # module-scoped CSS/CSS modules
  utilities/      # pure helper functions with no framework dependency
  state/          # module-local state (Context, reducer, or store) — never exported outside the module
  tests/          # module-owned tests
  index.js        # the module's PUBLIC BARREL (§3.3) — the only thing other code may import from
  README.md       # one paragraph: what this module owns, its public exports, its one-way dependencies (if any)
```

`<name>` is kebab-case and matches the module's primary route segment under `pages/modules/<name>/` (e.g. `modules/estimate-builder/` ↔ `pages/modules/estimate-builder/`). Sub-features that don't warrant their own top-level module (e.g. Document Engine, Standard Inclusions, both single-consumer under Estimate Builder per the audit) nest as a nested folder inside their owning module — `modules/estimate-builder/document-engine/`, not `modules/document-engine/`.

### 2.1 The Pages Router wrapper pattern (required, not optional)

Next.js Pages Router routes files by filesystem location under `pages/`/`pages/api/`. A module's routes therefore cannot physically live inside `modules/<name>/`. Every route file under `pages/modules/<name>/**` and `pages/api/<name>/**` must be a **thin wrapper**: import the real page/handler from `modules/<name>/pages/` or `modules/<name>/services/` and re-export it. A wrapper file should not contain business logic, JSX beyond a direct render call, or state — if it does, that logic has leaked out of the module folder and back into `pages/`, which is exactly the ownership ambiguity this rulebook exists to prevent.

```js
// pages/modules/<name>/index.js — the entire file
export { default } from "../../../modules/<name>/pages/IndexPage";
```

---

## 3. Which Modules May Import Which

### 3.1 Default rule

A module may import from:
1. Its own `modules/<name>/` folder (anything, freely).
2. The Permanently Shared Directories in §1.
3. Nothing else — **unless the dependency is listed explicitly in §3.2.**

If a new feature needs a dependency not covered by 1–3, that is a signal to either (a) put the shared logic in §1 with a documented second consumer, or (b) reconsider the module boundary — not to add an ad-hoc relative import and move on.

### 3.2 Explicit allow-list (every cross-module edge that exists today, confirmed by the audit, and is intentionally kept)

| From | To | Direction | Why it's allowed |
|---|---|---|---|
| `modules/crm` | `modules/telephony` | one-way | CRM's lead detail dialer UI (`LeadDetailsModal`) genuinely needs Telephony's `BrowserDialer`. Must go through Telephony's public barrel (`modules/telephony/index.js`), never a direct internal path. |
| `modules/email` | `modules/crm` | one-way, **interface-only** | Email writes delivery/open/click events into the CRM contact timeline (`writebacks`). This must be a call through CRM's public barrel — a named function like `recordEmailEvent(contactId, event)` — never a direct import of CRM's internal components. |
| `modules/lists` | `modules/crm` | one-way, **data-only, not code** | `crm-sync.js` reads/writes `leads`/`lead_lists`/`lead_list_members` Supabase tables directly. This is table-level coupling, not a code import, and is permitted as long as it stays table-level — if Lists ever needs to call CRM *logic* (not just tables), that becomes a code dependency and must be added to this table explicitly, through CRM's barrel. |
| `modules/estimate-builder` | `modules/estimate-builder/document-engine`, `modules/estimate-builder/standard-inclusions` | internal nesting, not cross-module | These are sub-folders of Estimate Builder, not peer modules — see §2. Listed here only to be explicit that this is expected and does not need a new allow-list entry every time it's touched. |
| Core platform routes (`pages/_app.js`, `middleware.js`, `pages/[slug].js`, `pages/sites/[...slug].js`, `pages/pricing.js`, `pages/index.js`, `pages/assets.js`) | `modules/website-builder` (public barrel only) | platform → module | Public site rendering and domain routing are platform-level concerns built on the Website Builder module. These callers may only import `modules/website-builder/index.js`'s exported surface, never an internal path like `modules/website-builder/services/projectStore.js` directly. |
| `modules/funnels` | `modules/website-builder` (public barrel only) | one-way | Funnels' "new" flow references Website Builder's project creation. Barrel-only, same rule as above. |

No other cross-module edge currently exists (confirmed via the audit's repo-wide grep) and none should be added silently. **Adding a row to this table is itself an architectural decision** — it should be a deliberate, reviewed line in a PR description, not an incidental relative import three directories deep.

### 3.3 The public barrel rule

Every module's `index.js` is the *only* file other code (other modules, or platform routes per §3.2) may import from. A module's `components/`, `services/`, `hooks/`, `state/`, etc. are private to the module — even for the modules explicitly allowed to depend on it in §3.2. This is what turns "8 external files each importing a different internal Website Builder path" (the audit's actual current state) into "8 files importing one barrel" — if the module's internals reshuffle, only the barrel's exports need to stay stable, not every consumer.

---

## 4. Forbidden Dependencies

These are not merely undocumented — they are **actively disallowed**, because allowing them would recreate exactly the coupling the audit flagged as a risk:

| Forbidden edge | Why |
|---|---|
| `modules/website-builder` → any of `modules/estimate-builder`, `modules/crm`, `modules/email` (or vice versa) | Confirmed zero coupling today (audit). Keep it that way — these are unrelated product domains and any import here is very likely a copy-paste shortcut, not a real requirement. |
| `modules/telephony` → `modules/crm` | The allowed direction is CRM → Telephony (§3.2), never the reverse. Telephony is the lower-level primitive; it must not know CRM exists. |
| `modules/freedom-trader`, `modules/freedom-terminal`, `modules/freedom-portfolio` → any commerce/marketing module (or vice versa) | Confirmed zero coupling. Investment/trading is a self-contained product area; keep it isolated. |
| Any module → another module's internal path (bypassing its `index.js` barrel) | Even for allowed edges in §3.2. An import like `modules/crm/components/LeadDetailsModal` from outside `modules/crm` is forbidden regardless of which module is asking — go through the barrel. |
| Any module → `pages/modules/_guard.js`-style logic reimplemented locally | Use the shared `useModuleGuard` (§1). A module rebuilding its own gate is how you get two ways of doing the same auth check and a security review headache later. |
| A route hub file (e.g. a top-level `pages/modules/<x>/index.js` that isn't itself module `<x>`) reaching into another module's private helper | This is exactly what the audit found: `pages/modules/construction/index.js` importing `lib/estimate-builder/developerBypass` directly. If a hub page needs a module's logic, that logic must be exported from the module's barrel, or the hub page isn't actually a neutral hub — reclassify it. |
| A new top-level directory under `components/`, `lib/`, or `hooks/` for anything that isn't in §1 | All new module-specific code goes under `modules/<name>/`, full stop — see §9. |
| Introducing a new global state library (Redux, a second Zustand pattern, etc.) scoped to one module | `zustand` and `@reduxjs/toolkit` are installed but unused platform-wide (audit finding) — a module reaching for one of these for local state should use `modules/<name>/state/` (Context or a local reducer) instead. If a genuine cross-module state need arises, that's a platform-level decision (goes in §1), not a per-module one. |

---

## 5. Path Alias Conventions

**Pre-condition (do this first, before any module adopts an alias):** `jsconfig.json` currently defines `@/* → ./*`, but `tsconfig.json` coexists with no `paths`/`baseUrl` — and only 8 import sites across 4 files in the whole repo actually use `@/`. Before this rulebook's aliases are load-bearing, move the `paths` mapping into `tsconfig.json` (the config Next.js/TypeScript tooling honors when both files are present) and confirm `npm run build` + `npm run typecheck` pass. Do not add module aliases on top of an alias mechanism that hasn't been confirmed to work.

Once confirmed, the convention is:

| Alias | Resolves to | Use for |
|---|---|---|
| `@modules/<name>/*` | `modules/<name>/*` | Importing from inside a module, or through its barrel: `@modules/crm` (resolves to the barrel), never `@modules/crm/components/LeadDetailsModal` from outside the module. |
| `@shared/*` | the Permanently Shared Directories in §1 that get consolidated under a `shared/` folder as part of the migration (not all of §1 lives there today — `context/`, `hooks/`, and `utils/` stay where they are; `@shared/*` is for genuinely new shared code going forward) | New framework-level code that doesn't fit an existing shared directory name. |
| `@/*` | repo root (existing) | Kept for backward compatibility with the 4 existing files; **do not use for new code** — use `@modules/*` or `@shared/*` instead so intent is explicit at the import site. |

A module's own internal imports (inside `modules/<name>/`) should use plain relative paths (`./`, `../`) — aliases are for crossing the module boundary, not for saving three characters inside a file's own folder. This keeps `grep`-based dependency audits (like the ones that produced the underlying audit) trivial: every alias import is by definition a boundary crossing worth reviewing.

---

## 6. Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Module folder name | kebab-case, matches its route segment | `modules/website-builder/` |
| React components | PascalCase file name matching the default export | `PageBuilderCanvas.js`, `LeadDetailsModal.js` |
| Hooks | camelCase, `use` prefix | `useEstimateBuilderWorkbook.js` |
| Services/lib functions | camelCase file name, named exports over default exports where there's more than one function | `campaignScheduler.js` exporting `scheduleCampaign`, `cancelCampaign` |
| Types (TS) | PascalCase for types/interfaces, file name matches the primary type or is `types.ts`/`index.ts` under `types/` | `ProjectEstimateTypes.ts` |
| Module barrel | always `index.js` (or `index.ts`) at the module root, never `<Name>Barrel.js` or similar | `modules/crm/index.js` |
| Route wrapper files under `pages/` | match the module's page component name in intent, but the *file* stays wherever Next.js routing requires it | `pages/modules/crm/index.js` re-exporting `modules/crm/pages/CrmDashboardPage.jsx` |
| Tests | co-located under `modules/<name>/tests/`, named `<subject>.test.mjs` or `.test.ts` matching the existing repo convention (`documentState.test.mjs`, `pdfPlanRendering.test.mjs`) | `modules/estimate-builder/tests/takeoffGeometry.test.mjs` |
| CSS Modules | `<ComponentName>.module.css`, colocated with the component in `modules/<name>/styles/` or next to the component itself — pick one pattern per module and stay consistent within it | `FoundingGrowthPartnerPage.module.css` |

Avoid version-suffixed file names as a substitute for real versioning (`EstimateWorksheetV2.js`, `EstimateWorksheetV3.js`, `EstimateWorksheetV4.js` all coexist today per the audit) — if a module needs to keep an old implementation alive alongside a new one, that's a `state`/feature-flag decision inside the module, documented in its `README.md`, not an indefinitely growing set of `V2`/`V3`/`V4` files with no record of which one is current.

---

## 7. Folder Conventions

- No module may create a new top-level directory at the repo root. New code belongs inside an existing module's `modules/<name>/` tree or, if genuinely cross-cutting, inside §1's shared directories (which itself requires the second-consumer justification in §4's last row).
- No module's internal folder structure (`components/`, `services/`, etc., per §2) may be imported into directly by another module — only the barrel, per §3.3.
- A module may have nested sub-modules (Document Engine and Standard Inclusions inside Estimate Builder are the confirmed example) when the sub-feature has exactly one consumer and no independent product identity. The moment a second real consumer appears, promote it to a top-level `modules/<name>/` on its own, with its own barrel — don't let a "just for us" nested folder quietly become a second module's actual dependency.
- Static assets required at request-time by Next.js (images, fonts, downloadable templates) stay under `public/`, referenced by path string from the module, never physically moved into `modules/<name>/` (Next.js cannot serve files from there).
- Scratch/backup/one-off directories (the `.history/`, `tmp/`, `recovery/`-style directories identified in the audit) do not belong in the working tree at all going forward — use branches and `git stash` for in-progress work, not root-level backup folders.

---

## 8. How All Future Modules Must Be Created

A new module is created by following this checklist, in order, before any feature code is written:

1. **Confirm it's actually a new module, not a feature inside an existing one.** If the new code's primary data/UI overlaps an existing module's domain (e.g. "a new CRM report" is not a new module, it's a feature inside `modules/crm/`), it goes inside that module.
2. **Scaffold the standard shape** from §2: `modules/<name>/{pages,components,hooks,services,types,styles,utilities,state,tests}/`, `index.js`, `README.md`. Only create the subfolders you need — an empty `types/` folder for a JS-only module is unnecessary, but if you later add a `.ts` file, it goes in `types/`, not loose in `components/`.
3. **Write the `README.md` first**, before code: one paragraph on what the module owns, and an explicit list of "this module imports from: …" and "this module is imported by: …" — even if both lists start empty. This is the seed of keeping §3.2 accurate over time.
4. **Add the thin `pages/` wrapper(s)** per §2.1 — route files under `pages/modules/<name>/` and `pages/api/<name>/` that import from `modules/<name>/` and contain no logic of their own.
5. **If the module needs to depend on another module**, add the edge to §3.2's table *in the same PR*, with a one-line justification, and route the import through the target module's barrel (§3.3) — never a direct internal path.
6. **If the module needs something from the repo root that isn't in §1**, that's a stop-and-discuss moment, not a silent import — either the dependency should be promoted to §1 with a real second-consumer justification, or the design should change so the module doesn't need it.
7. **Register the module's route(s) with the shared module guard** (`pages/modules/_guard.js` / `useModuleGuard`, §1) — do not hand-roll a per-module auth check.
8. **Before merging**, self-check the module against an independence estimate the way the audit did: does it import from exactly (a) its own folder and (b) §1/§3.2 — and nothing else? If not, the PR should explain why, in the same terms this rulebook uses, not leave it implicit.
9. **A module ships with at least a smoke-level test** under `modules/<name>/tests/` for its primary flow — matching the pattern already established by `test/freedom-paper-trading.test.js` and `components/document-engine/tests/*.test.mjs`.

---

## 9. Enforcement and Amendment

**Enforcement.** A rulebook nobody checks against code drifts within a quarter. Two concrete mechanisms are recommended (not implemented as part of this read-only document):

- Add a `dependency-cruiser` or `eslint-plugin-boundaries` config that encodes §3.1–§3.2 as machine-checked rules — each module tagged by its folder, an explicit allow-list matching §3.2, and CI fails the build on any import that isn't in the allow-list. This is the single highest-leverage follow-up to this document, because it turns "the rulebook says no" into "the build says no."
- Add a lightweight CI check that fails if a new top-level directory appears under `components/`, `lib/`, or `hooks/` that isn't already in §1's table — this catches the exact failure mode the original audit diagnosed (a "shared-looking" folder that's really one module's private code) at the moment it's introduced, not two years later in a follow-up audit.

**Amendment.** This document changes only via a reviewed PR, and only in these cases:
- A genuinely new cross-module dependency is needed → add a row to §3.2 with justification, in the same PR that introduces the import.
- A piece of code outgrows single-module use and gains a real second consumer → move it into §1, in the same PR that adds the second consumer.
- A new module is created → its name and one-line purpose should be added to this document's module list (§2 references the audit's module set; as new modules are created under §8, list them here so this document stays the map of what actually exists, not just what existed at the migration's start).

No silent exceptions. If code violates this document, either the code is wrong or the document is out of date — and an out-of-date rulebook gets fixed in the PR that reveals it, not left to drift further.
