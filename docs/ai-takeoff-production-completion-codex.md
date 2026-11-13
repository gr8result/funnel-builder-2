# AI Plan Takeoff: production completion report

**Recommendation: NOT production ready yet.** The takeoff module itself passes every automated check on the
current code, and the largest measurement errors from the 12 November audit are fixed. Three release gates
were not run in this session, because the machine never had enough free memory: the real-browser
Takeoff → Job Setup → Quotation acceptance, the production build, and the two-user test against a live
Supabase stack. Section 10 lists exactly what has to run, and what each one must show, before release.

Last updated 13 November 2026.

---

## 1. Version and architecture

| Item | Value |
|---|---|
| Repository | `E:\dev\funnel-builder-clean` |
| Branch | `recovery/live-snapshot-20261031` (authorised development branch; nothing pushed, merged or deployed) |
| Commits since the audit | `40ebcdf` review items + construction quantities, `f5ce015` sign-in/save lock fix, `5d38cbe` outdoor areas, retaining walls, level names (this session), plus this report and the port-3000 guards |
| Mounted screen | `components/estimate-builder/EstimateBuilderWorkbook.js` → `ai-plan-takeoff/AIPlanTakeoffPage.jsx` → `AIPlanTakeoffStandalone.jsx`. No other takeoff screen is mounted. |
| Measurement engine | The app's own geometry from the PDF linework: `geometry/pdfLinework.js` → `geometry/vectorWalls.js` (walls, openings, classification) → `geometry/planModelAdapter.js` (connected wall model, rooms) → `ai-integration/vectorProductionAnalysis.js` (footprint, outdoor areas) |
| AI provider | Optional. It supplies only sheet type and level, plus semantics matched to measured objects. It never supplies canonical geometry. No paid calls were made in this session. |
| Quantities | `takeoffSchedule.js` (walls, openings, floor areas, rooms), `constructionQuantities.js` (insulation, waterproofing, skirting, cornice, stairs, roof), `ai-integration/scheduleEvidence.js` (room rows, external areas, retaining walls) |
| Hand-off | `createJobSetupPayload` → Job Setup → quotation, behind the commercial review gate (`commercialBlockers`) |

## 2. Defects found and repaired this session

| # | Defect | Evidence | Repair | Test |
|---|---|---|---|---|
| 1 | **Balcony and terrace outlines came from the AI reading, not the drawing.** On the local vector path no outdoor area was measured at all. | Audit D6: balcony 14.71 vs 24.49 m², terrace 6.87 vs 48.84 m² | New `geometry/outdoorAreas.js` measures from the drawing. It takes the largest rectangle around the plan's own label whose four sides are drawn solid to both corners, and which touches but doesn't overlap the house. The side along the house is put on the house's outer face. Dimension lines (ticks at the corners), dashed roof lines and decking/tile hatching are rejected; post symbols aren't mistaken for ticks. An area that isn't closed or attached is not guessed. Wired into both the Run path and the local rerun path. | `test-takeoff-outdoor-areas.mjs` |
| 2 | **Retaining walls could only be counted as house external walls.** The review said "Confirm it as External", which would add them to external wall length, lining, insulation and cladding. | Jesmond Lower: both labelled retaining walls offered only Internal / External / Not a wall | New choice, **Retaining wall**. It is measured as its own quantity (Retaining Walls section, lm, thickness as drawn). The height is left to the builder, because the drawing says "Determined on Site". It never becomes house wall or room boundary. The review panel now also shows the reason text for each wall it asks about. | `test-takeoff-retaining-walls.mjs` |
| 3 | **One storey was counted as two levels.** Rooms carrying the drawing's level name ("Upper Floor") and rooms taking their sheet's level ("Ground Floor") were different levels, so the roof-insulation question was asked about the *upper* floor. | It blocked the 12 Nov browser run with 1 open item | Room levels are normalised to the app's level names | `test-takeoff-construction-quantities.mjs` (mixed-level case) |
| 4 | **Two regexes contained literal backspace characters instead of `\b`.** The outdoor-room filter in `vectorProductionAnalysis.js` never matched, so a room named Balcony or Terrace counted as indoor in the building outline. | Byte scan of the source tree | Replaced with `\b` in both takeoff files | covered by 1 and 3 |
| 5 | **The browser harness couldn't settle questions that appear after approvals are saved.** | 12 Nov run: `construction:ceiling-under-roof` left open | It answers again after the save | `test-takeoff-vector-plan-browser.mjs` |
| 6 | **The tenant-isolation test broke on another session's migration change.** The internal-member migration now sets a policy on `builder_requirement_quote_mappings`. | `relation ... does not exist` | The test creates that table from its own migration first, verbatim. The migration itself is correct in sequence. | `test-takeoff-tenant-rls-pglite.mjs` (11 checks) |
| 7 | **Three test scripts could drive the protected port-3000 app.** `emergency-recovery` also copies that origin's data out of the real Chrome profile. | Audit D20 | `v3-acceptance` retired (its page was removed). `emergency-recovery` refuses to run until it is ported to an isolated server. `job-setup-takeoff-browser` requires an explicit, non-3000 base URL. | Each prints SKIPPED with the reason |

