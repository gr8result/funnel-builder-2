// Diagnostic (paid, opt-in): times the real AI Takeoff provider requests for one sheet of a real plan
// exactly as the application builds them, with a long diagnostic timeout so the true duration and token
// usage are visible. Never writes to any job. Requires GR8_LIVE_PROVIDER_APPROVED=yes.
//   node scripts/diagnose-takeoff-provider-timing.mjs <page-image-dataurl.txt> <pageNumber> <level> [scopes]
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { buildTakeoffProviderRequest, DEFAULT_TAKEOFF_MODEL } from '../lib/construction-estimation/aiTakeoffAnalysis.js';

dotenv.config({ path: '.env.local' });
if (process.env.GR8_LIVE_PROVIDER_APPROVED !== 'yes') throw new Error('Set GR8_LIVE_PROVIDER_APPROVED=yes to make paid provider requests.');
const [file, pageArg, level = 'Ground Floor', scopeArg = 'geometry,items'] = process.argv.slice(2);
const pageNumber = Number(pageArg);
const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
const model = String(process.env.OPENAI_TAKEOFF_MODEL || DEFAULT_TAKEOFF_MODEL).trim();
const timeoutMs = Number(process.env.GR8_DIAG_TIMEOUT_MS || 900000);
const dataUrl = fs.readFileSync(file, 'utf8');
const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
const meta = await sharp(png).metadata();
const ratio = Math.min(1, 2400 / Math.max(meta.width, meta.height));
const width = Math.round(meta.width * ratio), height = Math.round(meta.height * ratio);
const jpeg = await sharp(png).flatten({ background: '#fff' }).resize(width, height).jpeg({ quality: 90 }).toBuffer();
const page = { pageNumber, logicalWidth: Number(process.env.GR8_LOGICAL_W || 420), logicalHeight: Number(process.env.GR8_LOGICAL_H || 595), pdfUnits: true,
  imageRotation: 0, imageWidth: width, imageHeight: height, imageDataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`, textItems: [], drawingType: 'floor_plan', level };
console.log(JSON.stringify({ model, pageNumber, level, image: `${width}x${height}`, imageKB: Math.round(jpeg.length / 1024), timeoutMs }));
const results = await Promise.all(scopeArg.split(',').map(async (measurementScope) => {
  const body = buildTakeoffProviderRequest({ action: 'measure', measurementScope, page, pixelsPerMm: Number(process.env.GR8_PX_PER_MM || 0.014132207996477566), contextPages: [] }, model);
  const started = Date.now();
  try {
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    const headersAt = Date.now() - started;
    const envelope = await response.json();
    const text = (envelope.output || []).flatMap((item) => item.content || []).filter((item) => item.type === 'output_text').map((item) => item.text).join('');
    let counts = null;
    try { const parsed = JSON.parse(text); counts = Object.fromEntries(['walls', 'openings', 'buildingAreas', 'rooms', 'fixtures', 'documentedQuantities', 'pillars', 'eaves'].map((key) => [key, parsed[key]?.length ?? null])); } catch {}
    return { scope: measurementScope, http: response.status, seconds: Math.round((Date.now() - started) / 100) / 10, headersSeconds: Math.round(headersAt / 100) / 10,
      status: envelope.status, incomplete: envelope.incomplete_details || null, usage: envelope.usage || null, error: envelope.error?.message || null, counts, requestId: response.headers.get('x-request-id') };
  } catch (error) {
    return { scope: measurementScope, failed: error.name, seconds: Math.round((Date.now() - started) / 100) / 10 };
  }
}));
const out = process.env.GR8_DIAG_OUT;
if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify({ model, pageNumber, results }, null, 2)); }
console.log(JSON.stringify(results, null, 2));
