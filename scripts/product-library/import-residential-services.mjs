import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const dir = 'data/product-library/catalogues/residential';
const cache = 'tmp/residential-catalogue/cache';
const now = new Date().toISOString();
const failures = [];
await fs.mkdir(dir, { recursive: true });
await fs.mkdir(cache, { recursive: true });
const only = process.argv.slice(2).find(arg => ['beacon', 'dulux'].includes(arg));
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x2B;/g, '+').replace(/\s+/g, ' ').trim();
async function get(url) {
  const file = `${cache}/${crypto.createHash('sha256').update(url).digest('hex')}.json`;
  if (!process.argv.includes('--refresh')) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch {} }
  const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  const result = { url, retrievedAt: now, html: await r.text() };
  await fs.writeFile(file, JSON.stringify(result));
  return result;
}
function walk(v, fn) { if (!v || typeof v !== 'object') return; fn(v); for (const x of Object.values(v)) walk(x, fn); }
function nextObjects(html) {
  let stream = '';
  for (const m of html.matchAll(/self\.__next_f.push\((.*?)\);?<\/script>/gs)) { try { const a = JSON.parse(m[1]); if (typeof a[1] === 'string') stream += a[1]; } catch {} }
  const out = [];
  for (const m of stream.matchAll(/[0-9a-f]+:([\[{])/g)) {
    const start = m.index + m[0].length - 1;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < stream.length; i++) {
      const c = stream[i];
      if (escaped) { escaped = false; continue; }
      if (quoted && c === '\\') { escaped = true; continue; }
      if (c === '"') { quoted = !quoted; continue; }
      if (quoted) continue;
      if (c === '[' || c === '{') depth++;
      if (c === ']' || c === '}') depth--;
      if (!depth) { try { out.push(JSON.parse(stream.slice(start, i + 1))); } catch {} break; }
    }
  }
  return out;
}
function base(supplier, sku, name, family, url, date) {
  const libraryFamily = family === 'interior-paint' ? 'paint' : family === 'interior-lighting' ? 'lighting' : family === 'ceiling-fan' ? 'ceiling-fans' : family;
  return { productCode: `${supplier.toUpperCase().replace(/\W+/g, '-')}-${sku}`, sku, externalProductId: sku, manufacturer: supplier, brand: supplier, supplier,
    productName: name, familyKey: libraryFamily, requirementKeys: [family], categoryKey: family, topLevelArea: 'interior',
    officialProductUrl: url, sourceUrl: url, priceSourceUrl: url, sourceType: 'official_supplier_catalogue', sourceRetrievedAt: date,
    sourceVerifiedAt: date, lastImportedAt: now, lastPriceCheckedAt: date, priceVerifiedAt: date, currency: 'AUD', priceUnit: 'each',
    active: true, priceStatus: 'quote_required', attributes: { externalProductId: sku, lastImportedAt: now, lastPriceCheckedAt: date } };
}
async function save(name, products, extra = {}) {
  const file = `${dir}/${name}.json`;
  let previous = []; try { previous = JSON.parse(await fs.readFile(file, 'utf8')).products || []; } catch {}
  const merged = new Map(previous.map(p => [p.productCode, p]));
  for (const p of products) {
    const old = merged.get(p.productCode);
    const history = [...(old?.attributes?.priceHistory || [])];
    if (old && old.rrp !== p.rrp) history.push({ regularPrice: old.rrp ?? null, salePrice: old.attributes?.salePrice ?? null, checkedAt: old.priceVerifiedAt });
    p.attributes = { ...p.attributes, priceHistory: history };
    merged.set(p.productCode, p);
  }
  const result = [...merged.values()];
  await fs.writeFile(file, JSON.stringify({ importedAt: now, ...extra, products: result }, null, 2) + '\n');
  console.log(name, result.length);
}
async function beacon() {
  const sources = [
    ['Downlights', '/interior/ceiling-lights/downlights'], ['Pendants', '/interior/pendant-lighting'],
    ['Ceiling Lights', '/interior/ceiling-lights/oyster-flush-mounts'], ['Wall Lights', '/interior/interior-wall-lights'],
    ['Bathroom Lighting', '/interior/bathroom/ip-rated-bathroom-lights'], ['Strip / Cabinet Lighting', '/interior/strip-cabinet-lights'],
    ['Step Lights', '/exterior/exterior-step-lights'], ['Exterior Lighting', '/exterior/wall'],
    ['Ceiling Fans', '/interior/fans/ceiling-fans'], ['Ceiling Fans', '/interior/fans/low-profile-hugger-ceiling-fans'],
    ['Ceiling Fans', '/exterior/outdoor-fans/coastal-rated-fans'], ['Ceiling Fans', '/exterior/outdoor-fans/alfresco'],
  ];
  const records = new Map();
  for (const [category, path] of sources) {
    try {
      const source = await get(`https://www.beaconlighting.com.au${path}`);
      const script = [...source.html.matchAll(/<script[^>]*>(.*?)<\/script>/gs)].map(m => m[1]).find(s => s.includes('InstantSearchInitialResults'));
      if (!script) throw new Error('No supplier catalogue state');
      const json = JSON.parse(script.slice(script.indexOf('=') + 1).trim().replace(/;$/, ''));
      let count = 0;
      walk(json, p => {
        if (!p.sku || !p.prices || !p.name?.en || !p.slug?.en || records.has(p.sku)) return;
        if (/table lamp|floor lamp|portable|exhaust|extension rod|remote control/i.test(p.name.en)) return;
        const family = category === 'Ceiling Fans' ? 'ceiling-fan' : 'interior-lighting';
        const url = `https://www.beaconlighting.com.au/${p.slug.en}`;
        const record = base('Beacon Lighting', p.sku, p.name.en, family, url, source.retrievedAt);
        const retail = p.prices.AUD?.priceValues?.['retail-group'];
        const regular = Number.isFinite(retail?.value) ? retail.value / 100 : null;
        const sale = Number.isFinite(retail?.discountedValue) ? retail.discountedValue / 100 : null;
        let swatch; try { swatch = JSON.parse(p.attributes?.swatches || '[]').find(v => v.isCurrent); } catch {}
        Object.assign(record, { productType: category, subcategory: category, colour: swatch?.label || '', finish: swatch?.label || '',
          primaryImageUrl: p.variants?.[0]?.images?.[0]?.url || '', galleryImageUrls: p.variants?.[0]?.images?.map(i => i.url) || [],
          imageStatus: 'verified_official_category_card', imageSourceUrl: url, imageVerifiedAt: source.retrievedAt,
          rrp: regular, clientPrice: regular, priceStatus: regular == null ? 'quote_required' : 'current',
          attributes: { ...record.attributes, ...p.attributes, productType: category, supplierCategories: p.categoryKeys?.en || [],
            regularPrice: regular, salePrice: sale, saleStart: null, saleEnd: null, priceRetrievedAt: source.retrievedAt,
            sourceCategoryUrl: source.url, sourcePriceUnit: 'AUD cents', colour: swatch?.label || '' } });
        records.set(p.sku, record); count++;
      });
      console.log('Beacon', category, count);
    } catch (e) { failures.push({ source: path, error: e.message }); }
  }
  const list = [...records.values()];
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(list.slice(i, i + 8).map(async record => {
      try {
        const s = await get(record.sourceUrl); let details;
        for (const root of nextObjects(s.html)) walk(root, o => { if (o.productData?.additionalInformation) details = o.productData; });
        if (!details) throw new Error('Missing product specification data');
        const specs = Object.fromEntries(details.additionalInformation.filter(v => v.type === 'keyValueTable').flatMap(v => v.content || []).map(v => [v.label, clean(v.value)]));
        record.brand = specs.Brand || record.brand;
        record.colour = specs['Colour/Finish'] || record.colour;
        record.finish = record.colour;
        record.material = specs.Material || '';
        record.dimensions = ['Height (mm)', 'Width (mm)', 'Depth (mm)'].filter(k => specs[k]).map(k => `${k}: ${specs[k]}`).join('; ');
        record.attributes.specifications = specs;
        record.attributes.downloads = details.additionalInformation.find(v => v.id === 'downloads')?.content || [];
        record.specificationUrl = record.attributes.downloads.find(v => v.fileType === 'pdf')?.url || '';
        record.attributes.priceBasis = 'Retail inc GST';
        record.attributes.selectionFacets = { 'Product type': record.productType, Finish: record.finish };
        for (const key of ['Dimmable', 'Ip Rating', 'Wattage Max', 'Kelvins', 'Colour Temperature', 'Globe Type', 'Fan Motor Type', 'Fan Size', 'Fan Blade Material', 'Remote Control', 'Remote Included', 'Fan With Light', 'Coastal Rated', 'Alfresco Rated', 'Smart', 'Current', 'Location', 'Fan Blade Size', 'Fanlight Available', 'No. Of Blades']) {
          if (specs[key]) record.attributes.selectionFacets[key] = specs[key];
        }
        for (const [k,v] of Object.entries(specs)) if (/motor|diameter|blade span|coastal|alfresco|smart|remote|light included|fan size/i.test(k)) record.attributes.selectionFacets[k] = v;
      } catch (e) { failures.push({ source: record.sourceUrl, error: e.message }); }
    }));
    console.log('Beacon specifications', Math.min(i + 8, list.length), '/', list.length);
  }
  await save('AU-BEACON-LIGHTING-FANS', list);
}
async function dulux() {
  const colours = new Map(); const products = new Map();
  const families = ['whites-and-neutrals', 'greys', 'browns', 'blues', 'greens', 'yellows', 'oranges', 'reds', 'purples'];
  for (const family of families) {
    try { const s = await get(`https://www.dulux.com.au/colour/${family}/`);
      for (const root of nextObjects(s.html)) walk(root, c => {
        if (!c.title || !c.hex || !c.colourCode || !c.colour || !c.slug) return;
        colours.set(c.colourCode, { id: `dulux-${c.colourCode}`, manufacturer: 'Dulux', name: c.title, code: c.colour.specifierNumber || c.colourCode,
          externalProductId: c.colourCode, family, hex: c.hex, lrv: c.colour.lrv ?? null, description: c.colour.description || '',
          sourceUrl: `https://www.dulux.com.au${c.slug}`, sourceCategoryUrl: s.url, lastImportedAt: now, lastCheckedAt: s.retrievedAt,
          isPopular: false, isBuilderStandard: false, displayPriority: 100 });
      }); console.log('Dulux colours', family, colours.size);
    } catch (e) { failures.push({ source: family, error: e.message }); }
  }
  const productUrls = new Set();
  for (const category of ['wash-and-wear', 'ceiling', 'weathershield', 'super-enamel', 'aquanamel', '1step-prep']) {
    try { const s = await get(`https://www.dulux.com.au/paint/${category}/`);
      for (const m of s.html.matchAll(/href="(\/paint\/[^/]+\/[^/?"]+\/)"/g)) productUrls.add(`https://www.dulux.com.au${m[1]}`);
    } catch (e) { failures.push({ source: category, error: e.message }); }
  }
  for (const url of productUrls) {
    try { const s = await get(url); let found = false;
      for (const root of nextObjects(s.html)) walk(root, p => {
        if (!Array.isArray(p.variants) || !p.subRange) return;
        const id = url.split('/').filter(Boolean).pop(); if (products.has(id)) return;
        const title = clean(s.html.match(/<title>(.*?)<\/title>/s)?.[1] || '');
        const sheen = p.sheen || title.match(/Low Sheen|Semi Gloss|Semi-Gloss|Gloss|Satin|Matt|Flat/i)?.[0] || (/Flat finish to hide surface imperfections/.test(s.html) ? 'Flat' : '');
        const name = title.replace(/\s*\| Dulux$/, '') || `Dulux ${p.subRange} ${sheen}`;
        const exterior = /weathershield/.test(url);
        const type = /ceiling/.test(url) ? 'Ceiling Paint' : /aquanamel|super-enamel/.test(url) ? 'Trim / Door Paint' : /1step/.test(url) ? 'Primer / Sealer / Undercoat' : exterior ? 'Exterior Paint' : /kitchen|bathroom/.test(url) ? 'Wet Area Paint' : 'Interior Wall Paint';
        const record = base('Dulux', p.code || id, name, exterior ? 'exterior-paint' : 'interior-paint', url, s.retrievedAt);
        Object.assign(record, { range: p.subRange, finish: sheen, productType: type, subcategory: type, description: clean(p.description),
          primaryImageUrl: clean(s.html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || ''), imageStatus: 'verified_official_product_page',
          specificationUrl: p.dataSheet || '', priceUnit: 'litre',
          attributes: { ...record.attributes, availableFinishes: sheen ? [sheen] : [], productType: type, variants: p.variants,
            coverage: p.coverage || p.coverageRate || null, coats: p.coats || null, technicalData: Object.fromEntries(Object.entries(p).filter(([k,v]) => !['variants','bases'].includes(k) && (v === null || typeof v !== 'object'))),
            // Package prices remain package prices; no tin price is assigned to a square metre of painting.
            requiresQuantityCalculation: true } });
        products.set(id, record); found = true;
      });
      if (!found && !products.has(url.split('/').filter(Boolean).pop())) failures.push({ source: url, error: 'No structured paint product with finishes' });
    } catch (e) { failures.push({ source: url, error: e.message }); }
  }
  await fs.writeFile(`${dir}/AU-DULUX-COLOURS.json`, JSON.stringify({ importedAt: now, colours: [...colours.values()] }, null, 2) + '\n');
  await save('AU-DULUX-PAINT', [...products.values()]);
}
if (!only || only === 'beacon') await beacon();
if (!only || only === 'dulux') await dulux();
await fs.writeFile(`${dir}/IMPORT-FAILURES${only ? '-' + only : ''}.json`, JSON.stringify({ at: now, failures }, null, 2) + '\n');
if (only) {
  const combined = [];
  for (const source of ['beacon', 'dulux']) {
    try {
      const report = JSON.parse(await fs.readFile(`${dir}/IMPORT-FAILURES-${source}.json`, 'utf8'));
      combined.push(...report.failures.map(failure => ({ catalogue: source, ...failure })));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await fs.writeFile(`${dir}/IMPORT-FAILURES.json`, JSON.stringify({ at: now, failures: combined }, null, 2) + '\n');
}
console.log('Import failures:', failures.length);
