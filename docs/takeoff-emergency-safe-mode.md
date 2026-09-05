# Emergency recovery status — 5 September 2026

Client Selections navigation is repaired and live-tested. Takeoff safe mode is implemented and live-tested, but recovery of the five-page `New Job 03/09` payload is **not complete**: none of the preserved candidate records contains those pages.

## Route protection

Use `http://localhost:3000/modules/estimate-builder?page=aiPlanTakeoff&safeMode=1` for recovery. The original Takeoff route is also temporarily intercepted. Neither route mounts the workbook, Takeoff component, PDF, canvas, schedules or revision payloads. Automatic mount hydration and collection recovery scans are disabled. Writes to `job:03-09/123` and its snapshots are locked pending complete recovery. The crashing Chrome Takeoff tabs were closed.

The panel automatically reads IndexedDB keys and a separate scalar metadata catalog only. Legacy fields without catalog entries remain Unknown until explicit inspection of one record in a disposable worker. IndexedDB cannot project fields from a legacy object without reading that single value; this never happens automatically. Raw Record export streams one record to disk from the worker without passing its payload to React. Original storage is read-only during recovery. No pruning, deletion or migration of original records was performed.

## Independently verified backups

Paths below are relative to the repository root. Source: the preserved localhost IndexedDB from Chrome Profile 6.

| Capture | Parsed JSON records | Non-zero bytes |
| --- | ---: | ---: |
| `recovery/emergency-2026-09-05T00-42-37-307Z` | 60 | 7,101,332,644 |
| `recovery/emergency-2026-09-05T00-42-37-307Z/latest-capture` | 4 | 571,805,308 |

Each directory contains `independent-verification.json`. Every completed `.raw.json` was parsed independently in a separate Node process, one record at a time, with zero failures. Native IndexedDB copies and partial earlier attempts are also preserved. There are 64 exported versions covering 63 distinct latest-capture keys; the original current-job version is retained in addition to the newer current-job version.

Latest job backup: `latest-capture/0000-job_03-09_123.raw.json`, 189,975,279 bytes, saved `2026-09-05T00:58:52.224Z`. It contains zero Takeoff plan pages. The newest snapshot and both related job-backup records also contain zero pages. Both verification reports therefore have `newestComplete: null`. Earlier five-page/revision-816 evidence consists of metadata pointers, not recovered plan pixels. The zero-byte Downloads `.gr8job` file is not a valid backup.

The large surviving records contain duplicated quotation/proposal artwork: the latest record has 186,905,163 embedded artwork characters and 42 pages with duplicated quotation artwork fields. No duplicated Takeoff plan pages were found because those fields are absent. The previous collection-wide recovery hydration was capable of loading many large records simultaneously and remains the suspected immediate OOM trigger. The five-page original still needs another surviving source; these verified raw backups do not establish its recovery.

## Storage repair

New plan persistence stores each plan asset once in `gr8-takeoff-plan-assets-v1`; job records, revisions and portable emergency snapshots retain asset references. Assets are committed before referencing records. Explicit loading resolves references; startup hydration does not. Synthetic Chrome tests confirmed five assets across multiple revisions, reference-only snapshots, round-trip equality, preservation of input records, and failure on missing assets. The existing affected job remains locked; original records were not migrated because a complete five-page backup has not been found.

## Browser evidence

Final safe-mode test used isolated Chrome with a preserved copy of the actual IndexedDB. It listed 63 metadata rows with legacy `jobs` value reads deliberately blocked, zero forbidden rendering elements, and zero page errors. Ten memory samples recorded peak summed Chrome process working sets of 873,877,504 bytes (about 833 MiB); sampled page JavaScript heap peaked at 20,486,012 bytes (about 19.5 MiB). Process working sets include shared pages and browser/native allocations; they are not page heap or unique physical memory. The initial pre-sampling page metric was about 37 MiB. Safe mode remained open throughout.

Evidence: `latest-capture/safe-mode-browser-report.json`, `latest-capture/chrome-memory.json`, and `latest-capture/safe-mode.png` under the recovery directory above.

Client Selections evidence: `test-artifacts/client-selections-safe-navigation/report.json` and eight screenshots. Live Chrome passed the exact stale-room failing URL, left navigation, Product Library → Kitchen → Ovens, return to Client Selections, refresh, Back, Forward, and repeated current-page navigation. Final page remained Client Selections, with no runtime invariant or redirect loop. Shared navigation compares normalized pathname and sorted query values, suppresses current/in-flight destinations, removes stale landing parameters, and preserves intentional appliance workflow parameters. URL effects use primitive dependencies; stable application component identity prevents query-change remount flashing.
