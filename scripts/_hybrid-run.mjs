// Scratch: the approved controlled hybrid experiment (Jesmond Road, 8 crops, one request each, no retries).
// The provider is asked for wall PATHS in crop fractions with uncertainty flags, never for measurements.
// node --import <provider-cap preload> scripts/_hybrid-run.mjs <tiles.json>... --out <dir> [--dry]
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const out = args[args.indexOf('--out') + 1];
const dry = args.includes('--dry');
const tileFiles = args.filter((arg, index) => arg.endsWith('-tiles.json') && args[index - 1] !== '--out');
const MODEL = 'gpt-5.4-2026-03-05';
const point = { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'number' }, y: { type: 'number' } } };
const schema = {
  type: 'object', additionalProperties: false, required: ['walls', 'openings', 'notWalls', 'notes'],
  properties: {
    walls: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'kind', 'path', 'thickness', 'uncertain', 'note'], properties: {
      id: { type: 'string' }, kind: { type: 'string', enum: ['external', 'internal', 'retaining', 'unsure'] },
      path: { type: 'array', minItems: 2, items: point }, thickness: { type: 'string', enum: ['thick', 'thin', 'unknown'] },
      uncertain: { type: 'boolean' }, note: { type: 'string' } } } },
    openings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'wallId', 'start', 'end', 'uncertain'], properties: {
      kind: { type: 'string', enum: ['hinged_door', 'sliding_door', 'cavity_slider', 'stacker_door', 'window', 'garage_door', 'open_doorway', 'unknown'] },
      wallId: { type: 'string' }, start: point, end: point, uncertain: { type: 'boolean' } } } },
    notWalls: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'at', 'note'], properties: {
      kind: { type: 'string', enum: ['cabinetry', 'fixture', 'stairs', 'annotation', 'dimension_line', 'furniture', 'hatching', 'retaining_wall', 'other'] }, at: point, note: { type: 'string' } } } },
    notes: { type: 'string' },
  },
};
const instructions = (tile) => `You are reading part of an architectural FLOOR PLAN (a crop of a larger sheet; the drawing may be rotated on the sheet, so text can run sideways).
Trace the WALLS of the building as an architect would read them.

Return coordinates as fractions of THIS IMAGE: x from 0 (left edge) to 1 (right edge), y from 0 (top edge) to 1 (bottom edge). Do not convert to millimetres; do not estimate lengths.
One image pixel is about ${tile.mmPerCropPixel.toFixed(1)} mm on site; use that only to judge what is a wall (internal walls are about 70-110 mm thick, external walls about 190-300 mm).

walls: every wall drawn on this crop, as a centreline PATH from end to end: follow the wall's two parallel faces, put a point at each end and at every corner. A wall continues THROUGH its doors and windows (do not break the path at an opening). Stop a path where the wall ends or meets another wall; put that end on the other wall's centreline. Parts of a wall cut off by the crop edge end at the edge.
- kind: external = the outside envelope of the dwelling; internal = partitions inside it; retaining = retaining or site walls that are not part of the dwelling envelope; unsure = cannot tell.
- uncertain = true when you are not sure it is a wall or not sure of its route.
openings: doors and windows IN those walls: their two ends along the wall (start, end) and the wall's id.
notWalls: things drawn with lines that must NOT be taken as walls: cabinetry and benches, baths, showers, vanities, toilets, robe shelving and hanging rails, stairs, furniture, hatching, dimension lines, notes and labels, retaining walls outside the dwelling. One point on each.
If a feature is cut off by the crop edge, include the visible part. Do not invent walls that are not drawn.`;
const tiles = tileFiles.flatMap((file) => JSON.parse(fs.readFileSync(file, 'utf8')).tiles.map((tile) => ({ ...tile, sheetFile: JSON.parse(fs.readFileSync(file, 'utf8')).sheet })));
const env = fs.readFileSync('E:/dev/funnel-builder-clean/.env.local', 'utf8');
const key = (env.match(/^OPENAI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
if (!key && !dry) throw new Error('OPENAI_API_KEY is not set in .env.local');
fs.mkdirSync(out, { recursive: true });
// Budget: US$2.50 per 1M input and US$15 per 1M output tokens (published GPT-5.4 rates, per third-party trackers).
// Before each request the worst case (a generous input estimate and the full output cap) is added to what has
// already been spent; if that would pass the US$5 ceiling, nothing more is sent.
const PRICE = { input: 2.5 / 1e6, output: 15 / 1e6 }, CEILING = 5;
const spentFile = path.join(out, 'spend.json');
const spent = fs.existsSync(spentFile) ? JSON.parse(fs.readFileSync(spentFile, 'utf8')) : { usd: 0, requests: [] };
for (const tile of tiles) {
  const target = path.join(out, `${tile.id}.json`);
  if (fs.existsSync(target)) { console.log(tile.id, 'already done; not sent again'); continue; }
  const body = { model: MODEL, store: false, reasoning: { effort: 'medium' }, max_output_tokens: 16000,
    text: { format: { type: 'json_schema', name: 'wall_paths', strict: true, schema } },
    input: [{ role: 'user', content: [{ type: 'input_text', text: instructions(tile) }, { type: 'input_image', image_url: `data:image/png;base64,${fs.readFileSync(tile.file).toString('base64')}`, detail: 'original' }] }] };
  if (dry) { console.log(tile.id, 'request', Math.round(JSON.stringify(body).length / 1024), 'KB', tile.image.width + 'x' + tile.image.height); continue; }
  const worst = spent.usd + 15000 * PRICE.input + 16000 * PRICE.output;
  if (worst > CEILING) { console.log(tile.id, 'not sent: projected spend', worst.toFixed(2), 'would pass the ceiling of', CEILING); break; }
  const started = Date.now();
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  const json = await response.json();
  const text = (json.output || []).flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text;
  let result = null;
  try { result = text ? JSON.parse(text) : null; } catch { result = null; }
  fs.writeFileSync(target, JSON.stringify({ tile, status: response.status, seconds: Math.round((Date.now() - started) / 1000), usage: json.usage || null, model: json.model || null, error: json.error || null, incomplete: json.incomplete_details || null, raw: result ? undefined : text, result }, null, 1));
  const cost = json.usage ? json.usage.input_tokens * PRICE.input + json.usage.output_tokens * PRICE.output : 0;
  spent.usd += cost;
  spent.requests.push({ tile: tile.id, status: response.status, usage: json.usage || null, usd: +cost.toFixed(4) });
  fs.writeFileSync(spentFile, JSON.stringify(spent, null, 1));
  console.log(tile.id, response.status, json.usage ? `in ${json.usage.input_tokens} out ${json.usage.output_tokens}` : '', 'cost', cost.toFixed(3), 'total', spent.usd.toFixed(3), json.error ? JSON.stringify(json.error).slice(0, 200) : '', result ? `walls ${result.walls.length}` : 'no parsed result');
}
