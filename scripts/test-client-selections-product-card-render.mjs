import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { PRICE_STATES, productPriceIncludesGst } from '../lib/builders/clientSelectionWorkflow.js';
import { numberValue, roundMoney } from '../lib/builders/selectionBudget.js';

const source = fs.readFileSync('pages/modules/builders/selections-book.js', 'utf8');
const ratesStart = source.indexOf('function plumbingProductRates(');
const cardStart = source.indexOf('function PlumbingFixtureProductCard(');
const cardEnd = source.indexOf('function PlumbingAllocationModal(', cardStart);
assert.ok(ratesStart > 0 && cardStart > ratesStart && cardEnd > cardStart);
const compiled = ts.transpileModule(source.slice(ratesStart, cardEnd), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dependencies = {
  React, PRICE_STATES, productPriceIncludesGst, numberValue, roundMoney,
  priceStateForGuidedOption: product => product.priceState,
  plumbingFixtureSupplierCode: product => product.productCode,
  displayCatalogueValue: value => value || '',
  slug: value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  money: value => `$${Number(value).toFixed(2)}`,
  signedMoney: value => `${value > 0 ? '+' : ''}$${Number(value).toFixed(2)}`,
  formatPlumbingAllocations: allocations => allocations.map(item => `${item.location} x${item.quantity}`).join(', '),
  PLUMBING_FIXTURE_SUPPLIER: 'Supplier',
  QUOTE_REQUIRED_LABEL: 'Quote Required',
  GuidedMiniTotal: ({ label, value }) => React.createElement('span', null, `${label}: ${value}`),
};
const Card = new Function(...Object.keys(dependencies), `${compiled}\nreturn PlumbingFixtureProductCard;`)(...Object.values(dependencies));
const product = {
  productCode: 'TEST-BASIN', productName: 'Test basin', supplier: 'Supplier', brand: 'Test',
  imageUrl: '/test-assets/test-brick-001.svg', selectedCost: 110, allowance: 80,
  priceState: PRICE_STATES.current, gstIncluded: true,
};
const render = selectedProduct => renderToStaticMarkup(React.createElement(Card, {
  requirement: { requirementKey: 'bathroom-basin', defaultAllowance: 80 }, product: selectedProduct,
}));
const priced = render(product);
assert.match(priced, /Price each: \$110\.00/);
assert.match(priced, /Upgrade: \+\$20\.00/, 'inclusive price is compared to the ex-GST allowance');
const unknownBasis = render({ ...product, gstIncluded: undefined });
assert.match(unknownBasis, /GST basis required/);
assert.doesNotMatch(unknownBasis, /Upgrade: \+\$/);
const unpriced = render({ ...product, priceState: PRICE_STATES.pending, selectedCost: null });
assert.match(unpriced, /Price not published/);
assert.match(unpriced, /Select/);
assert.match(source, /data-testid="selection-location-setup-required"/, 'builder allocation modal has a job-location setup state');
console.log('PASS actual plumbing card renders priced, unknown-GST and price-pending branches without ReferenceErrors; no fabricated pricing or variation.');