Already done before this session and verified in git: the lock fix (`f5ce015`, audit D1) and the takeoff code committed (audit D2). The six stale suites, the printed-area and Other-Opening review controls, and construction quantities are in `40ebcdf` (audit D15, D19).

## 3. Construction quantity coverage

| Quantity | Status | Source |
|---|---|---|
| External / internal wall length and area | Measured | Vector walls, classified external/internal from the drawing |
| Door and window schedule | Measured; class or height held for review where the plan doesn't state it | Openings, printed labels |
| Floor and ceiling area by room and level | Measured; each room is approved by the builder | Rooms (net floor area) |
| Building footprint per level | Measured | Rooms + walls to outer face |
| Balconies, terraces, patios, alfresco | **Measured from the drawn outline (new).** Builder approves. | `outdoorAreas.js` |
| Retaining walls | **Measured length and thickness (new).** Height entered by the builder. | Classifier + builder choice |
| Plasterboard, painting, skirting, architrave, cornice | Calculated from measured walls, openings and rooms, plus builder-supplied heights | `takeoffSchedule.js`, `constructionQuantities.js` |
| Insulation | Calculated: external walls net, plus ceilings under roof (the builder answers how much ceiling is under roof) | `constructionQuantities.js` |
| Wet-area waterproofing | Wet floors and junctions calculated. Shower walls are left to the builder. | `constructionQuantities.js` |
| Floor and wall tiling, floor finishes | A floor finish per room feeds the Floor Finishes record | Rooms panel |
| Roof plan area, eaves, fascia, gutter | Calculated from the approved footprint plus eaves. Pitched area needs the roof pitch in Job Setup. | `constructionQuantities.js` |
| Stairs | Number of flights asked of the builder (not countable from a floor plan) | review question |
| Multi-storey totals | Per level, after level normalisation | schedule |
| Electrical points | Counted from labels and legend symbols. **Not tested on a real electrical layout drawing** (none on this machine). | `geometry/electricalSymbols.js` |

Measured quantities and calculated ones are kept apart. A calculated row states the builder input it depends
on. Where an input is missing, the row carries no quantity and a review note; nothing is assumed.

## 4. Accuracy against the reference plans

