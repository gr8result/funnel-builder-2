# Client Selections (Stage 07) and Standard Inclusions (Stage 06): implementation audit

9 Nov 2026. Read-only audit of the current working tree (branch `recovery/live-snapshot-20261031`,
uncommitted). It also covers the links to AI Takeoff (Stage 04), Product Library (Stage 05) and
Quotation Builder (Stage 08).

## 1. Where things live

| Concern | Main files |
|---|---|
| Client Selections screen (guided flows, Review Schedule, PDF trigger) | `pages/modules/builders/selections-book.js` (~19.6k lines); older showroom `pages/modules/builders/client-selections.js` |
| Requirement catalogue, price states, financials | `lib/builders/clientSelectionWorkflow.js` (`PRICE_STATES`, `requirementFinancials`, `variationFor`) |
| One room list | `lib/builders/projectLocations.js` (sources), `lib/builders/projectRoomModel.js` (add / rename / remove / merge with stable ids) |
| Cabinetry | `lib/builders/cabinetryWorkflow.js`; quantity engine `lib/construction-estimation/cabinetryRequirements.js`; benchtops `lib/builders/benchtopSelection.js` + `components/client-selections/BenchtopSelectionWorkflow.jsx` |
| Variation pricing (V1) | `lib/builders/selectionVariationPricing.js`, `components/client-selections/VariationSummaryPanel.jsx` |
| Attention / readiness | `lib/builders/selectionAttention.js`, `components/client-selections/SelectionAttentionPanel.jsx` |
| Standard inclusions → job | `lib/standard-inclusions/clientSelectionBaseline.mjs`, `lib/builders/projectInclusionsAssignment.js`, API `pages/api/builders/project-inclusions.js` |
| Selections → quotation | `lib/builders/selectionReconciliation.js` (`planSelectionReconciliation`, `deferUnapprovedQuotationChanges`), `lib/builders/quotationFinancialImpact.js`, `lib/builders/selectionPricePending.js` |
| Schedule PDF | `lib/builders/selectionsScheduleDocument.js`, `selectionsScheduleHtml.js`, `finalInclusionsSchedule.js`, `finalInclusionsPdfExecution.js`, API `pages/api/builders/final-inclusions-schedule/generate.js` |
| Client Portal | `client-portal/server*.js`, `pages/api/client-portal/*` |
| Database | `supabase/migrations/20260813091800_builder_selection_books.sql`, `20261003000100_builder_selection_tenant_foundation.sql`, `20261021000100_builder_commercial_internal_member_rls.sql` |
| Job storage | browser IndexedDB job store + `.gr8job` files; cloud copy in `builder_selection_books` / `builder_client_selections` when the job is linked to a cloud project |

## 2. Operational vs stubbed vs missing

**Operational (covered by tests; real-job browser acceptance passed today):**
- the guided selections;
- cabinetry with per-room approval;
- the client view, which asks for no measurements;
- the bulkhead decision;
- the three pricing states with the builder-review queue;
- the Variation Summary on screen and in the PDF;
- the standard-inclusions baseline load;
- the attention and readiness panel;
- selections-to-quotation reconciliation behind financial approval;
- the PDF schedule;
- export and reopen of `.gr8job` files;
- the project room model.

**Stubbed or browser-only:**
- **Benchtop price-group mapping:** stored in browser localStorage per workspace, so each browser sees its own mapping. It needs a Supabase table.
- **Client/estimator screen switch:** browser localStorage, and display only. It is not a permission boundary; real protection is server-side (section 3c).
- **Local jobs:** a job that isn't linked to a cloud project can't generate the PDF; the app says so.

**Missing:**
- **Client self-service selections in the Client Portal.** The portal shows published selections and handles approvals, but clients can't make or change selections there. Today selections are made in the builder tool, with the client present.
- **Contract-state gate** (section 4).
- **Production confirmation that the RLS migration `20261021000100` has been applied.** I haven't checked; production was not touched.

## 3. Non-negotiable rules

### a. Room mapping
- **Approved rooms.** Every module reads one room list (`projectLocations.js`). Rooms come from evidence: AI Takeoff, cabinetry locations, a module's own records, or the user in Manage Rooms. Template pages such as "Bedroom 1–3" are not treated as rooms. Corrections are stored with stable ids, and `sourceKeys` stop a corrected room coming back under its old name.
- **Duplicates.** `selectionAttention.js` flags possible duplicate rooms, unlisted locations, the same product counted under two categories, and level-versus-room double counts. All of these block final issue.
- **Real job.** Seven cabinetry rooms in the correct order. No phantom Bathroom or Other card. O.Novo is not duplicated.

