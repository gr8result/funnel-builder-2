// Copies the local OCR assets the AI Takeoff label reader uses in the browser into public/takeoff-ocr,
// so tesseract.js never fetches anything from a CDN:
//   worker.min.js and the LSTM WebAssembly cores  <- node_modules (tesseract.js 7 / tesseract.js-core 7, Apache-2.0)
//   tessdata/eng.traineddata                      <- --tessdata <file> (tessdata_fast, Apache-2.0), checksum-verified
// Idempotent; prints what it copied. Usage: node scripts/prepare-takeoff-ocr-assets.mjs [--tessdata <path to eng.traineddata>]
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';

const root = process.cwd();
const out = path.join(root, 'public/takeoff-ocr');
// tessdata_fast eng.traineddata (github.com/tesseract-ocr/tessdata_fast, main), the file this reader was measured with.
const ENG_FAST_SHA256 = '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2';
const args = process.argv.slice(2);
const tessdataArg = args[args.indexOf('--tessdata') + 1];
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const copies = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt', 'worker.min.js.LICENSE.txt'],
  ...['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm'].map((name) => [`node_modules/tesseract.js-core/${name}.wasm.js`, `core/${name}.wasm.js`]),
  ['node_modules/tesseract.js-core/LICENSE', 'core/LICENSE'],
];
fs.mkdirSync(path.join(out, 'core'), { recursive: true }); fs.mkdirSync(path.join(out, 'tessdata'), { recursive: true });
for (const [from, to] of copies) {
  const src = path.join(root, from), dst = path.join(out, to);
  if (!fs.existsSync(src)) throw new Error(`Missing ${from}: run npm install first.`);
  if (fs.existsSync(dst) && sha(dst) === sha(src)) { console.log(`up to date  ${to}`); continue; }
  fs.copyFileSync(src, dst); console.log(`copied      ${to}`);
}
const eng = path.join(out, 'tessdata/eng.traineddata');
if (tessdataArg && tessdataArg !== '--tessdata') {
  if (sha(tessdataArg) !== ENG_FAST_SHA256) throw new Error(`${tessdataArg} is not the expected tessdata_fast eng.traineddata (sha256 mismatch).`);
  fs.copyFileSync(tessdataArg, eng); console.log('copied      tessdata/eng.traineddata');
}
if (!fs.existsSync(eng)) console.log('MISSING     tessdata/eng.traineddata: pass --tessdata <file> (tessdata_fast eng.traineddata, Apache-2.0). Label reading stays off until it is present.');
else if (sha(eng) !== ENG_FAST_SHA256) throw new Error('public/takeoff-ocr/tessdata/eng.traineddata does not match the expected tessdata_fast checksum.');
else console.log('verified    tessdata/eng.traineddata');
fs.writeFileSync(path.join(out, 'README.txt'), [
  'Local OCR assets for the AI Takeoff printed-label reader (components/construction-estimation/ai-plan-takeoff/geometry/localLabelOcr.js).',
  'Served from this origin only; no external OCR service is called.',
  'worker.min.js, core/*.wasm.js: tesseract.js 7.0.0 and tesseract.js-core 7.0.0, Apache License 2.0 (see core/LICENSE).',
  `tessdata/eng.traineddata: tesseract-ocr/tessdata_fast eng, Apache License 2.0, sha256 ${ENG_FAST_SHA256}.`,
  'Regenerate with: node scripts/prepare-takeoff-ocr-assets.mjs --tessdata <eng.traineddata>',
  '',
].join('\n'));
