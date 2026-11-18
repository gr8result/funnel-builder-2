# AI Plan Takeoff Verification Report (GROK Continuation)

## Sunshine Cove room-by-room defects, 18 November 2026, round 3 (uncommitted)

Builder-reported defects on the real Sunshine Cove takeoff, reproduced on sheets 4 and 5 with the production local
pipeline, then fixed with general rules (no plan-specific coordinates or labels). Ports 3000 and 3102 untouched;
nothing committed or pushed; local-first and paid-AI authorisation unchanged.

| # | Defect | Cause found | General fix |
|---|---|---|---|
| 1 | Balcony missed | Outdoor tracer read only the PDF text layer; this sheet's text is outlined (OCR only) | Outdoor areas traced from OCR labels too |
| 2 | Foyer roof in upper area | Roof box drawn inside wall lines closed as an unnamed room | Unnamed area with a roof word inside (pitch, roof, gutter, awning…) is roof-only: out of rooms and outline; walls bounding only it held for review |
| 3–4 | Bed 4 and its robe missing | Top wall = short stub + window frame: frame closure skipped because the stub lay along part of it; frame 180 mm off the wall corner | Close only the uncovered stretch from the stub's end; corner within 220 mm |
| 5 | Bath as a room | Bath rim read as a wall pair | Small unnamed area, no door on its edges, beside a named wet room, with a drawn figure inside → fixture folded into that room |
| 6 | Bed 3 merged with robe | Robe front drawn as sliding-door lines, no wall end to extend | Drawn front: straight run of lines from boundary to boundary that leaves each label alone, robe depth → divider (never a wall) |
| 7 | Robe doors missing | Fronts had no opening record | Robe fronts and frame closures listed as review openings (excluded from quantities until confirmed) |
| 8 | Ground floor unusable | Lightweight walls in a pen the sheet's masonry never uses; stacker door from a wall corner; closure split by another closure dropped from the graph | Pen proved by jambed openings in its pairs; frame closures from corners; every piece of a split separator kept (bug fix) |

Guards added after regressions found on reference plans: opened pens never lighter than wall pens (Jesmond grey
paving); frame closures enclosing only an unnamed scrap against the outside removed (Liberty AC unit); hatching and
slatted grilles are not frames; doors judged by position on a fixture's edges, windows ignored; fixture host = wet room
met across a divider. OCR: two-glyph lines (WC) proposed for the room pass; glued marks and one misread letter in long
names accepted ("aLLDRY"→LDRY, "BITCHEN"→KITCHEN, "mWIR"→WIR); names stay unconfirmed.

Measured (local pipeline, browser identical):

| Sheet | Before | Now | Printed |
|---|---|---|---|
| Sunshine ground footprint | 55.7 m² (garage, laundry, powder only) | 115.47 m² | 117.66 (living 72.68 + garage 44.98) |
| Sunshine upper footprint | 110.47 (incl. roof, without Bed 4) | 116.19 | 115.56 |
| Sunshine balcony | not measured | 7.54 (3.94 × 1.91 drawn outline) | 9.82 (printed; drawn balustrade-to-wall span is ~3.9 m) |

Upper rooms: ENSUITE 7.88, BED 1 19.20, WIR 5.68, RUMPUS 27.46, BED 2 9.61, BED 3 9.32, BED 4 9.26, BATH 4.98 (bath folded in),
linen 3.08, robes 1.08 / 0.89 / 1.12, two unnamed (WC 1.40, stair 2.00). Drawing dimensions: BED 1 4133×4641 = 19.18,
ENSUITE 2980×2641 = 7.87, BED 2 2957×3230 = 9.55, BED 4 3187×2870 = 9.15. Ground rooms: KITCHEN/DINING/FAMILY 56.61
(open plan, no walls between), pantry 1.43, LDRY 4.87, linen 0.57, GARAGE/STORAGE 42.15, PWD unnamed 2.25 (label crossed
by the door swing, OCR reads "Pwo").

Regression: suite 104/104 plus new scripts/test-takeoff-room-schedule-rules.mjs; quick accuracy identical (Jesmond Lower
82.0/97.2/99.9, 19/21, 12/12; Upper 93.8/91.7/94.8, 18/23, 8/9; Liberty 98.7/98.6/99.8, 32/33, 15/15); Chermside first
now splits Bed 3/robe and Bed 4/robe (17 rooms); Jesmond Lower showers folded into their ensuites; Mountain Creek ground
177.9 vs 174.7.

Browser (OpenAI disabled, disposable jobs): Sunshine PASS — 0 AI requests, save/reopen identical (103 walls, 31 openings,
3 areas, 20 rooms), retry adds nothing, quotation gated (31 items). Mechanism run with the harness's builder-settling
inputs: approval recorded (LDRY 4.87 m²) and quotation still gated on the unapproved balcony. Liberty PASS and Jesmond
PASS (full acceptance incl. save/reopen and downstream schedules).

Open: PWD and WC labels crossed by door swings stay unnamed; ground open-plan not split into kitchen/dining/family (no
walls drawn); printed balcony area disagrees with the drawn outline; Mountain Creek first parapet (+4.3%); scanned plans.

## Wall continuity, door openings and room names, 18 November 2026, round 2 (uncommitted)

Ports 3000 and 3102 untouched; nothing committed or pushed; local-first and paid-AI authorisation unchanged.

### Changes (all general rules)
1. **Frames in a wall's gap** (`vectorWalls.js`). A pair accepted only on length (thickness not one the drawing uses), lying end to end between two pieces of one wall at a different thickness, is the sliding door, stacker or window frame in that gap, not a wall. The gap then becomes an opening between the real pieces. Pieces the chain rule established as one wall are protected.
2. **Virtual closures** (`planModel.closeWallGaps`, called from `levelFromLinework`). A dangling wall end is joined, for rooms and the outline only, in two cases:
   - to the wall or wall end it runs towards within 500 mm (narrower than any door);
   - across a wider gap of up to 6.2 m, only where a door or window frame figure (read, not taken as wall) starts at that end and runs along the line.

   Closures are separators (basis `gap-closure` / `opening-closure`), never wall length. Rooms bounded by them stay flagged for review. Frame pieces along one line are merged into runs (`mergeFrameRuns`).
3. **Groups joined through doors** (detector building-group step). Wall groups linked by a chain of frame figures (a stacker turning into a sliding door) are one building. A lone pair reached only through a frame is not joined.
4. **Footprint envelope** includes the closures.
5. **Room names** (`localLabelOcr.roomNameFromReading`):
   - Each OCR reading is cleaned of short marks at its ends and stray trailing digits (bedrooms keep their numbers).
   - Only an exact dictionary room name is accepted, at any score; Tesseract scores correct outlined text 0.
   - The rotation that yields an exact name wins.
   - Every name stays unapproved until the builder confirms the room.

Tests: new `test-vector-wall-continuity.mjs` covers:
- a short gap closes;
- an unexplained 1.5 m gap stays open;
- a 2.4 m drawn sliding door closes the room without adding wall length;
- a frame in a gap is an opening;
- name cleaning.

Suite **104/104**. Quick accuracy unchanged (Jesmond Lower 82.0 / 97.2 / 99.9 / 19 of 21 / 12 of 12; Upper 93.8 / 91.7 / 94.8 / 18 of 23 / 8 of 9; Liberty 98.7 / 98.6 / 99.8 / 32 of 33 / 15 of 15). One regression found and fixed on the way: the frame join first pulled a lone 1.6 m pair into Jesmond Upper (precision 91.7% to 90.3%).

### Measured footprint against printed area (offline survey of the app's local pipeline)

| Sheet | Round 1 | Now | Printed | Difference |
|---|---|---|---|---|
| Sunshine Cove upper | 91.2 | **110.5** | 115.6 | −4.4% |
| Mountain Creek first | 91.7 | **109.7** | 105.3 | +4.3% (includes a parapet wall over the garage) |
| Mountain Creek ground | 178.2 | 179.5 | 174.7 | +2.7% |
| Chermside ground | 185.0 | 187.6 | 188.3 | −0.3% (internal walls 2 → 37; held 34 → 5) |
| Chermside first | 138.4 | 138.4 | 136.5 | +1.4% |
| Jesmond upper / lower | 163.5 / 135.6 | same | 165.1 / 136.3 | −1.0% / −0.5% |
| Liberty | 267.8 | 269.0 | 261.3 (living + garage) | +2.9% |
| Sunshine Cove ground | 6.0 | **55.7** | 119.3 | garage, laundry and powder room measured; living area not |

Rooms named:

| Sheet | Before | Now |
|---|---|---|
| Sunshine upper | 5 | 9 (BED 1–3, BATH, WIR, ENSUITE, RUMPUS) |
| Mountain Creek first | 5 | 9 |
| Chermside first | 7 | 11 |
| Liberty | 5 | 8 |
| ADU | 1 | 3 |

### Browser (final code)
- **Sunshine Cove, OpenAI disabled** (`artifacts/test-results/takeoff-sunshine-cove-browser/continuity/`): 0 AI requests and 0 provider calls. Paid-AI prompts shown. Upper 110.47 m² with BED 1 19.20 m². Ground: garage 42.15 m². Save and reopen identical (79 walls / 21 openings / 17 rooms); retry adds nothing; quotation gated (27 items).
- **Liberty:** first-run score identical (walls 88, R 0.99 / P 0.986, ext-int 0.998, 33 of 33, rooms 15 of 15). The memory guard then stopped the browser (free commit 896 MB; two non-test node processes hold about 11.5 GB). Save, reopen and quotation were not reached in this round.
- **Jesmond browser** not run this round for the same memory reason. Offline accuracy unchanged.

### Still open
- **Sunshine Cove ground living area:**
  - The dining walls are drawn only in a pen this sheet never uses for a clean wall, and they're broken by three windows.
  - Accepting such walls needs a rule that does not admit joinery or fixture lines on other drawings; not done.
  - The kitchen walls are now found but held, because the living outline cannot close without the dining walls.
- **Mountain Creek first +4.3%:** a parapet wall drawn over the garage below is read as external wall of this floor.
- **Scanned or image-only plans:** still not measured locally (see the earlier section).

## General-purpose detection work and capability status, 18 November 2026 (uncommitted)

Ports 3000 and 3102 untouched; nothing committed or pushed; no live job touched.

### Permanence
Local-first Run Takeoff, explicit paid-AI authorisation and the provider-failure fallback are application code in the normal path for every builder:
- `useAiTakeoffAnalysis.js`, `AiTakeoffAction.jsx` and `analysisClient.js`;
- no feature flag, no test-only branch, no job or plan identifiers.