**Risks:**
1. **Silent Kitchen default.** `cabinetryWorkflow.js` gives a schedule line with no location to "Kitchen" (`location: item.location || "Kitchen"`), and a location with no name becomes "Kitchen". This can move quantities silently. It should be flagged, not defaulted.
2. **Rooms are joined by name, not id.** Module records (allocations, paint overrides, tiled rooms) store a room name. Renames are rewritten in the same change, but an id-based join would be safer.
3. **Takeoff isn't the only source.** Approved room ids from the takeoff are one source, alongside the cabinetry locations and Manage Rooms. A room with no takeoff evidence can still exist if the user adds it. That is deliberate, but it means the takeoff doesn't strictly control rooms.

### b. Missing data handling
- **Selection changes.** Any change with a missing quantity, price or GST basis shows "Builder Review Required", lists what's missing, creates one task, and never shows $0 (`selectionVariationPricing.js`). The PDF prints it the same way. A summary containing unresolved rows prints "DRAFT — not a final variation".
- **Cabinetry engine.** Bulkheads saved without a length are reported "Bulkhead length required" with quantity 0 and no charge. Sharkfin and open shelving without rates are flagged RATE REQUIRED. Benchtop lengths are never guessed.
- **Products without a verified price** are marked `variationPending`. `requirementFinancials` returns `priceRequired`. Quotation rows applied with a pending price stay provisional (`selectionPricePending.js`).

**Risk:** the headline "Current Variation" total on the completion panel adds only priced items. Unknown items are mentioned in a sentence below it, not in the total. It should read "+$X estimated + N Builder Review Required".

### c. Package isolation
- **Job snapshot.** A job keeps its own `jobInclusionSnapshot`. Loading a package only fills requirements that have no product chosen (`clientSelectionBaseline.mjs`, the merge in `selections-book.js`), so confirmed client choices are never replaced.
- **Re-assigning the package.** `assignCurrentStandardInclusionsToProject` replaces the project's package assignment only with explicit `confirmed` + `useCurrentStandard`. Existing confirmed selections keep the allowance stored on them.
- **Quotation.** Any change that reconciliation would make to the approved quotation is held as `FINANCIAL_APPROVAL_REQUIRED` and never applied silently.
- **Fixed today:** `project-inclusions` now requires a builder role, so a client-role workspace member can't re-assign packages.

**Risk:** a package version update doesn't mark existing jobs as "baseline differs from current package". The jobs are unaffected, which is correct, but the builder isn't told.

## 4. Quotation integration and variation control
- **Before contract.** Reconciliation (`planSelectionReconciliation`) maps selections to quotation rows. `quotationFinancialImpact` computes the change. If anything changes, `deferUnapprovedQuotationChanges` keeps the existing quotation and records the proposal for approval. Duplicate charges are guarded by canonical identities, which the O.Novo tests cover.
- **After contract: missing.** Nothing in Client Selections knows the job is under contract. After signing, a selection change goes through the same approval and, if approved, rewrites the quotation lines instead of raising a variation. Variations exist (`builder_variations`, `pages/modules/builders/variations.js`, `lib/standard-inclusions/upgradeVariation.mjs` with builder approval → client response), but they are created only from the standard-inclusion upgrade flow. They are not created automatically from Client Selections changes or from the new Variation Summary.

## 5. Security findings (outside Client Selections, need their owners)
- **No workspace-membership check.** `pages/api/builders/proposal-document-upload.js`, `proposal-document-remove.js` and `proposal-document-export.js` check only that the token is valid. Any signed-in user, including a portal client, could act on another workspace's proposal documents through the service-role client. **P0, Quotation / proposals owner.**
- **Missing role check.** `pages/api/builders/product-catalogue.js` reads the builder catalogue with the service-role client and no role check. A client-role workspace member could read builder catalogue pricing. **P1, Product Library owner.** The file is currently being changed by another session, so I didn't edit it.

## 6. Prioritised checklist

**P0: before production**
1. Fix the `proposal-document-*` membership checks (Quotation owner).
2. Confirm in production that RLS migration `20261021000100` is applied (read-only check by the owner).
3. Add the contract-state gate: once the job is contracted, Client Selections changes create variation candidates (`builder_variations` drafts from the Variation Summary rows) and never rewrite quotation lines.

**P1**
4. Role-guard `product-catalogue` with the internal commercial roles (Product Library owner).
5. Replace the silent "Kitchen" default for schedule lines or locations with no room: flag them for builder review.
6. Move the benchtop price-group mapping from localStorage to a workspace table.
7. Send confirmed and accepted Variation Summary rows to `builder_variations` (one draft per confirmed row), using the existing builder-approval and client-response transitions.
8. Show the builder-review count next to the headline variation total.

**P2**
9. Store room ids on module records instead of names.
10. Flag jobs whose baseline package is older than the current package version (information only).
11. Client self-service selections in the Client Portal (needs a portal selection write API using the existing `authorizePortalRequest`).
12. Replace the client/estimator display switch with the signed-in role (internal roles see estimator fields), once client logins reach the builder tool.
