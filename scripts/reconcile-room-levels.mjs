// Preview (default) or apply the room-level reconciliation to a COPY of a .gr8job.
//
//   node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs \
//        scripts/reconcile-room-levels.mjs <job.gr8job> [--apply --out <new.gr8job>] [--report <report.json>]
//
// The source file is only read. --apply writes a new package and refuses to overwrite the source or an existing file.
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { planRoomLevelRepair, applyRoomLevelRepair } from '../lib/builders/roomLevelRepair.js';

const args = process.argv.slice(2);
const source = args.find((arg) => !arg.startsWith('--') && /\.gr8job$/i.test(arg));
const flag = (name) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : ''; };
const apply = args.includes('--apply');
if (!source || !fs.existsSync(source)) { console.error('Pass the .gr8job file to read.'); process.exit(2); }
const out = flag('--out');
if (apply) {
  if (!out) { console.error('--apply needs --out <new.gr8job>.'); process.exit(2); }
  if (path.resolve(out).toLowerCase() === path.resolve(source).toLowerCase()) { console.error('Refusing to overwrite the source job.'); process.exit(2); }
  if (fs.existsSync(out)) { console.error('Refusing to overwrite an existing file.'); process.exit(2); }
}

const zip = await JSZip.loadAsync(fs.readFileSync(source));
const read = async (name) => JSON.parse(await zip.file(name).async('string'));
const selections = await read('client-selections.json');
const takeoff = await read('takeoff.json');
const book = selections.clientSelectionsBook || selections.book;
const workbook = { aiPlanTakeoffJob: takeoff.aiPlanTakeoffJob, takeoffEngine: takeoff.takeoffEngine };

const plan = planRoomLevelRepair(book, workbook);
const sheetLevels = takeoff.aiPlanTakeoffJob?.sheetLevels || {};
const report = { source: path.basename(source), sheetLevels, summary: plan.summary, rooms: plan.rooms };
console.log(`Sheet classification: ${JSON.stringify(sheetLevels)}`);
console.log(`Rooms: ${plan.summary.total} | keep ${plan.summary.keep} | normalise ${plan.summary.normalise} | assign from plan sheet ${plan.summary.assign} | need builder review ${plan.summary.review}`);
for (const room of plan.rooms) console.log(`${room.status.toUpperCase().padEnd(9)} ${room.name.padEnd(24)} ${(room.currentLevel || '-').padEnd(14)} -> ${(room.proposedLevel || '(not set)').padEnd(13)} ${room.reason}`);
if (flag('--report')) fs.writeFileSync(flag('--report'), JSON.stringify(report, null, 2));

if (apply) {
  const result = applyRoomLevelRepair(book, plan, workbook);
  if (selections.clientSelectionsBook) selections.clientSelectionsBook = result.book;
  if (selections.book) selections.book = result.book;
  zip.file('client-selections.json', JSON.stringify(selections));
  const estimate = await read('estimate.json');
  const target = estimate.workbook || estimate;
  if (target.clientSelectionsBook) target.clientSelectionsBook = { ...target.clientSelectionsBook, projectRoomModel: result.book.projectRoomModel };
  if (target.projectRoomModel) target.projectRoomModel = result.book.projectRoomModel;
  zip.file('estimate.json', JSON.stringify(estimate));
  fs.writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`Applied ${result.applied} room levels to a new copy: ${out}`);
} else console.log('Preview only. Nothing was written.');
