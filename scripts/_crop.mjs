import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const [src, out, x, y, w, h, z = 3] = process.argv.slice(2);
const image = await loadImage(fs.readFileSync(src));
const c = createCanvas(w * z, h * z); const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
g.drawImage(image, +x, +y, +w, +h, 0, 0, w * z, h * z);
fs.writeFileSync(out, c.toBuffer('image/png')); console.log(image.width, image.height);