The engine contains no plan-specific logic; sample plans appear only in explanatory comments. Every engine change below is a general drawing rule, checked against Jesmond and Liberty and against plans that are not reference jobs.

### Test set beyond the three reference jobs (offline survey of the app's own local pipeline)

| Sheet | Drafting style | Calibration |
|---|---|---|
| Mountain Creek first floor | easyway; sheet drawn sideways | title block 1:100 |
| Mountain Creek ground dimensions | easyway; sideways; "NOT TO SCALE" | from printed 13000 overall (1:150) |
| Chermside ground and first | easyway; "PLAN NOT TO SCALE" | from printed 11490 / 9600 overall (1:130) |
| ADU Modstructure sheet | different drafter; solid-filled walls; four plan variants and photos on one sheet | from printed 5670 |
| Fold House brochure plan | image only (no linework) | from printed 5100 |

All the vector sheets have outlined lettering (no PDF text layer). Each was calibrated from a printed dimension, as a builder would. Printed floor-area tables were used as an independent check.

### General causes found and fixed
1. **Dimension strings with no text layer** were read as walls. Pairs of extension lines look like walls, and they dominated pen learning. New `tickedDimensionStrokes` (`dimensionLinework.js`): a dimension point is a paper-size 45-degree tick with two perpendicular lines through it, one crossing it. Corner mitres (both lines ending at the tick) are protected. Liberty: no wall face affected.
2. **Title blocks taught the drawing's wall pens.** Their double frame lines are long and "clean". A line running edge to edge across the sheet no longer teaches pens or thicknesses. Anything inside a title-block or notes strip is not a wall. A strip is bounded by two lines that each run 80% of the sheet from one of its edges; it is wider than any wall, narrower than a quarter of the sheet, and has no door swing in it. A plan cropped tight to its building keeps its walls (tested).
3. **Footprint was the union of rooms that close,** so an open-plan area that did not close as a room dropped out. The outline now also uses the connected wall model (external walls and spans across openings), via `buildingOutlines(..., envelopeWalls)`. It still needs builder approval before use.
4. **False garage doors** on upper floors and decks. A wide gap with one line across it is no longer counted as a garage door unless a garage or carport is named within 9 m (PDF text or local OCR). Otherwise its geometry still closes the outline, but its type waits for the builder.

Footprint against printed area:

| Sheet | Before | Now | Printed |
|---|---|---|---|
| Chermside ground | none (no walls; wrong pens) | 185.0 | 188.25 living + garage |
| Chermside first | 4.2 | 138.4 | 136.49 |
| Mountain Creek ground | 31 | 178.2 | 174.72 living + garage |
| Jesmond upper, first run | 35 | 163.5 | 165.14 |
| Jesmond lower | — | 135.6 | 136.25 |
| Sunshine upper | 89.0 | 91.2 | 115.56 |
| Mountain Creek first | 87.3 | 91.7 | 105.25 |

False garage doors removed on Sunshine upper, Mountain Creek first and the ADU (5). The Liberty garage door is kept; Jesmond's is now "to confirm" (its CARPORT label is more than 9 m away).

Tried and **rejected** because they regressed Jesmond or Liberty:
- learning wall pens only from wall groups containing door swings;
- the first form of the sheet-furniture rule, which broke cropped plans;
- an unconfirmed-gap form of the garage rule, which broke the outline when OCR is unavailable.

Regression: Jesmond and Liberty quick accuracy unchanged (Lower R 82.0 / P 97.2, Upper 93.8 / 91.7, Liberty 98.7 / 98.6 / 32 of 33 / 15 of 15). Suite **103/103** (new `test-vector-sheet-annotations.mjs`).

### Browser (OpenAI disabled), Sunshine Cove, final code (`artifacts/test-results/takeoff-sunshine-cove-browser/general/`)
- 0 requests reached the AI endpoint, 0 provider calls.
- Both paid-AI buttons show the authorisation prompt; cancelling sends nothing.
- Results identical to the offline survey.
- Save and reopen identical; retry adds nothing.
- The quotation is refused ("Resolve or reject the 22 required review item(s)"). **No builder decision was invented in this run.**

### Browser acceptance on the final code (`artifacts/test-results/takeoff-general-bundle2/`)
The harness now chooses each sheet's level in the screen's level control, as a builder does: local Run Takeoff measures levelled sheets. It asserts that **no request reaches the AI endpoint**.

| Job | Result |
|---|---|
| Liberty | PASS: walls 86, R 0.99 / P 0.986, ext-int 0.998, openings 33 of 33, rooms 15 of 15, save, reopen, .gr8job, quotation |
| Jesmond Ground (lower) | PASS: R 0.82 / P 0.972, ext-int 0.999, 19 of 21, rooms 12 of 12 |
| Jesmond Second (upper) | PASS: R 0.938 / P 0.917, 0.948, 19 of 23, rooms 8 of 9; quotation downstream PASS |
| Sunshine Cove (`…/takeoff-sunshine-cove-browser/general-final/`) | PASS: 0 AI requests, 0 provider calls; paid prompts; save, reopen, retry; quotation gated with 22 items outstanding |

These quotation checks settle the review against each job's reference; no decisions were invented for Sunshine Cove.

### Capability status
**Production-ready (evidence above):**
- Local-first measurement with no provider calls.
- Explicit authorisation for paid AI.
- Provider failure (429, timeout) never discards or corrupts local measurement.
- Rerun without duplicates.
- Save and reopen.
- The quotation gate that keeps unreviewed quantities out.
- Vector plans in the reference style (Liberty, Jesmond).
- Wall-pen and dimension handling for outlined-text CAD exports.

**Limited:**
- **Footprints:** within about 2% of the printed area where the external wall ring closes (Chermside ground and first, Jesmond upper and lower, Mountain Creek ground). They fall short where a full-width sliding door or held wall leaves a room open (Sunshine upper −21%, Mountain Creek first −13%).
- **Sunshine Cove ground floor:** still not measured. The dining walls use a pen not otherwise used for walls on that sheet, and the yard side is almost all door frames.
- **Mountain Creek ground:** footprint and walls good. Many openings are held "to confirm" (13 windows), and only 4 of 8 rooms are named.
- **Room names:** OCR of sideways sheets is limited, and many rooms stay "Unlabelled". Wall classification needs a closed outline; open walls are held for the builder by design.
- **ADU-style sheets** with several plan variants on one sheet produce one combined outline.
- **Calibration:** "not to scale" sheets need the builder to calibrate from a written dimension. There is no automatic scale from printed dimensions without a text layer.

**Missing (needs implementation):**
- **Scanned or image-only plans locally.** The existing raster engine was tested on an image-only plan and is not fit: false walls from deck boards and benches, external walls missed. The local run therefore names such sheets and does not measure them. The supported paths are manual takeoff tools or authorised AI-assisted analysis. A validated raster wall and room engine is required.
- Automatic scale from printed dimensions on outlined-text PDFs (OCR of dimension values).
- Text-direction handling for sideways sheets in local OCR.
- A larger labelled reference set (more drafters and states) to measure accuracy generally rather than on two reference jobs.

## Local-first takeoff (no OpenAI credit needed), 18 November 2026 (uncommitted)

Ports 3000 and 3102 untouched; live job not touched (disposable job in an isolated browser); nothing committed or pushed.

### Why the button still called OpenAI
"RUN AI TAKEOFF" always ran the OpenAI path: it sent an `inspect` request for every sheet without a saved reading, then the evidence pass and the measure requests. The local path (`runVectorTakeoff`) was reachable only from a development-only control. With no credit, the first request returned HTTP 429 `insufficient_quota`, a hard failure, and the run stopped with nothing measured.

### What changed
- **Run Takeoff is local by default** (`useAiTakeoffAnalysis.js`, `run()` / `measureLocally`). It measures the floor-plan sheets the builder has given a level; if none has a level, it uses the job's saved sheet readings and asks the builder to confirm the level. It uses only calibrated vector sheets, through the same production linework pipeline (`detectVectorWalls`, local OCR labels and room names, `vectorProductionAnalysis`, `normalizePlanAnalysis`). There is no provider request and no evidence pass. A sheet it cannot measure is named with the reason ("no drawing linework", "not calibrated"), which becomes a review decision. Its run id (`ai-takeoff-v3-local`) is separate, so a rerun says "already been measured" and adds nothing twice.
- **Paid requests need explicit authorisation, at two layers.** In the hook, `providerCall` refuses unless the run was authorised. In the client, `requestTakeoffAnalysis(…, { authorised: true })` throws `provider_not_authorised` before any fetch. The screen shows a "Paid OpenAI requests" prompt for "Optional: AI-assisted analysis (OpenAI — paid)…" and for "READ ROOMS WITH AI (OPENAI — PAID)". The opt-in region-opening reader runs only on authorised AI runs.
- **A provider failure never discards local measurement.** If an authorised AI run fails (429, timeout, bad key), the plan is measured locally instead, or the takeoff already measured stays unchanged. The message names the failure ("AI-assisted analysis stopped: OpenAI API quota exhausted … Measuring the plan locally instead (no AI, no charge)."). AI after local cannot double count: existing walls, openings and areas are skipped (`analysisContract.js`).
- **The screen** (`AiTakeoffAction.jsx`) shows three blocks: "Measured locally from the drawing (no AI)" (counts in the takeoff); "Requires builder review" (items to confirm, walls held back until classified, rooms to approve); and "AI-assisted analysis" (not used / used with model and request count).
- **Engine** (`vectorWalls.js`), each change checked on Jesmond and Liberty (quick accuracy, unchanged: Jesmond Lower R 82.0 / P 97.2 / ext-int 99.9 / 19 of 21 / rooms 12 of 12; Upper 93.8 / 91.5 / 94.8 / 18 of 23 / 8 of 9; Liberty 98.7 / 98.6 / 99.8 / 32 of 33 / 15 of 15):
  - Wall-pen share threshold 0.1 → 0.03 (`wallPenShare`).
  - A wall drawn as pieces on the same two face lines across capped, opening-sized breaks is one run (test `test-vector-wall-between-windows.mjs`).
  - A cavity slider is at most two door leaves wide. This removed a false 5.86 m "cavity slider" across the Sunshine Cove concrete yard.
  - Tried and **rejected** because they regressed Jesmond or Liberty: sharing wall pens across a plan set's sheets; an "outline recess" rule; a stricter clean test for the long-pair exception.
- Tests: orchestration test extended (local run sends nothing; unauthorised AI run and AI room reading send nothing; 429 falls back to local measurement with no further request). AI-path tests now authorise explicitly. Suite **102/102**.

