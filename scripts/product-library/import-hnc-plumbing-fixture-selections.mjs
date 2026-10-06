// Curates the Client Selections Plumbing Fixtures range from live Harvey Norman Commercial pages.
//
//   node --import ./scripts/register-json-loader.mjs scripts/product-library/import-hnc-plumbing-fixture-selections.mjs [--dry-run] [--only=<requirementKey>]
//
// For each of the nine Plumbing Fixtures requirements it reads HNC's own filtered category
// listing (HNC's sub-category filter, so a basin mixer can never land in Sink Mixers), then opens
// every candidate's HNC product page and records only what that page states: the displayed
// PRODUCT CODE (not the URL key), SRP, colour, size, features, brand and the product's own main
// photo. A candidate is rejected - never patched up - when its page has no product code, the
// name does not match the category, or its image is missing or identical to another product's.
//
// Existing rows in AU-HNC-PLUMBING-CATALOGUE.json are reused and enriched in place (matched by
// HNC URL key), so no product is duplicated. Rows not chosen are left untouched.
//
// Output: data/product-library/catalogues/plumbing/AU-HNC-PLUMBING-CATALOGUE.json
// Images: public/images/catalogues/plumbing/hnc-fixtures/<requirementKey>/<code>.<ext>
// Report: artifacts/test-results/hnc-plumbing-fixtures-import/report.json

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { getMasterProducts } from '../../lib/product-library/catalogueService.js';

const ROOT = process.cwd();
// --set=plumbing (default): Plumbing Fixtures + Bathroom Accessories + Mirrors, written into the
//   existing HNC plumbing catalogue so a product HNC already supplied is reused, never duplicated.
// --set=home: Hot Water, Outdoor Living, Ceiling Fans and Heating, written into the HNC
//   home-services catalogue.
const SET = (process.argv.find((a) => a.startsWith('--set=')) || '').split('=')[1] || 'plumbing';
const SET_CONFIG = {
  plumbing: {
    out: 'data/product-library/catalogues/plumbing/AU-HNC-PLUMBING-CATALOGUE.json',
    reportDir: 'artifacts/test-results/hnc-plumbing-fixtures-import',
    assetDir: '/images/catalogues/plumbing/hnc-fixtures',
  },
  home: {
    out: 'data/product-library/catalogues/services/AU-HNC-HOME-SERVICES-CATALOGUE.json',
    reportDir: 'artifacts/test-results/hnc-home-services-import',
    assetDir: '/images/catalogues/services/hnc',
  },
}[SET];
if (!SET_CONFIG) throw new Error(`Unknown --set=${SET}`);
const OUT = path.join(ROOT, SET_CONFIG.out);
const REPORT_DIR = path.join(ROOT, SET_CONFIG.reportDir);
const ASSET_DIR = SET_CONFIG.assetDir;
// Plumbing Fixtures rows keep their original tag; every other Client Selections category uses
// the generic attributes.clientSelectionRequirement tag.
const PLUMBING_TAG = 'plumbingFixtureCategory';
const SELECTION_TAG = 'clientSelectionRequirement';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE = 'https://www.harveynormancommercial.com.au';
const SOURCE_ORG = 'Harvey Norman Commercial';
const TODAY = new Date().toISOString().slice(0, 10);
const DRY = process.argv.includes('--dry-run');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';
// The requested five-brand accessory addition has its own bounded, repeatable
// supplier query. Reuse it through this existing importer entry point.
if (SET === 'plumbing' && ONLY === 'bathroom-accessories') {
  await import('./import-hnc-bathroom-accessories.mjs');
  process.exit(0);
}
// Read-only supplier-listing audit.  This is useful when refining the builder-standard mix
// without guessing at codes or relying on another retailer's catalogue.
const LIST_CANDIDATES = process.argv.includes('--list-candidates');
const TARGET_COUNT = 10;
const MAX_PER_BRAND_FIRST_PASS = 4;
const requestedPageCount = Number((process.argv.find((arg) => arg.startsWith('--pages=')) || '').split('=')[1]);
const PAGE_COUNT_OVERRIDE = Number.isFinite(requestedPageCount) && requestedPageCount > 0 ? Math.floor(requestedPageCount) : null;
const DEFAULT_LISTING_PAGES = 2;

