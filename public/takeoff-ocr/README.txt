Local OCR assets for the AI Takeoff printed-label reader (components/construction-estimation/ai-plan-takeoff/geometry/localLabelOcr.js).
Served from this origin only; no external OCR service is called.
worker.min.js, core/*.wasm.js: tesseract.js 7.0.0 and tesseract.js-core 7.0.0, Apache License 2.0 (see core/LICENSE).
tessdata/eng.traineddata: tesseract-ocr/tessdata_fast eng, Apache License 2.0, sha256 7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2.
Regenerate with: node scripts/prepare-takeoff-ocr-assets.mjs --tessdata <eng.traineddata>
