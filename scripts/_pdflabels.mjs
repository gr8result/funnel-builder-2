// Scratch: room names from a PDF page's text layer, as image pixels at a stated DPI. node scripts/_pdflabels.mjs <pdf> <page> <dpi> <out.json>
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const [file, pageArg, dpiArg, out] = process.argv.slice(2);
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), isEvalSupported: false }).promise;
const page = await doc.getPage(Number(pageArg)); const viewport = page.getViewport({ scale: Number(dpiArg) / 72 });
const words = /^(bed(room)?\s*\d*|master bedroom|living( room)?|kitchen|dining|e-?suite|ens(uite)?|wir|robe|bath(room)?|powder|pwd|l'?dry|laundry|home office|office|study|pantry|outdoor terrace|terrace|balcony|lobby|store|pooja|linen|media|theatre|rumpus|family|garage|wc|toilet|entry|foyer|void|alfresco|patio|deck)$/i;
const items = (await page.getTextContent()).items.filter((item) => words.test(item.str.trim()));
const labels = items.map((item) => { const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]); const w = item.width * Number(dpiArg) / 72; const rot = Math.atan2(item.transform[1], item.transform[0]); return { name: item.str.trim(), x: Math.round(x + Math.cos(rot) * w / 2), y: Math.round(y - Math.sin(rot) * w / 2) }; });
fs.writeFileSync(out, JSON.stringify(labels)); console.log(labels.map((l) => `${l.name}@${l.x},${l.y}`).join(' | '));
