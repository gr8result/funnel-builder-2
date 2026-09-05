# Exterior doors regression and read-only storage audit

## Cause and repair

`ScheduledEntryDoorWorkflow` returned an empty-state message before rendering when the imported Windows & Doors Schedule contained no exterior doors. The furniture picker repeated that requirement. The wrapper also read only the newer `guidedSelection.entryDoors` representation, hiding older choices saved directly in `guidedSelection`.

The wrapper now always renders the door catalogue and manual location controls. A read adapter displays legacy choices without migrating stored data. Manual drafts, the active door ID and hardware associations live in the selection book. Door Furniture stays inside Client Selections and exposes brand filters, Select, View Details and Compare. Opening the page does not initialise or save a replacement selection book. An explicit Save Progress or Confirm Selection saves user edits.

When older same-project selection-book history contains a real chosen door, the display can recover it past generic Included Selection placeholders. Queries are restricted to the active workspace and project; records are read individually after fetching history metadata. A later Takeoff import retains populated manual choices. Unmatched imported doors are separate locations. Applying a different selected door to all locations asks before replacing confirmed designs.

The selection-book loading effect also now depends on the primitive workspace ID, so it retries when the workspace becomes ready after a refresh.

## Original storage inspected without writing

- Supabase `builder_selection_books`: Johnson 123, project `64fd5367-275f-4264-bc3c-c13b6f3447a0`, has Hume Savoy 1200 XS26-1200 (`ENTRY-HUME-SAVOY-1200-XS26-1200`) in book `2d9de446-88ec-49f3-a296-357dcc74aa48`, row `row-1787899929120-5b5c64082e49e8`, `guidedSelection`. Newer generic placeholder rows had hidden this historical choice.
- Supabase `builder_client_selections` and Chrome localStorage selection drafts were inspected. They did not supply a newer matching chosen exterior-door model in this audit.
- Chrome Profile 6 IndexedDB `estimate-builder-template-db`, `jobs`, key `job:03-09/123`, saved `2026-09-05T00:58:52.224Z`: the current selection-book aliases contain only `Entry Door Included Selection`, model `Standard`, with no guided product. Metadata was read offline, then that single record was decoded offline to extract selection fields only. No original Takeoff data entered React, the workbook application or a browser page.
- Downloads `Johnson 123.gr8job` and `New Job 03 09.gr8job` both internally identify **New Job 03/09**, `03-09/123`. Only their job-details and client-selections ZIP members were inspected, not their estimate/Takeoff member. Both have the same generic entry-door placeholder.

The Savoy belongs to the server project Johnson 123; it must not be substituted into New Job 03/09. Original records, localStorage, IndexedDB and downloaded jobs were not cleared, migrated or overwritten. Audit evidence is in `test-artifacts/manual-entry-door-recovery/` (`server-audit.json`, `local-storage-audit.json`, `saved-files-audit.json`, `indexeddb-current-selection-audit.json`).

## Verification

`scripts/test-manual-entry-door-recovery.mjs` verifies read-only legacy adaptation, empty-import preservation, manual identities and metadata, exact matching and unmatched imported doors, populated-row targeting and internal selection-route context. `scripts/test-entry-door-furniture.mjs` verifies all 292 products, independent door selections, apply-all/change/remove and downstream schedules. Navigation, exterior-door and Takeoff recovery regression scripts provide additional coverage.

Live scripts use separate Chrome profiles and synthetic jobs, with all Supabase REST mutations blocked. The recovered-choice fixture copies the audited legacy row into a synthetic test job. Neither script opens the user's original Takeoff or writes the user's saved jobs. `DOOR_TEST_ORIGIN=http://localhost:3015` uses a separate Next build directory to avoid interference from concurrent development servers.

- `scripts/verify-manual-entry-door-recovery-live.mjs`: Client Selections → Exterior → Entry Doors → saved Savoy visible → manual location/quantity → Door Furniture → four brands → Lemaar/options → Confirm → Save Progress → refresh → reopen saved test job → same door, hardware, finish and quantity.
- `scripts/verify-empty-entry-door-live.mjs`: no door selection and no Takeoff schedule → Add Entry Door → location/level → Hume design/size/configuration/finish/glazing → Zanda hardware → Confirm → Save Progress → refresh → chosen door and manual location remain.

Runtime reports and screenshots are in `test-artifacts/manual-entry-door-recovery/live/` and `empty-live/`. Reports, rather than the presence of screenshots from an earlier run, determine pass/fail.

Both live reports passed on 6 September 2026 with zero page errors. The reopened legacy fixture retains Savoy XS26-1200, Lemaar Zalla Chrome Plate, quantity 2 and Front Entry / Ground. The empty-job fixture retains Hume Carringbush XCB1 and Zanda hardware at the manually added Side Entry / Ground location after refresh. Lint completed successfully with existing warnings. The manual-door, furniture, navigation, exterior-door and Takeoff recovery regression scripts passed.

Full repository typecheck is not clean: the completed run reported `TS2307` in `test-results/job-persistence-repair-before/useJobFile.ts:13` because the backup imports `../lib/jobFile`, which does not exist at that relative location. Subsequent broad reruns were stopped after several minutes; no full typecheck pass is claimed. That unrelated backup was left untouched.
