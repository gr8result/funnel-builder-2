import fs from 'node:fs'; import { createCanvas, loadImage } from '@napi-rs/canvas';
const [png, x, y0, y1] = process.argv.slice(2); const image = await loadImage(fs.readFileSync(png)); const c = createCanvas(image.width, image.height); const g = c.getContext('2d'); g.drawImage(image, 0, 0);
const d = g.getImageData(0, 0, image.width, image.height).data; const out = []; for (let y = +y0; y <= +y1; y += 1) out.push(d[(y * image.width + +x) * 4]); console.log(out.join(' '));