// HNC sub-category filter ids were read from HNC's own listing filters on 2026-09-25.
const listing = (p, categoryId, label) => ({ url: `${BASE}/${p}?category_id=${categoryId}&sort=position&dir=ASC`, label });
const TARGETS = [
  { key: 'sink', familyKey: 'kitchen-sinks', topLevelArea: 'kitchen', label: 'Sinks',
    listings: [listing('kitchen/sinks', 118, 'Topmount Kitchen Sinks'), listing('kitchen/sinks', 119, 'Undermount Kitchen Sinks')],
    // The entry-level stainless range is several HNC pages behind the designer Blanco range.
    // Keep the deeper pass here, rather than substituting an unverified retailer item.
    listingPages: 6,
    priorityUrlKeys: ['300521150', '300230150', '300421150', 'PS122', '40121', '526900', '526894', 'PPL20BU', '526855', '191647'],
    accepts: (n) => /\bsink\b/i.test(n) && !/mixer|\btap\b|dispos|accessor|colander|board|basket/i.test(n) },
  { key: 'sink-mixer', familyKey: 'kitchen-taps', topLevelArea: 'kitchen', label: 'Sink Mixers',
    listings: [listing('kitchen/sink-tapware', 120, 'Standard Sink Mixers'), listing('kitchen/sink-tapware', 123, 'Pullout Sink Mixers')],
    priorityUrlKeys: ['520016C56AF', 'VV733-00-1', '1397330001', '1187300001', 'AUSH.4841CP-3', 'AUSH.4751CPWPC3', 'AUSH.4460CPWPC3', 'AUSH.4341CPWPC3', '146-7120-00-1', '520017C56AF'],
    accepts: (n) => /mixer/i.test(n) && !/basin|\bbath|shower/i.test(n) },
  { key: 'bathroom-basin', familyKey: 'basins-bottle-traps', topLevelArea: 'bathroom', label: 'Bathroom Basins',
    listings: [listing('bathroom/basins-and-bottle-traps', 212, 'Above Counter Basins'), listing('bathroom/basins-and-bottle-traps', 214, 'Inset Basins'), listing('bathroom/basins-and-bottle-traps', 211, 'Wall Hung Basins'), listing('bathroom/basins-and-bottle-traps', 216, 'Under Counter Basins')],
    priorityUrlKeys: ['193507', '4700100W', '4700510W', '4700300W', '4700235W', '4700400W', '193317', 'L505E', 'HIGI143', 'TC21601S'],
    accepts: (n) => /basin/i.test(n) && !/mixer|trap|pedestal|shroud|\btap\b|waste/i.test(n) },
  { key: 'basin-mixer', familyKey: 'mixers-tapware', topLevelArea: 'bathroom', label: 'Basin Mixers',
    listings: [listing('bathroom/bathroom-mixers-and-tapware', 182, 'Basin Mixers')],
    priorityUrlKeys: ['520001C6AF', '68198C6AF', 'VV770-00-1', '114770110', '7B1-LF', '6B1-LF', '139-7700-00-1', '144-7700-00-1', '1103561', 'T2DO.01-1H'],
    accepts: (n) => /mixer/i.test(n) && !/sink|\bbath\b|bath filler|shower|diverter/i.test(n) },
  { key: 'bath', familyKey: 'baths-spas', topLevelArea: 'bathroom', label: 'Baths',
    listings: [listing('bathroom/baths-and-spas', 224, 'Freestanding Baths'), listing('bathroom/baths-and-spas', 226, 'Rectangular Baths')],
    priorityUrlKeys: ['AB17070E', 'PZ1510W', 'PZ1650W', '013101', '013111', '013121', '191526', '191516', 'EN5WFWOF', 'EN5FSWOF'],
    accepts: (n) => /\bbath\b/i.test(n) && !/spout|filler|mixer|\btap\b|\bspa\b|waste|panel|rack/i.test(n) },
  // Rails, roses and hand showers only - shower mixers are their own requirement below.
  { key: 'shower-fixtures', familyKey: 'showers', topLevelArea: 'bathroom', label: 'Shower Rails & Roses',
    listings: [listing('bathroom/showers', 968, 'Single Shower & Rail'), listing('bathroom/showers', 969, 'Twin Shower & Rail'), listing('bathroom/showers', 960, 'Shower Roses'), listing('bathroom/showers', 970, 'Shower Rose & Arm')],
    priorityUrlKeys: ['VS687CHR', 'VS651000', '520005C', 'VS671000', 'VS663000', '144-6810-00'],
    accepts: (n) => /shower|rose|rail/i.test(n) && !/mixer|screen|tray|base/i.test(n) },
  { key: 'shower-mixer', familyKey: 'mixers-tapware', topLevelArea: 'bathroom', label: 'Shower Mixers',
    listings: [listing('bathroom/bathroom-mixers-and-tapware', 953, 'Shower or Bath Mixers'), listing('bathroom/bathroom-mixers-and-tapware', 180, 'Bathroom Wall Mixers')],
    priorityUrlKeys: ['520043C4A', '520042C4A', '520041C4A', '520040C4A'],
    // A mixer HNC names for both shower and bath is filed under Bath Mixers, never both.
    accepts: (n) => /mixer/i.test(n) && /shower|wall/i.test(n) && !/\bbath\b|basin|sink|diverter/i.test(n) },
  { key: 'bath-mixer', familyKey: 'mixers-tapware', topLevelArea: 'bathroom', label: 'Bath Mixers',
    listings: [listing('bathroom/bathroom-mixers-and-tapware', 953, 'Shower or Bath Mixers'), listing('bathroom/bathroom-mixers-and-tapware', 187, 'Bath Fillers')],
    accepts: (n) => /\bbath\b/i.test(n) && /mixer|filler/i.test(n) && !/basin|spout|diverter/i.test(n) },
  { key: 'bath-spout', familyKey: 'mixers-tapware', topLevelArea: 'bathroom', label: 'Bath Spouts', count: 16,
    listings: [listing('bathroom/bathroom-mixers-and-tapware', 184, 'Bathroom Spouts')],
    accepts: (n) => /\bbath\b/i.test(n) && /spout|outlet/i.test(n) && !/diverter|mixer/i.test(n) },
  { key: 'toilet-suite', familyKey: 'toilets', topLevelArea: 'bathroom', label: 'Toilet Suites',
    listings: [listing('bathroom/toilets', 204, 'Back to Wall Toilet Suites'), listing('bathroom/toilets', 205, 'Close Coupled Toilet Suites'), listing('bathroom/toilets', 206, 'Link Toilet Suites')],
    priorityUrlKeys: ['75C0015A', 'OR015', '192213', 'OR001', 'PRI200W', '844720W', '844710W', 'BAS001', '829720W', '846420W'],
    accepts: (n) => /suite/i.test(n) && !/seat only|pushplate|cistern only/i.test(n),
    // Children's, school and care/accessible suites are genuine HNC suites but not residential picks.
    residentialOnly: true },
  { key: 'laundry-tub', familyKey: 'laundry-tubs', topLevelArea: 'laundry', label: 'Laundry Tubs',
    listings: [{ url: `${BASE}/laundry/laundry-tubs?sort=position&dir=ASC`, label: 'Laundry Tubs' }],
    priorityUrlKeys: ['71245', '71248', '191599', '71X4555', '71X5520', '303700251', '191712', 'F6001', 'F6111', 'CL200031'],
    accepts: (n) => /\btub\b|trough/i.test(n) && !/mixer|\btap\b/i.test(n) },
  // No laundry-mixer target: the Laundry is served by a Sink Mixer allocated to the Laundry
  // (HNC's own Laundry Tapware category is only washing-machine taps).

  // Bathroom Accessories + Mirrors: generic Client Selections tag. HNC lists each finish as its
  // own product code, so genuine finish variants are kept (finishVariants) - never invented.
  ...[
    ['towel-rail', 'Towel Rails', [[196, 'Towel Rails']], (n) => /towel (rail|bar)|\brail\b/i.test(n) && !/heated|ring/i.test(n)],
    ['hand-towel', 'Hand Towel Rings & Rails', [[197, 'Towel Rings']], (n) => /ring|hand towel/i.test(n)],
    ['toilet-roll-holder', 'Toilet Roll Holders', [[195, 'Toilet Roll Holders']], (n) => /roll holder|toilet roll|paper holder/i.test(n)],
    ['robe-hook', 'Robe Hooks', [[191, 'Robe Hooks']], (n) => /hook/i.test(n)],
    ['shower-shelf', 'Shelves & Soap Holders', [[192, 'Shelves'], [193, 'Soap Holders'], [198, 'Liquid Soap Dispensers']], (n) => /shelf|soap|dispenser|caddy/i.test(n)],
    ['toilet-brush', 'Toilet Brush Holders', [[194, 'Toilet Brush Holders']], (n) => /brush/i.test(n)],
  ].map(([key, label, ids, accepts]) => ({
    key, label, accepts, familyKey: 'bathroom-accessories', topLevelArea: 'bathroom', tag: SELECTION_TAG,
    finishVariants: true, count: 16, listings: ids.map(([id, sub]) => listing('bathroom/bathroom-accessories', id, sub)),
  })),
  // HNC's mirror listing cards navigate by script (no product links), so candidates come from
  // HNC's own catalogue API for the same category; each is still verified on its product page.
  { key: 'mirror', familyKey: 'mirror', topLevelArea: 'bathroom', label: 'Mirrors', tag: SELECTION_TAG, finishVariants: true, count: 14,
    graphqlCategoryId: 190,
    listings: [listing('bathroom/mirrors', 190, 'Mirrors')],
    accepts: (n) => /mirror|shaving cabinet|mirror cabinet/i.test(n) },

  // Floor Wastes & Drains (selected with tiled wet areas, under Tiles & Stone). HNC's Grates &
  // Drains cards navigate by script, so candidates come from HNC's catalogue API; each is verified
  // on its product page. Filter facets are read from the product's own name and HNC page data.
  { key: 'floor-waste', familyKey: 'floor-wastes', topLevelArea: 'bathroom', label: 'Floor Wastes & Drains', tag: SELECTION_TAG,
    finishVariants: true, noBrandCap: true, count: 30, graphqlCategoryId: 45,
    listings: [listing('bathroom/grates-and-drains', 45, 'Grates & Drains')],
    accepts: (n) => /waste|drain|grate|channel/i.test(n) && !/plug|pop.?up|basin|bath waste/i.test(n),
    facets: (name, pdp) => {
      const text = `${name} ${pdp.material} ${pdp.finish} ${pdp.colour} ${pdp.features.join(' ')}`;
      const linear = /channel|strip|linear drain|grate\s*&\s*(upvc\s*)?channel/i.test(name);
      const tileInsert = /tile insert/i.test(name);
      const plastic = /\b(u?pvc|plastic|abs|polypropylene)\b/i.test(`${pdp.material} ${pdp.finish}`);
      const metal = /chrome|stainless|brass|gun ?metal|black|nickel/i.test(`${pdp.colour} ${pdp.finish} ${pdp.material}`);
      const lengthMm = linear ? Number((name.match(/(\d{3,4})\s?mm/) || [])[1]) || null : null;
      const outletMm = Number((name.match(/\b(\d{2,3})\s?(mm)?\b/) || [])[1]) || null;
      return {
        // Finish is its own filter, so a brushed-brass or black grate is a "Grate", not "Chrome / Stainless".
        Type: linear ? 'Linear / Strip' : tileInsert ? 'Tile Insert' : plastic ? 'Plastic' : /chrome|stainless/i.test(`${pdp.colour} ${pdp.finish}`) ? 'Chrome / Stainless' : metal ? 'Grate (coloured finish)' : '',
        Shape: linear ? 'Linear' : /square/i.test(name) ? 'Square' : /round|circular/i.test(text) ? 'Round' : '',
        ...(lengthMm ? { Length: `${lengthMm}mm` } : {}),
        ...(!linear && outletMm && outletMm >= 50 && outletMm <= 200 ? { Size: `${outletMm}mm` } : {}),
      };
    } },

  // --set=home
  { set: 'home', key: 'hot-water-system', familyKey: 'hot-water', topLevelArea: 'services', label: 'Hot Water Systems', tag: SELECTION_TAG, count: 15,
    // Coverage of every energy type matters more than brand spread (gas is all Rinnai/Rheem).
    noBrandCap: true,
    listings: [
      { url: `${BASE}/hot-water/electric-hot-water?category_id=49&sort=position&dir=ASC`, label: 'Electric Hot Water' },
      { url: `${BASE}/hot-water/heat-pump?category_id=50&sort=position&dir=ASC`, label: 'Heat Pump' },
      { url: `${BASE}/hot-water/gas-hot-water?category_id=47&sort=position&dir=ASC`, label: 'Gas Hot Water' },
      { url: `${BASE}/hot-water/solar-hot-water?category_id=48&sort=position&dir=ASC`, label: 'Solar Hot Water' },
      { url: `${BASE}/hot-water/electric-instantaneous?category_id=998&sort=position&dir=ASC`, label: 'Electric Instantaneous' },
    ],
    accepts: (n) => /hot water|heat pump|water heater|continuous flow|instantaneous|storage|\d+\s?l\b/i.test(n) && !/kit|valve|stand|element|anode|cover|flue|remote|controller|timer|accessor/i.test(n) },
  { set: 'home', key: 'built-in-bbq', familyKey: 'outdoor-living', topLevelArea: 'alfresco-outdoor', label: 'Built-in BBQs', tag: SELECTION_TAG,
    listings: [{ url: `${BASE}/outdoor/built-in-barbecues?category_id=29&sort=position&dir=ASC`, label: 'Built In Barbecues' }],
    accepts: (n) => /bbq|barbecue|grill/i.test(n) && !/cover|cleaner|tool|accessor/i.test(n) },
  { set: 'home', key: 'bbq-rangehood', familyKey: 'outdoor-living', topLevelArea: 'alfresco-outdoor', label: 'Outdoor Rangehoods', tag: SELECTION_TAG,
    listings: [{ url: `${BASE}/outdoor/barbecue-rangehoods?category_id=33&sort=position&dir=ASC`, label: 'Barbecue Rangehoods' }],
    accepts: (n) => /hood/i.test(n) && !/filter|duct kit|cover/i.test(n) },
  { set: 'home', key: 'pizza-oven', familyKey: 'outdoor-living', topLevelArea: 'alfresco-outdoor', label: 'Pizza Ovens', tag: SELECTION_TAG,
    listings: [{ url: `${BASE}/outdoor/pizza-oven?category_id=1037&sort=position&dir=ASC`, label: 'Pizza Oven' }],
    accepts: (n) => /pizza|oven/i.test(n) && !/peel|cover|stone only|cutter|thermometer/i.test(n) },
  { set: 'home', key: 'outdoor-kitchen', familyKey: 'outdoor-living', topLevelArea: 'alfresco-outdoor', label: 'Outdoor Kitchens', tag: SELECTION_TAG,
    listings: [{ url: `${BASE}/outdoor/outdoor-kitchens?category_id=1071&sort=position&dir=ASC`, label: 'Outdoor Kitchens' }],
    accepts: (n) => /kitchen|cabinet|module|bench|sink|fridge|drawer|door/i.test(n) && !/cover|clean/i.test(n) },
  { set: 'home', key: 'ceiling-fan', familyKey: 'ceiling-fans', topLevelArea: 'services', label: 'Ceiling Fans', tag: SELECTION_TAG,
    listings: [{ url: `${BASE}/heating-cooling/ceiling-fans?category_id=1019&sort=position&dir=ASC`, label: 'Ceiling Fans' }],
    accepts: (n) => /fan/i.test(n) && !/blade only|remote only|light kit only/i.test(n) },
  { set: 'home', key: 'indoor-heating', familyKey: 'heating', topLevelArea: 'services', label: 'Heating & Fireplaces', tag: SELECTION_TAG,
    listings: [{ url: `${BASE}/heating-cooling/indoor-heaters?category_id=1027&sort=position&dir=ASC`, label: 'Indoor Heaters' }],
    accepts: (n) => /heater|fire|fireplace|flue|log/i.test(n) && !/kit|cover|remote|accessor/i.test(n) },
].filter((t) => (t.set || 'plumbing') === SET).filter((t) => !ONLY || ONLY.split(",").includes(t.key));

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const urlKey = (href) => decodeURIComponent((String(href).match(/\/products\/([^/?#]+)/i) || [])[1] || '');
const normalizedCode = (value) => String(value || '').trim().toUpperCase();
const listingName = (candidate) => candidate.exactName ? candidate.text : candidate.text.replace(/^No brand available\.\s*/i, '').split(/ SRP| COMPARE/)[0].trim().replace(/\s+\S*\d\S*$/, '');

// HNC listing position follows merchandising order, which currently front-loads designer
// products.  These verified URL keys intentionally lead with normal builder-standard options;
// the importer still opens each product page and rejects it if HNC does not substantiate it.
function preferredCandidateIndex(target, candidate) {
  const preferred = target.priorityUrlKeys || [];
  return preferred.findIndex((code) => normalizedCode(code) === normalizedCode(urlKey(candidate.href)));
}

function compareCandidatesForBuilderRange(target, left, right) {
  const leftPriority = preferredCandidateIndex(target, left);
  const rightPriority = preferredCandidateIndex(target, right);
  const leftRank = leftPriority < 0 ? Number.MAX_SAFE_INTEGER : leftPriority;
  const rightRank = rightPriority < 0 ? Number.MAX_SAFE_INTEGER : rightPriority;
  return leftRank - rightRank;
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

async function withPage(url, fn) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1600, height: 1600 });
  page.on('pageerror', () => {});
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(2500);
    return await fn(page);
  } finally { await page.close(); }
}

async function readListing(url) {
  return withPage(url, (page) => page.evaluate(() => {
    const seen = new Map();
    for (const a of document.querySelectorAll('a[href*="/products/"]')) {
      const href = a.href;
      if (seen.has(href)) continue;
      const card = a.closest('li,article,div[class*="card"],div[class*="product"]') || a.parentElement;
      const text = (card?.innerText || a.innerText || '').replace(/\s+/g, ' ').trim();
      if (text) seen.set(href, { href, text });
    }
    return [...seen.values()];
  }));
}

async function readProductPage(href) {
  return withPage(href, (page) => page.evaluate(() => {
    const text = document.body.innerText;
    // Breadcrumb is "Home / Products / <url key>", then the product title.
    const crumb = text.match(/\nProducts\n\/\n[^\n]+\n/);
    const start = crumb ? crumb.index + crumb[0].length : 0;
    const end = text.indexOf('ADD TO SHORTLIST', start);
    const block = text.slice(start, end > 0 ? end : start + 3000);
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const field = (label) => {
      const line = lines.find((l) => l.toUpperCase().startsWith(`${label}:`));
      if (!line) return '';
      const inline = line.slice(label.length + 1).trim();
      if (inline) return inline;
      // Some values wrap onto the next line; an empty field is followed by the next label.
      const next = lines[lines.indexOf(line) + 1] || '';
      return /^[A-Z][A-Z ()./&]*:/.test(next) ? '' : next;
    };
    const featureStart = lines.findIndex((l) => l.toUpperCase().startsWith('FEATURES:'));
    const features = featureStart >= 0 ? lines.slice(featureStart + 1).filter((l) => !/^[A-Z ]+:/.test(l)) : [];
    const brandLink = [...document.querySelectorAll('a[href*="/brands/"]')].map((a) => ({ slug: a.getAttribute('href').split('/brands/')[1] || '', text: a.textContent.trim() })).find((b) => b.slug);
    const images = [...document.querySelectorAll('img')]
      .filter((img) => /^Thumbnail \d+$/.test(img.alt || ''))
      .map((img) => img.currentSrc || img.src)
      .filter((src) => /backend\.harveynormancommercial\.com\.au\/media\/catalog\/product\//.test(src));
    return {
      title: lines[0] || '',
      priceText: field('SRP (INC. GST)'),
      colour: field('COLOUR'),
      code: field('PRODUCT CODE'),
      size: field('SIZE'),
      finish: field('FINISH'),
      material: field('MATERIAL'),
      warranty: field('WARRANTY'),
      features,
      brandSlug: brandLink?.slug || '',
      brandText: brandLink?.text || '',
      images,
      hasSpecSheet: /DOWNLOAD SPECSHEET/i.test(text),
    };
  }));
}

async function fetchImage(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(45000) });
    if (!r.ok) return { ok: false, why: `HTTP ${r.status}` };
    const ct = r.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return { ok: false, why: `content-type ${ct}` };
    return { ok: true, ct, body: Buffer.from(await r.arrayBuffer()) };
  } catch (e) { return { ok: false, why: e.name }; }
}

