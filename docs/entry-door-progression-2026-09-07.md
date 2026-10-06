# Entry door progression fix

The current local Client Selections component used independent field callbacks, guessed next-step destinations, and an authoritative `doorStep` query parameter. Completion also explicitly used `autoAdvance: false` without a continuation. These paths could disagree about the saved choices, active tab and remaining required options.

Progression now reads the updated per-door draft through one `nextIncompleteEntryDoorStep` function. Requirements come from the resolved model. Changing an upstream choice invalidates dependent draft choices while preserving the previous confirmed door record. Glazing acknowledgement and hardware-options confirmation are saved explicitly. Missing required choices prevent review, including through a stale or forward-linked URL. Navigation effects use primitive dependencies and the existing same-URL navigation guard.

Confirm saves the complete door record and marks `configurationComplete: true`. Only a successful persistence result triggers continuation. Another incomplete entry-door location remains in the door workflow; otherwise the next incomplete exterior category opens within Client Selections with the active job retained. A failed save does not navigate onward.

## Files

- `pages/modules/builders/selections-book.js`
- `lib/builders/entryDoorProgression.js`
- `scripts/test-entry-door-progression.mjs`
- `scripts/verify-entry-door-progression-live.mjs`
- This report.

## Verification

Chrome ran the entire supplier → range → design → size → configuration → finish → glazing → glass type → hardware → review → confirm sequence against an isolated job copy with no Takeoff schedule. Step selections advanced automatically without clicking the progress tabs. Confirmation persisted the selection, then opened `selectionRequirement=garage-door` on `page=clientSelections`.

The saved Hume Savoy 1200 XS26 door has Grey Tint glass and Gainsborough Lianna `1140LIASCV` hardware, Satin Chrome, quantity 2. Review Schedule contains the hardware. Refresh, reopening the saved job and returning to Review Schedule passed with zero browser page errors. No original saved jobs, catalogue records or images were modified; remote data mutations were blocked during the browser test.

Evidence: `test-artifacts/entry-door-progression/live/report.json`, `09-review-schedule.png` and `10-refreshed-reopened-review.png` in the same directory. The immediate next-category screenshot caught the route-transition spinner; the recorded URL identifies Garage Doors.

Regression checks passed: entry-door progression, selection-navigation guards, manual entry-door recovery, and entry-door furniture/schedule persistence. ESLint completed with zero errors and 59 warnings in the touched application files.
