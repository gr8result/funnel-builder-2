import fs from 'node:fs/promises';
const dir = 'data/product-library/catalogues/residential';
const read = async name => JSON.parse(await fs.readFile(`${dir}/${name}.json`, 'utf8'));
const beacon = (await read('AU-BEACON-LIGHTING-FANS')).products;
const paint = (await read('AU-DULUX-PAINT')).products;
const colours = (await read('AU-DULUX-COLOURS')).colours;
const count = (list, key) => Object.fromEntries([...new Set(list.map(key))].map(k => [k, list.filter(p => key(p) === k).length]));
const report = { generatedAt: new Date().toISOString(),
  beacon: { total: beacon.length, byCategory: count(beacon, p => p.productType), images: beacon.filter(p => p.primaryImageUrl).length, regularPrices: beacon.filter(p => p.attributes.regularPrice > 0).length, promotionalPrices: beacon.filter(p => p.attributes.salePrice > 0).length, withSpecifications: beacon.filter(p => p.attributes.specifications).length },
  dulux: { colours: colours.length, families: count(colours, c => c.family), validSwatches: colours.filter(c => /^#[a-f0-9]{6}$/i.test(c.hex)).length, products: paint.length, byCategory: count(paint, p => p.productType), withPublishedPackagePricing: paint.filter(p => p.attributes.variants?.some(v => v.price?.value > 0)).length, withoutPublishedPricing: paint.filter(p => !p.attributes.variants?.some(v => v.price?.value > 0)).length, withTechnicalData: paint.filter(p => p.attributes.technicalData || p.specificationUrl).length },
  failures: Object.fromEntries(await Promise.all(['beacon','dulux'].map(async name => [name,(await read(`IMPORT-FAILURES-${name}`)).failures]))),
};
if (process.argv.includes('--images')) {
  const urls = [...new Set([...beacon,...paint].map(p => p.primaryImageUrl).filter(Boolean))];
  const results = [];
  for (let i = 0; i < urls.length; i += 8) {
    await Promise.all(urls.slice(i,i+8).map(async url => {
      try {
        let r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
        if (!r.ok || !r.headers.get('content-type')?.startsWith('image/')) r = await fetch(url, { signal: AbortSignal.timeout(20000) });
        const result = { url, status: r.status, contentType: r.headers.get('content-type'), ok: r.ok && Boolean(r.headers.get('content-type')?.startsWith('image/')) };
        await r.body?.cancel(); results.push(result);
      } catch (e) { results.push({ url, ok: false, error: e.message }); }
    }));
    if (i % 80 === 0) console.log('Images verified', Math.min(i+8,urls.length),'/',urls.length);
  }
  report.imageVerification = { total: results.length, passed: results.filter(r=>r.ok).length, failures: results.filter(r=>!r.ok) };
}
await fs.writeFile(`${dir}/COMPLETION-REPORT.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