Run with `scripts/takeoff-quick-accuracy.mjs` (the app's own local vector path, no provider). References are
independent hand traces, read only after the reading is complete.

### Outdoor areas, against the plan's printed area table

| Plan | Area | Before (12 Nov) | Now | Printed | Error |
|---|---|---|---|---|---|
| Jesmond Lower | Balcony | 14.71 m² (AI) | **24.22 m²** | 24.49 m² | −1.1% |
| Jesmond Upper | Outdoor terrace | 6.87 m² (AI) | **48.30 m²** | 48.84 m² | −1.1% |

### Walls, openings, rooms

| Measure | Liberty Ground | Jesmond Lower | Jesmond Upper |
|---|---|---|---|
| Wall recall (house walls) | 0.958 | 0.820 → see note | 0.938 |
| Wall precision | 0.985 | 0.972 | 0.915 |
| External/internal class correct | 0.979 | 0.999 | 0.948 |
| Openings matched / reference | 29/33 | 19/21 | 18/23 → see openings |
| Rooms matched / reference | 15/15 | 12/12 | 8/9 → see rooms |
| Footprint vs printed | 261.77 vs 261.31 m² (+0.2%) | 135.01 vs 136.25 (−0.9%) | 163.20 vs 165.14 (−1.2%) |

**Jesmond Lower wall recall (0.82).** The only reference walls not found as house walls are the two retaining
walls, 8.59 m and 15.23 m. They are detected and offered for review. Marked as retaining walls, they measure
8.49 m and 15.13 m (−1.2% and −0.7%), as their own quantity. All house walls on that sheet are found.

**Liberty footprint (audit D17).** The audit had no reference for it. The sheet carries its own area table:
Living 221.00 + Garage 40.31 = 261.31 m², against 261.77 m² measured.

**Rooms with more than 5% area error, each checked against the drawing:**

| Room | Error | Finding |
|---|---|---|
| Jesmond Upper Powder | +17.5% | **Engine correct.** The powder room is L-shaped: its 870 door is in the corridor wall and swings into a tiled entry nook under the linen cupboard. The tile grid runs into the nook. The reference rectangle leaves the nook out. |
| Jesmond Upper "Cupboard west of powder" | not found | **Not a room.** The 1809DH OBS window is in the powder's west wall, and the external wall steps in there. The space is an outdoor recess beside the external stair. The reference also puts that window on the wrong wall, which scores as one missed plus one extra opening. |
| Jesmond Upper WIR | −15.4% | Convention. The engine leaves out the two cross-hatched solid piers (0.53 m²); the reference includes them. |
| Jesmond Upper Pantry | −6.7% | Convention. A cross-hatched solid strip along the north side (0.42 m²) is left out. |
| Jesmond Lower Bed 3 WIR | −7.2% | Convention. The boxed plumbing stack (services boxing) is left out. |
| Jesmond Upper Linen | −12.8% | 0.09 m² at the bi-fold door line of a 0.7 m² cupboard. Commercially negligible. |
| Liberty Dining/Family/Kitchen | −7.6% | Same total area. The engine measures the foyer/hall (7.02 m²) as a separate space; the reference names it as part of the open plan (87.11 + 7.02 = 94.13 vs 94.28 m²). |
| Liberty WC | −5.3% | 0.08 m². Not investigated further. |

The engine reports **net floor area**: solid piers, hatched solid strips and services boxing are left out.
This is consistent across all three sheets. If GR8 Result wants gross room area for some quantities, that is
a business-rule decision; the room's measurement bases already carry net and gross separately.

**Openings not matched, each checked against the drawing:**

| Opening | Finding |
|---|---|
| Jesmond Upper entry sidelight (645) | Found (643 mm), 413 mm from the reference point. The reference marks its own position as ±150 mm. |
| Jesmond Upper powder window | Found. It is on the powder wall, not where the reference puts it (see rooms). |
| Jesmond Upper east windows 1 and 3 (1809LV) | The unlabelled four-window bank is read as one 3,600 mm unit and held for the builder to say one window, four windows or a door. This is a deliberate rule with its own regression test, and it is listed in review. |
| Jesmond Upper kitchen–pantry opening (1760) | The room closes there with a virtual divider (no wall), not an opening object. |
| Jesmond Lower 0315 FG OBS (1500 × 300 high-level window) | **Genuinely missed.** Its frame box sits about 140 mm in from the adjoining wall pieces, so it is merged into the wall as a 148 mm piece rather than read as a frame. Widening the frame cap tolerance alone does not fix it (tested). The engine's "extra" window beside it is a real 1809DH OBS window the reference leaves out. |
| Jesmond Lower ensuite door (720) | Found with the right width and type, but **hosted on the wrong wall**: the east wall where the open leaf rests, instead of the gap in the north wall (about 570 mm off). Same room corner, both internal walls, so the wall deduction totals are unaffected. |
| Liberty bed 1 WIR opening, barn door, dining/foyer and media openings | Not re-checked this session (the audit's 4 of 33) |

## 5. Test results

| Suite | Result |
|---|---|
| Deterministic takeoff suites (`scripts/test-takeoff-*.mjs` + vector production + element classifier, browser and port-3000 suites excluded) | **66 / 66 pass** (13 Nov). Run with `--import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs`. |
| New this session | `test-takeoff-outdoor-areas` (synthetic + Jesmond vs printed), `test-takeoff-retaining-walls` (Jesmond vs reference) |
| Tenant RLS on real migrations (PGlite) | 11 checks pass |
| Plain `node` without the JSON import hook | Three suites still need the hook. Shared pricing libraries owned by another session import JSON without import attributes (audit D18, unchanged). |
| Browser: `test-takeoff-vector-plan-browser.mjs` | **NOT RUN this session** (memory, section 9). The last run (12 Nov) stopped at the review gate on the item fixed in defect 3. |
| Production build | **NOT RUN this session** (memory). The last pass was `.next-build` with the lock fix (12 Nov, before `40ebcdf` and `5d38cbe`). |

## 6. Browser acceptance evidence

Nothing new this session. The 12 Nov evidence (audit section 3.1) still stands for upload, calibration, run,
room approval, wall checks, reopen and rerun on both plans. The full acceptance list in the brief (steps 1–18)
has **not** been completed end to end on the current commit.

## 7. Security and multi-user

- Tenant isolation of saved takeoff jobs: 11 checks pass against the real migrations in an in-memory Postgres
  (cross-tenant read/write, client role, removed member, anonymous).
- Two simultaneous users, conflicting saves and session recovery against a live Supabase stack: **NOT TESTED**.
  This needs the isolated stack (`TAKEOFF_ISOLATED_ENV`); Docker was not running.
- Sign-in/save lock: fixed in `f5ce015`. Real-browser freeze, two-tab and contention scenarios passed on 12 Nov.

## 8. Save, recovery and performance

**Not re-measured this session.** Still open: the Jesmond first save (42 s on 12 Nov), close-during-save,
the `.gr8job` export/import round trip (about 300 MB), and recovery from interrupted writes and missing assets.
The contract tests for overwrite protection, save verification, the freshness guard and original protection
pass in the deterministic suite.

## 9. Integration reconciliation

The harness reconciles every Job Setup field the takeoff fills against its takeoff figure, and checks that the
approved room area reaches Job Setup and the calculated quotation exactly once. It was not run this session.
The defect that stopped it on 12 Nov is fixed (defect 3), so the next run should get past the review gate.

### Why the browser run and build did not run

Free commit memory stayed between 0.7 and 2.2 GB for the whole session (limit 55.8 GB, 32 GB RAM). The largest
holders were the protected port-3000 dev server (`node`, PID 20224, 6.9 GB) and WSL (`vmmemWSL`, 5.4 GB), with
many VS Code and Chrome processes. The browser harness needs at least 6 GB free, the production build more.
Launching either would risk the commit-limit crash recorded on 8 Nov. No other session's process was touched.

## 10. Release gates still to pass, in order

1. **Free memory**, without touching port 3000: free commit at least 8 GB. For example, close unused VS Code
   windows or WSL if nothing needs them. This is the owner's call.
2. **Browser acceptance**, one plan at a time:
   `GR8_VECTOR_PLAN=jesmond node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-takeoff-vector-plan-browser.mjs`,
   then the same with `liberty`. It must exit 0 with an empty mismatch list in `<plan>-reconciliation.json`.
   Then run once without `GR8_SKIP_GR8JOB_EXPORT` for the `.gr8job` round trip.
3. **Production build**: `node scripts/run-next-clean.mjs build` (output `.next-build`), coordinated with the
   other sessions. It must exit 0.
4. **Two users / live RLS**: start the isolated Supabase stack (Docker), set `TAKEOFF_ISOLATED_ENV`, and run
   `test-takeoff-two-tenant-isolated.mjs` and `test-takeoff-two-tenant-browser.mjs`.
5. **Save time**: profile the Jesmond first save (`GR8_PROFILE_SAVE=1` in the harness) and cut it, then a
   close-during-save test.

## 11. Remaining limitations (not blocking commercial use once the gates pass, but builders should know)

- An outdoor area is read only when the sheet has a text label for it and a closed, attached, rectangular solid
  outline. Liberty's text is drawn as outlines, so its alfresco (56.23 m²) and patios are not read
  automatically; the builder draws or approves them. L-shaped or detached outdoor areas aren't read.
- A terrace or patio is typed Patio even when it is under the roof (Jesmond's terrace is). The builder changes
  the type if it should count as under-roof area.
- Retaining wall height, stair flights, roof pitch and ceiling-under-roof are builder inputs by design.
- One missed high-level window and one door on the wrong wall on Jesmond Lower (section 4).
- Electrical counting is unproven on a real electrical layout drawing.
- Five files owned by other modules contain the same backspace-for-`\b` corruption and are **not** edited
  here. Each regex silently fails to match:
  - `lib/builders/cabinetryWorkflow.js:1376` (`wc`)
  - `lib/builders/electricalSchedule.js:109` (`fans?`)
  - `lib/product-library/productLibraryTaxonomy.js:214` (`bath`, `pan`)
  - `scripts/product-library/import-bosch-range.mjs:119` (`db`)
  - `scripts/test-client-selections-real-job-walkthrough-browser.mjs:88`
- `buildLocalVectorAnalysis` (the per-sheet rerun after a wall decision) does not return the production
  response's `buildingAreas`, so a rerun does not refresh footprint or outdoor areas. The Run path does.

## 12. Release recommendation

**Do not release yet.** Measurement is in good shape on both reference plans:

- Footprints are within 1.2% of the printed figures.
- Outdoor areas are within 1.1%.
- Retaining walls are within 1.2%.
- Every room over 5% is explained by the drawing.

But the three P0 gates in section 10 (browser acceptance into Job Setup and quotation, production build, live
two-user test) have not run on the current commit. Once they pass, the module can go to a limited release with
the section 11 limitations stated to builders.
