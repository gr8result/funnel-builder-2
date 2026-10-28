// Scratch: render one PDF page to PNG at a stated DPI (read-only). node scripts/_pdfpage.mjs <pdf> <page> <dpi> <out.png>
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const [file, pageArg, dpiArg, out] = process.argv.slice(2);
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), isEvalSupported: false }).promise;
if (out === 'info') { console.log('pages', doc.numPages); for (let i = 1; i <= doc.numPages; i += 1) { const p = await doc.getPage(i); const v = p.getViewport({ scale: 1 }); const text = (await p.getTextContent()).items.map((item) => item.str).join(' ').replace(/\s+/g, ' '); console.log(i, Math.round(v.width), 'x', Math.round(v.height), 'pt |', text.slice(0, 160)); } process.exit(0); }
const page = await doc.getPage(Number(pageArg));
const viewport = page.getViewport({ scale: Number(dpiArg) / 72 });
const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
await page.render({ canvasContext: context, viewport }).promise;
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log('rendered', canvas.width, 'x', canvas.height);