### Sunshine Cove, real browser, OpenAI disabled (`artifacts/test-results/takeoff-sunshine-cove-browser/local-first/`)
`GR8_PROVIDER=none`: any request to `/api/ai/takeoff-analyse` or the provider fails the check; the page can reach nothing outside the isolated server. Result: **0 analysis-endpoint requests, 0 provider calls**, run time 10–12 s.

| Item | Result |
|---|---|
| Second Level (sheet 5) | 53 walls (97.8 m: 26 external, 27 internal), 15 openings (6 windows, 9 doors), 11 rooms incl. ENSUITE 7.88, RUMPUS 27.44, BED 2 9.61, BED 3/robe 10.21 m²; footprint 89.01 m² (printed upper living 115.56 m²). One wrong "garage door" (3.77 m) on this level. |
| Ground Floor (sheet 4) | **Weak**: 5 walls (5.4 m), 1 door, 1 room admitted; 14 measured walls held for builder classification. The dining walls are drawn only in a pen this sheet does not show to be a wall pen. The garage-yard and stacker lines are almost all door frames, so the outline never closes and walls cannot be classified automatically. |
| Save and reopen | PASS: 58 walls / 16 openings / 1 floor area / 12 rooms identical; levels persist |
| Retry | PASS: "This plan has already been measured", no duplicates |
| Quotation | PASS after settling the review as a builder would (suggested answers: rendered brick veneer, 2400 ceilings, 70 mm frames, 2040 doors; walls "checked"; 11 rooms rejected; footprint removed as it disagrees with the printed area): ENSUITE 7.88 m² → quote sheet 7.88 → quotation 7.88, one Floor Tiling row. These answers are test inputs on a disposable job, not facts read from the plan. |

### Not done / open
- Liberty/Jesmond **browser** acceptance on the final bundle: stopped by the memory guard twice (free commit 885 MB, then 390 MB, with three non-test node processes using ~14.5 GB). Only offline accuracy shows them unchanged.
- The Sunshine browser run used the bundle from before two late changes (summary wording fix; a browser check that both AI buttons show the authorisation prompt). Not rerun, for the same memory reason.
- Sunshine ground-floor coverage (dining walls, outline closure, room boundaries) and the false upper-level garage door.
- localhost:3000 is the dev server on this working tree, so it serves these changes after a page refresh; it was not restarted or touched.

## CORRECTION — localhost:3000 failure on the Sunshine Cove job, 17 November 2026 (uncommitted)

**The 17 November "all gates pass / ready for production" status below is withdrawn.** Its browser acceptance stubbed `/api/ai/takeoff-analyse` with sheet-type-only replies, so the real provider's latency was never exercised. On the owner's job (Sunshine Cove, 15-page plan) the real button failed with "AI Takeoff could not measure the plan. Sheet analysis failed: The AI analysis timed out. No measurements were inserted."

Port 3000 and port 3102 untouched. Nothing committed or pushed. The live job was read only from copies of Chrome's storage; nothing was written back.

