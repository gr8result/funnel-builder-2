import fs from 'node:fs';
import {getEffectiveProductCatalogue} from '../../lib/product-library/catalogueService.js';
import {productVerifiedImage} from '../../lib/product-library/productPresentation.js';
const {products} = getEffectiveProductCatalogue({includeDisabled: true});
const local = new Map(); const remote = new Map();
for (const p of products) {
  const src = productVerifiedImage(p) || p.primaryImageUrl || '';
  if (!src) continue;
  if (src.startsWith('/')) local.set(src.split('?')[0], p);
  else if (/^https?:/.test(src)) remote.set(src, p);
}
const missing = [...local].filter(([s]) => !fs.existsSync('public' + decodeURI(s)));
console.log('local image refs:', local.size, '| FILE MISSING:', missing.length);
for (const [s, p] of missing.slice(0, 25)) console.log('   ', p.brand, p.model || p.productCode, '->', s);
console.log('\nremote image refs:', remote.size);
const bad = [];
const entries = [...remote];
for (let i = 0; i < entries.length; i += 20) {
  await Promise.all(entries.slice(i, i + 20).map(async ([u, p]) => {
    try {
      const r = await fetch(u, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-0' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) bad.push([u, p, r.status]);
    } catch (e) { bad.push([u, p, 'ERR:' + e.name]); }
  }));
}
console.log('BROKEN remote:', bad.length);
for (const [u, p, s] of bad.slice(0, 30)) console.log('   ', String(s).padEnd(10), p.brand, p.model || p.productCode, '->', u.slice(0, 95));
