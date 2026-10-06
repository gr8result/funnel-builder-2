// Every cabinetry product in the builder catalogue should have a rate, and estimates
// must never be presented as verified supplier pricing.

import assert from 'node:assert/strict';
import { PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS } from '../lib/product-library/cabinetryCatalogueSelectors.js';
import {
  CABINETRY_UNIT_RATES, CABINETRY_FINISH_MULTIPLIERS, getCabinetryUnitRate, listCabinetryUnitRates,
} from '../lib/product-library/cabinetryUnitRates.js';

// 1. Every catalogue product is covered by the rate table.
{
  const missing = PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS
    .map((p) => p.id)
    .filter((id) => !(id in CABINETRY_UNIT_RATES));
  assert.deepEqual(missing, [], `catalogue products with no rate entry: ${missing.join(', ')}`);
}

// 2. No rate entry points at a product that does not exist.
{
  const ids = new Set(PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS.map((p) => p.id));
  const orphans = Object.keys(CABINETRY_UNIT_RATES).filter((id) => !ids.has(id));
  assert.deepEqual(orphans, [], `rate entries with no catalogue product: ${orphans.join(', ')}`);
}

// 3. Estimates are never labelled as firm prices.
{
  for (const row of listCabinetryUnitRates()) {
    assert.notEqual(row.priceStatus, 'current', `${row.id} must not claim a current price`);
    if (row.rate !== null) assert.equal(row.priceStatus, 'price_pending', `${row.id} should be price_pending`);
    else assert.equal(row.priceStatus, 'quote_required', `${row.id} without a rate should be quote_required`);
  }
}

// 4. Finish changes the price of door-fronted units, and only those.
{
  const base = getCabinetryUnitRate('CABINETRY-UNIT-STANDARD-BASE', 'Standard colourboard');
  const shaker = getCabinetryUnitRate('CABINETRY-UNIT-STANDARD-BASE', 'Shaker/profile door');
  assert.equal(base.rate, 380);
  assert.equal(shaker.rate, 625);
  assert.ok(shaker.rate > base.rate, 'Shaker must cost more than standard colourboard');

  const hardware = getCabinetryUnitRate('CABINETRY-HARDWARE-BLUM-SOFT-CLOSE', 'Shaker/profile door');
  assert.equal(hardware.rate, 85, 'hardware price must not move with door finish');
  assert.equal(hardware.finish, 'Finish independent');
}

// 5. Rates rise monotonically across the finish tiers.
{
  const order = ['Standard colourboard', 'Premium decorative board', 'Vinyl wrap', 'Gloss decorative board', 'Two-pack painted', 'Shaker/profile door'];
  let previous = 0;
  for (const finish of order) {
    const { rate } = getCabinetryUnitRate('CABINETRY-UNIT-TALL-PANTRY', finish);
    assert.ok(rate >= previous, `${finish} (${rate}) should not be cheaper than the tier below (${previous})`);
    previous = rate;
  }
}

// 6. An unknown finish, or a custom unit, yields no invented number.
{
  const unknown = getCabinetryUnitRate('CABINETRY-UNIT-STANDARD-BASE', 'Other/custom');
  assert.equal(unknown.rate, null);
  assert.equal(unknown.priceStatus, 'quote_required');

  const custom = getCabinetryUnitRate('CABINETRY-UNIT-BATH-OTHER-CUSTOM');
  assert.equal(custom.rate, null, 'a custom bathroom cabinet must always be quoted');

  const nonsense = getCabinetryUnitRate('NOT-A-REAL-PRODUCT');
  assert.equal(nonsense.rate, null);
}

// 7. Every multiplier is sane.
{
  for (const [finish, m] of Object.entries(CABINETRY_FINISH_MULTIPLIERS)) {
    assert.ok(m >= 1 && m <= 2.5, `${finish} multiplier ${m} is outside a believable range`);
  }
}

const priced = listCabinetryUnitRates().filter((r) => r.rate !== null).length;
console.log(`PASS: all ${PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS.length} cabinetry products have rate coverage (${priced} priced, ${PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS.length - priced} quote-only), and no estimate is presented as a firm price.`);