const extFor = (url, ct) => {
  const clean = url.split('?')[0].toLowerCase();
  for (const e of ['.webp', '.jpeg', '.jpg', '.png']) if (clean.endsWith(e)) return e === '.jpeg' ? '.jpg' : e;
  return ct.includes('png') ? '.png' : ct.includes('webp') ? '.webp' : '.jpg';
};

function brandName(slugValue, text) {
  const known = { 'villeroy-boch': 'Villeroy & Boch', 'phoenix-builders': 'Phoenix Builders', 'nood-co': 'Nood Co', toto: 'TOTO' };
  if (known[slugValue]) return known[slugValue];
  if (text && !/^brands?$/i.test(text) && text.length < 40) return text.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase());
  return slugValue.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const nameKey = (name) => slug(name).replace(/-(lh|rh)(-|$)/g, '$2');

const catalogue = fs.existsSync(OUT)
  ? JSON.parse(fs.readFileSync(OUT, 'utf8').replace(/^﻿/, ''))
  : { catalogue: 'AU-HNC-HOME-SERVICES-CATALOGUE', generatedAt: TODAY, note: 'Harvey Norman Commercial home-services range (hot water, outdoor living, ceiling fans, heating) for Client Selections. Every row verified against its HNC product page.', officialSources: [BASE], products: [] };