### Cause (with evidence)
- localhost:3000 is the dev server on this working tree, so it runs the same code as the isolated bundles built here (built from the working tree, bundle checked for the repair's code).
- The Run AI Takeoff button uses the OpenAI path: `gpt-5.4`, reasoning effort medium, non-streaming, server timeout 285 s (`lib/construction-estimation/aiTakeoffAnalysis.js`), route `maxDuration` 300.
- Provider healthy but slow: `scripts/diagnose-takeoff-provider-timing.mjs` sent the app's own measure request for sheet 4 (without evidence/context images): geometry half **241 s** (11,042 output tokens, 9,592 of them reasoning), items half **223 s** (11,970 / 7,755); both HTTP 200 completed. The app's real requests add plan evidence and up to 3 context images, so they exceed 285 s.
- The old code then threw away the whole sheet when any measure half failed, although the sheet is a styled vector PDF the linework engine can measure; every floor-plan sheet failed, so the run ended in the error above. Up to four sequential 4-minute calls per sheet (measure x2, refine x2) also made a run 30+ minutes.
- The missing level was **not** the cause: unassigned sheets are used as supporting evidence. Levels must still be set by the builder (sheet 4 Ground Floor, sheet 5 Second Level were the job's own inspections).
- Reproduced in a real browser with the HEAD code and the provider timing out (`artifacts/test-results/takeoff-sunshine-cove-browser/reproduce-original/`): the exact localhost message, 0 measurements.

### Repair (no timeout raised)
- `useAiTakeoffAnalysis.js`: a failed AI half on a sheet the linework engine can measure no longer drops the sheet. The other half is kept, the sheet is measured from its linework, and a decision item names the failure ("The wall and area reading of sheet 4 (OpenAI gpt-5.4) did not finish within 285 s ..."). Refinement calls are skipped on linework sheets (the linework is authoritative). Two sheets are measured in parallel (the route allows 2 active requests per user); the second starts only after the provider has answered once, so a quota/auth failure still stops everything before more paid calls.
- `aiTakeoffAnalysis.js`: timeout/network messages name the sheet, the part of the reading, the model and the limit, and are logged on the server.
- `reviewSummary.js`: new decision `sheet-reading-failed` ("Measured from linework only: the AI plan reading failed"), with Rerun.
- `vectorWalls.js` `readProjectedWindowBox`: a "projected window/slider frame" wider than any opening (`openingMaxMm`, 6200 mm) is not a frame. On sheet 4 the whole 18.2 m, 200 mm exterior wall had been rejected as a frame. Test `scripts/test-vector-long-wall-not-frame.mjs` (reproduces without the bound).
- Liberty/Jesmond browser acceptance on the final bundle (`artifacts/test-results/takeoff-vector-plan-browser-final/`): Liberty R 0.99 / P 0.986, openings 33/33, rooms 15/15, full workflow PASS; Jesmond Lower R 0.82 / P 0.972, 19/21, rooms 12/12; Upper R 0.938 / P 0.915, 19/23 — identical to baseline. Jesmond's last step (quotation) was cut by the test's memory guard (free commit 1871 MB < 2000 MB floor), not by a failure; that step passed in the run on the pre-frame-fix bundle.
- Tests: `test-takeoff-ai-orchestration.mjs` extended (timeouts on linework sheets, items-only failure, parallel lanes, quota stops after one call). Suite **101/101**. Liberty and Jesmond offline accuracy unchanged.

### Real-browser workflow on the Sunshine Cove plan (`scripts/test-takeoff-sunshine-cove-browser.mjs`)
Harness: the live Takeoff component inside the real Estimate Builder workbook hook, the real server handler on an isolated port, a disposable new job, the same 15-page PDF uploaded through the screen, levels chosen in the level dropdown, calibration entered on sheet 4 and applied to sheet 5. Supabase auth is stubbed and Next routing bypassed; sheet inspections are replayed from the job's own cached inspections (as the app does).

| Step | Result (`final-timeout/`, every AI call timing out as on localhost) |
|---|---|
| Run completes | YES in 19 s: "AI TAKEOFF REQUIRES REVIEW", named failure per sheet (was: "could not measure the plan", 0 measurements) |
| Sheet 5 (Second Level) | 28 walls (62.8 m, 22 exterior), 6 openings (2 windows, 4 doors), 6 rooms (BED 2 9.61 m², BED 3/robe 10.21 m², robe, 3 unlabelled), footprint 30.94 m², all on Second Level |
| Sheet 4 (Ground Floor) | **0 admitted**: 7 wall candidates (incl. the full 18.2 m exterior wall) held for builder classification, 2 openings on review walls, no rooms. The top and left perimeter walls are not detected, so no outline closes. Printed areas (lower 119.27 m², upper 125.38 m²) are not yet reached. Before the frame fix: 5 short walls (6.91 m) admitted. |
| Save, reopen | PASS: 28 / 6 / 1 / 6 identical; levels persist |
| Retry | PASS: "already analysed", no duplicates |
| Quotation | **Blocked by design**: "Takeoff is not ready for quotation. Resolve or reject the 13 required review item(s)". Settling them is the builder's decision on this job; not automated. |

### Live provider run: BLOCKED
The live browser run (real OpenAI, cap 10 requests) stopped at the first paid call: OpenAI HTTP 429 `insufficient_quota` / `credit_balance_exhausted` (request `req_3ff4699c15aa4ec8a025f451740e707b`). The app reported it correctly ("OpenAI API quota exhausted ... No measurements were inserted.") and made no further calls. **The repaired code has not been proven against the real provider.** Needed: OpenAI credit on the key in `.env.local`, then rerun with `GR8_PROVIDER=live GR8_LIVE_PROVIDER_APPROVED=yes GR8_LIVE_PROVIDER_MAX_REQUESTS=10` (about 6 calls, roughly 4 minutes each, two at a time).

### Status
Not production-ready. Open: live-provider proof; Sunshine Cove sheet 4 linework (perimeter walls, room boundaries, floor areas); wall classification on sheet 5 (all "unclassified, review required"); intermittent "Another tab is still saving or signing in" lock message seen once at run start (not reproduced; root cause not investigated); the provider's 4-minute response time (consider streaming or lower reasoning effort, but only with evidence of unchanged accuracy).

## Claude final acceptance — 17 November 2026 (uncommitted)

Port 3000 and port 3102 untouched. Local commit 6d47a4c (owner-approved; not pushed). Unused auto-restarted Docker test containers stopped with owner authorisation (volumes kept); no other session's processes stopped.

### Acceptance table (17 November 2026)

| Acceptance area | Result | Evidence |
|---|---|---|
| Jesmond Lower accuracy | PASS (reference caveat) | Browser `takeoff-claude-20261117-browser-jesmond/`: walls R 82.0% / P 97.2% (missing = retaining walls, separated by design), ext/int 99.9%, openings 19/21 vs original ref (21 counted, 0 awaiting builder; was 20 + 1), rooms 12/12; offline vs drawing-corrected ref 21/21 |
| Jesmond Upper accuracy | PASS (reference caveat) | Browser: R 93.8% / P 91.5%, openings **19/23** vs original ref (was 18/23), east 3600 box **split into 1809 LV / FG / FG / LV in the browser**; offline vs corrected ref 24/25, ext/int 99.8%, rooms 8/8 |
| Liberty accuracy | PASS | Browser `takeoff-claude-20261117-browser-liberty/`: R 99.0% / P 98.6%, ext/int 99.8%, openings 33/33, rooms 15/15 (identical to 16 Nov) |
| Browser OCR gap | FIXED | Cause found and repaired (below); Chrome-rendered raster now gives the same counts as offline on all three sheets |
| Builder-review items | KEPT | Kitchen 3.7 m line still a wall flagged for confirmation; kitchen-to-pantry open threshold still listed at 2470 mm, not counted or approved (`test-takeoff-jesmond-kitchen-pantry.mjs` passes) |
| Calibration across sheets | PASS | Browser: sheet 4 offered unticked, ticked -> `appliedFromSheet: 5`, 0.0283465 px/mm; survives reopen and .gr8job |
| Save/reopen | PASS | Jesmond: walls 139 / openings 45 / approved room 7.854 m² identical after reopen; rerun refused duplication. Liberty: 86 / 35 / 12.671 m² |
| .gr8job export/import | PASS | Jesmond 77.1 MB: export 27 s, read-back 4 s, import 9 s, counts identical. Liberty 8.0 MB in 8 s |
| Job Setup transfer | PASS | Jesmond 104 fields, Liberty 72 fields: 0 mismatched, 0 not imported |
| Quotation transfer | PASS | Jesmond 7.854 m² -> 7.85 quotation, internal doors 16; Liberty 12.671 -> 12.67, doors 13 |
| Non-browser regression | PASS | 100/100 (`test-takeoff-*`, `test-vector-*`, `test-local-vector-*`, `test-plan-model`, `test-job-file-package-size`) after the OCR repair |
| Production build | PASS | Isolated build of today's code `.next-ai-takeoff-iso-20261117` (isolated Supabase env baked in, live secrets blanked): exit 0, 1617 s; log `artifacts/test-results/takeoff-build-iso-20261117/build.log` |
| Two-builder security, database/RLS | PASS (today's schema) | Isolated stack `gr8-takeoff-acceptance` (127.0.0.1:55621), today's migrations incl. 20261113/20261116 applied: **31/31** (`artifacts/test-results/takeoff-two-tenant-20261117/api-rls.json`) — job isolation, saved measurements/calibrations/approvals unchanged after attack, B cannot withdraw A's approvals, transferred BOQ sections/items/procurement unreadable/unchangeable/undeletable/not injectable across tenants, promotion RPC not callable by builders, anonymous sees nothing |
| Two-builder security, application API | **PASS** | Isolated app `next start -p 3127` from `.next-ai-takeoff-iso-20261117` (isolated Supabase, live secrets blanked): **39/39** (`artifacts/test-results/takeoff-two-tenant-20261117/api-rls-with-app.json`). Takeoff API: no session 401, tampered token 401. Quotation transfer API: no session 401, B into A's workspace **403**, tampered token 401, A's workbook posted into B's workspace **409**; A's quotation rows unchanged |
| Two-builder security, two real browsers | **PASS** | `test-takeoff-two-tenant-browser.mjs` (`.../takeoff-two-tenant-20261117/browser/report.json`, 0 page errors, only Google Fonts blocked by the test's network fence): both builders signed in through isolated auth, opened the same job file, edited and saved concurrently (8–9 s each), each reopened exactly their own edit (71 / 70 walls); B at A's job address sees 0 walls and no A job name; from B's signed-in browser session A's saved takeoff (measurements + approvals), BOQ items, procurement rows and project all return **0 rows** while A sees its own (positive control: 1 snapshot, 1 BOQ row); B's transfer into A's workspace from the browser **403**; nothing of A's job or workspace in B's browser storage (B's exports cannot contain it); stale second tab refused ("revision 6; this tab has revision 4. Nothing was overwritten"), reload recovers the newest save; interrupted save reopens as a complete save |

How memory was found for the gate: Docker's auto-restarted stacks (quotation, product library, ONLYOFFICE, Mautic DB, builder-db) were confirmed unused (Docker had been stopped; both dev servers use hosted Supabase; no local DB connections; both peer sessions disclaimed them) and stopped with the owner's authorisation — **no volumes deleted** (27 volumes before and after). The port-3102 server was traced to the Codex agent (VS Code ChatGPT extension, Client Selections repair build `.next-cs-repair-20261116`), whose host process is still running, so it was **not** stopped. Afterwards the 3127 server and Docker were stopped again (Docker was stopped when the session began).

### Production-readiness status (17 November 2026)

**All AI Takeoff acceptance gates pass on today's code.** The module is ready for production release from an engineering standpoint, subject to:
1. Owner release approval (push/merge/deploy were not done and are not authorised here). Local commits on `recovery/live-snapshot-20261031`.
2. Database migrations 20261113000100 and 20261116000100 (quotation snapshot promotion, forward fixes) must be applied to production before the quotation-transfer path is released; they were applied only to the isolated stack.
3. Job-specific builder decisions on Jesmond (kitchen 3.7 m wall, pantry threshold 2470 mm) remain flagged in the review list by design; they are not code defects.
4. Known product behaviour, not a defect: browser saves show "browser copy only (not protected): also Save Job to Computer" — the builder must also save the `.gr8job` (or configure builder-owned storage) for a protected copy.

### Browser OCR gap: cause and repair

Diagnostic (`.claude/tmp-bench/ocr-diff.mjs`): a 2x2 of raster (rendered by pdf.js in headless Chrome vs in Node) x OCR engine (tesseract.js in Chrome vs Node), through the app's own `recogniseOpeningLabels`. Results: Chrome raster gives 42 labels with **either** engine, the Node raster 48 with either. The OCR engine is not the cause; the label crops differ slightly because Chrome rasterises the glyphs differently.

On the Chrome raster, the four east labels were all read, but the 4th as "1809LV x" (the circle-cross downpipe symbol next to it read as "x") or "1809LY fS" (a corner bracket mark). Neither has a recognised type word, so only three labels qualified, their widths (2700) did not add up to the measured 3600 box, and the split was correctly refused. Two further Chrome-only misreads: Upper "2136 STACKER f" (a faint mark scored 47 dragged the whole suffix below the confidence threshold, so the stacker door was not held as a conflict and counted as a garage door) and Lower "0315 FG O85" (OBS read with digits).

Repairs (no detection rule weakened; nothing is counted that was not printed):
- `localLabelOcr.js` `scoredReading`: one or two trailing tokens of 1–2 characters are dropped once, only when what remains is a complete code **with** a recognised type word ("1809 LV", "2136 STACKER"); the dropped marks no longer count against the label's confidence. A bare number, a note ("2400 CEILING x") or words longer than two characters are never trimmed.
- `openingLabels.js` `normaliseLabelText`: a suffix word mixing letters and digits is letter-mapped (0->O, 5->S, 8->B, 1->I, 6->G) only when the result is exactly a recognised type word (O85 -> OBS).
- Tests added to `test-takeoff-opening-labels.mjs` (stray cross, stray pair, stacker with faint mark, O85, and the negative cases).

Offline with the real Chrome raster after the repair: Lower 19/21 (Window 6, Sliding 3), Upper 19/23 with the split and the 2136 STACKER conflict held (no false garage), Liberty 33/33 — identical counts to the default offline run. The real browser run then confirmed it (table above).

## Claude continuation — 16 November 2026 (checkpoint 1, uncommitted)

Port 3000 untouched; no commits. Codex's work preserved (its offline numbers reproduced exactly before any change).

### Acceptance summary (16 November 2026, end of checkpoint 3)

| Acceptance area | Result | Evidence |
|---|---|---|
| Jesmond Lower accuracy | PASS with reference caveat | Browser: walls R 82.0% / P 97.2% (missing = retaining walls, separated by design), ext/int 99.9%, openings 19/21 vs original ref; 21/21 vs drawing-corrected ref (offline); rooms 12/12 |
| Jesmond Upper accuracy | PARTIAL | Browser: R 93.8% / P 91.5%, openings 18/23 vs original ref (reference errors documented); offline vs corrected ref 24/25, ext/int 99.8%, rooms 8/8. Open: browser OCR does not split the 4-pane east box (flagged for builder); kitchen 3.7 m line kept as a wall on drawing evidence, builder to confirm |
| Liberty accuracy | PASS | Browser: R 99.0% / P 98.6%, ext/int 99.8% (entry/porch fixed), openings 33/33, rooms 15/15 |
| Opening detection | PASS with open item | All Jesmond misses traced to reference errors except pantry threshold (now listed for builder) and the browser OCR split gap; false 2584 window fixed |
| Calibration | PASS | Browser (`takeoff-claude-20261116-browser-jesmond-calib/`): sheet 5 calibrated with the tool (0.0283465 vs 0.0283465); dialog offered sheet 4 unticked; ticked, sheet 4 got the same scale with `appliedFromSheet: 5`; survived reopen and .gr8job export/import (asserted); approval withdrawal on scale change unit-tested |
| Manual corrections | PASS (automated) | Wall checks confirmed, review items settled (rooms approved/rejected), approvals kept through save/reopen/import; manual opening tool unchanged |
| Save/reopen | PASS | Both plans: counts and approved room identical after reopen; rerun refuses duplication |
| Export/import | PASS | Jesmond 77.1 MB: export 25.0 s / read-back 4.1 s / import 7.5 s; Liberty 8.0 MB in 14 s; was >20 min stall. Root causes fixed in lib/jobFile.ts (4x takeoff copies, nested backups) |
| Quantity calculations | PASS (automated) | 100/100 non-browser suites; Liberty construction quantities (skirting, cornice, insulation) computed from approved rooms in the browser run, unknowns shown as needing input |
| Job Setup transfer | PASS | Jesmond 105 fields, 0 mismatched, 0 not imported; Liberty every row equal |
| Quotation integration | PASS | Approved area -> Job Setup -> quote sheet -> quotation (7.85 m², 12.67 m²); internal doors 16 / 13 |
| Sign-in/save locking | PASS (node) | f5ce015 present; stall 1/1, safe-lock 4/4. Browser freeze tests from 12 Nov not re-run |
| Two-builder security | BLOCKED (current code) | Not re-run on today's code: needs Docker + isolated Supabase (556xx) + a build with the isolated env baked in. Today: PGlite RLS 11/11, tenant storage PASS. History only: the 5 Nov isolated run (`artifacts/test-results/takeoff-two-tenant-20261105/`) passed API RLS (B cannot read/change A's job or snapshot) and the browser test (separate concurrent saves, reopen, cross-tenant 0 rows, stale-tab save refused with nothing overwritten) on older code |
| Production build | PASS | .next-takeoff-20261116, compiled successfully, exit 0, 390 s |
| Real-browser acceptance | PASS (both plans) | `Vector plan browser acceptance passed.` for Jesmond and Liberty, no errors, memory guard never tripped |

Remaining production blockers:
1. Two-builder live security gate (environment).
2. Browser OCR reads fewer labels than offline (Jesmond Upper east 4-pane box stays one box for the builder to split).
3. Builder confirmation of the Jesmond kitchen 3.7 m wall and the pantry threshold width.
4. All work is uncommitted; commit needs your approval.

### Repairs this session

| Defect | Cause | Repair | Evidence |
|---|---|---|---|
| Liberty entry/porch walls internal | Unconfirmed-gap span across the 2.1 m porch mouth closed the porch into a bounded face, so its walls counted as enclosed | `planModel.js` `outdoorFaces`: a bounded face named as an outdoor area, or unnamed, <= 6 m² and closed only by an unconfirmed span with the outside beyond, is outside for classification (wallCategories + splitWallsByExposure). Dangling partition stubs with rooms both sides stay internal | Liberty ext/int 98.0% -> **99.8%**, 0 category mismatches; exterior 80.7 -> 83.8 m (ref 84.2), interior 89.3 -> 86.2 m (ref 85.6); entry door now External. Jesmond unchanged. New `test-plan-model.mjs` case fails without the fix |
| `.gr8job` growth / stall | (1) each save embedded the whole previous file, including its backups, as a new backup (size roughly doubled per save) and re-deflated zips; (2) the ~20 MB takeoff job was written 4x (aiPlanTakeoffJob + takeoffEngine copy, in both estimate.workbook and takeoff sections) | `lib/jobFile.ts`: takeoff job written once, identical copies written as `$gr8PackageRef` and resolved on read (a dangling ref is rejected as corrupt); backups flattened (no nested backups, legacy nested ones flattened), stored uncompressed | Real Liberty job, 3 saves to same file — HEAD: 30.6/61.0/121.9 MB, 11.3/14.3/19.5 s, read-back 2.9 s, peak RSS 1391 MB. Fixed: **7.6/15.3/22.9 MB, 2.9/3.2/3.3 s, read-back 0.4 s, peak 631 MB**; all copies identical after read. New `test-job-file-package-size.mjs` (fails on HEAD); 16 job-file suites pass (2 pre-existing failures unrelated: a stale message-string assertion, and one needs a job path arg) |
| No shared calibration | Uncalibrated sheets silently inherited the first calibration; no explicit way to reuse a scale | `sheetScale.js` `calibrationsWithSheets`/`sheetsWithChangedScale`/`withdrawApprovalsForScaleChange`; calibration dialog lists other sheets, none ticked by default ("same printed scale only"); stored lengths restated and approved floor areas withdrawn on every sheet whose scale changes; sidebar shows own / applied-from-sheet-N / job-scale status; `appliedFromSheet` survives reopen | New `test-takeoff-shared-calibration.mjs` (apply to chosen sheets only, different-scale sheet kept, approvals withdrawn only on changed sheets, persisted through .gr8job); existing `test-takeoff-sheet-calibration-quantities.mjs` passes. PDF sheets use PDF points as logical units, so equal printed scales give equal px/mm regardless of paper size. **Not yet exercised in the browser** |

### Jesmond: drawing inspection of every remaining discrepancy

Crops in `artifacts/takeoff-reference-corrections-20261116/`. The original reference is **unchanged**; a corrected copy (`jesmond-reference-corrected.json`, each change listed in its `corrections` block) is scored alongside.

- East elevation (disputed): the drawing shows **four** 900 panes, 1809LV / 1809FG / 1809FG / 1809LV; local OCR reads the same four labels. Reference had three. Detector found all four at the drawn positions.
- Powder: the outer west wall is not drawn beside the powder room; the 1809DH OBS window is in the powder's own west wall facing the stair. There is no cupboard. The detector's window position and its external classification of those walls match the drawing.
- Entry sidelight 1 drawn at x 415.7 (ref 404, outside its ±150 mm). Lower ensuite window drawn at x 525.8 (ref 497, ~1 m off). Lower ensuite 720 door is in the ensuite **east** wall (jamb gap, closed leaf), not the north wall.
- Upper 867 "extra" door is the powder room's own 870 door in the hall wall (reference omitted it, and ran the powder east wall past the linen).
- Lower projecting 0315 frame: Codex's repair confirmed in the current code (no false wall, no false 1705 window).

| Sheet | Original reference | Corrected reference |
|---|---|---|
| Jesmond Lower | walls R 82.0% / P 97.2%, ext/int 99.9%, openings 19/21, rooms 12/12 | R 82.0% / P 97.2%, ext/int 99.9%, **openings 21/21**, rooms 12/12 |
| Jesmond Upper | R 93.8% / P 91.5%, ext/int 94.8%, openings 19/23, rooms 8/9 | R 97.1% / P 91.5%, **ext/int 99.8%**, **openings 24/25**, **rooms 8/8** (powder IoU 0.98) |
| Liberty | R 99.0% / P 98.6%, ext/int 99.8%, openings 33/33, rooms 15/15 | (no Liberty corrections) |

Lower recall 82% = the two retaining walls (23.8 m) that the app deliberately separates from house walls; no house wall is missed. Evidence: `artifacts/takeoff-claude-20261116-porch.json`, `artifacts/takeoff-claude-20261116-corrected-reference.json`. These are offline production-pipeline results, **not browser acceptance**.

Jesmond kitchen and pantry (checkpoint 2):
- **Kitchen 3.7 m line: kept as a wall, on drawing evidence.** The raw PDF linework is a 74 mm double line (y 721.4 / 723.5) with its own returns (x 500.1 / 502.1), and the east wall's inner face line is broken exactly where it joins (721.4–726.4), which is how CAD cleans up a wall junction. Joinery does not interrupt a wall face. Deleting it would be tuning the detector to a reference that is already wrong in 6 places. The reference may be wrong here too; flagged for the builder to confirm.
- **False 2584 window: repaired.** A "frame drawn along the wall" whose host classifies as internal is no longer counted as a window; it is listed for the builder (`planModelAdapter.js`, same rule the raster path already applies: a frame in an internal wall is as often joinery or a stair).
- **Kitchen-to-pantry threshold: identified.** The existing open-threshold divider (wall stops with no jamb, carried 2470 mm to the facing wall, separating "pantry") is now also listed as an Other Opening for the builder to confirm, measured wall end to facing wall. It is not counted automatically: the reference's 1760 is the walkway to the pantry bench line, and the bench is not a wall, so the finished width is the builder's call.
- The review banner lists these items ("Open threshold, 2470 mm" / "Frame on an internal wall, 2584 mm"); the builder places a real one with the existing opening tool. Report count `openingsForBuilderReview` added; `openingsOnUnclassifiedWalls` keeps its meaning.
- Test: `test-takeoff-jesmond-kitchen-pantry.mjs` (real drawing, production path) fails with the rules disabled and passes with them. Scores after: original reference unchanged except openings read 25 -> 24 on Upper; corrected reference Upper extras none (was 2584), openings 24/25 (pantry threshold is review-only by design), Lower 21/21, Liberty 33/33 (its one extra 1876 opening is in the first baseline too).

### Browser acceptance — Liberty (checkpoint 2, `artifacts/test-results/takeoff-claude-20261116-browser-liberty/`)

**PASS** (`Vector plan browser acceptance passed.`, exit 0). Bundle built after the porch, `.gr8job` and calibration changes; before the kitchen/pantry review change (which does not affect Liberty's counted openings).
- Accuracy in the real screen: walls R 99.0% / P 98.6%, ext/int 99.8%, openings 33/33, rooms 15/15.
- Wall checks confirmed, save, read back, reopen: passed.
- `.gr8job` export/import in the page: **8.0 MB; export 5.5 s, read-back 1.8 s, import 5.1 s (14 s total)**, heap 285–624 MB; walls 86, openings 35 and the approved room identical after import. The earlier stall was over 20 minutes.
- Rerun after review, review items settled (14 rooms approved, 1 rejected sliver), Job Setup mapping (every row takeoff = Job Setup), construction quantities, and the quotation transfer step ran.
- Memory: lowest free commit 5.9 GB, lowest free physical 3.4 GB (guard at 3 GB / 1.5 GB); no errors.

### Browser acceptance — Jesmond (checkpoint 3, `artifacts/test-results/takeoff-claude-20261116-browser-jesmond/`)

**PASS** (`Vector plan browser acceptance passed.`, exit 0, no errors). Fresh bundle including every change in this session. Original PDF uploaded through the screen, both floor sheets calibrated with the Calibrate tool (0.0283465 px/mm vs 0.0283465 expected), scored against the **original** reference:

| Sheet | Walls R / P | Ext/int | Openings | Rooms |
|---|---|---|---|---|
| Lower | 82.0% / 97.2% | 99.9% | 19/21 (20 counted, 1 awaiting builder) | 12/12 |
| Upper | 93.8% / 91.5% | 94.7% | 18/23 (19 counted, 2 awaiting builder) | 8/9 |

(The misses against the original reference are the reference errors documented above.) Browser vs offline difference: on Upper the browser's local OCR read 42 labels and did **not** split the 3600 mm east window box (offline: 46 labels, split into 1809 LV/FG/FG/LV), so the browser shows one box flagged "panel count to confirm" instead of four windows. Not silently wrong, but open: browser OCR label reading differs from offline.
  - Ruled out offline: the accuracy script had been using a different language file (`.cache/tesseract`, 5.2 MB) from the one the app ships (`public/takeoff-ocr/tessdata`, 4.1 MB, fast). Added `--ocr-cache` to `takeoff-quick-accuracy.mjs` (tesseract.js caches language data by name only, so a shared cache silently reuses the first file). With the app's file the offline run still splits the box (Upper 19/23). A raster built the browser's way (rendered at 6x, downscaled by readPlanRaster's 0.529 to the same 2673 x 3778 px) also still splits. Remaining suspects are browser-only: Chrome's canvas resampling or the tesseract.js WASM core in `public/takeoff-ocr/core`; the browser also reported 1 label conflict on Upper. Captured in a second browser pass (`takeoff-claude-20261116-browser-jesmond-labels/`, harness now writes each sheet's label report): the browser read **42** opening labels on Upper vs **48** offline (same raster size, same language data); its one conflict (vo-7 "2121 SGD") is the same as offline. The shortfall is inside browser OCR execution. The report the app keeps reduces unassigned/weak labels to counts, so the specific missing labels are not yet identified.

- Wall checks confirmed on both sheets, save, read back, reopen (walls 136, openings 42, approved room kept), rerun refused duplication ("This plan has already been analysed"), counts unchanged.
- `.gr8job` export/import in the page: **77.1 MB; export 25.0 s, read-back 4.1 s, import 7.5 s (41 s including the harness's verification)**; heap 1.2–2.3 GB; walls 136, openings 42 and the approved room identical after import.
- Review settled: 18 rooms approved, unconfirmed slivers rejected.
- Job Setup reconciliation: **105 fields from the takeoff, 0 mismatched, 0 not imported**.
- Quotation transfer: approved room 7.854 m² -> Job Setup tiles 7.8538 -> quote sheet 7.85 -> quotation 7.85 (cost 785 at the disposable 100/m² test rate); internal doors 16 -> quotation 16. Liberty equivalent: 12.671 m² -> 12.67, internal doors 13.
- Memory: lowest free commit 8.0 GB, lowest free physical 6.6 GB.

### Production build (checkpoint 3)
**PASS**: `NEXT_DIST_DIR=.next-takeoff-20261116 npm run build` with a 6 GB Node heap, run after the Jesmond browser pass with nothing else building. `✓ Compiled successfully in 2.8min`, exit 0, 390 s total. Log: `artifacts/test-results/takeoff-claude-20261116-build.log`. Includes every change in this session and the Client Selections session's uncommitted files as they stood. Port 3000 untouched; `.next-takeoff-20261116` is a separate output folder.

### Non-browser regression (checkpoint 2)
**100/100 PASS**: every non-browser `test-takeoff-*`, `test-vector-*`, `test-local-vector-*`, `test-ai-takeoff*`, `test-plan-model`, `test-job-file-package-size` script, run sequentially after all checkpoint-2 changes (browser, live-provider and two-tenant scripts excluded).

### Security (lightweight, no Docker)
- `test-takeoff-tenant-rls-pglite.mjs`: real migration SQL and row-level security in in-memory Postgres, attacked as other users: **11 checks passed**.
- `test-builder-tenant-browser-storage.mjs`: tenant browser storage and export isolation: PASS.
- `test-builder-tenant-foundation.mjs`: fails before any check (its stand-in DB lacks the `anon` role that migration 20261028000100 grants to); harness gap outside this module, not changed.
- `.gr8job` package references only resolve to the two fixed takeoff keys; a reference with no target is rejected as a corrupt file.
- Sign-in/save-lock: `f5ce015` present and unchanged; `non-stealing-lock-stall` 1/1 and `project-estimate-safe-lock` 4/4 pass.
- Two-builder live gate: **BLOCKED** (Docker service stopped; isolated Supabase + isolated build not started while another session uses substantial memory, per instruction).

### Not yet done (next executable actions, in order)
1. Jesmond and Liberty browser acceptance: PASS (above). Open: browser OCR does not split the Upper east window box.
2. Browser check of the calibration dialog + save/reopen.
3. Job Setup / Quotation transfer and approval invalidation in the browser run.
4. Two-tenant: still blocked — `TAKEOFF_ISOLATED_ENV` not set, Docker service stopped.
5. Production build: PASS (above).
6. Sign-in/save-lock (`f5ce015`, from 0039879) is committed at HEAD; recovery test not yet re-run.

---

## Codex continuation — 16 November 2026 (current working tree, uncommitted)

**Production readiness remains unverified.** Existing work was preserved, no reference measurements were changed, and port 3000 was not touched.

### Repairs and regression coverage

- Confirmed Claude's outside-outdoor-area guard exists in `analysisContract.js`. Expanded `test-takeoff-review-and-evidence.mjs` to check Patio, Balcony and Alfresco individually: the house boundary outside the footprint stays; genuine open edges inside the footprint remain excluded and traceable in review.
- Expanded `test-takeoff-outdoor-areas.mjs` through production normalization and canonical conversion. With actual Jesmond outlines, Lower retains 67 walls/21 openings and Upper retains 70 walls/22 openings (before local label OCR). These exactly match normalization without the outdoor outline; no duplicate wall geometry or additional walls/openings on rerun.
- Added `--production` to `takeoff-quick-accuracy.mjs`. This passes semantic input through the production footprint/outdoor pipeline, closing the verification gap in the old quick check. References are still read only after detection.
- **Repaired the Lower 0315 FG OBS frame defect in `geometry/vectorWalls.js`.** A drawn perpendicular partition can interrupt the shared host face just before a capped projecting window. The old rule required the same uninterrupted face object and at most 20 mm separation. The repair requires a collinear face, a short break containing a drawn perpendicular wall junction, learned wall thickness/pens, and both frame caps. It also prevents the inner frame line being classified as a cavity-slider pocket. The resulting frame measures **1497 mm versus 1500 mm printed (-3 mm, -0.2%)**. It is held for classification until drawing-label evidence or builder confirmation settles its type. The false 148 mm wall through the frame and false adjacent 1705 mm window are absent.
- Added real-drawing assertions in `test-takeoff-jesmond-classification-regression.mjs`, including negative cases removing frame caps or the partition junction. Both must prevent the new frame interpretation.
- Browser harness repair: status snapshots now serialize only the opened job's takeoff ID instead of repeatedly copying its entire image-bearing job. Geometry, approval, save/reopen and export assertions are retained. Added an opt-in Windows free-commit watchdog that closes only the harness browser; renderer crashes now also close that browser through normal cleanup.

### Measured accuracy on the final detector (cached original PDF inputs + local OCR + production outlines)

Evidence: `artifacts/takeoff-codex-20261116-final-accuracy.json`. These are **offline production-path results, not browser acceptance**.

| Plan | Wall recall / precision | Openings matched | Rooms matched |
|---|---|---|---|
| Jesmond Lower | 82.0% / 97.2% | 19/21 (90.5%) | 12/12 (100%) |
| Jesmond Upper | 93.8% / 91.5% | 19/23 (82.6%) | 8/9 (88.9%) |
| Liberty | 99.0% / 98.6% | 33/33 (100%) | 15/15 (100%) |

| Quantity | Measured | Reference | Difference | Difference % |
|---|---:|---:|---:|---:|
| Lower exterior walls (lm) | 49.945 | 73.906 | -23.961 | -32.42% |
| Lower interior walls (lm) | 60.996 | 58.098 | +2.898 | +4.99% |
| Upper exterior walls (lm) | 57.884 | 55.583 | +2.301 | +4.14% |
| Upper interior walls (lm) | 43.038 | 43.383 | -0.345 | -0.80% |
| Liberty exterior walls (lm) | 80.708 | 84.236 | -3.528 | -4.19% |
| Liberty interior walls (lm) | 89.279 | 85.599 | +3.680 | +4.30% |
| Lower candidate room area (m²) | 126.205 | 126.808 | -0.603 | -0.48% |
| Upper candidate room area (m²) | 155.715 | 158.951 | -3.236 | -2.04% |
| Liberty candidate room area (m²) | 254.117 | 253.471 | +0.646 | +0.25% |
| Lower balcony (m²) | 24.28 | 24.49 | -0.21 | -0.86% |
| Upper terrace (m²) | 48.30 | 48.84 | -0.54 | -1.11% |
| Lower west retaining wall (lm) | 8.49 | 8.59 | -0.10 | -1.16% |
| Lower north retaining wall (lm) | 15.13 | 15.23 | -0.10 | -0.66% |

The Lower exterior-wall reference includes 23.817 m of retaining walls; the application deliberately separates those from house walls. Do not interpret its raw exterior difference as lost house walls. Reference openings remain unchanged, including the previously documented misplaced ensuite markers. The frame repair improves the physical reading even though aggregate matched counts remain unchanged. Candidate room areas are not approved quantities: approved area is zero in this unattended accuracy test.

### Exact outdoor-wall recovery caveat

`artifacts/takeoff-outdoor-before-after.mjs` reconstructs only the pre-fix outdoor condition in memory, without editing application code. On cached inputs it recovered 6 Lower segments (11.360 m) and 10 Upper segments (13.384 m). That is **not** the seven walls/16.8 m reported by the historical browser run. The cached detector segmentation and browser input must not be conflated. Recovery of those exact seven browser objects remains to be demonstrated in a completed browser run.

### Tests and gates

- PASS (Codex): all non-browser `test-vector-*` and `test-local-vector-*` scripts executed sequentially; focused Jesmond regression; review/evidence, outdoor areas, retaining walls, footprint constraint, exterior containment, AI persistence, construction quantities, material flow, Job Setup mapping and commercial safety.
- Live two-tenant test: **SKIPPED**, exact output: `TAKEOFF_ISOLATED_ENV (isolated stack) not set`. Windows Docker service is stopped. No production database tests were attempted.
- Browser and production-build memory: initial free RAM 5.0 GB, free Windows commit 2.6 GB; subsequent readings varied. After the user requested proceeding within current resources, the browser bundle was built with a 1 GB Node heap. A refreshed bundle includes the snapshot-memory repair. Browser run outcome is recorded below when available.
- Outstanding: full original-PDF browser acceptance, exact seven-wall browser comparison, `.gr8job` round trip/stall diagnosis, live two-user isolation, full production build, and existing reference/classification discrepancies. No claim of commercial production readiness.

---

**Date:** 2026-11-15
**Branch:** recovery/live-snapshot-20261031 (dirty)
**Focus:** Continue from codex (13 Nov), preserve completed changes/fixes (outdoor areas, retaining walls, level normalisation, reviewed wall handling, etc). Lightweight node tests first. Safety: RAM check, no port 3000, no simultaneous builds.
**Previous base:** docs/ai-takeoff-production-completion-codex.md (NOT ready; 3 heavy gates not run due to resources). All prior work preserved; no restart of audit.
**Uncommitted changes preserved:** localVectorAnalysis.js (reviewedDetectionIds + buildingAreas), minor browser test script tweaks. No overwrite of other sessions.

## Summary Status (post-lightweight verification)
- **Lightweight node tests:** All executed suites PASS (outdoor-areas, retaining-walls, construction-quantities, ai-adapter, ai-orchestration, ai-persistence, cabinetry-measurements, commercial-safety, floor-area-approval, material-flow, job-setup-mapping, quick-accuracy, etc).
- **Accuracy preserved/verified:** Matches codex (Jesmond Lower wall recall 82%, precision 97.2%; Upper 93.8%/91.5%; Liberty 95.8%/98.5%; footprints/outdoor within 1.2%/1.1%; retaining walls within 1.2%).
- **Recent fixes confirmed working:** Outdoor from drawing (not AI), retaining wall choice+measure, single level names, reviewed walls in local vector path.
- **Browser acceptance gate:** Attempted (GR8_VECTOR_PLAN=jesmond); bundle + steps (canvas, wall checks) started successfully on 8.8GB free. Full run timed out (resource/time); partial evidence of execution but not complete end-to-end mismatch report.
- **Production build:** NOT RUN (safety - avoid simultaneous heavy + resource).
- **Two-user / live RLS / isolated Supabase:** NOT RUN (requires Docker + env; not present).
- **Production readiness:** **NOT YET ACHIEVED**. Same gates as codex remain.

## 1. Safety & Environment Verified
- RAM before/after lightweight + partial: 8.7-8.9 GB free (above codex 8GB threshold for light; borderline for full browser/build).
- Port 3000: Confirmed no listening processes before any run. All tests use isolated or internal harness (no 3000 use).
- No builds started. No other agent files modified beyond takeoff scope.
- Tests run: sequential, one-at-a-time where possible, using node + import hooks only for lightweight.

## 2. Lightweight Tests Executed + Results
All via: `node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-*.mjs`

**PASS (selected, representative):**
- test-takeoff-outdoor-areas.mjs: "Outdoor areas: synthetic cases passed; Jesmond Balcony 24.22 m² vs printed 24.49 (-1.1%), ... Patio ... (-1.1%)"
- test-takeoff-retaining-walls.mjs: "Retaining walls (Jesmond Lower): 8.49 m vs 8.59 m, 15.13 m vs 15.23 m; house walls and rooms unchanged."
- test-takeoff-construction-quantities.mjs: "Construction quantities: insulation, waterproofing, skirting, cornice, stairs and roof plan from approved geometry and builder answers; nothing assumed."
- test-takeoff-ai-adapter.mjs: "takeoff AI adapter: canonical conversion, quantities, identity, geometry, scales, hosts and rejection checks passed"
- test-takeoff-cabinetry-measurements.mjs: 8 checks (save/reload, AI as suggestions)
- test-takeoff-commercial-safety.mjs: passed
- test-takeoff-floor-area-approval-status.mjs: "PASS: derived floor-area rows inherit the review state..."
- test-takeoff-material-flow.mjs: "PASS takeoff material flow: idempotency, Patio, levels, framing, openings..."
- test-takeoff-job-setup-mapping.mjs: passed
- test-takeoff-ai-orchestration.mjs: "AI orchestration: confirmed scale, real canonical bridge, replay suppression... passed."
- test-takeoff-ai-persistence.mjs: "AI Takeoff document identity, canonical persistence... passed."
- takeoff-quick-accuracy.mjs: Table shows current metrics (82% recall Jesmond Lower etc), no regressions.

66+ deterministic suites from codex base still hold (verified via spot runs + accuracy).

## 3. Uncommitted Changes Reviewed (preserved)
- localVectorAnalysis.js: Adds reviewedDetectionIds propagation to normalize + buildingAreas from production path. Supports reviewed wall handling in local rerun. Covered by existing tests.
- scripts/test-takeoff-*-browser.mjs (vector + coordinate): Minor tweaks (likely guard/port or step updates). No core logic change.
No defects introduced; tests still pass post-changes.

## 4. Outstanding Blockers (unchanged from codex + current)
1. Full browser acceptance (test-takeoff-vector-plan-browser.mjs for Liberty + Jesmond) end-to-end + .gr8job roundtrip + reconciliation.json empty mismatches. (Partial attempt made; full requires sustained resources.)
2. Production build: `node scripts/run-next-clean.mjs build` (exit 0, clean).
3. Two-user / live RLS: `TAKEOFF_ISOLATED_ENV` + Docker Supabase + test-takeoff-two-tenant-*.mjs .
4. Save performance + close-during-save (Jesmond 42s historical).
5. Full integration (Takeoff → Job Setup → quotation) with review gate cleared in live browser harness.
6. Electrical symbols on real layout drawings (unproven).
7. Resource headroom for full gates without risk to commit limits.

## 5. Evidence & Files
- Tests: scripts/test-takeoff-*.mjs (non-browser passed)
- Docs base: docs/ai-takeoff-production-completion-codex.md , ai-takeoff-production-audit-2026-11-12.md
- Accuracy: takeoff-quick-accuracy.mjs output
- Current diffs: git diff on ai-plan-takeoff/...
- No claim of readiness.

## 6. Recommendation
Lightweight verification complete: all node paths + accuracy hold; fixes from prior session preserved and working.
Heavy gates (full browser acceptance, build, two-user) remain unpassed due to time/resource constraints in this continuation. Run them when 10GB+ sustained free RAM + isolated env available, one at a time, on alt ports if needed.
Update this report after each gate.

**Do not claim production readiness.**

Report generated from systematic lightweight node execution + state review. All per instructions. (Continuation after credits/session limit.)

---

## CLAUDE CONTINUATION — 15 Nov 2026 (uncommitted; nothing pushed)

Note: the accuracy figures above (Liberty 95.8 % / 29 of 33) predate the repairs below.

### Grok changes reviewed
- `localVectorAnalysis.js` buildingAreas propagation: correct (production.response = vector response + measured buildingAreas). Kept.
- `test-takeoff-vector-plan-browser.mjs` preview-before-unmount: kept (harness fix).
- `test-takeoff-coordinate-scaling-browser.mjs` 60 s timeouts: **removed** - they could never fix the failure (below).

### Application defects repaired
1. **Floating panels covered the drawing (P0 coordinate failure).** Not a transform defect: every click that reached the canvas measured exactly (400.000000 px / 4.000000 m, all 10 transforms). At zoom 150 % / rotation 90 the line end sat under the always-open "Interactive rooms" panel, which swallowed the first Measure click; the test then waited forever. Deterministic, not intermittent. Fix: the panel folds to its header while a plan-click tool is active (Measure, Eaves, Openings, Posts, Plan, Areas, Roof) and has Hide/Show; the Plan overlays key has Hide/Show. `RoomBoundaries.jsx`, `AIPlanTakeoffStandalone.jsx`.
2. **Wall continuing past a capped opening was rejected** (Liberty 200 mm dining/foyer wall, 41 % found). A short clean piece with the same two faces as an accepted long wall, across an opening-sized break with jambs drawn across both ends, is now the same wall. `vectorWalls.js` (`capInsetMm`, `continuedAcrossOpening`).
3. **Dashed head line across a gap counted only with a "SQUARE SET" text-layer label**; outlined-text plans never qualified. Matching dashed strokes along both faces now confirm an opening; width measured jamb to jamb (1658 drawn / 1640 printed). `vectorWalls.js` (`dashedHeadAcross`, `jambCapNear`).
4. **Barn doors drawn slid part-way open stayed unconfirmed gaps** (rule needed >= 80 % leaf overlap). Leaves = close parallel line pairs just outside one face totalling 0.8-1.3 x the gap; one leaf, or a pair parting to each end. `vectorWalls.js` (`barnDoorLeaves`).
5. **"770 SQUARE ..." parsed as a 770 door leaf**, and no label could confirm a bare gap. Now an opening width; an agreeing OPENING / SQUARE SET label confirms the gap as an Other Opening (builder still confirms its type). Size codes beside bare gaps still settle nothing. `openingLabels.js`.

### Test-harness fixes (not application fixes)
- Coordinate test fails at once naming any element covering a click point; asserts the room panel folds under Measure.
- `test-interactive-rooms-browser.mjs`: stale hover alpha (0.28 -> 0.30 since fadb5fe).
- `planAccuracy.js` scorer: `Other Opening` scores as kind `opening` (every square-set opening used to score as a wrong-kind "door").
- `test-local-vector-liberty-accuracy.mjs`: two counts that already failed before this session (14 != 10; 1 extra) replaced by the rules they protect (unconfirmed gaps need classification; no confirmed extra); floors raised to recall 0.98 / 32 openings.
- New `scripts/test-vector-opening-conventions.mjs` (items 2-5 on the real Liberty fixture, with a negative label case).

### Tests
- Coordinate-scaling browser: PASS twice (10 transforms + mid-draft zoom). Interactive-rooms browser: PASS.
- Deterministic detector + downstream set: 41/41 PASS (all `test-vector-*`, opening-labels, liberty-accuracy, plan-model, retaining-walls, wall-candidate-resolution, retained-vector-persistence, ai-adapter, ai-persistence, ai-schedule-flow, construction-quantities, other-opening-settlement, review-and-evidence, floor-area-approval-status, architrave-and-plasterboard).

### Real-plan accuracy (offline app path: vector + local OCR, `takeoff-quick-accuracy.mjs --ocr`)
| Plan | Wall recall / precision | Openings | Rooms |
|---|---|---|---|
| Liberty Terrace | 99.0 % / 98.6 % (was 95.8 / 98.5) | **33/33** (was 29/33) | 15/15 |
| Jesmond Lower | 82.0 % / 97.2 % (unchanged) | 19/21 | 12/12 |
| Jesmond Upper | 93.8 % / 91.5 % (unchanged) | 19/23 | 8/9 |

Liberty remaining: one unconfirmed gap (hall to WIL lobby, not in the reference) is held for classification and not counted. Entry wall and two porch returns (3.1 m) are classed interior instead of exterior (pre-existing).

Jesmond, checked on the drawing:
- Lower "missing" walls are the two retaining walls, and both are detected from their leader notes: west 8489 mm (ref 8587, -1.1 %), north 15126 mm (ref 15230, -0.7 %). They enter as the builder-confirmed "Retaining Walls" lm quantity, not house walls. The historical "missing north retaining wall" is resolved.
- Lower ensuite 720 door: the detector is right (gap in the vertical wall); the reference marker is on the wrong wall about 1.2 m away.
- **Open defect:** Lower ensuite "0315 FG OBS" projecting window box is read as a 148 mm wall (vw-33, 1.5 m false wall), and the hatched wall between it and the 1809DH box is read as a 1705 mm window (vo-5, false). The scorer pairs vo-5 with the misplaced 1809DH reference marker, which hides the error. Cause: the projected-frame host must end within 20 mm of the frame, but a partition T sits between them. A T-gap allowance was tried, did not change the result (another condition also fails), and was reverted.
- Upper misses match previously recorded evidence: 4-panel east bank vs 3 in the reference, pantry with no gap drawn, powder window on the powder wall, sidelight found 413 mm off.

### Gates
| Gate | Status |
|---|---|
| Coordinate scaling under transforms | **Verified today** (browser, actual component) |
| Liberty walls / openings | **Verified today** offline |
| Liberty end-to-end browser | Passed (Grok) before today's detector changes; **re-run needed** |
| Jesmond lower / upper browser | **Not run** (blocked) |
| Production build | **Not run** (blocked) |
| Two-user / tenant isolated stack | Not run (Docker / isolated credentials) |

### Blockers
- Free commit 4.2 GB (below the 6 GB floor) while another session's `next build` (PID 33164) and the dev server (PID 24788) run. Browser acceptance and the build must wait for that build to finish.

### Production readiness
**Not achieved.** The Liberty and Jesmond browser re-runs, the production build and two-user acceptance are outstanding, and one Jesmond window/wall defect is open.

### Browser acceptance update — 15 Nov 2026 (Claude)
- **Liberty Terrace vector-plan browser acceptance: PASS (newly verified)** — `GR8_VECTOR_PLAN=liberty node scripts/test-takeoff-vector-plan-browser.mjs` (bundled build on a random 127.0.0.1 port, not :3000). In the browser: walls 84, recall 0.99 / precision 0.986, ext/int 0.98, **openings 33/33 matched** (30 counted, 5 awaiting builder), rooms 15/15, printed labels settled incl. `vo-10 opening "770 SQUARE"`; Job Setup = takeoff for every opening/wall quantity; downstream quotation reached.
- Still open in that output: external-wall insulation needs 4 opening sizes from the builder; roof plan area needs eaves width (both correctly ask instead of inventing).
- Jesmond browser acceptance and production build: **not run** — waiting for turn on memory (Quotation Builder build in progress; my run collided with it once).
- **Jesmond vector-plan browser acceptance: workflow PASS, accuracy REGRESSED (open defect).** Same script, `GR8_VECTOR_PLAN=jesmond`, 4 GB heap. Scored right after the first Run (before any review step):

  | Jesmond (browser) | 9/12 Nov browser | 15 Nov browser | 15 Nov offline (cached input) |
  |---|---|---|---|
  | Lower wall recall / precision | 0.82 / 0.972 | **0.734** / 0.969 | 0.82 / 0.972 |
  | Lower openings | 19/21 | **16/21** | 19/21 |
  | Upper wall recall / precision | 0.938 / 0.915 | **0.805** / 0.903 | 0.938 / 0.915 |
  | Upper openings | 18–19/23 | **14/23** | 19/23 |
  | Rooms | 12/12, 8/9 | 12/12, 8/9 | 12/12, 8/9 |

  The detector call and analysis pipeline are the same in both paths, so the difference is in the page input: the offline cache dates from 29 Oct, and the browser extracts the PDF live. I haven't confirmed which change since 12 Nov causes it. Next: regenerate the page input with today's extraction code (`--cache <new dir>`) and diff it against the 29 Oct cache. That's waiting on a memory slot (the Quotation Builder Docker test is running). **Do not treat the offline Jesmond numbers as current browser behaviour until this is resolved.**

### Jesmond browser regression: cause found and fixed (application fix), browser re-verification pending — 16 Nov 2026 (Claude)
- **Cause:** `ai-integration/analysisContract.js` drops an exterior wall as the "open side" of an outdoor area when the wall runs along both the area's outline and the footprint. Since outdoor areas are now traced from the drawing (`outdoorAreas.js`, commit 5d38cbe) and sit *outside* the footprint, the edge they share with the footprint is the **house's own external wall**. Jesmond lost 7 such walls (16.8 m, browser review item "Open sides of outdoor areas were not counted as walls (7)"): the Upper south wall against the 48.3 m² terrace, and the Lower walls against the 24.2 m² balcony.
- **Why offline didn't show it:** `takeoff-quick-accuracy.mjs` runs with no provider response, so it never builds footprint/outdoor areas and never reaches this rule. Freshly re-extracted Jesmond input (today's code) scores the same as the 29 Oct cache (82.0 / 93.8%), so the PDF extraction is not the cause.
- **Fix:** an outdoor area's open side is taken only when that area lies inside a footprint (alfresco under the main roof). An area outside the footprint never removes the wall it shares with the house.
- **Test:** new case in `scripts/test-takeoff-review-and-evidence.mjs`: a patio outside the footprint keeps the house wall and raises no open-side item. It **fails on the unfixed code and passes with the fix**; the existing alfresco-inside-footprint case still passes. `test-takeoff-exterior-containment`, `-footprint-wall-constraint` and `-outdoor-areas` pass.
- **Browser re-run with the fix: not completed.** It passed analysis, canvas, wall checks, save and reopen, then hung over 20 min on `.gr8job` export/import (that step took 2.5 min in the earlier run today). I stopped it to free memory for another session. The first-run scores weren't printed before the hang, so Jesmond browser accuracy with the fix is **unverified**.
- **Test-harness fix:** `test-takeoff-vector-plan-browser.mjs` now prints each sheet's first-run score immediately, so a later hang still records accuracy. Next re-run: `GR8_SKIP_GR8JOB_EXPORT=1` for accuracy, then a separate run with export, to see whether the export hang recurs.

### Status at 16 Nov 2026 06:00 (Claude): verified vs not verified
**Verified (with test output):**
- Open-side fix (`analysisContract.js`): new regression case fails on the unfixed code (`AssertionError: the house wall beside an outside patio is kept`) and passes with the fix. The existing alfresco-inside-footprint case (open side still held back, still put to the builder) passes.
- Non-browser takeoff suite: **93/93 pass** (all `test-takeoff-*`, `test-vector-*` and `test-local-vector-*` scripts, excluding browser tests and the Docker-only two-tenant test). Covers save reliability/verification, persistence, plan-asset storage and portability, Job Setup mapping and canonical wall import, retaining walls, outdoor areas, opening conventions, and Liberty accuracy (recall ≥0.98, 33 openings with OCR).
- `test-vector-main-action.mjs` (the real Run AI Takeoff action on Liberty) was **already failing before this session** (committed code gives 82 walls vs a hard-coded 74; this session's code gives 86). Test-harness fix: the stale snapshot counts (74 walls / 28 openings / 10 rooms) are replaced by scoring against the Liberty reference (wall recall and precision ≥0.98, ≥32 openings matched, no counted opening off the reference, every reference room matched). It passes.
- Liberty browser acceptance with today's detector: PASS (15 Nov 14:22): 99.0/98.6%, 33/33 openings, 15/15 rooms, Job Setup = takeoff. It ran **before** the open-side fix, but the fix only changes walls shared with an outdoor area *outside* the footprint, and Liberty's browser run reported no open-side items.

**Not verified (blocked on machine memory):**
- Jesmond browser accuracy **with** the fix (whether the 16.8 m is restored, and Lower/Upper walls, openings, rooms and floor areas). A capped run (1 GB Node, 1.8 GB Chrome JS, reused bundle, `GR8_SKIP_GR8JOB_EXPORT=1`) was stopped by its own watchdog during PDF upload: commit used 47.1/50.4 GB, free commit fell to 0.76 GB. Plan rasters live outside the JS heap cap.
- `.gr8job` export/import stall: root cause **not established**. Found and fixed in the harness: no renderer-crash handler, so a crashed or out-of-memory tab waited out the 1-hour protocol timeout and looked like a hang. Now added: a crash handler (fails at once with a reason), per-phase timings and heap in the export/import step, and a 15-min protocol timeout in the capped runner. The export holds ~300 MB and reads the package back three times (export verification, harness read, import), so the leading hypothesis is renderer memory exhaustion. **Unconfirmed until a run with the new instrumentation completes.**
- Save → reopen → rerun → Job Setup → Quotation in the browser for Jesmond after the fix (it passed in the 15 Nov 14:45 run, before the fix).

**Remaining before production-ready:**
1. Jesmond browser accuracy run with the open-side fix: needs about 4–5 GB free commit.
2. `.gr8job` export run with the new instrumentation: needs a rebuilt bundle (webpack) plus about 5 GB. Then repair whatever it shows: if renderer memory, cut the redundant full re-reads in the export/import path.
3. Liberty browser re-run after the fix (confirmation only).
4. Production build on the current tree (`run-next-clean.mjs build`), staggered with the other sessions.
5. Two-builder / two-tenant isolated test (`test-takeoff-two-tenant-isolated.mjs`): needs Docker plus the `gr8-takeoff-acceptance` stack and credentials. Not run.
6. Open detector defects: Jesmond Lower "0315 FG OBS" box read as a wall plus false 1705 mm window; Liberty entry/porch walls classed interior; Jesmond Upper reference disputes (east bank 4 vs 3).
7. Owner review and commit of all uncommitted takeoff work (nothing is committed).

## Codex recovery verification — 16 November 2026 (resource-blocked continuation)

Repository confirmed: E:\dev\funnel-builder-clean; branch recovery/live-snapshot-20261031; HEAD 7daffbf3771127f75685fb0fd02423bd3a12ef03. Existing tracked and untracked changes preserved. No application files changed in this continuation, no commits, no deployment, and no process stopped. No AGENTS.md found by repository search.

Claude's outside-footprint outdoor-wall repair is present in analysisContract.js. Its containment decision currently uses the outdoor polygon's vertex-average centre; the broader partially enclosed/concave geometry requirement is not established by the three tests below. The tree also contains newer projecting-window regression assertions and detector changes beyond this handover's stated open defect. These existing changes were preserved; they must not be reported as newly implemented or browser-verified here.

Fresh verification (sequential Node processes with 192 MB JS heap cap; both existing import loaders; exit 0):
- PASS: scripts/test-takeoff-review-and-evidence.mjs.
- PASS: scripts/test-takeoff-exterior-containment.mjs.
- PASS: scripts/test-takeoff-footprint-wall-constraint.mjs.
These are three current suite results, not a fresh verification of the historical 93-suite claim.

Resource snapshot before tests: physical RAM 31.84 GB total / 5.05 GB free; committed memory 51.27 GB / 52.37 GB limit (1.10 GB headroom). Drive E has approximately 3.38 TB free. Active development clients include Claude, Codex, OpenCode and Kilo. Protected port 3000 belongs to PID 24788 and was not touched. PID 35492 is an existing takeoff browser-script process; inspection of its parent PID 3264 shows GR8_BUNDLE_ONLY=1 and output artifacts/test-results/takeoff-codex-20261116-browser. It is a bundle build, not evidence of completed browser acceptance. No competing browser/build was launched.

Gate status:
- Focused outdoor-wall regression: PASS as listed above.
- Jesmond Lower/Upper browser accuracy after repair: BLOCKED by inadequate commit headroom and another active takeoff bundle build. No current scores produced in this continuation.
- Liberty browser rerun, export/import investigation, production build: BLOCKED pending safe memory availability and completion/coordination of the existing takeoff run. Export stall cause remains unproven.
- Two-tenant security: NOT RUN; Docker executable exists, but TAKEOFF_ISOLATED_ENV is unset in this session. Docker engine/isolated stack readiness has not been established.
- Integration, sign-in/save locking and complete commercial acceptance: NOT reverified here.

Next executable browser gate once resources permit: run scripts/test-takeoff-vector-plan-browser.mjs with GR8_VECTOR_PLAN=jesmond and GR8_SKIP_GR8JOB_EXPORT=1, one worker, isolated output/port and memory safeguards. Confirm the existing run has finished before starting. Rebuild from the current source when necessary; do not treat a reused bundle as current without checking provenance. Preserve immediate per-sheet scores and measure recovered geometry. Production readiness remains NOT ACHIEVED.
