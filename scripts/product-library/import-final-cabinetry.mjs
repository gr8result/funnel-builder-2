import fs from 'node:fs';
import crypto from 'node:crypto';
import Papa from 'papaparse';
import path from 'node:path';

const source = process.argv[2];
if (!source) throw Error('Supply the approved Description,Price CSV path.');
const bytes = fs.readFileSync(source);
const parsed = Papa.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''), {skipEmptyLines:false});
if (parsed.errors.length) throw Error(JSON.stringify(parsed.errors));
const records = parsed.data;
if (records.shift().join(',') !== 'Description,Price') throw Error('Expected Description,Price only.');
if (records.at(-1)?.length === 1 && records.at(-1)[0] === '') records.pop();
if (records.shift().join(',') !== 'CABINETRY,') throw Error('Expected main CABINETRY heading.');
const major = new Set(['KITCHEN CABINETRY', "BUTLER'S PANTRY CABINETRY", 'LAUNDRY CABINETRY', 'BATHROOM / ENSUITE / POWDER ROOM CABINETRY', 'WARDROBES', 'BENCHTOPS', 'KITCHEN BENCHTOPS', "BUTLER'S PANTRY BENCHTOPS", 'LAUNDRY BENCHTOPS', 'BATHROOM BENCHTOPS']);
let room = '', range = '';
const rows = records.map(([description, price, ...extra], index) => {
  if (extra.length || description == null || price == null) throw Error(`Invalid source row ${index + 3}`);
  const base = {sourceRow:index + 3, description};
  if (!description && !price) return {...base, type:'spacer'};
  if (price === '') {
    const level = major.has(description) ? 1 : 2;
    if (level === 1) { room = description; range = ''; } else range = description;
    return {...base, type:'heading', level};
  }
  if (!description || !Number.isFinite(Number(price)) || Number(price) < 0) throw Error(`Invalid price on row ${index + 3}`);
  const unit = /(?:^|\W)m2\b/i.test(description) ? 'M2' : /(?:^|\W)LM\b/i.test(description) || (/BENCHTOPS/.test(room) && /(?:600|900|1200)mm wide/i.test(description)) ? 'LM' : /\bSET\b/i.test(description) ? 'SET' : 'ITEM';
  return {...base, type:'product', price:Number(price), room, range, unit};
});
const dir = 'data/product-library/catalogues/builder-cabinetry';
const additionsBytes = fs.readFileSync(`${dir}/approved-kitchen-panels.json`);
const panels = JSON.parse(additionsBytes);
if (panels.length !== 10 || new Set(panels.map(p=>p.key)).size !== 10 || panels.some(p=>p.room !== 'KITCHEN CABINETRY' || p.unit !== 'EACH')) throw Error('Invalid approved Kitchen panels.');
const combined = rows.flatMap((row,index) => {
  const lastInFinish = row.type === 'product' && row.room === 'KITCHEN CABINETRY' && rows[index+1]?.type !== 'product';
  return lastInFinish ? [row, ...panels.filter(p=>p.range===row.range)] : [row];
});
if (combined.length !== rows.length + 10) throw Error('Every panel must be inserted once in its Kitchen finish group.');
const data = {workspaceId:'846885cd-25b9-4eca-b9f9-3fd02f5882d8', sourceFile:'cabinetry-quotation-final-review.csv', sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'), datasetRevision:crypto.createHash('sha256').update(bytes).update(additionsBytes).digest('hex'), approvedAdditionsFile:'approved-kitchen-panels.json', rows:combined};
if (path.resolve(source) !== path.resolve(`${dir}/cabinetry-quotation-final-review.csv`)) fs.copyFileSync(source, `${dir}/cabinetry-quotation-final-review.csv`);
fs.writeFileSync(`${dir}/final-cabinetry-quotation.json`, JSON.stringify(data,null,2)+'\n');
console.log(Object.fromEntries(['product','heading','spacer'].map(t=>[t,combined.filter(r=>r.type===t).length])));
