// Execute the component's actual page-import function, including its failure path.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', 'utf8');
const start = source.indexOf('  const renderPdfPageForJob =');
const end = source.indexOf('\n  useEffect(', start);
assert.ok(start > 0 && end > start);
const events = [];
const canvas = { width: 0, height: 0, getContext: () => ({}), toDataURL: () => 'data:image/png;base64,portable' };
const page = {
  getViewport: ({ scale }) => ({ width: 100 * scale, height: 80 * scale }),
  render: () => ({ promise: Promise.resolve().then(() => events.push('rendered')) }),
  cleanup: () => events.push('released'),
};
let failEvidence = false;
const render = new Function('window', 'rawCanvasRef', 'extractPdfVectors', 'readPdfAnalysisEvidence',
  `${source.slice(start, end)}; return renderPdfPageForJob;`)(
  { devicePixelRatio: 2 }, { current: canvas }, async () => [{ x1: 1, y1: 2, x2: 3, y2: 4 }],
  async () => { events.push('evidence'); if (failEvidence) throw new Error('evidence failed'); return { textItems: [{ text: 'PLAN' }] }; },
);
const pdf = { getPage: async () => page };
const result = await render(pdf, 5);
assert.equal(result.pageNumber, 5);
assert.equal(result.width, 1200, 'original full-resolution raster dimensions retained');
assert.equal(result.height, 960);
assert.equal(result.logicalWidth, 100);
assert.equal(result.renderScale, 12);
assert.equal(result.dataUrl, 'data:image/png;base64,portable');
assert.equal(result.vectorSegments.length, 1);
assert.equal(result.textItems[0].text, 'PLAN');
assert.deepEqual(events, ['rendered', 'evidence', 'released']);
assert.equal(canvas.width * canvas.height, 0, 'backing store released after extraction');
events.length = 0;
failEvidence = true;
await assert.rejects(render(pdf, 6), /evidence failed/);
assert.deepEqual(events, ['rendered', 'evidence', 'released']);
assert.equal(canvas.width * canvas.height, 0, 'failed extraction also releases backing store');
console.log('PASS PDF page import: resolution/data preserved; page and canvas released on success and failure.');
