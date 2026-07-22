# Dev Plan Import Test Audit

## Files created

- `pages/dev/plan-import-test.js`
- `docs/dev-plan-import-test-audit.md`

## Files modified

- None outside the isolated `/dev/plan-import-test` route and this audit report.

## Orientation libraries used

- PDF parsing and rendering: PDF.js loaded in-browser from `cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174`.
- PDF.js worker: `cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`.

## OCR method used

- Tesseract.js loaded in-browser from `cdn.jsdelivr.net/npm/tesseract.js@5`.
- OCR is attempted when native PDF text extraction returns fewer than 8 non-empty text items.

## Scoring formula and weights

Every page generates candidates for `0`, `90`, `180` and `270` degrees. The original PDF is rendered unchanged at analysis resolution, and candidate canvases are derived from that render.

- PDF rotation metadata match: 5 points.
- Native readable horizontal text: up to 35 points.
- Native text direction match: up to 12 points.
- OCR confidence: up to 20 points.
- OCR readable words: up to 12 points.
- Architectural keywords: up to 16 points from native text plus up to 16 points from OCR text.
- Likely title-block keyword position: up to 10 points.
- Horizontal and vertical line distribution balance: up to 10 points.

Architectural keywords checked:

`FLOOR PLAN`, `GROUND FLOOR`, `FIRST FLOOR`, `BEDROOM`, `KITCHEN`, `BATHROOM`, `GARAGE`, `LIVING`, `DINING`, `LAUNDRY`, `SCALE`, `DRAWING`, `PROJECT`, `CLIENT`.

## Persistence behavior

- The uploaded PDF bytes are not permanently rotated or overwritten.
- Confirmed rotation is saved separately in `localStorage` under a key derived from the PDF SHA-256 hash and page number.
- The page includes `Verify reload persistence`, which reopens the preserved original PDF bytes, reanalyzes every page and reloads the confirmed rotation values from storage.

## Test files used

Not completed in this environment. The local shell timed out on basic commands including `pwd`, `Get-ChildItem`, `Get-Content package.json` and `npx tsc --noEmit`, so no fixtures could be generated or executed here.

## Required test case results

- Normal vector PDF with selectable text: Not run.
- Scanned PDF with no selectable text: Not run.
- PDF whose metadata rotation is wrong: Not run.
- Portrait sheet containing a landscape drawing: Not run.
- Plan with vertical dimensions and mixed-direction text: Not run.
- Multi-page PDF with different page orientations: Not run.

## Known failure cases

- Browser network access is required for the PDF.js and Tesseract.js CDN scripts unless these libraries are later vendored or installed locally.
- OCR is slower on large scanned pages because all four candidates can require recognition.
- Title-block detection is heuristic and assumes a lower/right title-block zone after candidate rotation.
- Line distribution is a weak signal by design; it can help identify plan-like drawings but should not dominate text and OCR signals.
- A browser hard refresh cannot restore the original uploaded PDF without the user reselecting the file; confirmed rotations persist separately and are restored after reuploading or through the in-page reload verification flow.

## Screenshots or recorded diagnostics

No screenshots were captured because local validation tooling could not be run. The implemented route displays the four candidate thumbnails and diagnostics side by side for every loaded page.