const byUrlKey = new Map(catalogue.products.map((row) => [urlKey(row.official_product_url || row.source_url).toUpperCase(), row]));
const otherMaster = getMasterProducts().filter((p) => p.supplier !== SOURCE_ORG);
const imageHashes = new Map();
const report = { generatedAt: new Date().toISOString(), source: BASE, targetPerCategory: TARGET_COUNT, categories: {} };

for (const target of TARGETS) {
  const entry = { label: target.label, listings: target.listings.map((l) => l.url), candidatesSeen: 0, selected: [], reused: 0, imported: 0, rejected: [] };
  report.categories[target.key] = entry;
  const listingPages = PAGE_COUNT_OVERRIDE || target.listingPages || DEFAULT_LISTING_PAGES;

  // Interleave HNC sub-listings so one sub-type does not fill the whole range.
  const pools = [];
  if (target.graphqlCategoryId) {
    const query = `{products(filter:{category_id:{eq:"${target.graphqlCategoryId}"}},pageSize:100){items{sku name}}}`;
    const response = await fetch(`https://backend.harveynormancommercial.com.au/graphql?query=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA } });
    const items = (await response.json())?.data?.products?.items || [];
    pools.push(items.map((item) => ({ href: `${BASE}/products/${encodeURIComponent(item.sku)}`, text: item.name, exactName: true, subListing: target.listings[0].label })));
    console.error(`[${target.key}] HNC catalogue API: ${items.length} products`);
  }
  for (const source of (target.graphqlCategoryId ? [] : target.listings)) {
    const tiles = [];
    for (let pageNo = 1; pageNo <= listingPages; pageNo += 1) {
      const pageTiles = await readListing(`${source.url}&page=${pageNo}`);
      const fresh = pageTiles.filter((t) => !tiles.some((x) => x.href === t.href));
      if (!fresh.length) break;
      tiles.push(...fresh);
    }
    pools.push(tiles.map((t) => ({ ...t, subListing: source.label })));
    console.error(`[${target.key}] ${source.label}: ${tiles.length} listing tiles`);
  }
  const candidates = [];
  for (let i = 0; pools.some((p) => i < p.length); i += 1) pools.forEach((p) => { if (p[i] && !candidates.some((c) => c.href === p[i].href)) candidates.push(p[i]); });
  entry.candidatesSeen = candidates.length;
  const rankedCandidates = [...candidates].sort((left, right) => compareCandidatesForBuilderRange(target, left, right));

  if (LIST_CANDIDATES) {
    entry.candidates = rankedCandidates.map((candidate) => ({
      code: urlKey(candidate.href),
      name: listingName(candidate),
      subListing: candidate.subListing,
      url: candidate.href,
    }));
    continue;
  }

  const chosenNames = new Set();
  const finishCounts = new Map();
  const brandCounts = new Map();
  const deferred = [];
  const tryCandidate = async (candidate, enforceBrandCap) => {
    // Listing cards read '<name> <HNC code> SRP (INC. GST): $x'; drop the trailing code token.
    // Tiles without a brand logo start with the logo's alt text 'No brand available.'.
    const listedName = listingName(candidate);
    if (!target.accepts(listedName)) { entry.rejected.push({ href: candidate.href, name: listedName, reason: `HNC name is not a ${target.label.toLowerCase()} item` }); return false; }
    // colour/handing variant of a model already chosen. Where HNC sells genuine finish
    // variants as separate product codes (accessories, mirrors) up to three finishes are kept.
    if (!target.finishVariants && chosenNames.has(nameKey(listedName))) return false;
    if (target.finishVariants && (finishCounts.get(nameKey(listedName)) || 0) >= 3) return false;
    if (target.residentialOnly && /child|school|\bcare\b|accessib|ambulant|disab/i.test(listedName)) { entry.rejected.push({ href: candidate.href, name: listedName, reason: "Specialist children's/school/care product, not a residential selection" }); return false; }
    const pdp = await readProductPage(candidate.href);
    // HNC renders the page title in upper case, so the name keeps the listing's own casing and
    // must be the same words as the product page title.
    const name = listedName;
    const reject = (reason) => { entry.rejected.push({ href: candidate.href, name, code: pdp.code || '', reason }); return false; };
    const squash = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
    if (squash(pdp.title) !== squash(listedName)) return reject(`Listing name does not match HNC product page title "${pdp.title}"`);
    if (!pdp.code) return reject('HNC product page shows no product code');
    if (!target.accepts(name)) return reject(`HNC product page name is not a ${target.label.toLowerCase()} item`);
    const brand = brandName(pdp.brandSlug, pdp.brandText);
    if (!brand) return reject('HNC product page shows no brand');
    const isCuratedChoice = preferredCandidateIndex(target, candidate) >= 0;
    if (enforceBrandCap && !target.noBrandCap && !isCuratedChoice && (brandCounts.get(brand) || 0) >= MAX_PER_BRAND_FIRST_PASS) { deferred.push(candidate); return false; }
    const mainImage = pdp.images.find((src) => !/_tech|_line|_dim|_spec/i.test(src));
    if (!mainImage) return reject('HNC product page has no product photograph (only technical drawings or none)');
    const image = await fetchImage(mainImage.replace(/\/cache\/[0-9a-f]+\//, '/'));
    if (!image.ok) return reject(`Product image could not be downloaded (${image.why})`);
    const hash = crypto.createHash('sha1').update(image.body).digest('hex');
    if (imageHashes.has(hash) && imageHashes.get(hash) !== pdp.code) return reject(`Image is identical to ${imageHashes.get(hash)}'s image`);
    const price = Number(String(pdp.priceText).replace(/[^0-9.]/g, '')) || null;

    const key = urlKey(candidate.href);
    const existing = byUrlKey.get(key.toUpperCase());
    const alsoListedAs = otherMaster.filter((p) => [p.model, p.sku].some((v) => v && [pdp.code, key].map((x) => x.toUpperCase()).includes(String(v).toUpperCase()))).map((p) => p.productCode);
    const relImage = `${ASSET_DIR}/${target.key}/${slug(pdp.code)}${extFor(mainImage, image.ct)}`;
    if (!DRY) {
      fs.mkdirSync(path.join(ROOT, 'public', path.dirname(relImage)), { recursive: true });
      fs.writeFileSync(path.join(ROOT, 'public', relImage), image.body);
    }
    imageHashes.set(hash, pdp.code);
    const description = pdp.features.length ? pdp.features.join('. ').replace(/\.\./g, '.') : '';
    const row = {
      ...(existing || {}),
      product_code: existing?.product_code || `PLB-HNC-${slug(key).toUpperCase()}`,
      family_key: existing?.family_key || target.familyKey,
      requirement_keys: existing?.requirement_keys || target.familyKey,
      category_key: existing?.category_key || target.label,
      top_level_area: existing?.top_level_area || target.topLevelArea,
      manufacturer: brand,
      brand,
      supplier: SOURCE_ORG,
      product_name: name,
      model: pdp.code,
      sku: pdp.code,
      colour: pdp.colour,
      finish: pdp.finish || pdp.colour,
      material: pdp.material,
      dimensions: pdp.size,
      description,
      primary_image_url: relImage,
      image_source_url: mainImage,
      image_source_type: 'authorised-supplier-media',
      image_source_organisation: SOURCE_ORG,
      image_status: 'verified_exact',
      image_verified_at: TODAY,
      official_product_url: candidate.href,
      client_price: price,
      rrp: price,
      price_status: price ? 'current' : 'quote_required',
      price_unit: 'each',
      currency: 'AUD',
      regions: 'AU',
      active: true,
      source_type: 'authorised_supplier_listing',
      source_name: `${SOURCE_ORG} ${candidate.subListing} listing`,
      source_url: candidate.href,
      source_verified_at: TODAY,
      attributes: {
        ...(existing?.attributes || {}),
        ...((target.tag || PLUMBING_TAG) === PLUMBING_TAG
          ? { plumbingCategoryKey: existing?.attributes?.plumbingCategoryKey || target.familyKey }
          : {}),
        priceBasis: 'Harvey Norman Commercial SRP inc GST',
        [target.tag || PLUMBING_TAG]: target.key,
        // The client-facing category is deliberately curated standard -> midrange -> upgrade;
        // never infer that ordering from HNC's merchandising position.
        [(target.tag || PLUMBING_TAG) === PLUMBING_TAG ? 'plumbingFixtureOrder' : 'clientSelectionOrder']: entry.selected.length + 1,
        hncProductCode: pdp.code,
        hncUrlKey: key,
        hncSubCategory: candidate.subListing,
        ...(target.facets ? { selectionFacets: Object.fromEntries(Object.entries(target.facets(name, pdp)).filter(([, value]) => value)) } : {}),
        features: pdp.features,
        warranty: pdp.warranty || null,
        specSheetOnHnc: pdp.hasSpecSheet,
        imageSha1: hash,
        ...(alsoListedAs.length ? { alsoListedAs } : {}),
      },
    };
    if (existing) Object.assign(existing, row); else { catalogue.products.push(row); byUrlKey.set(key.toUpperCase(), row); }
    entry[existing ? 'reused' : 'imported'] += 1;
    entry.selected.push({ code: pdp.code, name, brand, price, colour: pdp.colour, size: pdp.size, image: relImage, url: candidate.href, reused: Boolean(existing), alsoListedAs });
    chosenNames.add(nameKey(listedName));
    chosenNames.add(nameKey(name));
    finishCounts.set(nameKey(listedName), (finishCounts.get(nameKey(listedName)) || 0) + 1);
    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    console.error(`  + ${target.key.padEnd(16)} ${pdp.code.padEnd(18)} ${brand.padEnd(14)} ${price ? `$${price}` : 'no price'}  ${name}`);
    return true;
  };

  const targetCount = target.count || TARGET_COUNT;
  for (const candidate of rankedCandidates) {
    if (entry.selected.length >= targetCount) break;
    await tryCandidate(candidate, true);
  }
  for (const candidate of deferred) {
    if (entry.selected.length >= targetCount) break;
    await tryCandidate(candidate, false);
  }
  if (entry.selected.length < Math.min(9, targetCount)) entry.shortfall = `HNC listings yielded ${entry.selected.length} genuine ${target.label.toLowerCase()} products after verification.`;
  console.error(`[${target.key}] selected ${entry.selected.length} (reused ${entry.reused}, imported ${entry.imported}, rejected ${entry.rejected.length})`);
}

await browser.close();

// A product chosen in an earlier run for a category that has since been re-run but not
// re-chosen keeps its data but loses the category tag, so no stale pick lingers.
const rerun = new Set(TARGETS.map((t) => t.key));
const chosenCodes = new Set(Object.values(report.categories).flatMap((c) => c.selected.map((s) => s.code)));
for (const row of catalogue.products) {
  for (const tagKey of [PLUMBING_TAG, SELECTION_TAG]) {
    const tag = row.attributes?.[tagKey];
    if (tag && rerun.has(tag) && !chosenCodes.has(row.attributes.hncProductCode)) delete row.attributes[tagKey];
  }
}

catalogue.generatedAt = TODAY;
catalogue.clientSelectionNote = 'Rows tagged attributes.clientSelectionRequirement are Client Selections category ranges (bathroom accessories, mirrors, hot water, outdoor living, fans, heating), verified the same way against each HNC product page.';
catalogue.fixtureSelectionNote = 'Rows tagged attributes.plumbingFixtureCategory are the Client Selections Plumbing Fixtures range, verified against each HNC product page by scripts/product-library/import-hnc-plumbing-fixture-selections.mjs. model/sku hold the product code HNC displays; attributes.hncUrlKey holds HNC\'s URL key.';
if (!DRY) fs.writeFileSync(OUT, `${JSON.stringify(catalogue, null, 2)}\n`);
fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(path.join(REPORT_DIR, DRY ? 'report-dry-run.json' : 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const [key, c] of Object.entries(report.categories)) console.log(`${key.padEnd(16)} selected=${c.selected.length} reused=${c.reused} imported=${c.imported} rejected=${c.rejected.length}${c.shortfall ? `  SHORTFALL: ${c.shortfall}` : ''}`);
